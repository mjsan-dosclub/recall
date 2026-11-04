import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { TRANSCRIPTION_PROMPT, transcribeWithFallback } from '@/lib/transcription';

export const runtime='nodejs';
export const maxDuration=60;
const payload=z.object({
  audio:z.string().min(4).max(2_800_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  mime:z.enum(['audio/webm','audio/mp4','audio/ogg','audio/wav']),
});
const output=z.object({transcript:z.string().max(8000)});

async function googleTranscribe(input:z.infer<typeof payload>){
  const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY!});
  const result=await transcribeWithFallback((model,timeout)=>ai.models.generateContent({
    model,
    contents:[{role:'user',parts:[
      {inlineData:{data:input.audio,mimeType:input.mime==='audio/mp4'?'audio/m4a':input.mime}},
      {text:TRANSCRIPTION_PROMPT},
    ]}],
    config:{httpOptions:{timeout,retryOptions:{attempts:1}},responseMimeType:'application/json',responseJsonSchema:z.toJSONSchema(output),temperature:0,candidateCount:1,maxOutputTokens:2048},
  }),process.env.GEMINI_TRANSCRIPTION_MODEL);
  return output.parse(JSON.parse(result.text??'{}'));
}
async function openAiTranscribe(input:z.infer<typeof payload>){
  const audio=Buffer.from(input.audio,'base64');
  const upload=new FormData();
  upload.set('file',new Blob([audio],{type:input.mime}),`note.${input.mime==='audio/mp4'?'mp4':input.mime==='audio/wav'?'wav':'webm'}`);
  upload.set('model','gpt-transcribe');
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:upload});
  if(!response.ok)throw new Error(`Transcription failed (${response.status})`);
  const result=await response.json();return output.parse({transcript:result.text||''});
}
export async function POST(req:NextRequest){
  const origin=req.headers.get('origin');
  if(origin){try{if(new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'Invalid origin'},{status:403})}catch{return NextResponse.json({error:'Invalid origin'},{status:403})}}
  if(!(await currentUser()))return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!process.env.GEMINI_API_KEY&&!process.env.OPENAI_API_KEY)return NextResponse.json({error:'Transcription is not configured. You can type your note instead.'},{status:503});
  try{
    const raw=await req.text();
    if(raw.length>2_900_000)return NextResponse.json({error:'The recording is too large. Please record a shorter note.'},{status:413});
    const parsed=payload.safeParse(JSON.parse(raw));
    if(!parsed.success)return NextResponse.json({error:'Record a shorter audio clip in a supported format.'},{status:400});
    const result=process.env.GEMINI_API_KEY?await googleTranscribe(parsed.data):await openAiTranscribe(parsed.data);
    return NextResponse.json(result);
  }catch(error){
    const status=(error as {status?:number}).status;
    return NextResponse.json({error:`Transcription failed${status?` (${status})`:''}. Your recording is still saved on this device.`},{status:502});
  }
}

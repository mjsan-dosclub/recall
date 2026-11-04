import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  const origin=req.headers.get('origin');
  if(origin&&new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'Invalid origin'},{status:403});
  if(!(await currentUser()))return NextResponse.json({error:'Unauthorized'},{status:401});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'Server transcription needs an OpenAI API key. You can type your note instead.'},{status:503});
  const form=await req.formData();const audio=form.get('audio');
  if(!(audio instanceof File)||audio.size>20_000_000)return NextResponse.json({error:'Record an audio clip under 20 MB.'},{status:400});
  const language=form.get('language')==='ta'?'ta':'en';
  const upload=new FormData();upload.set('file',audio,audio.name||'note.webm');upload.set('model','gpt-transcribe');upload.append('languages[]',language);
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:upload});
  const result=await response.json();
  if(!response.ok)return NextResponse.json({error:`Transcription failed (${response.status})`},{status:502});
  return NextResponse.json({transcript:result.text||''});
}

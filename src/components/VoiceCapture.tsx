'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, UploadCloud } from 'lucide-react';
import { getLocalClip, getLatestLocalClip, saveLocalClip } from '@/lib/localAudio';
import { PcmCapture, isIosDevice } from '@/lib/pcmCapture';
import { blobBase64, transcriptionPayload } from '@/lib/transcription';

const BAR_COUNT=23;
type Props={ownerId:string;language:'en'|'ta';transcriptionConfigured:boolean;provider:string;onTranscript:(text:string)=>void;onError:(message:string)=>void};

export default function VoiceCapture({ownerId,language,transcriptionConfigured,provider,onTranscript,onError}:Props){
  const [recording,setRecording]=useState(false);
  const [working,setWorking]=useState(false);
  const [clipId,setClipId]=useState('');
  const [clipUrl,setClipUrl]=useState('');
  const [status,setStatus]=useState(transcriptionConfigured?'Tap the mic. Audio saves on this device before transcription.':'Tap the mic to save audio on this device. You can type the note below.');
  const [seconds,setSeconds]=useState(0);
  const bars=useRef<(HTMLSpanElement|null)[]>([]);
  const recorder=useRef<MediaRecorder|null>(null);
  const pcm=useRef<PcmCapture|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const context=useRef<AudioContext|null>(null);
  const frame=useRef<number>(0);
  const tick=useRef<ReturnType<typeof setInterval>|null>(null);
  const url=useRef('');
  const languageRef=useRef(language);
  const mounted=useRef(true);
  useEffect(()=>{languageRef.current=language},[language]);
  useEffect(()=>{
    mounted.current=true;
    getLatestLocalClip(ownerId).then(clip=>{
      if(!clip||clip.ownerId!==ownerId||!mounted.current)return;
      const next=URL.createObjectURL(clip.blob);url.current=next;setClipUrl(next);setClipId(clip.id);
      setStatus('Saved on this device. Play it back or transcribe it.');
    }).catch(()=>{});
    return()=>{mounted.current=false;stopMeter();pcm.current?.cancel();if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(track=>track.stop());if(url.current)URL.revokeObjectURL(url.current)};
  },[ownerId]);

  function stopMeter(){
    if(frame.current)cancelAnimationFrame(frame.current);
    if(tick.current)clearInterval(tick.current);
    tick.current=null;
    context.current?.close().catch(()=>{});context.current=null;
    bars.current.forEach(bar=>{if(bar)bar.style.height='5px'});
  }
  function startClock(){
    const started=Date.now();setSeconds(0);
    tick.current=setInterval(()=>{const elapsed=Math.floor((Date.now()-started)/1000);setSeconds(elapsed);if(elapsed>=59)void stop()},1000);
  }
  function paintPcmLevel(level:number){
    const amplitude=Math.min(1,level*12);
    for(let i=0;i<BAR_COUNT;i++){
      const motion=.45+.55*Math.abs(Math.sin(i*.71+Date.now()/170));
      if(bars.current[i])bars.current[i]!.style.height=`${Math.round(5+43*amplitude*motion)}px`;
    }
  }
  async function transcribe(id:string){
    if(!transcriptionConfigured){setStatus('Audio saved on this device. Type the note below, or configure transcription.');return}
    setWorking(true);setStatus('Transcribing your saved recording…');
    try{
      const clip=await getLocalClip(id);
      if(!clip||clip.ownerId!==ownerId)throw new Error('The local recording could not be found.');
      if(clip.blob.size>2_000_000)throw new Error('The recording is too large for transcription. Please record a shorter note.');
      const body=transcriptionPayload(await blobBase64(clip.blob),clip.blob.type);
      const response=await fetch('/api/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Transcription failed');
      if(!result.transcript?.trim())throw new Error('No speech was heard. Please try again or type the note.');
      onTranscript(result.transcript);
      setStatus(`Transcript ready via ${provider}. Listen and correct anything before saving.`);
    }catch(error){onError(error instanceof Error?error.message:String(error));setStatus('Audio remains saved on this device. You can retry transcription.');}
    finally{setWorking(false)}
  }
  async function saveAndTranscribe(blob:Blob){
    setRecording(false);setWorking(true);setStatus('Saving the recording on this device…');
    try{
      if(!blob.size)throw new Error('No audio was captured. Please try again.');
      const id=crypto.randomUUID();
      await saveLocalClip({id,ownerId,blob,recordedAt:new Date().toISOString(),language:languageRef.current});
      if(!mounted.current)return;
      if(url.current)URL.revokeObjectURL(url.current);
      const next=URL.createObjectURL(blob);url.current=next;setClipUrl(next);setClipId(id);
      setStatus('Saved on this device.');setWorking(false);
      await transcribe(id);
    }catch(error){if(mounted.current){onError(error instanceof Error?error.message:String(error));setStatus('Recording could not be saved. Please try again.');setWorking(false)}}
  }
  async function start(){
    const ios=isIosDevice(navigator.userAgent,navigator.platform,navigator.maxTouchPoints);
    if(!navigator.mediaDevices?.getUserMedia||(!ios&&typeof MediaRecorder==='undefined')){onError('Audio recording is unavailable in this browser.');return}
    try{
      if(ios){
        const capture=new PcmCapture({onError:message=>{onError(message);setRecording(false);setWorking(false);stopMeter()},onLevel:paintPcmLevel,onLimit:()=>{void stop()}});
        pcm.current=capture;
        if(!await capture.start())return;
        setRecording(true);setStatus('Recording now. Tap the stop square when finished.');startClock();return;
      }
      const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:{ideal:1},echoCancellation:true,noiseSuppression:true}});
      stream.current=media;
      const chunks:Blob[]=[];
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type))||'';
      const nextRecorder=new MediaRecorder(media,{...(mime?{mimeType:mime}:{}),audioBitsPerSecond:64000});
      recorder.current=nextRecorder;
      nextRecorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);if(chunks.reduce((total,part)=>total+part.size,0)>1_850_000&&nextRecorder.state==='recording')nextRecorder.stop()};
      nextRecorder.onstop=async()=>{stopMeter();media.getTracks().forEach(track=>track.stop());recorder.current=null;const blob=new Blob(chunks,{type:nextRecorder.mimeType||'audio/webm'});await saveAndTranscribe(blob)};
      nextRecorder.onerror=()=>{stopMeter();media.getTracks().forEach(track=>track.stop());onError('Could not record audio. Please retry or type the note.');setRecording(false);setWorking(false)};
      const audioContext=new AudioContext();context.current=audioContext;
      const source=audioContext.createMediaStreamSource(media);
      const analyser=audioContext.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.66;source.connect(analyser);
      const values=new Uint8Array(analyser.frequencyBinCount);
      const animate=()=>{analyser.getByteFrequencyData(values);for(let i=0;i<BAR_COUNT;i++){const low=Math.floor(i*values.length/BAR_COUNT);const high=Math.max(low+1,Math.floor((i+1)*values.length/BAR_COUNT));let sum=0;for(let n=low;n<high;n++)sum+=values[n];const level=sum/(high-low)/255;const height=Math.max(5,Math.min(48,5+Math.pow(level,1.15)*95));if(bars.current[i])bars.current[i]!.style.height=`${height}px`}frame.current=requestAnimationFrame(animate)};
      nextRecorder.start(1000);setRecording(true);setStatus('Recording now. Tap the stop square when finished.');startClock();animate();
    }catch(error){pcm.current?.cancel();pcm.current=null;stream.current?.getTracks().forEach(track=>track.stop());stopMeter();onError(error instanceof Error?error.message:String(error));setStatus('Microphone access was not available.');setWorking(false)}
  }
  async function stop(){
    if(pcm.current){const capture=pcm.current;pcm.current=null;setWorking(true);setRecording(false);setStatus('Finishing recording…');stopMeter();const blob=await capture.stop();if(blob)await saveAndTranscribe(blob);else{onError('No speech was heard. Please try again or type the note.');setWorking(false)}return}
    if(recorder.current?.state==='recording'){recorder.current.stop();setStatus('Finishing recording…');stopMeter();setWorking(true)}
  }
  return <div className={`capture-card voice-capture ${recording?'is-recording':''}`}>
    <button className={`mic-button ${recording?'recording':''}`} onClick={recording?stop:start} disabled={working} aria-label={recording?'Stop recording':'Start recording'}>{recording?<Square size={27} fill="currentColor"/>:<Mic size={31}/>}</button>
    <strong>{recording?`Recording · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:working?'Processing your recording…':'Record a voice note'}</strong>
    <span role="status">{status}</span>
    <div className="live-wave" aria-label={recording?'Live microphone level':'Microphone is idle'}>{Array.from({length:BAR_COUNT},(_,i)=><span key={i} ref={element=>{bars.current[i]=element}}/>)}</div>
    {transcriptionConfigured&&<small className="voice-provider">Saved locally first · Sent to {provider} for transcription</small>}{clipUrl&&<div className="local-clip"><audio controls src={clipUrl} aria-label="Saved voice note"/><small>Saved in this browser for your account · {clipId.slice(0,8)}</small>{transcriptionConfigured&&<button onClick={()=>transcribe(clipId)} disabled={working||recording}><UploadCloud size={15}/> Retry transcription</button>}</div>}
  </div>;
}

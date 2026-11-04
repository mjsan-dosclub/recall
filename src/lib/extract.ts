import * as chrono from 'chrono-node';
import { DateTime } from 'luxon';

export type DraftAction = { kind: 'follow_up'|'reminder'|'meeting'; title: string; dueAt: string | null; timeSpecified?: boolean; durationMinutes?: number };
export type Extraction = { contactName: string; summary: string; actions: DraftAction[]; mode: 'AI'|'Local rules' };
const zone='Asia/Kolkata';
export function parseIST(phrase: string, now=new Date()): string | null {
  const lower=phrase.toLowerCase();
  const base=DateTime.fromJSDate(now,{zone});
  const days=lower.match(/\bin\s+(\d+)\s+days?\b/);
  let d: DateTime | null=null;
  if(days) d=base.plus({days:Number(days[1])});
  else if(/\bday after tomorrow\b/.test(lower)) d=base.plus({days:2});
  else if(/\btomorrow\b/.test(lower)) d=base.plus({days:1});
  else if(/\btoday\b/.test(lower)) d=base;
  if(d) {
    const time=lower.match(/\b(?:at|around|by)\s+(\d{1,2})(?::(\d\d))?\s*(am|pm)?\b/);
    let hour=9, minute=0;
    if(/afternoon/.test(lower)) hour=15;
    if(/evening/.test(lower)) hour=18;
    if(/morning/.test(lower)) hour=9;
    if(time) { hour=Number(time[1])%12+(time[3]==='pm'?12:time[3]==='am'?0:(Number(time[1])<8?12:0)); minute=Number(time[2]||0); }
    return d.set({hour,minute,second:0,millisecond:0}).toUTC().toISO();
  }
  const reference=new Date(base.year,base.month-1,base.day,base.hour,base.minute);
  const result=chrono.parse(phrase,reference,{forwardDate:true})[0];
  if(!result) return null;
  const c=result.start;
  return DateTime.fromObject({year:c.get('year')||base.year,month:c.get('month')||base.month,day:c.get('day')||base.day,hour:c.isCertain('hour')?(c.get('hour')??9):9,minute:c.isCertain('minute')?(c.get('minute')??0):0},{zone}).toUTC().toISO();
}
export function localExtract(transcript: string): Extraction {
  const clean=transcript.trim();
  const match=clean.match(/\b(?:spoke (?:to|with)|talked (?:to|with)|met (?:with)?|called|call|meeting with|follow up with|about)\s+([A-Z][\p{L}'-]*(?:\s+[A-Z][\p{L}'-]*)?)/iu);
  const contactName=match?.[1]?.replace(/[.,;!?]+$/,'').replace(/\s+(today|tomorrow|about|and|yesterday)$/i,'').trim() || '';
  const segments=clean.split(/(?:[.;]|\s+and\s+(?=(?:call|follow|remind|meet|schedule|reschedule|send|check)\b))/i).map(s=>s.trim()).filter(Boolean);
  const actions: DraftAction[]=[];
  for(const segment of segments) {
    const kind=/\b(meet|meeting|schedule|reschedule)\b/i.test(segment)?'meeting':/\b(remind|reminder)\b/i.test(segment)?'reminder':/\b(follow up|call|send|check back|reach out)\b/i.test(segment)?'follow_up':null;
    if(!kind) continue;
    if(/\b(?:spoke|talked|called|met)\b/i.test(segment) && !/\b(?:need to|should|will|please|next|again|tomorrow|today|in \d+ days?|at \d|on \w+day)\b/i.test(segment)) continue;
    actions.push({kind,title:segment.charAt(0).toUpperCase()+segment.slice(1),dueAt:parseIST(segment)});
  }
  return {contactName,summary:clean,actions,mode:'Local rules'};
}
export async function extract(transcript: string): Promise<Extraction> {
  if(!process.env.OPENAI_API_KEY) return localExtract(transcript);
  const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',response_format:{type:'json_object'},messages:[{role:'system',content:`Extract a contact interaction. Return JSON with contactName, summary, actions array. Each action: kind one of follow_up, reminder, meeting; title; dueAt ISO UTC string or null. Interpret relative dates in Asia/Kolkata. Current IST: ${DateTime.now().setZone(zone).toISO()}. Include all distinct future actions. Do not invent dates.`},{role:'user',content:transcript}]})});
  if(!response.ok) throw new Error(`AI request failed (${response.status})`);
  const data=await response.json();
  const parsed=JSON.parse(data.choices?.[0]?.message?.content||'{}');
  return {contactName:String(parsed.contactName||''),summary:String(parsed.summary||transcript),actions:Array.isArray(parsed.actions)?parsed.actions.map((a:DraftAction)=>({kind:['follow_up','reminder','meeting'].includes(a.kind)?a.kind:'follow_up',title:String(a.title||'Follow up'),dueAt:a.dueAt&&DateTime.fromISO(a.dueAt).isValid?a.dueAt:null})):[],mode:'AI'};
}

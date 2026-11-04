'use client';
import { useState } from 'react';
import { DateTime } from 'luxon';
import { ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Mic, Plus, Settings2, Sparkles, Users } from 'lucide-react';

export type SalesAction={id:string;contactId:string;contactName:string;kind:'follow_up'|'reminder'|'meeting';title:string;dueAt:string|null;durationMinutes?:number;status:string;createdAt:string};
export type SalesContact={id:string;name:string};
const zone='Asia/Kolkata';
const today=()=>DateTime.now().setZone(zone).startOf('day');
const dayKey=(iso:string)=>DateTime.fromISO(iso).setZone(zone).toISODate()||'';
const time=(iso:string)=>DateTime.fromISO(iso).setZone(zone).toFormat('h:mm a');
const label=(kind:string)=>kind==='meeting'?'Meeting':kind==='reminder'?'Reminder':'Follow-up';

export function SalesActionCard({action,onContact,onComplete,featured=false}:{action:SalesAction;onContact:(id:string)=>void;onComplete:(id:string)=>void;featured?:boolean}){
  return <article className={`sales-task-card ${featured?'featured':''} ${action.kind}`}>
    <div className="sales-task-top"><span className="sales-task-kind">{label(action.kind)}</span><span className="sales-task-time">{action.dueAt?time(action.dueAt):'Any time'} IST</span></div>
    <h3>{action.title}</h3><p>With {action.contactName}</p>
    <div className="sales-task-bottom"><button onClick={()=>onContact(action.contactId)}>View conversation <ArrowRight size={15}/></button><button className="sales-task-done" onClick={()=>onComplete(action.id)} aria-label={`Complete ${action.title}`}><Check size={18}/></button></div>
  </article>;
}

export function MonthlyCalendar({actions,onContact,onComplete,compact=false}:{actions:SalesAction[];onContact:(id:string)=>void;onComplete:(id:string)=>void;compact?:boolean}){
  const [month,setMonth]=useState(today().startOf('month'));
  const [selected,setSelected]=useState(today().toISODate()||'');
  const first=month.startOf('month');const blanks=first.weekday-1;
  const dates=Array.from({length:blanks+month.daysInMonth!},(_,i)=>i<blanks?null:first.plus({days:i-blanks}));
  const counts=new Map<string,number>();
  for(const action of actions)if(action.status==='pending'&&action.dueAt){const key=dayKey(action.dueAt);counts.set(key,(counts.get(key)||0)+1)}
  const selectedActions=actions.filter(a=>a.status==='pending'&&a.dueAt&&dayKey(a.dueAt)===selected);
  return <section className={`sales-calendar ${compact?'compact':''}`}><div className="sales-section-head"><div><span className="sales-overline">PLAN AHEAD</span><h2>{compact?'Your calendar':'Monthly calendar'}</h2></div><div className="sales-month-controls"><button onClick={()=>setMonth(month.minus({months:1}))} aria-label="Previous month"><ChevronLeft size={19}/></button><strong>{month.toFormat('LLLL yyyy')}</strong><button onClick={()=>setMonth(month.plus({months:1}))} aria-label="Next month"><ChevronRight size={19}/></button></div></div><div className="sales-weekdays">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=><span key={x}>{x}</span>)}</div><div className="sales-days">{dates.map((d,i)=>d?<button key={d.toISODate()} className={`${d.toISODate()===selected?'selected':''} ${d.toISODate()===today().toISODate()?'today':''}`} onClick={()=>setSelected(d.toISODate()||'')}><span>{d.day}</span>{counts.get(d.toISODate()||'')?<i/>:null}</button>:<span key={`blank-${i}`}/>)}</div><div className="sales-calendar-agenda"><strong>{DateTime.fromISO(selected,{zone}).toFormat('cccc, d LLLL')}</strong><span>{selectedActions.length} {selectedActions.length===1?'action':'actions'}</span></div>{selectedActions.length?<div className="sales-calendar-tasks">{selectedActions.map(a=><SalesActionCard key={a.id} action={a} onContact={onContact} onComplete={onComplete}/>)}</div>:<p className="sales-calendar-empty">No actions planned for this day.</p>}</section>;
}

export default function SalesDashboard({name,actions,contacts,onCapture,onManual,onContact,onComplete,onSettings,onCalendar,onAsk}:{name:string;actions:SalesAction[];contacts:SalesContact[];onCapture:()=>void;onManual:()=>void;onContact:(id:string)=>void;onComplete:(id:string)=>void;onSettings:()=>void;onCalendar:()=>void;onAsk:()=>void}){
  const now=today();const key=now.toISODate();
  const pending=actions.filter(a=>a.status==='pending');
  const due=pending.filter(a=>a.dueAt&&dayKey(a.dueAt)===key);
  const overdue=pending.filter(a=>a.dueAt&&dayKey(a.dueAt)<key!);
  const upcoming=pending.filter(a=>a.dueAt&&dayKey(a.dueAt)>key!);
  const completed=actions.filter(a=>a.status==='done').length;
  const greeting=DateTime.now().setZone(zone).hour<12?'Good morning':DateTime.now().setZone(zone).hour<17?'Good afternoon':'Good evening';
  return <div className="sales-dashboard"><div className="sales-welcome"><div><h1>{greeting},<br/><span>{name.split(' ')[0]}.</span></h1><p>Your conversations are here when you need them.</p></div><button className="sales-settings-shortcut" onClick={onSettings} aria-label="Reminder settings"><Settings2 size={21}/></button></div>
    <div className="sales-voice-banner"><div className="sales-voice-glow"/><div><span>YOUR POCKET MEMORY</span><h2>A quick note now.<br/>A clear tomorrow.</h2><p>Say what happened. We’ll keep the next step ready.</p><div className="sales-voice-actions"><button onClick={onCapture}><Mic size={18}/> Record a conversation <ArrowRight size={16}/></button><button onClick={onManual}><Plus size={17}/> Add manually</button></div></div><div className="sales-voice-circle"><Mic size={31}/></div></div>
    <div className="sales-metrics"><div className="sales-metric highlighted"><span>Today</span><strong>{due.length}</strong><Clock3 size={20}/></div><div className="sales-metric"><span>Overdue</span><strong>{overdue.length}</strong><Bell size={20}/></div><div className="sales-metric"><span>Upcoming</span><strong>{upcoming.length}</strong><CalendarDays size={20}/></div><div className="sales-metric"><span>Done</span><strong>{completed}</strong><Check size={20}/></div></div>
    <section className="sales-today"><div className="sales-section-head"><div><span className="sales-overline">STAY ON TOP OF IT</span><h2>Today’s actions <span>{due.length}</span></h2></div><div className="sales-section-actions"><button onClick={onManual}><Plus size={15}/> Add action</button><button onClick={onCalendar}>View calendar <ArrowRight size={15}/></button></div></div>{due.length?<div className="sales-today-grid">{due.map((a,i)=><SalesActionCard key={a.id} action={a} onContact={onContact} onComplete={onComplete} featured={i===0}/>)}</div>:<div className="sales-today-empty"><div><span className="sales-empty-icon"><Sparkles size={23}/></span><h3>Nothing due today.</h3><p>You have time to meet your next prospect.</p></div><button onClick={onManual}><Plus size={18}/> Add an action</button></div>}</section>
    {overdue.length>0&&<section className="sales-overdue"><div className="sales-section-head"><div><span className="sales-overline">NEEDS A LOOK</span><h2>Overdue <span>{overdue.length}</span></h2></div></div><div className="sales-today-grid">{overdue.map(a=><SalesActionCard key={a.id} action={a} onContact={onContact} onComplete={onComplete}/>)}</div></section>}
    <div className="sales-lower"><MonthlyCalendar actions={actions} onContact={onContact} onComplete={onComplete} compact/><div className="sales-side-panel"><div className="sales-section-head"><div><span className="sales-overline">YOUR RELATIONSHIPS</span><h2>People to remember</h2></div><Users size={19}/></div><strong>{contacts.length}</strong><p>Every conversation stays with the right person.</p><button onClick={onAsk}><Sparkles size={16}/> Ask about a conversation <ArrowRight size={15}/></button></div></div>
  </div>;
}

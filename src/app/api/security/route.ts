import { NextResponse } from 'next/server';
import { abuseEnabled, securityResponse } from '@/lib/abuse';
export const dynamic='force-dynamic';
export function GET(){
  try{return NextResponse.json({captchaRequired:abuseEnabled(),siteKey:abuseEnabled()?process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY||null:null},{headers:{'Cache-Control':'no-store'}});}
  catch(error){return securityResponse(error)||NextResponse.json({error:'Security checks unavailable.'},{status:503});}
}

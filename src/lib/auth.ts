import { cookies } from 'next/headers';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { row, run } from './db';

export type User = { id: string; email: string; name: string };
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function passwordHash(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function passwordValid(password: string, stored: string) { const [salt,hash] = stored.split(':'); if (!salt || !hash) return false; const a=Buffer.from(hash,'hex'); const b=scryptSync(password,salt,a.length); return timingSafeEqual(a,b); }
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get('recall_session')?.value;
  if (!token) return null;
  return row<User>(`SELECT users.id,users.email,users.name FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?`,hashToken(token),new Date().toISOString()) || null;
}
export async function setSession(userId: string) {
  const token=randomBytes(32).toString('hex');
  const expires=new Date(Date.now()+30*86400000);
  run('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',hashToken(token),userId,expires.toISOString());
  (await cookies()).set('recall_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',expires});
}
export async function clearSession() {
  const token=(await cookies()).get('recall_session')?.value;
  if(token) run('DELETE FROM sessions WHERE token_hash=?',hashToken(token));
  (await cookies()).delete('recall_session');
}

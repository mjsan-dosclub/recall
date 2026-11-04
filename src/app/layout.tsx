import type { Metadata, Viewport } from 'next';
import './globals.css';
import './sales.css';
export const metadata:Metadata={title:'Recall — Voice Follow Up',description:'Your conversations, next steps and reminders in one calm place.',manifest:'/manifest.webmanifest',icons:{icon:'/icon-192.png',apple:'/apple-touch-icon.png'},appleWebApp:{capable:true,statusBarStyle:'default',title:'Recall'}};
export const viewport:Viewport={themeColor:'#1d423a',width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}

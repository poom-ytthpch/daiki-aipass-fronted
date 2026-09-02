import type { Metadata } from 'next';import './globals.css';import {AppShell} from '@/components/AppShell';
export const metadata:Metadata={title:'Daiki AI Passport',description:'Private AI gateway and local LLM workspace'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="th"><body><AppShell>{children}</AppShell></body></html>}

'use client';
// Always-mounted helper for the chat area: scheduled messages, disappearing-message sweep, the demo
// "Ananya" message 20 s after start (js/main.js), screenshot alerts and secret-chat hiding (js/privacy.js).
import { useEffect } from 'react';
import { chatById } from '@/lib/util';
import { simulateIncoming } from '@/lib/actions';
import { runScheduled, sweepExpired, screenshotDetected, curChat } from './core';

export function ChatTimers() {
  useEffect(() => {
    const a = setInterval(runScheduled, 2000);
    const b = setInterval(sweepExpired, 3000);
    runScheduled();
    // A little life: a new message arrives shortly after opening the demo
    const c = setTimeout(() => { const ch = chatById('ch_ananya'); if (ch) simulateIncoming(ch, 'c_ananya', 'btw did you see the new WHATSMORE logo drafts? 😍', 0); }, 20000);
    // Best-effort screenshot detection: browsers only see some OS shortcuts
    const up = (e: KeyboardEvent) => { if (e.key === 'PrintScreen') screenshotDetected(); };
    const down = (e: KeyboardEvent) => { if (e.metaKey && e.shiftKey && ['3', '4', '5', '#', '$', '%'].includes(e.key)) screenshotDetected(); };
    // Secret chats hide their content when the window loses focus (app switcher / screen recording)
    const secretBlur = (on: boolean) => { document.getElementById('main')?.classList.toggle('secret-hide', !!(on && curChat()?.secret)); };
    const blur = () => secretBlur(true), focus = () => secretBlur(false), vis = () => secretBlur(document.hidden);
    document.addEventListener('keyup', up);
    document.addEventListener('keydown', down);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(a); clearInterval(b); clearTimeout(c);
      document.removeEventListener('keyup', up); document.removeEventListener('keydown', down);
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return null;
}

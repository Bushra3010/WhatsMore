'use client';
// Live layer entry: real accounts, live chats (Supabase Postgres + Realtime + Storage), real WebRTC
// calls, real stories and moderation. Each module registers itself on import; LiveRoot starts the
// session and the browser listeners once the app state has loaded.
import { useEffect } from 'react';
import { ui } from '@/lib/state';
import { chatById } from '@/lib/util';
import { overlays } from '@/lib/registry';
import { cloudOn, cloudSync, markRead, sendTyping } from './core';
import './send';
import { startAccounts } from './account';
import './rtc';
import './stories';
import './moderation';

function LiveRoot() {
  useEffect(() => {
    startAccounts();
    const onFocus = () => { if (cloudOn()) cloudSync(); };
    const onVis = () => { if (ui.active?.startsWith('sb_')) markRead(chatById(ui.active)); };
    const onInput = (e: Event) => {
      const t = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (t?.id === 'input' && t.value.trim()) sendTyping();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('input', onInput);
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis); document.removeEventListener('input', onInput); };
  }, []);
  return null;
}
overlays.live = LiveRoot;

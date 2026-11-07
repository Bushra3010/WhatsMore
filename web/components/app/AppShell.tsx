'use client';
// The WHATSMORE app shell: rail | sidebar | main | drawer, plus overlays. Feature areas register their
// screens in lib/registry (each area's index.tsx is imported below for its side effects).
import { useEffect, useState } from 'react';
import { S, ui, load, refresh, useRender, KEY, replaceState } from '@/lib/state';
import { tabs, pages, views, mains, drawers, overlays } from '@/lib/registry';
import { chatById } from '@/lib/util';
import { OverlayHost, closeMenu, toast } from '@/lib/overlay';
import { settingHooks } from '@/components/ui/Bits';
import { Rail } from './Rail';
import { EmptyMain } from './EmptyMain';
// feature areas (order matters only where an area extends another's hooks)
import '@/components/chats';
import '@/components/sidebar';
import '@/components/settings';
import '@/components/modules';
import '@/components/media';
import '@/components/docs';
import '@/features/live';
import { isNativeApp } from '@/features/native';

export function applyTheme() {
  const t = S.settings.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#172133' : '#0b3d91');
}
settingHooks.push((path) => { if (path === 'theme') applyTheme(); });

export default function AppShell() {
  const [ready, setReady] = useState(false);
  useRender();
  useEffect(() => {
    load();
    applyTheme();
    // one-time client start-up: the saved state is only readable in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', applyTheme);
    const onResize = () => closeMenu();
    window.addEventListener('resize', onResize);
    // Another tab of this app = another linked device: pick up its changes live.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try { replaceState(JSON.parse(e.newValue)); } catch { return; }
      if (ui.active && !chatById(ui.active)) ui.active = null;
      refresh();
    };
    window.addEventListener('storage', onStorage);
    try {
      if (!sessionStorage.getItem('wm-welcome')) {
        sessionStorage.setItem('wm-welcome', '1');
        const where = isNativeApp() ? 'on this phone' : 'in your browser';
        setTimeout(() => toast(`👋 Welcome to the WHATSMORE demo — everything runs locally ${where}.`, null, { ms: 5000 }), 600);
      }
    } catch { /* storage unavailable */ }
    return () => { mq.removeEventListener?.('change', applyTheme); window.removeEventListener('resize', onResize); window.removeEventListener('storage', onStorage); };
  }, []);
  if (!ready) return <div className="app-loading" aria-busy="true" />;

  const Side = (ui.page && pages[ui.page]) || tabs[ui.tab] || tabs.chats;
  const ch = chatById(ui.active);
  const View = ui.view ? views[ui.view] : undefined;
  const Main = ch ? mains.__chat : View || mains[ui.tab];
  const Drawer = ui.drawer && ch ? drawers[ui.drawer] : undefined;
  return (
    <>
      <div id="app" className={`app ${ch || View ? 'chat-open' : ''} ${Drawer ? 'drawer-open' : ''}`}>
        <Rail />
        <aside id="sidebar" className="sidebar">{Side ? <Side /> : null}</aside>
        <main id="main" className="main">{Main ? <Main /> : <EmptyMain />}</main>
        <aside id="drawer" className={`drawer ${Drawer ? 'open' : ''}`}>{Drawer ? <Drawer /> : null}</aside>
      </div>
      <div id="overlay-root">
        {Object.entries(overlays).map(([k, O]) => <O key={k} />)}
        <OverlayHost />
      </div>
    </>
  );
}

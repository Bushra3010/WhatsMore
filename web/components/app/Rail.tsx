'use client';
import { useEffect, useState } from 'react';
import { S, ui } from '@/lib/state';
import { goTab } from '@/lib/nav';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui/Avatar';

// Mobile bottom bar follows the blueprint: Home | Chats | AI | Services | Profile. The rest live on Home.
const TABS: [string, string, string, boolean?][] = [['home', 'home', 'Home'], ['chats', 'chat', 'Chats'], ['status', 'status', 'Status', true], ['calls', 'call', 'Calls', true], ['communities', 'groups', 'Communities', true], ['files', 'cloud', 'Files', true], ['ai', 'sparkle', 'AI'], ['services', 'apps', 'Services']];
/** Run when a tab opens (e.g. the AI tab opens its main view). */
export const onTabOpen: ((tab: string) => void)[] = [];
export function openTab(tab: string) { goTab(tab); onTabOpen.forEach((f) => f(tab)); }

export function Rail() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const f = () => setNarrow(innerWidth <= 760); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  const unread = S.chats.filter((c) => (c.unread || 0) > 0 && !c.archived && !c.locked).length;
  const newStatus = S.statuses.some((s) => !s.viewed);
  const btn = (id: string, ic: string, label: string, desk?: boolean) => (
    <button key={id} className={`rail-btn ${ui.tab === id ? 'active' : ''} ${desk ? 'desk-only' : ''}`} data-act="tab" data-tab={id} title={label} aria-label={label} onClick={() => openTab(id)}>
      <span className="rail-ic"><Icon name={ic} /></span>
      {id === 'chats' && unread ? <span className="rail-badge">{unread}</span> : null}
      {id === 'status' && newStatus ? <span className="rail-dot" /> : null}
      <span className="rail-label">{label}</span>
    </button>
  );
  return (
    <nav id="rail" className="rail" aria-label="Main navigation">
      <div className="rail-top">{TABS.map(([id, ic, label, desk]) => btn(id, ic, label, desk))}</div>
      <div className="rail-bottom">
        {btn('settings', 'settings', narrow ? 'Profile' : 'Settings')}
        <button className="rail-me" data-act="tab" data-tab="settings" title="Profile" aria-label="Profile" onClick={() => openTab('settings')}><Avatar o={S.me} size={32} /></button>
      </div>
    </nav>
  );
}

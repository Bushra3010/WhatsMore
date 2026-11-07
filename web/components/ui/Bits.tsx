'use client';
// Small shared building blocks used by every area (ported from sidebar.js / settings.js / modules.js helpers).
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { S, commit, ui, refresh } from '@/lib/state';
import { back, openPage, closeView } from '@/lib/nav';

export const getPath = (o: Record<string, unknown>, p: string): unknown => p.split('.').reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o);
export function setPath(o: Record<string, unknown>, p: string, v: unknown) {
  const ks = p.split('.'); const last = ks.pop()!;
  const target = ks.reduce<Record<string, unknown>>((a, k) => (a[k] ??= {}) as Record<string, unknown>, o);
  target[last] = v;
}
/** Hooks run after a setting changes (theme, toasts…): (path, value) => void. */
export const settingHooks: ((path: string, v: unknown) => void)[] = [];
export function setSetting(path: string, v: unknown) {
  setPath(S.settings as Record<string, unknown>, path, v);
  commit();
  settingHooks.forEach((h) => h(path, v));
}

/** Sidebar page header with a back button. */
export function PageHead({ title, extra, onBack }: { title: string; extra?: ReactNode; onBack?: () => void }) {
  return (
    <header className="side-head page">
      <button className="icon-btn" aria-label="Back" data-act="back" onClick={onBack || back}><Icon name="back" /></button>
      <h2>{title}</h2>{extra}
    </header>
  );
}

export function SearchBox({ id, ph, value, onChange }: { id: string; ph: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="search">
      <span className="search-ic"><Icon name="search" size={20} /></span>
      <input id={id} type="search" placeholder={ph} value={value} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
      <button className="icon-btn sm search-clear" aria-label="Clear search" data-act="clearsearch" onClick={() => onChange('')}><Icon name="close" size={18} /></button>
    </div>
  );
}

/** Toggle bound to a path in S.settings (toggleRow). */
export function ToggleRow({ path, label, sub }: { path: string; label: ReactNode; sub?: ReactNode }) {
  return (
    <label className="set-row">
      <div><div className="ci-name">{label}</div>{sub ? <div className="ci-sub">{sub}</div> : null}</div>
      <input type="checkbox" className="switch" data-setting={path} checked={!!getPath(S.settings as Record<string, unknown>, path)} onChange={(e) => setSetting(path, e.target.checked)} />
    </label>
  );
}
/** Select bound to a path in S.settings (selectRow). Numeric option values stay numbers. */
export function SelectRow({ path, label, opts, sub }: { path: string; label: ReactNode; opts: [string | number, string][]; sub?: ReactNode }) {
  const cur = getPath(S.settings as Record<string, unknown>, path);
  return (
    <label className="set-row">
      <div><div className="ci-name">{label}</div>{sub ? <div className="ci-sub">{sub}</div> : null}</div>
      <select data-setting={path} value={String(cur ?? '')} onChange={(e) => { const o = opts.find(([v]) => String(v) === e.target.value); setSetting(path, o ? o[0] : e.target.value); }}>
        {opts.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
      </select>
    </label>
  );
}
/** Row that opens a sidebar page (settingRow). */
export function SettingRow({ page, ic, title, sub }: { page: string; ic: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="list-row action" data-act="page" data-page={page} role="button" tabIndex={0} onClick={() => openPage(page)} onKeyDown={(e) => { if (e.key === 'Enter') openPage(page); }}>
      <span className="action-ic plain"><Icon name={ic} size={22} /></span>
      <div className="grow"><div className="ci-name">{title}</div>{sub ? <div className="ci-sub">{sub}</div> : null}</div>
      <Icon name="chevright" size={20} cls="muted" />
    </div>
  );
}
/** Hint box with an icon (note()/hint-box). */
export function Note({ ic = 'info', children, flat = true }: { ic?: string; children: ReactNode; flat?: boolean }) {
  return <div className={`hint-box ${flat ? 'flat' : ''}`}><Icon name={ic} size={16} /><span>{children}</span></div>;
}
/** Section card inside module views (sec()). */
export function Sec({ title, children, extra }: { title: ReactNode; children: ReactNode; extra?: ReactNode }) {
  return <section className="vsec"><div className="vsec-head"><h3>{title}</h3>{extra}</div>{children}</section>;
}
/** KPI tile (kpi()). */
export function Kpi({ label, value, delta, id }: { label: ReactNode; value: ReactNode; delta?: string; id?: string }) {
  return <div className="kpi"><span>{label}</span><b id={id}>{value}</b>{delta ? <small className={delta.startsWith('-') ? 'down' : 'up'}>{delta}</small> : null}</div>;
}
/** Main-area view header (viewHead()). */
export function ViewHead({ title, sub, ic, color, onClose }: { title: string; sub?: string; ic: string; color: string; onClose?: () => void }) {
  const close = onClose || closeView;
  return (
    <header className="chat-head view-head">
      <button className="icon-btn back-btn" aria-label="Back" data-act="closeview" onClick={close}><Icon name="back" /></button>
      <span className="mod-ic" style={{ background: color }}><Icon name={ic} size={22} /></span>
      <div className="chat-head-text grow"><div className="chat-head-name">{title}</div>{sub ? <div className="chat-head-sub">{sub}</div> : null}</div>
      <button className="icon-btn desk-close" aria-label="Close" data-act="closeview" onClick={close}><Icon name="close" /></button>
    </header>
  );
}
export const markDirty = () => { refresh(); };
export { ui };

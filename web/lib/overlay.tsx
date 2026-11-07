'use client';
// Modals, pop-up menus and toasts. Same calling style as the original app:
//   modal({ title, body, actions: [{ label, primary, onClick: (root) => false | void }] })
//   showMenu(anchorElementOrPoint, [{ label, icon, onClick }], opts)
//   toast('Saved'), confirmModal(title, text, label, fn)
// `body` is a React node. Action handlers receive the dialog element so forms can read their inputs
// (uncontrolled inputs with ids); returning false keeps the dialog open.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { create } from 'zustand';
import { Icon } from '@/components/Icon';

export interface ModalAction { label: string; primary?: boolean; danger?: boolean; onClick?: (root: HTMLDivElement) => boolean | void | Promise<unknown> }
export interface ModalOpts { title: string; body: ReactNode; actions?: (ModalAction | false | null | undefined)[]; wide?: boolean; cls?: string; onClose?: () => void; onMount?: (root: HTMLDivElement, close: () => void) => void }
export interface MenuItem { label: string; icon?: string; color?: string; danger?: boolean; onClick: () => void }
export interface MenuOpts { cls?: string; header?: ReactNode; alignLeft?: boolean; above?: boolean; onReact?: (emoji: string) => void }
interface ModalEntry extends ModalOpts { id: number }
interface ToastEntry { id: number; text: ReactNode; onClick?: () => void; ms: number; out?: boolean }
type Anchor = Element | { x: number; y: number };
interface MenuEntry { anchor: { left: number; right: number; top: number; bottom: number }; items: (MenuItem | '-')[]; opts: MenuOpts }

const useOverlay = create<{ modals: ModalEntry[]; toasts: ToastEntry[]; menu: MenuEntry | null }>(() => ({ modals: [], toasts: [], menu: null }));
let seq = 0;

export function modal(opts: ModalOpts) {
  const id = ++seq;
  useOverlay.setState((s) => ({ modals: [...s.modals, { ...opts, id }] }));
  const close = () => closeModal(id);
  return { id, close };
}
export function closeModal(id?: number) {
  const s = useOverlay.getState();
  const target = id == null ? s.modals[s.modals.length - 1] : s.modals.find((m) => m.id === id);
  if (!target) return;
  useOverlay.setState({ modals: s.modals.filter((m) => m !== target) });
  target.onClose?.();
}
export const closeAllModals = () => { useOverlay.getState().modals.slice().reverse().forEach((m) => closeModal(m.id)); };
export const modalOpen = () => useOverlay.getState().modals.length > 0;

export function confirmModal(title: string, text: string, label: string, fn: () => void, danger = true) {
  modal({ title, body: <p className="muted">{text}</p>, actions: [{ label: 'Cancel' }, { label, primary: !danger, danger, onClick: () => { fn(); } }] });
}

export function toast(text: ReactNode, onClick?: (() => void) | null, opts: { ms?: number } = {}) {
  const id = ++seq, ms = opts.ms || 3200;
  useOverlay.setState((s) => ({ toasts: [...s.toasts, { id, text, onClick: onClick || undefined, ms }] }));
  setTimeout(() => {
    useOverlay.setState((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, out: true } : t)) }));
    setTimeout(() => useOverlay.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 300);
  }, ms);
}
export function copyText(t: string) {
  (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject())
    .then(() => toast('Copied to clipboard')).catch(() => toast('Could not copy'));
}

export function showMenu(pos: Anchor, items: (MenuItem | '-' | false | null | undefined)[], opts: MenuOpts = {}) {
  const r = 'getBoundingClientRect' in pos ? pos.getBoundingClientRect() : { left: pos.x, right: pos.x, top: pos.y, bottom: pos.y };
  useOverlay.setState({ menu: { anchor: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, items: items.filter(Boolean) as (MenuItem | '-')[], opts } });
}
export const closeMenu = () => useOverlay.setState({ menu: null });

// ---------- hosts
function ModalView({ m }: { m: ModalEntry }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = () => closeModal(m.id);
  useEffect(() => {
    const root = ref.current!;
    m.onMount?.(root, close);
    const f = root.querySelector<HTMLElement>('[autofocus]') || root.querySelector<HTMLElement>('input, textarea');
    const t = setTimeout(() => f?.focus(), 30);
    return () => clearTimeout(t);
    // run once per modal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const actions = (m.actions || []).filter(Boolean) as ModalAction[];
  return (
    <div className="modal-backdrop" ref={ref} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`modal ${m.wide ? 'wide' : ''} ${m.cls || ''}`} role="dialog" aria-modal="true" aria-label={m.title}>
        <div className="modal-head"><h3>{m.title}</h3><button className="icon-btn" aria-label="Close" onClick={close}><Icon name="close" /></button></div>
        <div className="modal-body">{m.body}</div>
        {actions.length > 0 && (
          <div className="modal-actions">
            {actions.map((a, i) => (
              <button key={i} className={`btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`} data-mact={i}
                onClick={async () => { const r = a.onClick ? await a.onClick(ref.current!) : undefined; if (r !== false) close(); }}>{a.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuView({ menu }: { menu: MenuEntry }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current!, r = menu.anchor, o = menu.opts;
    const mw = el.offsetWidth, mh = el.offsetHeight, vw = innerWidth, vh = innerHeight;
    let x = o.alignLeft ? r.left : r.right - mw;
    let y = o.above ? r.top - mh - 6 : r.bottom + 4;
    if (x + mw > vw - 8) x = vw - mw - 8;
    if (x < 8) x = 8;
    if (y + mh > vh - 8) y = Math.max(8, r.top - mh - 4);
    if (y < 8) y = 8;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.querySelector('button')?.focus({ preventScroll: true });
    const outside = (e: MouseEvent) => { if (!el.contains(e.target as Node)) closeMenu(); };
    const t = setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', outside, true); };
  }, [menu]);
  return (
    <div className={`menu ${menu.opts.cls || ''}`} id="menu" role="menu" ref={ref}
      onClick={(e) => { e.stopPropagation(); const rb = (e.target as HTMLElement).closest<HTMLElement>('[data-react]'); if (rb && menu.opts.onReact) { closeMenu(); menu.opts.onReact(rb.dataset.react!); } }}>
      {menu.opts.header}
      {menu.items.map((it, i) => (it === '-' ? <div className="menu-sep" key={i} /> : (
        <button key={i} className={`menu-item ${it.danger ? 'danger' : ''}`} data-mi={i} role="menuitem" onClick={() => { closeMenu(); it.onClick(); }}>
          {it.icon && <span className="mi-ic" style={it.color ? { background: it.color } : undefined}><Icon name={it.icon} size={it.color ? 18 : 20} /></span>}
          <span>{it.label}</span>
        </button>
      )))}
    </div>
  );
}

export function OverlayHost() {
  const { modals, toasts, menu } = useOverlay();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (useOverlay.getState().menu) closeMenu(); else if (useOverlay.getState().modals.length) closeModal(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      {modals.map((m) => <ModalView key={m.id} m={m} />)}
      {menu && <MenuView menu={menu} />}
      <div id="toasts" className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.onClick ? 'clickable' : ''} ${t.out ? 'out' : ''}`} onClick={t.onClick ? () => { t.onClick!(); useOverlay.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })); } : undefined}>{t.text}</div>
        ))}
      </div>
    </>
  );
}

// ---------- files and images
export function readImage(file: File, max = 1280): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (Math.max(w, h) > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d')!.drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = rej;
      img.src = fr.result as string;
    };
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}
/** Open the browser's file chooser. */
export function pickFile(opts: { accept?: string; multiple?: boolean; capture?: string } = {}): Promise<File[]> {
  return new Promise((res) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    if (opts.accept) inp.accept = opts.accept;
    if (opts.multiple) inp.multiple = true;
    if (opts.capture) inp.setAttribute('capture', opts.capture);
    inp.onchange = () => res([...(inp.files || [])]);
    inp.click();
  });
}
export const readDataURL = (f: Blob): Promise<string> => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

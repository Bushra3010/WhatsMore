'use client';
// Toasts and confirm dialogs, callable from anywhere like the original toast() and dialog().
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

function store<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (v: T) => { value = v; subs.forEach((f) => f()); },
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  };
}

// ---------- toast
const toasts = store<{ id: number; text: string } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let toastId = 0;

export function toast(text: string) {
  clearTimeout(toastTimer);
  toasts.set({ id: ++toastId, text });
  toastTimer = setTimeout(() => toasts.set(null), 3500);
}

export function Toaster() {
  const t = useSyncExternalStore(toasts.subscribe, toasts.get, () => null);
  return t ? <div id="toast" role="status" key={t.id}>{t.text}</div> : null;
}

// ---------- dialog
type DialogValues = Record<string, string>;
type DialogOpts = { title: string; body?: ReactNode; ok?: string; danger?: boolean };
type DialogReq = DialogOpts & { id: number; resolve: (v: DialogValues | null) => void };
const dialogs = store<DialogReq | null>(null);
let dialogId = 0;

/** Shows a confirm dialog. Resolves with the values of the named fields in `body`, or null on cancel. */
export function dialog(opts: DialogOpts): Promise<DialogValues | null> {
  return new Promise((resolve) => {
    dialogs.get()?.resolve(null);
    dialogs.set({ ...opts, id: ++dialogId, resolve });
  });
}

export function DialogHost() {
  const d = useSyncExternalStore(dialogs.subscribe, dialogs.get, () => null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (d) ref.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
  }, [d]);
  if (!d) return null;
  const close = (ok: boolean) => {
    const fields = ref.current ? [...ref.current.querySelectorAll<HTMLInputElement>('[name]')] : [];
    const vals = Object.fromEntries(fields.map((i) => [i.name, i.value]));
    dialogs.set(null);
    d.resolve(ok ? vals : null);
  };
  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(false); }}>
      <div
        className="dialog" role="dialog" aria-modal="true" aria-label={d.title} ref={ref} key={d.id}
        onKeyDown={(e) => { if (e.key === 'Escape') close(false); }}
      >
        <h3>{d.title}</h3>
        <div>{d.body}</div>
        <div className="btns">
          <button className="cc-btn" type="button" onClick={() => close(false)}>Cancel</button>
          <button className={`cc-btn ${d.danger ? 'danger' : 'primary'}`} type="button" onClick={() => close(true)}>{d.ok || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}

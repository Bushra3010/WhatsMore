'use client';
// Behaviour for the Android app (Capacitor). On the website none of this runs.
// - The hardware Back button steps back through the app (menu/dialog → panel → chat → page → Chats)
//   instead of closing the app straight away.
// - Status bar / theme colour follow the app theme (handled by the WebView meta theme-color).
import { useEffect } from 'react';
import { ui, refresh } from '@/lib/state';
import { overlays } from '@/lib/registry';
import { closeMenu, closeModal, modalOpen } from '@/lib/overlay';
import { closeChat } from '@/lib/actions';
import { back, closeView, openDrawer, goTab } from '@/lib/nav';

/** True inside the Android/iOS app shell. */
export const isNativeApp = () => typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

function handleBack(exit: () => void) {
  if (document.getElementById('menu')) return closeMenu();
  if (modalOpen()) return closeModal();
  // full-screen layers (story viewer, lightbox, document studio, onboarding) close on Escape
  if (document.querySelector('.story, .lightbox, .studio, #onboard')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }
  if (document.querySelector('.call, #rtc')) return; // never hang up a call by accident
  if (ui.emojiOpen) { ui.emojiOpen = false; return refresh(); }
  if (ui.chatSearch !== null && ui.chatSearch !== undefined) { ui.chatSearch = null; return refresh(); }
  if (ui.drawer) return openDrawer(null);
  if (ui.active) return closeChat();
  if (ui.view) return closeView();
  if (ui.page) return back();
  if (ui.tab !== 'chats') return goTab('chats');
  exit();
}

function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    import('@capacitor/app').then(({ App }) => {
      if (cancelled) return;
      App.addListener('backButton', () => handleBack(() => { App.minimizeApp(); })).then((h) => { remove = () => h.remove(); });
    });
    return () => { cancelled = true; remove?.(); };
  }, []);
  return null;
}
overlays.native = NativeBridge;

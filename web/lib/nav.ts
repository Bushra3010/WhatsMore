'use client';
// Navigation between tabs, sidebar pages, main-area views and the drawer.
import { refresh, ui } from './state';

export function goTab(tab: string, page: string | null = null) {
  ui.tab = tab; ui.page = page;
  if (tab !== ui.tab || page) ui.view = ui.view; // views stay open across tabs, like the original
  refresh();
}
export function openPage(page: string | null) { ui.page = page; refresh(); }
export function back() { ui.page = ui.page === 'newgroup' ? 'newchat' : null; refresh(); }
/** Open a main-area view, e.g. 'mod:pay' or 'ai'. Closing it returns to the open chat or the welcome screen. */
export function openView(v: string) { ui.view = v; ui.active = null; ui.drawer = null; refresh(); }
export function closeView() { ui.view = null; refresh(); }
export function openDrawer(d: string | null) { ui.drawer = d; refresh(); }
export const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 760;

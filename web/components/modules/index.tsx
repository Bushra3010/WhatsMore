'use client';
// Area entry: Home, AI, Services hub and the super-app modules. Registers tabs, views, actions and hooks
// in lib/registry (see PORTING.md). Ported from js/modules.js, js/superapp.js and js/cloudplus.js.
import { useEffect, type ComponentType } from 'react';
import { S, ui, save, refresh } from '@/lib/state';
import { MIN } from '@/lib/util';
import { openView } from '@/lib/nav';
import { tabs, views, pages, overlays, register } from '@/lib/registry';
import { bizBots } from '@/lib/actions';
import { ViewHead, settingHooks } from '@/components/ui/Bits';
import { onTabOpen } from '@/components/app/Rail';
import { MODULES, svc, payFlow } from './shared';
import { HomeTab, ServicesTab } from './home';
import { AITab, AIView, aiAsk } from './ai';
import { PayView } from './pay';
import { BusinessView } from './business';
import { MarketView, sellerBot, sellerChat } from './market';
import { CitizenView, SOSView } from './services';
import { FamilyView } from './family';
import { LearnView, NewsView, AreaView, CreatorView, VoiceView } from './community';
import { WellbeingView, AdminView, wellbeingSettingHook } from './life';
import { logNotif, openNotifCenter, dndActive, ensureModDefaults } from './notifs';
import { importChatModal } from './importChats';
import { ProfilesPage, AIMemoryPage, NotifyPage } from './settingsPages';

const BODIES: Record<string, ComponentType> = {
  pay: PayView, business: BusinessView, market: MarketView, citizen: CitizenView, sos: SOSView, family: FamilyView, learn: LearnView,
  news: NewsView, area: AreaView, creator: CreatorView, voice: VoiceView, wellbeing: WellbeingView, admin: AdminView,
};

// renderView(): view head + scrolling body for every module
MODULES.forEach((m) => {
  const Body = BODIES[m.id];
  const View = () => (
    <>
      <ViewHead title={m.name} sub={m.sub} ic={m.ic} color={m.color} />
      <div className="view-scroll"><div className="view-inner"><Body /></div></div>
    </>
  );
  View.displayName = 'ModView_' + m.id;
  views['mod:' + m.id] = View;
});
views.ai = AIView;
tabs.home = HomeTab;
tabs.services = ServicesTab;
tabs.ai = AITab;
// settings pages from modules.js extraSettingsPage (the settings area's own versions win if registered)
pages['set-profiles'] ||= ProfilesPage;
pages['set-ai'] ||= AIMemoryPage;
pages['set-notify'] ||= NotifyPage;

// opening the AI tab opens the AI view
onTabOpen.push((tab) => { if (tab === 'ai') openView('ai'); });

// every notification is logged in the notification center; DND and focus mode silence the toast
// Notifications: the chat area's notifyHooks entry already logs to the center and applies DND / focus /
// profile rules (it calls act.logNotif and act.dndActive), so this area only provides those actions.
// marketplace sellers answer with their own AI assistant
bizBots.push(sellerBot);
settingHooks.push(wellbeingSettingHook);

register({
  logNotif, openNotifCenter, importChats: importChatModal, importChatModal,
  svc: (mod: string) => svc(mod),
  aiAsk, sellerChat, payFlow, dndActive,
});

/** Boot work that ran at startup in the original: defaults/migrations and the screen-time counter. */
function ModulesBoot() {
  useEffect(() => {
    if (ensureModDefaults()) save();
    if (!ui.sessionStart) ui.sessionStart = Date.now();
    refresh();
    const t = setInterval(() => {
      const st = S?.mod?.screen;
      if (st) { st.min++; ui.sessionStart = Date.now(); save(); }
      ensureModDefaults();
    }, 5 * MIN);
    return () => clearInterval(t);
  }, []);
  return null;
}
overlays.modulesBoot = ModulesBoot;

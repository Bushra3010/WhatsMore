'use client';
// Settings pages defined in js/modules.js extraSettingsPage(): Profiles, AI & memory, Notifications.
// Registered only when the settings area has not registered its own version.
import { S, commit } from '@/lib/state';
import { confirmModal, toast } from '@/lib/overlay';
import { PROFILES, switchProfile } from '@/lib/profiles';
import { Icon } from '@/components/Icon';
import { PageHead, ToggleRow } from '@/components/ui/Bits';

export function ProfilesPage() {
  const sub: Record<string, string> = { personal: 'Friends & family · @' + S.me.username, business: S.me.name + ' Designs · catalogue, orders, AI replies', creator: 'Followers, subscribers, paid community', family: 'Family Hub, shared calendar, location' };
  return (
    <>
      <PageHead title="Profiles" />
      <div className="side-scroll">
        <p className="pad muted small">One app, separate identities. Each profile has its own chats, notifications, privacy settings, status and profile info.</p>
        {Object.entries(PROFILES).map(([k, [l, e]]) => (
          <div key={k} className="set-row" data-act="setprofile" data-p={k} role="button" tabIndex={0} onClick={() => switchProfile(k)}>
            <span className="big-emoji">{e}</span><div className="grow"><div className="ci-name">{l}</div><div className="ci-sub">{sub[k]}</div></div>{S.settings.profile === k ? <span className="pill">Active</span> : null}
          </div>
        ))}
      </div>
    </>
  );
}

export function AIMemoryPage() {
  return (
    <>
      <PageHead title="AI & memory" />
      <div className="side-scroll">
        <ToggleRow path="aiMemory" label="AI memory" sub="Let WHATSMORE AI remember your preferences. Off = nothing is remembered." />
        <div className="list-label">What AI may use</div>
        <ToggleRow path="aiPerms.chats" label="Chats you choose to summarize" sub="Only when you ask — never in the background" />
        <ToggleRow path="aiPerms.files" label="Files & documents" sub="For summaries, proofreading and smart search" />
        <ToggleRow path="aiPerms.contacts" label="Contact names" sub="To understand “the invoice Ramesh sent”" />
        <ToggleRow path="aiPerms.location" label="Location" sub="For My Area suggestions" />
        <div className="pad"><button className="btn danger block" data-act="clearaimem" onClick={() => confirmModal('Clear AI memory?', 'WHATSMORE AI will forget your preferences and past AI conversations.', 'Clear', () => { S.mod.ai = null; commit(); toast('AI memory cleared'); })}>Clear AI memory</button></div>
        <div className="hint-box"><Icon name="shield" size={16} /><span>Sensitive data (payments, IDs, health) is never used for AI memory. AI runs through a model-agnostic gateway — on-device where possible.</span></div>
      </div>
    </>
  );
}

export function NotifyPage() {
  const rows: [string, string][] = [['messages', 'Messages'], ['calls', 'Calls'], ['payments', 'Payments'], ['business', 'Business'], ['marketplace', 'Marketplace'], ['community', 'Community & channels'], ['ai', 'AI suggestions'], ['security', 'Security alerts'], ['services', 'Government & services']];
  return (
    <>
      <PageHead title="Notifications" />
      <div className="side-scroll">
        <div className="list-label">Notify me about</div>
        {rows.map(([k, l]) => <ToggleRow key={k} path={'notify.' + k} label={l} />)}
        <div className="hint-box"><Icon name="timer" size={16} /><span>Use Digital wellbeing for focus mode, quiet hours and a daily notification summary.</span></div>
      </div>
    </>
  );
}

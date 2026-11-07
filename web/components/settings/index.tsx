'use client';
// Settings area: the Settings tab and its pages, onboarding / account screens, account recovery,
// linked devices and QR codes. Registers everything in lib/registry. See PORTING.md.
import { tabs, pages, overlays, register, act } from '@/lib/registry';
import { settingHooks } from '@/components/ui/Bits';
import { toast } from '@/lib/overlay';
import {
  SettingsTab, ProfilePage, SecurityPage, PrivacyPage, ChatsPage, PaymentsPage, StoragePage, AboutPage,
  ProfilesPage, AIPage, NotifyPage, DataPage, saveProfile, setPinModal,
} from './pages';
import { DevicesPage, linkDeviceModal } from './devices';
import { Onboarding, startOnboarding, openAccountFlow } from './Onboarding';
import { qrModal, scanModal, connectFromText, drawQR, QRBox } from './qr';
import { checkUsername } from './common';
import { recoveryKeyModal, recoveryEmailModal, trustedContactsModal } from './recovery';

export { profileSaveHooks } from './hooks';
export { checkUsername, saveProfile, setPinModal, QRBox };

tabs.settings = SettingsTab;
Object.assign(pages, {
  'set-profile': ProfilePage,
  'set-security': SecurityPage,
  'set-privacy': PrivacyPage,
  'set-chats': ChatsPage,
  'set-payments': PaymentsPage,
  'set-storage': StoragePage,
  'set-about': AboutPage,
  'set-devices': DevicesPage,
  'set-profiles': ProfilesPage,
  'set-ai': AIPage,
  'set-notify': NotifyPage,
  'set-data': DataPage,
});
overlays.onboarding = Onboarding;

register({
  startOnboarding, openAccountFlow, qrModal, scanModal, connectFromText, drawQR,
  linkDeviceModal, recoveryKeyModal, recoveryEmailModal, trustedContactsModal, checkUsername,
});

// Side effects of settings changes (main.js change handler)
settingHooks.push((path, v) => {
  if (path === 'security.passkeys' && v) toast('Passkey created for this device (demo)');
  if (path === 'security.twoStep') toast(v ? 'Two-step verification on' : 'Two-step verification off');
});

// Chat lock PIN: only if the chats area hasn't registered its own
if (!('setPinModal' in act)) register({ setPinModal });

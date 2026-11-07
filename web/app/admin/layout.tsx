import type { Metadata } from 'next';
import { LOGO_ICON } from '@/components/admin/Logo';
// Command Center styles load only under /admin, never in the main app.
import './admin.css';

export const metadata: Metadata = {
  title: { template: '%s · WHATSMORE Command Center', default: 'WHATSMORE Command Center' },
  robots: { index: false, follow: false },
  icons: { icon: LOGO_ICON },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata, Viewport } from 'next';

const ICON = "data:image/svg+xml,%3Csvg width='64' height='64' viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='b' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%230b3d91'/%3E%3Cstop offset='1' stop-color='%231a73e8'/%3E%3C/linearGradient%3E%3ClinearGradient id='t' gradientUnits='userSpaceOnUse' x1='0' y1='20' x2='0' y2='46'%3E%3Cstop offset='.333' stop-color='%23ff9933'/%3E%3Cstop offset='.333' stop-color='%23ffffff'/%3E%3Cstop offset='.667' stop-color='%23ffffff'/%3E%3Cstop offset='.667' stop-color='%231ea31a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='2' y='2' width='60' height='60' rx='16' fill='url(%23b)'/%3E%3Cpath d='M14.5 21.5l7.5 23L32 27.5l10 17 7.5-23' fill='none' stroke='url(%23t)' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: 'WHATSMORE',
  description: 'More Than Chat. Message, call, share stories, pay and shop — all in one place.',
  icons: { icon: ICON },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0b3d91' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

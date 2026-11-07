import { ICONS } from '@/lib/icons-data';

/** Material-style icon (24x24). Same names as the original `icon(name, size, cls)`. */
export function Icon({ name, size = 24, cls = '' }: { name: string; size?: number; cls?: string }) {
  if (name === 'status') {
    return (
      <svg className={`ic ${cls}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4.6 2.6" />
        <circle cx="12" cy="12" r="4.6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={`ic ${cls}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={ICONS[name] || ICONS.info} />
    </svg>
  );
}

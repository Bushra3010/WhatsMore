import { useId } from 'react';

/** The WHATSMORE "W" in the Indian tricolour on a blue tile. */
export function Logo({ size = 48 }: { size?: number }) {
  const n = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="WHATSMORE">
      <defs>
        <linearGradient id={`wmbg${n}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0b3d91" /><stop offset="1" stopColor="#1a73e8" /></linearGradient>
        <linearGradient id={`wmtri${n}`} gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="46">
          <stop offset=".333" stopColor="#ff9933" /><stop offset=".333" stopColor="#ffffff" /><stop offset=".667" stopColor="#ffffff" /><stop offset=".667" stopColor="#1ea31a" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#wmbg${n})`} />
      <path d="M14.5 21.5l7.5 23L32 27.5l10 17 7.5-23" fill="none" stroke={`url(#wmtri${n})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

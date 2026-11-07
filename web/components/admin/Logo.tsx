// The Command Center logo: the tricolour W (same artwork as LOGO in js/admin.js).

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="lb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d91"/><stop offset="1" stop-color="#1a73e8"/></linearGradient><linearGradient id="lt" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="46"><stop offset=".333" stop-color="#ff9933"/><stop offset=".333" stop-color="#fff"/><stop offset=".667" stop-color="#fff"/><stop offset=".667" stop-color="#1ea31a"/></linearGradient></defs><rect x="2" y="2" width="60" height="60" rx="16" fill="url(#lb)"/><path d="M14.5 21.5l7.5 23L32 27.5l10 17 7.5-23" fill="none" stroke="url(#lt)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** Favicon for every Command Center page. */
export const LOGO_ICON = 'data:image/svg+xml,' + encodeURIComponent(SVG);

export function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b3d91" />
          <stop offset="1" stopColor="#1a73e8" />
        </linearGradient>
        <linearGradient id="lt" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="46">
          <stop offset=".333" stopColor="#ff9933" />
          <stop offset=".333" stopColor="#fff" />
          <stop offset=".667" stopColor="#fff" />
          <stop offset=".667" stopColor="#1ea31a" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#lb)" />
      <path d="M14.5 21.5l7.5 23L32 27.5l10 17 7.5-23" fill="none" stroke="url(#lt)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

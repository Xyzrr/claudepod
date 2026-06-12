/**
 * The app's icon set: inline SVGs, one stroke style, currentColor throughout.
 * Never mix in emoji or text glyphs for iconography — sizes and weights drift.
 */

type IconProps = { size?: number };

function Svg({ size = 20, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconPlay({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPause({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconMic({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11.5a7 7 0 0 0 14 0" />
      <line x1="12" y1="18.5" x2="12" y2="21.5" />
    </Svg>
  );
}

export function IconSend({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </Svg>
  );
}

export function IconBack({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function IconGear({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function IconSignOut({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </Svg>
  );
}

export function IconX({ size }: IconProps) {
  return (
    <Svg size={size}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </Svg>
  );
}

export function IconSkipBack15({ size }: IconProps) {
  return (
    <Svg size={size}>
      <polyline points="2.5 3.5 2.5 9.5 8.5 9.5" />
      <path d="M4 14.5a9 9 0 1 0 1-7.5L2.5 9.5" />
      <text
        x="12.5"
        y="17"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        15
      </text>
    </Svg>
  );
}

export function IconSkipForward30({ size }: IconProps) {
  return (
    <Svg size={size}>
      <polyline points="21.5 3.5 21.5 9.5 15.5 9.5" />
      <path d="M20 14.5a9 9 0 1 1-1-7.5l2.5 2.5" />
      <text
        x="11.5"
        y="17"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        30
      </text>
    </Svg>
  );
}

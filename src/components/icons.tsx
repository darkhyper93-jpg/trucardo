/* Íconos de trazo, del mismo peso que los botones redondos de la referencia. */

type P = { size?: number };
const base = (size = 24) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const PlusIcon = ({ size = 30 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="M12 4.5v15M4.5 12h15" />
  </svg>
);
export const MinusIcon = ({ size = 30 }: P) => (
  <svg {...base(size)} strokeWidth={2.4}>
    <path d="M4.5 12h15" />
  </svg>
);
export const BackIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const MenuIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M5 7h14M5 12h14M5 17h14" />
  </svg>
);
export const MicIcon = ({ size = 30 }: P) => (
  <svg {...base(size)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  </svg>
);
export const MicOffIcon = ({ size = 30 }: P) => (
  <svg {...base(size)}>
    <path d="M9 9V6a3 3 0 0 1 5.8-1M15 10v1a3 3 0 0 1-4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11a6.4 6.4 0 0 1-.4 2.2M12 17.5V21M8.5 21h7M3 3l18 18" />
  </svg>
);
export const SpeakerIcon = ({ size = 30 }: P) => (
  <svg {...base(size)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);
export const UndoIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
export const CardsIcon = ({ size }: P) => (
  <svg {...base(size)}>
    <rect x="3.5" y="6" width="10" height="14" rx="1.6" transform="rotate(-10 8.5 13)" />
    <rect x="10.5" y="4" width="10" height="14" rx="1.6" transform="rotate(8 15.5 11)" />
  </svg>
);
export const KeyboardIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10" />
  </svg>
);
export const CloseIcon = ({ size = 20 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

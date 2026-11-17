import React from 'react';
import { RaceEvent } from '../types';

interface IconProps {
  size?: number;
  className?: string;
}

const baseProps = (size = 18, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true as const,
});

export const IconBib: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <path d="M8 15h8" />
    <path d="M10 12.5h4" />
  </svg>
);

export const IconFlag: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M4 21V4" />
    <path d="M4 4h15l-2.5 4.5L19 13H4" />
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconMapPin: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  </svg>
);

export const IconCalendar: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </svg>
);

export const IconUsers: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 14.3c2.4.4 4.5 2 4.5 4.7" />
  </svg>
);

export const IconLedger: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 9h10M7 13h6M7 17h4" />
    <path d="M16 14.5v4M14 16.5h4" />
  </svg>
);

export const IconQr: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <path d="M14 14h3v3h-3zM18 18h3v3h-3zM18 14h3M14 19h2" />
  </svg>
);

export const IconCheckCircle: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.2 2.4 2.4 4.8-5" />
  </svg>
);

export const IconAlert: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 4 3 20h18L12 4Z" />
    <path d="M12 10v4.5" />
    <circle cx="12" cy="17.2" r="0.6" fill="currentColor" />
  </svg>
);

export const IconClock: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </svg>
);

export const IconLock: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const IconSwitch: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M17 3l4 4-4 4" />
    <path d="M3 7h18" />
    <path d="M7 21l-4-4 4-4" />
    <path d="M21 17H3" />
  </svg>
);

export const IconCamera: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M4 8h3l2-2.5h6L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconArrowRight: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconArrowLeft: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const IconBuilding: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3" />
  </svg>
);

export const IconShield: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 3 5 6v6c0 4.6 3 7.9 7 9 4-1.1 7-4.4 7-9V6l-7-3Z" />
    <path d="m9.2 12 2 2 3.8-4" />
  </svg>
);

export const IconDownload: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M12 4v11M7.5 11.5 12 16l4.5-4.5" />
    <path d="M4 19h16" />
  </svg>
);

export const IconCopy: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const IconBag: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M6 7h12l1 13H5L6 7Z" />
    <path d="M9 7V5a3 3 0 0 1 6 0v2" />
  </svg>
);

export const IconShirt: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M8 4h8l4 3.5-2.2 3.2-2.3-1.2V20H8.5V9.5L6.2 10.7 4 7.5 8 4Z" />
  </svg>
);

export const IconSliders: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="9" cy="6" r="2" fill="currentColor" />
    <circle cx="15" cy="12" r="2" fill="currentColor" />
    <circle cx="10" cy="18" r="2" fill="currentColor" />
  </svg>
);

export const IconEye: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

export const IconEyeOff: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17.2 17.2 0 0 1-3.2 4.1" />
    <path d="M6.4 6.6C3.7 8.5 2 12 2 12s3.5 6 10 6c1.9 0 3.6-.5 5-1.3" />
  </svg>
);

export const IconMail: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const IconDevice: React.FC<IconProps> = ({ size, className }) => (
  <svg {...baseProps(size, className)}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

export const IconGoogleMark: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.85"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M20.2 12.2H12v3.4h4.7a4.9 4.9 0 1 1-1.5-5.6l2.4-2.4A8.5 8.5 0 1 0 20.5 12c0-.3-.1-.5-.3-.8Z" />
  </svg>
);

export const IconLineMark: React.FC<IconProps> = ({ size = 18, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.85"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 11.2c0-4.4-4-8-9-8s-9 3.6-9 8c0 3.9 3.2 7.2 7.5 7.9.3.1.7.2.8.5.1.3 0 .8-.1 1.2 0 0-.2.8.7.4.9-.4 4.7-2.8 6.4-4.8 1.7-1.7 2.7-3.4 2.7-5.2Z" />
  </svg>
);

export const EventCoverArtwork: React.FC<{
  motif: RaceEvent['coverMotif'];
  className?: string;
}> = ({ motif, className }) => {
  return (
    <svg
      viewBox="0 0 400 165"
      className={className}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      {motif === 'mountain' && (
        <>
          <rect width="400" height="165" fill="var(--cover-mountain-bg)" />
          <circle cx="326" cy="44" r="20" fill="var(--cover-sun)" />
          <path
            d="M0 140 L92 66 L172 120 L258 46 L354 114 L400 88 L400 165 L0 165 Z"
            fill="var(--cover-mountain-mid)"
          />
          <path
            d="M0 165 Q140 124 250 146 T400 120 L400 165 Z"
            fill="var(--cover-mountain-fg)"
          />
          <path
            d="M48 160 Q168 128 336 138"
            stroke="var(--cover-route)"
            strokeWidth="2.2"
            strokeDasharray="6 5"
            fill="none"
          />
        </>
      )}
      {motif === 'coast' && (
        <>
          <rect width="400" height="165" fill="var(--cover-coast-bg)" />
          <circle cx="298" cy="58" r="25" fill="var(--cover-sun)" />
          <path
            d="M0 110 Q100 96 200 110 T400 106 L400 165 L0 165 Z"
            fill="var(--cover-coast-mid)"
          />
          <path
            d="M0 136 Q120 122 240 138 T400 130 L400 165 L0 165 Z"
            fill="var(--cover-coast-fg)"
          />
          <path
            d="M32 150 Q170 126 362 142"
            stroke="var(--cover-route)"
            strokeWidth="2.2"
            strokeDasharray="6 5"
            fill="none"
          />
        </>
      )}
      {motif === 'heritage' && (
        <>
          <rect width="400" height="165" fill="var(--cover-heritage-bg)" />
          <path
            d="M38 136 V86 H96 V136 M124 136 V72 L162 50 L200 72 V136 M228 136 V82 H302 V136 M326 136 V92 H370 V136"
            stroke="var(--cover-heritage-line)"
            strokeWidth="1.8"
            fill="none"
          />
          <rect y="136" width="400" height="29" fill="var(--cover-heritage-fg)" />
          <path
            d="M24 150 H376"
            stroke="var(--cover-route)"
            strokeWidth="2.2"
            strokeDasharray="6 5"
          />
        </>
      )}
      {motif === 'river' && (
        <>
          <rect width="400" height="165" fill="var(--cover-river-bg)" />
          <circle cx="84" cy="42" r="14" fill="var(--cover-sun)" />
          <path
            d="M0 114 C110 90, 230 140, 400 102 L400 165 L0 165 Z"
            fill="var(--cover-river-mid)"
          />
          <path
            d="M40 108 Q120 74 200 108 Q280 74 360 108"
            stroke="var(--cover-route)"
            strokeWidth="2"
            fill="none"
          />
        </>
      )}
      {motif === 'trail' && (
        <>
          <rect width="400" height="165" fill="var(--cover-trail-bg)" />
          <path
            d="M0 92 Q95 52 190 85 T400 70"
            stroke="var(--cover-trail-line)"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0 120 Q115 80 220 112 T400 96"
            stroke="var(--cover-trail-line)"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0 144 Q130 110 255 136 T400 120 L400 165 L0 165 Z"
            fill="var(--cover-trail-fg)"
          />
        </>
      )}
    </svg>
  );
};

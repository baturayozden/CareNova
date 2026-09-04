// CareNovaIcons.tsx
// 7 custom line icons for CareNova. Single-color via `currentColor` —
// set the color through CSS (text-[#2563EB] / style color) on the icon or a parent.
// Default size 24px. Each accepts `size` plus any standard <svg> prop (className, style, aria-label…).
//
//   import { WhatsAppNativeIcon } from '../icons/CareNovaIcons';
//   <WhatsAppNativeIcon size={32} className="text-gold" />
//
import React from 'react';

type IconProps = { size?: number } & React.SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function WhatsAppNativeIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M9 15 A6 6 0 0 1 15 9 H33 A6 6 0 0 1 39 15 V25 A6 6 0 0 1 33 31 H18 L11 37 L9 25 Z" />
      <path d="M24 13 L25.5 17 L29 18.5 L25.5 20 L24 24 L22.5 20 L19 18.5 L22.5 17 Z" />
    </svg>
  );
}

export function AnyLanguageIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <circle cx="24" cy="24" r="14" />
      <path d="M24 10 A6 14 0 0 0 24 38 A6 14 0 0 0 24 10" />
      <line x1="10" y1="24" x2="38" y2="24" />
      <path d="M13 17 C18 19.5 30 19.5 35 17" />
      <path d="M13 31 C18 28.5 30 28.5 35 31" />
    </svg>
  );
}

export function ObjectionDetectionIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M12 7 H23 A5 5 0 0 1 28 12 V20 A5 5 0 0 1 23 25 H15 L9 30 L10.5 25 H12 A5 5 0 0 1 7 20 V12 A5 5 0 0 1 12 7 Z" />
      <line x1="17" y1="11" x2="17" y2="15.5" />
      <circle cx="17" cy="18.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="29" cy="29" r="6.5" />
      <line x1="33.6" y1="33.6" x2="39" y2="39" />
    </svg>
  );
}

export function MultiClinicIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <line x1="9" y1="38" x2="39" y2="38" />
      <path d="M11.5 38 V26 Q11.5 24.5 13 24.5 H18 Q19.5 24.5 19.5 26 V38" />
      <path d="M21.5 38 V22 Q21.5 20.5 23 20.5 H27 Q28.5 20.5 28.5 22 V38" />
      <path d="M30.5 38 V26 Q30.5 24.5 32 24.5 H37 Q38.5 24.5 38.5 26 V38" />
      <path d="M25 15.5 V20.5" />
      <path d="M23 14 C19 16 16 19.5 15.5 24.5" />
      <path d="M27 14 C31 16 34 19.5 34.5 24.5" />
      <circle cx="25" cy="12.5" r="2.6" />
      <line x1="25" y1="11" x2="25" y2="14" />
      <line x1="23.5" y1="12.5" x2="26.5" y2="12.5" />
    </svg>
  );
}

export function LeadsOvernightIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M25 9 A12 12 0 1 0 25 33 A9.5 9.5 0 0 1 25 9 Z" />
      <path d="M34 11 H40 A3 3 0 0 1 43 14 V18 A3 3 0 0 1 40 21 H36.5 L33 25 L34 21 H34 A3 3 0 0 1 31 18 V14 A3 3 0 0 1 34 11 Z" />
      <circle cx="37" cy="29" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="38.7" cy="33" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="40.2" cy="36.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HoursFollowupIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <path d="M16 10 H32 L24 24 L32 38 H16 L24 24 Z" />
      <path d="M18.5 13.5 H29.5" />
      <circle cx="24" cy="27" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="24" cy="30.5" r="0.65" fill="currentColor" stroke="none" />
      <path d="M19.5 38 C20.5 34 27.5 34 28.5 38" />
    </svg>
  );
}

export function MultilingualUnansweredIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...base} {...props}>
      <circle cx="18" cy="18" r="9" />
      <path d="M18 9 A3.6 9 0 0 0 18 27 A3.6 9 0 0 0 18 9" />
      <line x1="9" y1="18" x2="27" y2="18" />
      <path d="M30 27 H40 A3 3 0 0 1 43 30 V36 A3 3 0 0 1 40 39 H35 L31 43 L32 39 H30 A3 3 0 0 1 27 36 V30 A3 3 0 0 1 30 27 Z" />
      <circle cx="31.6" cy="33" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="35" cy="33" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="38.4" cy="33" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  );
}

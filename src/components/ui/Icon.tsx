import * as React from "react";

type IconProps = {
  size?: number;
  stroke?: number;
  className?: string;
  style?: React.CSSProperties;
};

const Svg = ({ size = 16, stroke = 1.6, className, style, children }: IconProps & { children: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden
  >
    {children}
  </svg>
);

export const I = {
  Home:     (p: IconProps) => <Svg {...p}><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v10h14V10"/></Svg>,
  Doc:      (p: IconProps) => <Svg {...p}><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/></Svg>,
  List:     (p: IconProps) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16"/></Svg>,
  Users:    (p: IconProps) => <Svg {...p}><circle cx="9" cy="9" r="3.2"/><path d="M3 19c.8-3.2 3.4-5 6-5s5.2 1.8 6 5"/><circle cx="17" cy="8" r="2.4"/><path d="M15.5 13.5c2.5.2 4.4 1.7 5 4"/></Svg>,
  Check:    (p: IconProps) => <Svg {...p}><path d="M5 12.5l4 4 10-10"/></Svg>,
  Clock:    (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Svg>,
  Bell:     (p: IconProps) => <Svg {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></Svg>,
  Plus:     (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14"/></Svg>,
  Up:       (p: IconProps) => <Svg {...p}><path d="M12 19V5M5 12l7-7 7 7"/></Svg>,
  Down:     (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12l7 7 7-7"/></Svg>,
  Right:    (p: IconProps) => <Svg {...p}><path d="M5 12h14M13 5l7 7-7 7"/></Svg>,
  Chevron:  (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6"/></Svg>,
  Search:   (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></Svg>,
  Cog:      (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Svg>,
  Upload:   (p: IconProps) => <Svg {...p}><path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></Svg>,
  Pin:      (p: IconProps) => <Svg {...p}><circle cx="12" cy="10" r="3"/><path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z"/></Svg>,
  Mail:     (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></Svg>,
  Phone:    (p: IconProps) => <Svg {...p}><path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></Svg>,
  Eye:      (p: IconProps) => <Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Svg>,
  Calendar: (p: IconProps) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Svg>,
  Filter:   (p: IconProps) => <Svg {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></Svg>,
  Building: (p: IconProps) => <Svg {...p}><path d="M4 21V5l8-2 8 2v16"/><path d="M4 21h16"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/></Svg>,
  X:        (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18"/></Svg>,
  Lock:     (p: IconProps) => <Svg {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Svg>,
  LogOut:   (p: IconProps) => <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></Svg>,
  User:     (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></Svg>,
  MoreVert: (p: IconProps) => <Svg {...p}><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></Svg>,
  Trash:    (p: IconProps) => <Svg {...p}><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></Svg>,
  Warning:  (p: IconProps) => <Svg {...p}><path d="M12 3L2 21h20L12 3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.8" fill="currentColor" stroke="none"/></Svg>,
};

export type IconKey = keyof typeof I;

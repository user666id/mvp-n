// Minimal stroke icon set (Lucide-style), sized via `size` and colored by
// `currentColor` so they inherit text color.
import React from 'react'

type P = { size?: number; className?: string; strokeWidth?: number }
const base = (size = 22, strokeWidth = 1.75): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export const ChevronRight = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><path d="m9 18 6-6-6-6" /></svg>
)
export const ChevronLeft = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><path d="m15 18-6-6 6-6" /></svg>
)
export const Menu = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" />
  </svg>
)
export const ChevronDown = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
export const Vibrate = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="m2 8 2 2-2 2 2 2-2 2" /><path d="m22 8-2 2 2 2-2 2 2 2" />
    <rect width="8" height="14" x="8" y="5" rx="1" />
  </svg>
)
export const Pencil = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
export const Copy = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect width="13" height="13" x="9" y="9" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)
export const ExternalLink = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M15 3h6v6" /><path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
)
export const QrCode = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" />
    <rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" />
    <path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" />
    <path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />
  </svg>
)
export const X = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
)
export const Plus = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
)
export const Check = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><path d="M20 6 9 17l-5-5" /></svg>
)
export const Globe = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" />
  </svg>
)
export const Clock = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
)
export const Cloud = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 1.5A4 4 0 0 0 6.5 19Z" />
  </svg>
)
export const Layers = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" />
  </svg>
)
export const Sliders = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
    <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
    <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
    <line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" /><line x1="18" x2="22" y1="16" y2="16" />
  </svg>
)
export const Settings = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const ShieldCheck = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
export const Bell = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </svg>
)
export const Phone = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect width="14" height="20" x="5" y="2" rx="2" /><path d="M12 18h.01" />
  </svg>
)
export const Monitor = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />
  </svg>
)
export const Trash = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
  </svg>
)
export const Ban = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>
)
export const Info = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
)
export const LogOut = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
  </svg>
)
export const Lock = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)
export const Refresh = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
  </svg>
)
export const Key = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
    <path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" />
  </svg>
)
export const Users = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
export const Gauge = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </svg>
)
export const Star = ({ size, className, strokeWidth }: P) => (
  <svg {...base(size, strokeWidth)} className={className}>
    <path d="M11.5 3.2a.6.6 0 0 1 1 0l2.2 4.5 4.9.7a.6.6 0 0 1 .3 1l-3.5 3.5.8 4.9a.6.6 0 0 1-.8.6L12 16.6l-4.4 2.3a.6.6 0 0 1-.8-.6l.8-4.9-3.5-3.5a.6.6 0 0 1 .3-1l4.9-.7z" />
  </svg>
)

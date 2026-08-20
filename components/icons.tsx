import type { SVGProps } from "react";

/**
 * Inline ikonalar — tashqi kutubxonasiz, `currentColor` bilan bo'yaladi.
 * Barchasi 24×24 grid, 1.75 stroke.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={20}
      height={20}
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconSend = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Icon>
);

export const IconTelegram = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width={20} height={20} {...p}>
    <path d="M21.94 4.6 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.47-2.27 2.19c-.25.25-.46.46-.95.46l.34-4.8 8.74-7.9c.38-.34-.08-.53-.59-.19L6.97 12.1l-4.65-1.45c-1.01-.32-1.03-1.01.21-1.5L20.63 3.1c.84-.31 1.58.2 1.31 1.5Z" />
  </svg>
);

export const IconGoogle = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18} {...p}>
    <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.56-5.17 3.56-8.87Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
  </svg>
);

export const IconChat = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l2-4.6A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
  </Icon>
);

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15v3M12 10v8M17 6v12" />
  </Icon>
);

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);

export const IconUsers = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const IconKey = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="m10.7 12.3 8.3-8.3" />
    <path d="m16.5 6.5 2.5 2.5" />
  </Icon>
);

export const IconHelp = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.5 2.5 0 0 1 4.9.8c0 1.7-2.5 2.5-2.5 2.5" />
    <path d="M12 17h.01" />
  </Icon>
);

export const IconMore = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="19" r="1" />
  </Icon>
);

export const IconGlobe = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
  </Icon>
);

export const IconBell = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Icon>
);

export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Icon>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="m20 6-11 11-5-5" />
  </Icon>
);

export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </Icon>
);

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Icon>
);

export const IconLogout = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </Icon>
);

export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Icon>
);

export const IconSparkle = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Icon>
);

export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const IconAlert = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

export const IconBot = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 4v4M9 14h.01M15 14h.01" />
    <path d="M4 13H2M22 13h-2" />
  </Icon>
);

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconTrash = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
  </Icon>
);

/** Qara logotipi: qora doira ichida ochilgan "ko'z" — «qara» = «ko'r». */
export const IconStore = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 9h18l-1.2-4.2A1.5 1.5 0 0 0 18.36 3H5.64a1.5 1.5 0 0 0-1.44 1.08L3 9Z" />
    <path d="M4 9v10a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19V9" />
    <path d="M9 21v-6h6v6" />
  </Icon>
);

export const IconBolt = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />
  </Icon>
);

export const IconPlug = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 2v6M15 2v6" />
    <path d="M6 8h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8Z" />
    <path d="M12 17v5" />
  </Icon>
);

export function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="inline-flex items-center gap-2">
        <svg viewBox="0 0 32 32" width={28} height={28} aria-hidden="true">
          <rect width="32" height="32" rx="9" fill="var(--text)" />
          <path
            d="M6.5 16c3-4.6 6.4-6.9 9.5-6.9s6.5 2.3 9.5 6.9c-3 4.6-6.4 6.9-9.5 6.9S9.5 20.6 6.5 16Z"
            fill="none"
            stroke="var(--surface)"
            strokeWidth="1.9"
          />
          <circle cx="16" cy="16" r="3.1" fill="var(--accent)" />
        </svg>
        <span className="text-[17px] font-semibold tracking-tight text-ink">
          Qara
        </span>
      </span>
    </span>
  );
}

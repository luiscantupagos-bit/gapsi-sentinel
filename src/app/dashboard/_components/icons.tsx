/**
 * Iconos SVG de línea (una sola familia, 20×20, trazo 1.6, `currentColor`).
 * Accesibles: decorativos por defecto (aria-hidden). Sin dependencias externas.
 */
type IconProps = { className?: string };

function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconPanel = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z" />
  </Svg>
);
export const IconDoc = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </Svg>
);
export const IconTasks = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M9 11l3 3 8-8" />
    <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
  </Svg>
);
export const IconCapa = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M12 3a9 9 0 1 0 9 9" />
    <path d="M21 3v6h-6" />
    <path d="M12 8v4l3 2" />
  </Svg>
);
export const IconInbox = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5 5h14l3 7v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6z" />
  </Svg>
);
export const IconAnalysis = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </Svg>
);
export const IconAudit = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z" />
    <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
export const IconProjects = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
);
export const IconRisk = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M12 3l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);
export const IconSupplier = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
    <circle cx="7" cy="17" r="1.6" />
    <circle cx="17" cy="17" r="1.6" />
  </Svg>
);
export const IconTraining = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M22 9L12 4 2 9l10 5 10-5z" />
    <path d="M6 11v5c0 1 3 2 6 2s6-1 6-2v-5" />
  </Svg>
);
export const IconReport = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 17v-3M12 17v-6M16 17v-2" />
  </Svg>
);
export const IconSettings = (p: IconProps) => (
  <Svg className={p.className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H7a1.7 1.7 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V7a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);
export const IconBell = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Svg>
);
export const IconChevron = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconLogout = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </Svg>
);

export const IconDiagnostic = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M9 3h6a1 1 0 0 1 1 1v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1V4a1 1 0 0 1 1-1z" />
    <path d="M9 13l2 2 4-4" />
  </Svg>
);
export const IconChart = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg className={p.className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const IconCalendar = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
  </Svg>
);
export const IconAlert = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M12 3l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </Svg>
);
export const IconGauge = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 18l4-5" />
  </Svg>
);

// --- Iconos de herramientas de análisis (misma familia de línea) ---
export const IconWhy = (p: IconProps) => (
  <Svg className={p.className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2.2-2.6 3.8" />
    <path d="M12 17h.01" />
  </Svg>
);
export const IconFishbone = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M3 12h16l2-2v4l-2-2" />
    <path d="M7 12l-2-3M11 12l-2-3M15 12l-2-3" />
    <path d="M7 12l-2 3M11 12l-2 3M15 12l-2 3" />
  </Svg>
);
export const IconTree = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M12 3v4M12 7L6 11M12 7l6 4" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <rect x="3" y="11" width="6" height="4" rx="1" />
    <rect x="15" y="11" width="6" height="4" rx="1" />
  </Svg>
);
export const IconCompare = (p: IconProps) => (
  <Svg className={p.className}>
    <path d="M6 20V8M12 20V4M18 20v-8" />
    <path d="M3 20h18" />
  </Svg>
);

/** Clave de icono → componente. Fuente única en `tool-catalog.ts` (campo `icon`). */
const TOOL_ICONS: Record<string, (p: IconProps) => React.ReactElement> = {
  why: IconWhy,
  fishbone: IconFishbone,
  tree: IconTree,
  doc: IconDoc,
  risk: IconRisk,
  chart: IconChart,
  recurrence: IconCapa,
  compare: IconCompare,
  analysis: IconAnalysis,
};

/** Renderiza el icono SVG de una herramienta a partir de su clave del catálogo. */
export function ToolIcon({ icon, className }: { icon: string; className?: string }) {
  const Cmp = TOOL_ICONS[icon] ?? IconAnalysis;
  return <Cmp className={className} />;
}

// Configuración de navegación del área privada (CORE-ALIGN-001).
// Datos puros (sin estado de cliente) para poder reutilizarse y probarse.
import {
  IconAnalysis,
  IconAudit,
  IconCapa,
  IconChart,
  IconDiagnostic,
  IconDoc,
  IconPanel,
  IconProjects,
  IconReport,
  IconTasks,
} from './icons';

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};
export type NavGroup = { title: string | null; items: NavItem[] };

// Solo rutas reales. Sin módulos futuros deshabilitados ni "Configuración"
// inexistente. Bandeja CAPA y Eventos de calidad NO están en el nivel principal.
export const NAV_GROUPS: NavGroup[] = [
  { title: null, items: [{ href: '/dashboard', label: 'Panel', icon: IconPanel }] },
  {
    title: 'Cumplimiento',
    items: [
      { href: '/dashboard/diagnostics', label: 'Diagnósticos', icon: IconDiagnostic },
      { href: '/dashboard/audits', label: 'Auditorías', icon: IconAudit },
      { href: '/dashboard/documents', label: 'Documentos', icon: IconDoc },
    ],
  },
  {
    title: 'Mejora',
    items: [
      { href: '/dashboard/capa', label: 'Acciones correctivas', icon: IconCapa },
      { href: '/dashboard/capa/analysis', label: 'Análisis', icon: IconAnalysis },
    ],
  },
  {
    title: 'Trabajo',
    items: [
      { href: '/dashboard/tasks', label: 'Tareas', icon: IconTasks },
      { href: '/dashboard/projects', label: 'Proyectos', icon: IconProjects },
    ],
  },
  {
    title: 'Desempeño',
    items: [
      { href: '/dashboard/kpis', label: 'Indicadores', icon: IconReport },
      { href: '/dashboard/analytics', label: 'Analítica', icon: IconChart },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function activeNavHref(pathname: string): string {
  const matches = NAV_ITEMS.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  ).sort((a, b) => b.href.length - a.href.length);
  return matches[0]?.href ?? '';
}

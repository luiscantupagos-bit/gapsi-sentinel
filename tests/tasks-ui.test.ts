/**
 * Pruebas estructurales de la UI de tareas y proyectos (TASK-009). Siguen el
 * patrón de layout.test.ts / pareto-ui.test.ts: verifican sobre el código fuente
 * los contratos de UX (español, sin UUID, clickeables, pestañas, Kanban,
 * calendario, Gantt, integración de dashboard). La validación visual se
 * documenta en las notas de implementación.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const sidebar = read('../src/app/dashboard/_components/nav-config.tsx');
const taskBits = read('../src/app/dashboard/tasks/_components/TaskBits.tsx');
const taskState = read('../src/features/tasks/task-state.ts');
const listPage = read('../src/app/dashboard/tasks/page.tsx');
const board = read('../src/app/dashboard/tasks/board/_components/KanbanBoard.tsx');
const calendar = read('../src/app/dashboard/tasks/calendar/page.tsx');
const gantt = read('../src/app/dashboard/projects/[projectId]/_components/GanttChart.tsx');
const dashboard = read('../src/app/dashboard/page.tsx');

describe('TASK-009 UI — navegación e idioma', () => {
  it('el sidebar enlaza el gestor global de tareas y proyectos', () => {
    expect(sidebar).toMatch(/href: '\/dashboard\/tasks'/);
    expect(sidebar).toMatch(/href: '\/dashboard\/projects'/);
  });

  it('los estados y tipos se muestran en español', () => {
    expect(taskState).toMatch(/in_progress: 'En progreso'/);
    expect(taskState).toMatch(/blocked: 'Bloqueada'/);
    expect(taskState).toMatch(/capa_action: 'Acción CAPA'/);
  });

  it('no se imprime el estado interno en inglés: se usa el badge con etiqueta', () => {
    expect(taskBits).toMatch(/TASK_STATUS_LABEL\[status as TaskStatus\]/);
  });
});

describe('TASK-009 UI — clickeables y sin UUID', () => {
  it('la tabla enlaza código y título (nativa a detalle, agregada a origen)', () => {
    expect(taskBits).toMatch(/href=\{i\.detailHref \?\? i\.originHref\}/);
    expect(taskBits).toMatch(/className="tbl-title"/);
    expect(taskBits).toMatch(/abrir origen/);
  });

  it('la tabla muestra el nombre del responsable, no su UUID', () => {
    expect(taskBits).toMatch(/i\.responsibleName/);
    expect(taskBits).not.toMatch(/responsibleUserId\}/);
  });
});

describe('TASK-009 UI — pestañas y filtros', () => {
  it('la lista ofrece pestañas de filtros rápidos', () => {
    for (const key of ['mine', 'all', 'overdue', 'blocked', 'completed', 'due_soon']) {
      expect(listPage).toContain(`key: '${key}'`);
    }
    expect(listPage).toMatch(/className=\{`tab\$\{/);
  });
});

describe('TASK-009 UI — Kanban', () => {
  it('agrupa por estado y valida el movimiento en servidor', () => {
    expect(board).toMatch(/TASK_STATUSES\.filter\(\(s\) => s !== 'draft'\)/);
    expect(board).toMatch(/transitionTaskAction/);
    expect(board).toMatch(/canTransitionTask/);
  });

  it('las tarjetas son clickeables y las agregadas abren su origen', () => {
    expect(board).toMatch(/className="kanban__title"/);
    expect(board).toMatch(/abrir origen/);
  });
});

describe('TASK-009 UI — Calendario y Gantt', () => {
  it('el calendario arma una rejilla mensual con tareas e hitos clickeables', () => {
    expect(calendar).toMatch(/cal-grid/);
    expect(calendar).toMatch(/cal-item/);
    expect(calendar).toMatch(/listMilestones/);
  });

  it('el Gantt marca hoy, hitos y vencidos, con barras clickeables (sin librería)', () => {
    expect(gantt).toMatch(/gantt__today/);
    expect(gantt).toMatch(/gantt__milestone/);
    expect(gantt).toMatch(/is-overdue/);
    expect(gantt).toMatch(/<Link href=\{r\.href\}/);
    expect(gantt).not.toMatch(/from 'gantt|dhtmlx|frappe/);
  });
});

describe('TASK-009 UI — integración con el dashboard', () => {
  it('agrega métricas reales de tareas/proyectos con tarjetas clickeables', () => {
    expect(dashboard).toMatch(/getTaskSummary/);
    expect(dashboard).toMatch(/getProjectSummary/);
    expect(dashboard).toMatch(/href="\/dashboard\/tasks\?tab=overdue"/);
    expect(dashboard).toMatch(/href="\/dashboard\/projects\?status=active"/);
  });
});

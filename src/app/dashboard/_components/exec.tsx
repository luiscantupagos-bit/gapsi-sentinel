/**
 * Componentes del Dashboard Ejecutivo (tema claro). Solo presentación.
 * Cuando un módulo aún no tiene datos, se usa `Placeholder` ("Próximamente" /
 * "En configuración"): no se inventan métricas.
 */
type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

const TONE_HEX: Record<Tone, string> = {
  green: '#16a34a',
  amber: '#d97706',
  red: '#dc2626',
  blue: '#2563eb',
  slate: '#64748b',
};

/** Tarjeta KPI con anillo indicador (o valor grande) y estado opcional. */
export function KpiCard({
  label,
  value,
  tone = 'blue',
  ring,
  note,
  placeholder,
}: {
  label: string;
  value?: React.ReactNode;
  tone?: Tone;
  ring?: number; // 0..100 para dibujar el anillo de progreso
  note?: string;
  placeholder?: string; // si se pasa, la tarjeta muestra el estado en lugar del valor
}) {
  const color = TONE_HEX[tone];
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, ring ?? 0));
  return (
    <div className="kpi">
      <div className="kpi__ring" aria-hidden>
        <svg viewBox="0 0 64 64" width="56" height="56">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#eef2f6" strokeWidth="6" />
          {ring != null && !placeholder && (
            <circle
              cx="32"
              cy="32"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * c} ${c}`}
              transform="rotate(-90 32 32)"
            />
          )}
          <circle cx="32" cy="32" r="16" fill={placeholder ? '#f1f5f9' : `${color}1a`} />
        </svg>
      </div>
      <div className="kpi__body">
        <span className="kpi__label">{label}</span>
        {placeholder ? (
          <span className="kpi__placeholder">{placeholder}</span>
        ) : (
          <span className="kpi__value" style={{ color }}>
            {value}
          </span>
        )}
        {note && <span className="kpi__note">{note}</span>}
      </div>
    </div>
  );
}

/** Medidor semicircular (0..100). Si `value` es null, muestra "En configuración". */
export function SemiGauge({
  value,
  caption,
  placeholder,
}: {
  value: number | null;
  caption?: string;
  placeholder?: string;
}) {
  const cx = 110;
  const cy = 110;
  const rad = 88;
  const zone =
    value == null
      ? '#cbd5e1'
      : value >= 90
        ? '#16a34a'
        : value >= 80
          ? '#84cc16'
          : value >= 70
            ? '#d97706'
            : '#dc2626';
  // Semicírculo de 180° (de 180° a 0°).
  const polar = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)];
  };
  const [sx, sy] = polar(180);
  const [ex, ey] = polar(0);
  const valDeg = value == null ? 180 : 180 - (Math.max(0, Math.min(100, value)) / 100) * 180;
  const [vx, vy] = polar(valDeg);
  return (
    <div
      className="semigauge"
      role="img"
      aria-label={`${caption ?? 'Puntaje'}: ${value ?? 'en configuración'}`}
    >
      <svg viewBox="0 0 220 130" width="100%" style={{ maxWidth: 260 }}>
        <path
          d={`M ${sx} ${sy} A ${rad} ${rad} 0 0 1 ${ex} ${ey}`}
          fill="none"
          stroke="#eef2f6"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {value != null && (
          <path
            d={`M ${sx} ${sy} A ${rad} ${rad} 0 0 1 ${vx} ${vy}`}
            fill="none"
            stroke={zone}
            strokeWidth="16"
            strokeLinecap="round"
          />
        )}
        {value == null ? (
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fill="#64748b">
            {placeholder ?? 'En configuración'}
          </text>
        ) : (
          <>
            <text
              x={cx}
              y={cy - 8}
              textAnchor="middle"
              fontSize="30"
              fontWeight="700"
              fill="#16202b"
            >
              {value}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="#64748b">
              {caption ?? '/100'}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/** Estado vacío para módulos sin datos aún. */
export function Placeholder({
  title = 'Próximamente',
  message,
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="exec-placeholder" role="status">
      <span className="exec-placeholder__badge">{title}</span>
      {message && <p>{message}</p>}
    </div>
  );
}

// Radial gauge for the Skin Health Score — styled like a dermatoscope's
// magnification ring (tick marks + a swept arc) rather than a bare number,
// so the one figure patients check most often reads as a proper instrument.
export default function ScoreDial({ score, label, labelClassName = '', size = 148 }) {
  const center = size / 2
  const r = center - 14
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const dash = (pct / 100) * c

  const ticks = Array.from({ length: 24 }).map((_, i) => {
    const a = (i / 24) * 2 * Math.PI
    const r1 = r - 14
    const r2 = i % 6 === 0 ? r - 21 : r - 17
    return {
      key: i,
      x1: center + r1 * Math.cos(a),
      y1: center + r1 * Math.sin(a),
      x2: center + r2 * Math.cos(a),
      y2: center + r2 * Math.sin(a),
    }
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        <circle cx={center} cy={center} r={r} fill="none" strokeWidth="10" className="stroke-gray-100 dark:stroke-gray-800" />
        {score != null && (
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${center} ${center})`}
            className="stroke-brand-600 dark:stroke-brand-400"
          />
        )}
        <g strokeWidth="1.4" className="stroke-gray-300 dark:stroke-gray-600">
          {ticks.map((t) => (
            <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
          ))}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">{score ?? '—'}</span>
        {label && (
          <span className={`mt-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${labelClassName}`}>{label}</span>
        )}
      </div>
    </div>
  )
}

import { useMemo } from "react";

/**
 * Ventilator pressure–time waveform. Animated draw + subtle pulse.
 * Signature motif — also usable inline as a small logomark.
 */
export function WaveformHero({ height = 220 }: { height?: number }) {
  const path = useMemo(() => {
    // Generate a synthetic ventilator inspiratory/expiratory curve
    const w = 1200;
    const h = height;
    const mid = h * 0.62;
    const amp = h * 0.34;
    const cycles = 4;
    let d = `M 0 ${mid}`;
    for (let c = 0; c < cycles; c++) {
      const x0 = (w / cycles) * c;
      const step = w / cycles;
      // rising limb
      d += ` L ${x0 + step * 0.06} ${mid}`;
      d += ` C ${x0 + step * 0.12} ${mid - amp * 0.9}, ${x0 + step * 0.18} ${mid - amp}, ${x0 + step * 0.24} ${mid - amp}`;
      // plateau
      d += ` L ${x0 + step * 0.5} ${mid - amp * 0.95}`;
      // expiratory decay
      d += ` C ${x0 + step * 0.6} ${mid - amp * 0.4}, ${x0 + step * 0.72} ${mid + amp * 0.06}, ${x0 + step * 0.9} ${mid}`;
      d += ` L ${x0 + step} ${mid}`;
    }
    return d;
  }, [height]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-ink text-ink-foreground shadow-elevated">
      {/* grid overlay */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <svg
        viewBox={`0 0 1200 ${height}`}
        preserveAspectRatio="none"
        className="relative block h-[220px] w-full"
      >
        <defs>
          <linearGradient id="wave-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-teal)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L 1200 ${height} L 0 ${height} Z`} fill="url(#wave-fill)" />
        <path
          d={path}
          fill="none"
          stroke="var(--color-teal)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="waveform-draw"
        />
      </svg>
    </div>
  );
}

export function WaveformMark({ className = "h-6 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 24" className={className} aria-hidden>
      <path
        d="M0 18 L8 18 C10 18 11 6 14 6 L18 6 L22 4 L26 6 C29 6 30 18 32 18 L40 18 C42 18 43 12 46 12 L60 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

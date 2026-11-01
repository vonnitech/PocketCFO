import { useMemo, useState } from 'react';
import { formatCurrency } from '../lib/utils';

type AuditPieChartDatum = {
  name: string;
  total: number;
  color: string;
};

type AuditPieChartProps = {
  data: AuditPieChartDatum[];
};

type ChartSegment = AuditPieChartDatum & {
  dashArray: string;
  dashOffset: number;
  percentage: number;
};

const CHART_SIZE = 208;
const STROKE_WIDTH = 28;
const RADIUS = (CHART_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Fixed gap between slices, and the shortest a slice may be drawn, both in
// chart units. Square ends keep every slice inside its own share: round caps
// spilled half the stroke width onto both neighbours and swallowed small ones.
const GAP = 3;
const MIN_SLICE = 4;

// Colours live in index.css (--chart-1..8) so dark mode can soften them. No
// near-white or near-black (they looked like a hole in the ring), and no red.
const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);

// Stroke widths are set in CSS so dark mode can use a thinner ring sitting in a
// faint track; the gaps then show the track instead of reading as black cracks.
const SLICE_CLASS = '[stroke-width:28] dark:[stroke-width:22]';
const ACTIVE_SLICE_CLASS = '[stroke-width:32] dark:[stroke-width:26]';

export default function AuditPieChart({ data }: AuditPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { segments, total } = useMemo(() => {
    const items = data.filter(item => item.total > 0).sort((a, b) => b.total - a.total);
    const chartTotal = items.reduce((sum, item) => sum + item.total, 0);

    if (chartTotal <= 0) {
      return { segments: [] as ChartSegment[], total: 0 };
    }

    const gap = items.length > 1 ? GAP : 0;
    let start = 0;
    const chartSegments = items.map((item, index) => {
      const percentage = item.total / chartTotal;
      const share = CIRCUMFERENCE * percentage;
      const filledLength = Math.max(share - gap, Math.min(MIN_SLICE, share));
      const dashArray = `${filledLength} ${CIRCUMFERENCE - filledLength}`;
      const dashOffset = -start;

      start += share;

      return {
        ...item,
        color: PALETTE[index % PALETTE.length],
        dashArray,
        dashOffset,
        percentage,
      };
    });

    return { segments: chartSegments, total: chartTotal };
  }, [data]);

  const activeSegment = activeIndex === null ? null : segments[activeIndex];
  const centerLabel = activeSegment?.name ?? 'Total Spend';
  const centerValue = formatCurrency(activeSegment ? activeSegment.total : total);
  const centerShare = activeSegment
    ? `${Math.round(activeSegment.percentage * 100)}%`
    : `${segments.length} ${segments.length === 1 ? 'category' : 'categories'}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full flex items-center justify-center">
        <svg
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
          className="w-56 h-56 overflow-visible"
          role="img"
          aria-label="Spend breakdown donut chart"
        >
          <circle
            cx={CHART_SIZE / 2}
            cy={CHART_SIZE / 2}
            r={RADIUS}
            fill="none"
            style={{ stroke: 'var(--chart-track)' }}
            strokeWidth={STROKE_WIDTH + 4}
            className="hidden dark:block"
          />

          {segments.map((segment, index) => (
            <circle
              key={segment.name}
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={RADIUS}
              fill="none"
              style={{ stroke: segment.color, opacity: activeIndex === null || activeIndex === index ? 1 : 0.35 }}
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
              className={`${activeIndex === index ? ACTIVE_SLICE_CLASS : SLICE_CLASS} transition-all duration-150 cursor-pointer`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(current => (current === index ? null : current))}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(current => (current === index ? null : current))}
              tabIndex={0}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-12 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-text-muted truncate max-w-full">{centerLabel}</p>
          <p className="text-xl font-black tracking-tight text-text-main tabular-nums">{centerValue}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">{centerShare}</p>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2">
        {segments.map((segment, index) => (
          <button
            key={segment.name}
            type="button"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(current => (current === index ? null : current))}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(current => (current === index ? null : current))}
            className={`w-full text-left bg-input border-[3px] rounded-2xl px-4 py-3 transition-colors ${
              activeIndex === index ? 'border-border bg-surface' : 'border-border/30'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted truncate">{segment.name}</span>
              </div>
              <span className="text-xs font-black text-text-main tabular-nums flex-shrink-0">
                {formatCurrency(segment.total)}
                <span className="ml-2 text-[10px] text-text-muted">{Math.round(segment.percentage * 100)}%</span>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

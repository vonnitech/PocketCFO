import { useMemo, useState } from 'react';

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
const GAP_RATIO = 0.012;

const PALETTE = [
  '#000000', '#6366f1', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#84cc16',
];

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function AuditPieChart({ data }: AuditPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { segments, total } = useMemo(() => {
    const chartTotal = data.reduce((sum, item) => sum + item.total, 0);

    if (chartTotal <= 0) {
      return { segments: [] as ChartSegment[], total: 0 };
    }

    let progress = 0;
    const chartSegments = data.map((item, index) => {
      const percentage = item.total / chartTotal;
      const gap = Math.min(CIRCUMFERENCE * GAP_RATIO, CIRCUMFERENCE * percentage * 0.35);
      const filledLength = Math.max(CIRCUMFERENCE * percentage - gap, 0);
      const dashArray = `${filledLength} ${CIRCUMFERENCE - filledLength}`;
      const dashOffset = -progress * CIRCUMFERENCE;

      progress += percentage;

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
  const centerValue = activeSegment ? formatCurrency(activeSegment.total) : formatCurrency(total);
  const centerShare = activeSegment ? `${Math.round(activeSegment.percentage * 100)}%` : `${segments.length} categories`;

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
            stroke="#e5e7eb"
            strokeWidth={STROKE_WIDTH}
          />

          {segments.map((segment, index) => (
            <circle
              key={segment.name}
              cx={CHART_SIZE / 2}
              cy={CHART_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={activeIndex === index ? STROKE_WIDTH + 4 : STROKE_WIDTH}
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
              className="transition-all duration-150 cursor-pointer"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(current => (current === index ? null : current))}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(current => (current === index ? null : current))}
              tabIndex={0}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">{centerLabel}</p>
          <p className="text-2xl font-black italic tracking-tighter text-text-main">{centerValue}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{centerShare}</p>
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
              activeIndex === index ? 'border-black bg-surface' : 'border-black/10'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full border-2 border-black flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 truncate">{segment.name}</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-black flex-shrink-0">
                {Math.round(segment.percentage * 100)}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

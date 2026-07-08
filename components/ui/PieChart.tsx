import type { ReactNode } from "react";

export interface PieChartSegment {
  value: number;
  className: string;
}

export function PieChart({
  center,
  className,
  radius,
  segments,
  size,
  trackClassName
}: {
  center: ReactNode;
  className: string;
  radius: number;
  segments: PieChartSegment[];
  size: number;
  trackClassName: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={className} aria-hidden="true">
      <svg viewBox={`0 0 ${size} ${size}`} role="presentation">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={trackClassName}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {total > 0 ? segments.map((segment) => {
          const length = circumference * (segment.value / total);
          const circle = (
            <circle
              key={segment.className}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className={segment.className}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += length;
          return circle;
        }) : null}
      </svg>
      {center}
    </div>
  );
}

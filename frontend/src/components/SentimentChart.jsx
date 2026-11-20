import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { SENTIMENT_COLORS } from '../utils/constants';

export default function SentimentChart({ positive = 0, neutral = 0, negative = 0 }) {
  const total = positive + neutral + negative;
  const data = [
    { name: 'Positive', value: positive },
    { name: 'Neutral', value: neutral },
    { name: 'Negative', value: negative },
  ];
  // With no data, draw a neutral placeholder ring so the chart area isn't blank.
  const chartData = total > 0 ? data : [{ name: 'No data', value: 1 }];

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div
        className="relative h-44 w-44 shrink-0"
        role="img"
        aria-label={`Sentiment distribution: ${positive} positive, ${neutral} neutral, ${negative} negative`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={total > 0 ? 2 : 0}
              stroke="none"
              isAnimationActive
            >
              {chartData.map((d) => (
                <Cell key={d.name} fill={SENTIMENT_COLORS[d.name] || '#e2e8f0'} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip formatter={(v, n) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">responses</span>
        </div>
      </div>

      <ul className="w-full space-y-3">
        {data.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.name}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: SENTIMENT_COLORS[d.name] }}
                    aria-hidden="true"
                  />
                  {d.name}
                </span>
                <span className="tabular-nums text-slate-500">
                  {d.value} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: SENTIMENT_COLORS[d.name] }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

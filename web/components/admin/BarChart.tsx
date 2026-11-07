'use client';
// One-series bar chart with one axis, whole-number ticks, 4px rounded tops, a hover tooltip and a
// "Show as table" fallback. Bars use the --chart colour from admin.css.
import { useRef, useState } from 'react';
import { dayOf, num, type Daily } from './format';

export function BarChart({ rows, k, label }: { rows: Daily[]; k: 'signups' | 'messages'; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ i: number; x: number; y: number; text: string } | null>(null);
  const W = 560, H = 160, padB = 22, padL = 34;
  const max = Math.max(1, ...rows.map((r) => r[k]));
  const step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / step) * step;
  const bw = (W - padL) / Math.max(1, rows.length), gap = 2;
  const ticks = top >= 2 && top % 2 === 0 ? [0, top / 2, top] : [0, top]; // counts are whole numbers

  const enter = (i: number, text: string) => (e: React.MouseEvent<SVGGElement>) => {
    const g = e.currentTarget, c = wrap.current;
    const hit = g.querySelector('.hit');
    if (!c || !hit) return;
    const r = hit.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const bar = g.querySelector('.cc-bar');
    setTip({ i, text, x: r.left - cr.left + r.width / 2, y: bar ? bar.getBoundingClientRect().top - cr.top : 150 });
  };

  return (
    <>
      <div className="chart" ref={wrap}>
        <svg viewBox={`0 0 ${W} ${H + padB}`} role="img" aria-label={`${label}, last 14 days`}>
          {ticks.map((t) => {
            const y = H - (t / top) * H;
            return (
              <g key={'t' + t}>
                <line className="gridline" x1={padL} x2={W} y1={y} y2={y} />
                <text className="axis" x={padL - 6} y={y + 3} textAnchor="end">{num(t)}</text>
              </g>
            );
          })}
          {rows.map((r, i) => {
            const v = r[k];
            const h = Math.max(v ? 2 : 0, (v / top) * H), x = padL + i * bw + gap / 2, y = H - h, w = Math.max(2, bw - gap - 4);
            const rad = Math.min(4, w / 2), rh = Math.min(4, h);
            const path = h ? `M${x},${H} L${x},${y + rh} Q${x},${y} ${x + rad},${y} L${x + w - rad},${y} Q${x + w},${y} ${x + w},${y + rh} L${x + w},${H} Z` : '';
            const d = dayOf(r.day);
            const text = `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}: ${num(v)}`;
            return (
              <g key={r.day} onMouseEnter={enter(i, text)} onMouseLeave={() => setTip(null)}>
                {path ? <path className={'cc-bar' + (tip?.i === i ? ' hover' : '')} d={path} /> : null}
                <rect className="hit" x={padL + i * bw} y={0} width={bw} height={H} />
                {i % 2 === rows.length % 2 ? null : <text className="axis" x={x + w / 2} y={H + 15} textAnchor="middle">{d.getDate()}</text>}
              </g>
            );
          })}
        </svg>
        <div className="tip" hidden={!tip} style={tip ? { left: tip.x, top: tip.y } : undefined}>{tip?.text}</div>
      </div>
      <details className="table-view">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th>Day</th><th className="num">{label}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td>{dayOf(r.day).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                <td className="num">{num(r[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

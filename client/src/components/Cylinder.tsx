import { ml } from '../util';

type Props = {
  totalMl: number;
  goalMl: number;
  portionMl: number;
  schedule: string[];
  expectedMl: number; // onde a água "deveria estar" agora, pelo cronograma
  pulse: number; // muda a cada registro → bolhas
};

// Geometria da proveta (unidades do viewBox).
const GX = 58;
const GW = 104;
const TOP = 34;
const BOTTOM = 446;
const INNER = BOTTOM - TOP;
const W = 224;

// Onda com período de 50: transladar 50 unidades fecha o loop sem emenda.
const WAVE = (() => {
  let d = 'M -100 0 Q -87.5 -5 -75 0';
  for (let x = -50; x <= W + 100; x += 25) d += ` T ${x} 0`;
  return `${d} V 600 H -100 Z`;
})();

const BUBBLES = [0.22, 0.48, 0.7, 0.35, 0.82, 0.58];

export function Cylinder({ totalMl, goalMl, portionMl, schedule, expectedMl, pulse }: Props) {
  const capacity = goalMl * 1.2;
  const y = (v: number) => BOTTOM - (Math.min(v, capacity) / capacity) * INNER;
  const level = totalMl > 0 ? y(totalMl) : BOTTOM + 8;
  const crowded = schedule.length > 12;
  const pct = Math.round((totalMl / goalMl) * 100);

  const marks = schedule.map((time, i) => {
    const amount = Math.min(goalMl, (i + 1) * portionMl);
    return { time, amount, y: y(amount), label: !crowded || i % 2 === 1 || i === schedule.length - 1 };
  });

  const glass = `M ${GX} ${TOP} V ${BOTTOM - 16} Q ${GX} ${BOTTOM} ${GX + 16} ${BOTTOM} H ${GX + GW - 16} Q ${GX + GW} ${BOTTOM} ${GX + GW} ${BOTTOM - 16} V ${TOP}`;

  return (
    <svg
      className="cyl"
      viewBox={`0 0 ${W} 476`}
      role="img"
      aria-label={`Proveta com ${ml(totalMl)} de ${ml(goalMl)} ml, ${pct}% da meta`}
    >
      <defs>
        <clipPath id="cyl-inner">
          <path d={`${glass} Z`} />
        </clipPath>
        <linearGradient id="cyl-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water-light)" />
          <stop offset="0.18" stopColor="var(--water)" />
          <stop offset="1" stopColor="var(--water-deep)" />
        </linearGradient>
      </defs>

      {/* corpo de vidro */}
      <path d={`${glass} Z`} className="cyl__glass" />

      <g clipPath="url(#cyl-inner)">
        <g className="cyl__level" style={{ transform: `translateY(${level}px)` }}>
          <path d={WAVE} className="cyl__wave cyl__wave--back" />
          <path d={WAVE} className="cyl__wave cyl__wave--front" fill="url(#cyl-water)" />
        </g>
        {pulse > 0 &&
          BUBBLES.map((x, i) => (
            <circle
              key={`${pulse}-${i}`}
              className="cyl__bubble"
              cx={GX + 12 + x * (GW - 24)}
              cy={BOTTOM - 10}
              r={2 + (i % 3)}
              style={{ ['--rise' as string]: `${Math.min(0, level - BOTTOM + 14)}px`, animationDelay: `${i * 90}ms` }}
            />
          ))}
        <rect x={GX + 10} y={TOP + 6} width="7" height={INNER - 30} rx="3.5" className="cyl__shine" />
      </g>

      {/* graduações: ml à esquerda, horário sugerido de cada dose à direita */}
      {marks.map((m, i) => {
        const done = totalMl >= m.amount;
        const isNext = !done && (i === 0 || totalMl >= marks[i - 1].amount);
        return (
          <g key={i} className={`cyl__mark${done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
            <line x1={GX} x2={GX + 20} y1={m.y} y2={m.y} className="cyl__tick" />
            {i > 0 && <line x1={GX} x2={GX + 10} y1={(m.y + marks[i - 1].y) / 2} y2={(m.y + marks[i - 1].y) / 2} className="cyl__tick cyl__tick--minor" />}
            {m.label && (
              <>
                <text x={GX - 8} y={m.y + 3.5} textAnchor="end" className="cyl__ml">
                  {ml(m.amount)}
                </text>
                <text x={GX + GW + 14} y={m.y + 3.5} className="cyl__time">
                  {m.time}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* linha da meta */}
      <line x1={GX - 4} x2={GX + GW + 4} y1={y(goalMl)} y2={y(goalMl)} className="cyl__goal" />
      <text x={GX + GW - 8} y={y(goalMl) - 7} textAnchor="end" className="cyl__goal-label">
        meta
      </text>

      {/* marcador "agora": onde o nível deveria estar pelo cronograma */}
      {expectedMl > 0 && expectedMl <= goalMl && (
        <path d={`M ${GX + GW + 11} ${y(expectedMl) - 5} L ${GX + GW + 3} ${y(expectedMl)} L ${GX + GW + 11} ${y(expectedMl) + 5} Z`} className="cyl__now">
          <title>Pelo cronograma, você estaria em {ml(expectedMl)} ml agora</title>
        </path>
      )}

      <path d={`M ${GX - 9} ${TOP - 8} L ${GX} ${TOP}`} className="cyl__lip" />
      <path d={`M ${GX + GW} ${TOP} L ${GX + GW + 4} ${TOP - 4}`} className="cyl__lip" />
      <rect x={GX - 16} y={BOTTOM + 6} width={GW + 32} height="12" rx="4" className="cyl__foot" />
    </svg>
  );
}

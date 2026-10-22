import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError, type DayPoint, type Summary } from '../api';
import { useUser } from '../App';
import { dayLabel, ml } from '../util';

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const level = (pct: number) => (pct === 0 ? 0 : pct < 50 ? 1 : pct < 100 ? 2 : 3);
const LEVEL_TEXT = ['sem registro', 'menos da metade', 'mais da metade', 'meta batida'];

export function HistoryPage() {
  const { user } = useUser();
  const [days, setDays] = useState<7 | 30>(7);
  const [series, setSeries] = useState<DayPoint[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.summary(user.id).then(setSummary).catch((e: ApiError) => setError(e.message));
  }, [user.id]);

  useEffect(() => {
    api.history(user.id, days).then((h) => setSeries(h.series)).catch((e: ApiError) => setError(e.message));
  }, [user.id, days]);

  if (error) return <p className="form-error" role="alert">{error}</p>;

  return (
    <div className="history">
      <header className="page-head">
        <h1 className="page-title">Histórico</h1>
        <p className="page-sub">Meta atual: {ml(user.goals.dailyGoalMl)} ml por dia</p>
      </header>

      {summary && (
        <dl className="stats">
          <Stat label="Sequência atual" value={summary.currentStreak} unit={summary.currentStreak === 1 ? 'dia' : 'dias'} accent />
          <Stat label="Melhor sequência" value={summary.bestStreak} unit={summary.bestStreak === 1 ? 'dia' : 'dias'} />
          <Stat label="Média diária" value={ml(summary.averageDailyMl)} unit="ml" hint="nos dias com registro" />
          <Stat
            label="Melhor dia"
            value={summary.bestDay ? ml(summary.bestDay.totalMl) : '—'}
            unit={summary.bestDay ? 'ml' : ''}
            hint={summary.bestDay ? dayLabel(summary.bestDay.date, { day: 'numeric', month: 'short' }) : 'ainda sem registros'}
          />
          <Stat label="Meta batida no mês" value={summary.month.rate} unit="%" hint={`${summary.month.metDays} de ${summary.month.days.length} dias`} />
        </dl>
      )}

      <section className="card" aria-labelledby="chart-title">
        <div className="card__head">
          <h2 id="chart-title" className="section-title">Mililitros por dia</h2>
          <div className="segmented" role="group" aria-label="Período">
            {([7, 30] as const).map((d) => (
              <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>
                {d} dias
              </button>
            ))}
          </div>
        </div>
        {series ? <DailyChart data={series} goal={user.goals.dailyGoalMl} /> : <div className="skeleton skeleton--chart" />}
      </section>

      {summary && (
        <section className="card" aria-labelledby="cal-title">
          <h2 id="cal-title" className="section-title">
            {dayLabel(summary.month.start, { month: 'long', year: 'numeric' })}
          </h2>
          <Calendar summary={summary} />
        </section>
      )}

      {summary && (
        <section aria-labelledby="badges-title">
          <h2 id="badges-title" className="section-title">Conquistas</h2>
          <ul className="badges">
            {summary.badges.map((b) => (
              <li key={b.id} className={`badge${b.earned ? ' is-earned' : ''}`}>
                <svg viewBox="0 0 24 30" aria-hidden="true" className="badge__drop">
                  <path d="M12 2 C 12 2 3 13 3 19.5 A 9 9 0 0 0 21 19.5 C 21 13 12 2 12 2 Z" />
                </svg>
                <div>
                  <p className="badge__title">{b.title}</p>
                  <p className="badge__desc">
                    {b.description}
                    <span className="sr-only">{b.earned ? ' (conquistada)' : ' (ainda não conquistada)'}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, unit, hint, accent }: { label: string; value: string | number; unit: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`stat${accent ? ' stat--accent' : ''}`}>
      <dt>{label}</dt>
      <dd>
        <span className="stat__value">{value}</span>
        {unit !== '%' && ' '}
        <span className="stat__unit">{unit}</span>
        {hint && <span className="stat__hint">{hint}</span>}
      </dd>
    </div>
  );
}

function DailyChart({ data, goal }: { data: DayPoint[]; goal: number }) {
  const short = data.length <= 7;
  const tick = (d: string) => (short ? dayLabel(d, { weekday: 'short' }).replace('.', '') : dayLabel(d, { day: 'numeric' }));
  const max = Math.max(goal * 1.15, ...data.map((d) => d.totalMl));

  return (
    <>
      <div className="chart" aria-hidden="true">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -8 }} barCategoryGap={short ? '28%' : '18%'}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
            <XAxis dataKey="date" tickFormatter={tick} tickLine={false} axisLine={{ stroke: 'var(--line)' }} interval={short ? 0 : 'preserveStartEnd'} minTickGap={6} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} />
            <YAxis domain={[0, Math.ceil(max / 500) * 500]} tickFormatter={(v: number) => (v ? `${(v / 1000).toLocaleString('pt-BR')} L` : '0')} tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--ink-soft)', fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: 'var(--hover)' }}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as DayPoint | undefined);
                if (!p) return null;
                return (
                  <div className="tip">
                    <p className="tip__date">{dayLabel(p.date, { weekday: 'long', day: 'numeric', month: 'short' })}</p>
                    <p className="tip__value">
                      {ml(p.totalMl)} ml <span>· {p.pct}% da meta</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="totalMl" radius={[4, 4, 0, 0]} isAnimationActive={!window.matchMedia('(prefers-reduced-motion: reduce)').matches}>
              {data.map((d) => (
                <Cell key={d.date} fill={d.totalMl >= goal ? 'var(--water-deep)' : 'var(--water-light)'} />
              ))}
            </Bar>
            <ReferenceLine y={goal} stroke="var(--amber)" strokeWidth={2} strokeDasharray="6 4" label={{ value: 'meta', position: 'insideTopRight', fill: 'var(--amber-ink)', fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-key">
        <span className="key key--met" /> bateu a meta <span className="key key--miss" /> abaixo da meta <span className="key key--goal" /> meta
      </p>
      <table className="sr-only">
        <caption>Mililitros bebidos por dia nos últimos {data.length} dias</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Total</th>
            <th>% da meta</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{dayLabel(d.date, { day: 'numeric', month: 'long' })}</td>
              <td>{ml(d.totalMl)} ml</td>
              <td>{d.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Calendar({ summary }: { summary: Summary }) {
  const { start, days } = summary.month;
  const first = new Date(`${start}T12:00:00Z`);
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const offset = first.getUTCDay();
  const byDate = new Map(days.map((d) => [d.date, d]));

  return (
    <>
      <div className="cal__row" aria-hidden="true">
        {WEEK.map((w, i) => (
          <span key={i} className="cal__wd">
            {w}
          </span>
        ))}
      </div>
      <ol className="cal__row cal__days" aria-label="Dias do mês coloridos pela % da meta">
        {Array.from({ length: offset }, (_, i) => (
          <li key={`e${i}`} className="cal__day cal__day--empty" aria-hidden="true" />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const date = `${start.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
          const d = byDate.get(date);
          const lv = d ? level(d.pct) : -1;
          return (
            <li
              key={date}
              className={`cal__day lv${lv}${date === summary.today ? ' is-today' : ''}`}
              aria-label={d ? `Dia ${i + 1}: ${ml(d.totalMl)} ml, ${LEVEL_TEXT[lv]}` : `Dia ${i + 1}: ainda não chegou`}
              title={d ? `${ml(d.totalMl)} ml · ${d.pct}%` : undefined}
            >
              {i + 1}
            </li>
          );
        })}
      </ol>
      <p className="chart-key">
        {LEVEL_TEXT.map((t, i) => (
          <span key={t} className="chart-key__item">
            <span className={`key lv${i}`} /> {t}
          </span>
        ))}
      </p>
    </>
  );
}

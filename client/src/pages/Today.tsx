import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type Intake, type Today } from '../api';
import { useUser } from '../App';
import { Cylinder } from '../components/Cylinder';
import { Celebrate } from '../components/Celebrate';
import { dayLabel, minutesNow, ml, timeIn, toMinutes, useCountUp } from '../util';

const QUICK = [150, 250, 350, 500];

export function TodayPage() {
  const { user } = useUser();
  const [today, setToday] = useState<Today | null>(null);
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const [custom, setCustom] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const reached = useRef<boolean | null>(null);

  const refresh = useCallback(async () => {
    const [t, list] = await Promise.all([api.today(user.id), api.listIntakes(user.id)]);
    if (reached.current === false && t.goalReached) setCelebrate(Date.now());
    reached.current = t.goalReached;
    setToday(t);
    setIntakes(list.intakes);
  }, [user.id]);

  useEffect(() => {
    refresh().catch((e: ApiError) => setError(e.message));
    const t = setInterval(() => refresh().catch(() => {}), 60_000); // vira o dia / próxima dose
    return () => clearInterval(t);
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      setAnnounce(message);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const drink = (amount: number) =>
    run(async () => {
      await api.addIntake(user.id, amount);
      setPulse((p) => p + 1);
    }, `${ml(amount)} ml registrados`);

  const remove = (i: Intake) =>
    run(() => api.deleteIntake(user.id, i.id), `Registro de ${ml(i.amountMl)} ml excluído`);

  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(custom);
    if (n >= 1 && n <= 2000) {
      drink(Math.round(n));
      setCustom(null);
    }
  };

  const shown = useCountUp(today?.totalMl ?? 0);
  if (!today) return error ? <p className="form-error" role="alert">{error}</p> : <div className="skeleton" aria-busy="true" aria-label="Carregando o dia" />;

  const cup = user.goals.defaultCupMl;
  const last = intakes.at(-1);
  const now = minutesNow(user.timezone);
  const expectedMl = Math.min(today.goalMl, today.schedule.filter((t) => toMinutes(t) <= now).length * today.portionMl);
  const pctShown = Math.round((shown / today.goalMl) * 100);

  return (
    <div className="today">
      <Celebrate trigger={celebrate} />
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <section className="today__glass" aria-label="Progresso de hoje">
        <Cylinder
          totalMl={today.totalMl}
          goalMl={today.goalMl}
          portionMl={today.portionMl}
          schedule={today.schedule}
          expectedMl={expectedMl}
          pulse={pulse}
        />
      </section>

      <div className="today__reading">
        <p className="eyebrow">{dayLabel(today.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="reading">
          <span className="reading__value">{ml(shown)}</span>
          <span className="reading__unit">ml</span>
        </h1>
        <p className="reading__of">
          de {ml(today.goalMl)} ml · <strong className={today.goalReached ? 'is-reached' : ''}>{pctShown}%</strong>
          {today.goalReached && <span className="tag">meta batida</span>}
        </p>
      </div>

      <div className="today__actions">

        <button className="drink" onClick={() => drink(cup)} disabled={busy}>
          <span className="drink__label">Bebi água</span>
          <span className="drink__amount">+{ml(cup)} ml</span>
        </button>

        <div className="quick" role="group" aria-label="Registrar outra quantidade">
          {QUICK.map((q) => (
            <button key={q} className="chip" onClick={() => drink(q)} disabled={busy} aria-label={`Registrar ${q} ml`}>
              {q}
            </button>
          ))}
          <button className="chip" onClick={() => setCustom(custom === null ? '' : null)} aria-expanded={custom !== null}>
            Outro
          </button>
        </div>
        {custom !== null && (
          <form className="custom" onSubmit={submitCustom}>
            <label htmlFor="custom-ml" className="sr-only">
              Quantidade em ml
            </label>
            <input id="custom-ml" className="input" type="number" inputMode="numeric" min={1} max={2000} placeholder="ml" value={custom} onChange={(e) => setCustom(e.target.value)} autoFocus />
            <button className="btn btn--primary" disabled={busy || !(Number(custom) >= 1 && Number(custom) <= 2000)}>
              Registrar
            </button>
          </form>
        )}

        {last && (
          <button className="link undo" onClick={() => remove(last)} disabled={busy}>
            Desfazer último ({ml(last.amountMl)} ml às {timeIn(last.timestamp, user.timezone)})
          </button>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}

        <dl className="readouts">
          <div>
            <dt>Doses</dt>
            <dd>
              {today.dosesTaken}<small>/{today.dosesPlanned}</small>
            </dd>
          </div>
          <div>
            <dt>Faltam</dt>
            <dd>
              {ml(today.remainingMl)}<small> ml</small>
            </dd>
          </div>
          <div className="readouts__wide">
            <dt>Próxima dose</dt>
            <dd>
              {today.nextDose ? (
                <>
                  {today.nextDose.late ? 'agora' : today.nextDose.time}
                  <small> · {ml(today.nextDose.amountMl)} ml</small>
                </>
              ) : (
                <small>meta cumprida, beba quando tiver sede</small>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <section className="timeline" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="section-title">Registros de hoje</h2>
        {intakes.length === 0 ? (
          <p className="empty">Nenhum registro ainda. Toque em "Bebi água" depois do primeiro copo.</p>
        ) : (
          <ol className="timeline__list">
            {[...intakes].reverse().map((i) => (
              <li key={i.id} className="timeline__item">
                <time dateTime={i.timestamp}>{timeIn(i.timestamp, user.timezone)}</time>
                <span className="timeline__bar" style={{ ['--w' as string]: `${Math.min(100, (i.amountMl / 500) * 100)}%` }} aria-hidden="true" />
                <span className="timeline__ml">{ml(i.amountMl)} ml</span>
                <button
                  className="icon-btn"
                  onClick={() => remove(i)}
                  disabled={busy}
                  aria-label={`Excluir registro de ${ml(i.amountMl)} ml às ${timeIn(i.timestamp, user.timezone)}`}
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

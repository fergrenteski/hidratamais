import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ApiError, type Goals } from '../api';
import { useUser } from '../App';
import { ml } from '../util';

const CUPS = [150, 250, 350, 500];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function GoalsPage() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const onboarding = useSearchParams()[0].has('inicio');
  const [g, setG] = useState<Goals>(user.goals);
  const [weight, setWeight] = useState(user.goals.weightKg ? String(user.goals.weightKg) : '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Goals>) => {
    setG((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };
  const num = (v: string) => (v === '' ? 0 : Number(v));

  const kg = Number(weight);
  const suggested = kg >= 20 && kg <= 400 ? clamp(Math.round((kg * 35) / 50) * 50, 500, 10000) : null;
  const portion = g.dosesPerDay > 0 ? Math.ceil(g.dailyGoalMl / g.dosesPerDay) : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await api.updateGoals(user.id, { ...g, weightKg: suggested !== null ? kg : null });
      setUser(u);
      if (onboarding) navigate('/', { replace: true });
      else setSaved(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="goals">
      <header className="page-head">
        <h1 className="page-title">{onboarding ? `Oi, ${user.name}. Vamos calibrar?` : 'Metas'}</h1>
        <p className="page-sub">
          {onboarding ? 'Os valores abaixo são um bom ponto de partida. Ajuste se quiser e salve.' : 'Mudanças valem a partir de agora e recalculam o histórico.'}
        </p>
      </header>

      <form className="form" onSubmit={submit}>
        <fieldset className="field">
          <legend className="field__legend">Meta diária</legend>
          <div className="field__row">
            <label className="field__item">
              <span className="label">Mililitros por dia</span>
              <input className="input input--num" type="number" inputMode="numeric" min={500} max={10000} step={50} required value={g.dailyGoalMl || ''} onChange={(e) => set({ dailyGoalMl: num(e.target.value) })} />
            </label>
            <label className="field__item">
              <span className="label">Seu peso (kg, opcional)</span>
              <input className="input input--num" type="number" inputMode="decimal" min={20} max={400} step="0.1" value={weight} onChange={(e) => { setWeight(e.target.value); setSaved(false); }} />
            </label>
          </div>
          {suggested !== null && suggested !== g.dailyGoalMl && (
            <button type="button" className="suggest" onClick={() => set({ dailyGoalMl: suggested })}>
              Usar sugestão: 35 ml × {kg.toLocaleString('pt-BR')} kg ≈ <strong>{ml(suggested)} ml</strong>
            </button>
          )}
        </fieldset>

        <fieldset className="field">
          <legend className="field__legend">Doses ao longo do dia</legend>
          <div className="field__row">
            <label className="field__item">
              <span className="label">Quantas vezes</span>
              <input className="input input--num" type="number" inputMode="numeric" min={1} max={24} required value={g.dosesPerDay || ''} onChange={(e) => set({ dosesPerDay: num(e.target.value) })} />
            </label>
            <p className="calc" aria-live="polite">
              <span className="calc__value">{portion ? ml(portion) : '—'}</span> ml por dose
            </p>
          </div>
          <div className="field__row">
            <label className="field__item">
              <span className="label">Primeira dose</span>
              <input className="input" type="time" required value={g.window.start} onChange={(e) => set({ window: { ...g.window, start: e.target.value } })} />
            </label>
            <label className="field__item">
              <span className="label">Última dose</span>
              <input className="input" type="time" required value={g.window.end} onChange={(e) => set({ window: { ...g.window, end: e.target.value } })} />
            </label>
          </div>
          <p className="hint">Os horários sugeridos são distribuídos igualmente entre a primeira e a última dose.</p>
        </fieldset>

        <fieldset className="field">
          <legend className="field__legend">Copo padrão</legend>
          <p className="hint">É o volume registrado pelo botão "Bebi água".</p>
          <div className="quick" role="radiogroup" aria-label="Tamanhos comuns">
            {CUPS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={g.defaultCupMl === c} className="chip" onClick={() => set({ defaultCupMl: c })}>
                {c} ml
              </button>
            ))}
          </div>
          <label className="field__item">
            <span className="label">Ou outro volume (ml)</span>
            <input className="input input--num" type="number" inputMode="numeric" min={1} max={2000} required value={g.defaultCupMl || ''} onChange={(e) => set({ defaultCupMl: num(e.target.value) })} />
          </label>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form__actions">
          <button className="btn btn--primary" disabled={busy}>
            {onboarding ? 'Salvar e começar' : 'Salvar metas'}
          </button>
          {saved && <span className="saved" role="status">Metas salvas</span>}
        </div>
      </form>
    </div>
  );
}

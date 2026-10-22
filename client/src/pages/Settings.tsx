import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../api';
import { useUser } from '../App';
import { applyTheme, ml, storage, type Theme } from '../util';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'Automático' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
];

export function SettingsPage() {
  const { user, setUser, logout } = useUser();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [theme, setTheme] = useState<Theme>((storage.get('hm-theme') as Theme) || 'system');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setUser(await api.updateUser(user.id, { name }));
      setMsg({ ok: true, text: 'Nome atualizado' });
    } catch (err) {
      setMsg({ ok: false, text: (err as ApiError).message });
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    setBusy(true);
    try {
      await api.deleteUser(user.id);
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setMsg({ ok: false, text: (err as ApiError).message });
      setBusy(false);
    }
  }

  const leave = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="settings">
      <header className="page-head">
        <h1 className="page-title">Ajustes</h1>
      </header>

      <form className="card form" onSubmit={saveName}>
        <label className="field__item">
          <span className="label">Seu nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required />
        </label>
        <div className="form__actions">
          <button className="btn btn--primary" disabled={busy || name.trim() === user.name || name.trim().length < 2}>
            Salvar nome
          </button>
          {msg && (
            <span className={msg.ok ? 'saved' : 'form-error'} role={msg.ok ? 'status' : 'alert'}>
              {msg.text}
            </span>
          )}
        </div>
      </form>

      <section className="card">
        <h2 className="section-title">Metas</h2>
        <p className="hint">
          {ml(user.goals.dailyGoalMl)} ml em {user.goals.dosesPerDay} doses, das {user.goals.window.start} às {user.goals.window.end}. Copo padrão de {ml(user.goals.defaultCupMl)} ml.
        </p>
        <Link className="btn btn--ghost" to="/metas">
          Editar metas
        </Link>
      </section>

      <section className="card">
        <h2 className="section-title" id="theme-title">Tema</h2>
        <div className="segmented" role="radiogroup" aria-labelledby="theme-title">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={theme === t.id}
              onClick={() => {
                setTheme(t.id);
                applyTheme(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Trocar de usuário</h2>
        <p className="hint">Seus dados continuam salvos. Para voltar, use "Retomar pelo nome" com {user.name}.</p>
        <button className="btn btn--ghost" onClick={leave}>
          Sair deste perfil
        </button>
      </section>

      <section className="card card--danger">
        <h2 className="section-title">Excluir meus dados</h2>
        <p className="hint">Apaga seu perfil, suas metas e todos os registros de água. Não dá para desfazer.</p>
        {confirming ? (
          <div className="form__actions">
            <button className="btn btn--danger" onClick={deleteAll} disabled={busy}>
              Excluir tudo definitivamente
            </button>
            <button className="btn btn--ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button className="btn btn--danger-ghost" onClick={() => setConfirming(true)}>
            Excluir todos os meus dados
          </button>
        )}
      </section>
    </div>
  );
}

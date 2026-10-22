import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError, type User, type UserMatch } from '../api';
import { Wordmark } from '../App';

export function Welcome({ onReady }: { onReady: (u: User) => void }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'new' | 'resume'>('new');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [matches, setMatches] = useState<UserMatch[] | null>(null);

  const switchMode = (m: 'new' | 'resume') => {
    setMode(m);
    setError(null);
    setMatches(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'new') {
        onReady(await api.createUser(name));
        navigate('/metas?inicio=1', { replace: true });
      } else {
        const found = await api.searchUsers(name);
        if (found.length === 1) return resume(found[0].id);
        setMatches(found);
        if (!found.length) setError(`Ninguém chamado "${name.trim()}" por aqui. Confira a grafia ou crie um perfil novo.`);
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.code === 'NAME_TAKEN') {
        setMode('resume');
        setError(`"${name.trim()}" já tem perfil. Toque em "Retomar perfil" para continuar de onde parou.`);
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resume(id: string) {
    setBusy(true);
    try {
      onReady(await api.getUser(id));
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }

  return (
    <main className="welcome">
      <div className="welcome__brand">
        <Wordmark />
      </div>
      <h1 className="welcome__title">
        Quanto você <span>bebeu</span> hoje?
      </h1>
      <p className="welcome__lead">
        Defina uma meta, registre cada copo com um toque e veja a proveta encher ao longo do dia. Sem senha: só o seu nome.
      </p>

      <form className="welcome__form" onSubmit={submit} noValidate>
        <label htmlFor="name" className="label">
          {mode === 'new' ? 'Como podemos te chamar?' : 'Qual nome você usou?'}
        </label>
        <div className="welcome__row">
          <input
            id="name"
            className="input input--lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={40}
            autoComplete="given-name"
            autoFocus
            required
            aria-describedby={error ? 'name-error' : undefined}
            aria-invalid={!!error}
          />
          <button className="btn btn--primary" disabled={busy || name.trim().length < 2}>
            {mode === 'new' ? 'Começar' : 'Retomar perfil'}
          </button>
        </div>
        {error && (
          <p id="name-error" className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>

      {matches && matches.length > 1 && (
        <ul className="matches" aria-label="Perfis encontrados">
          {matches.map((m) => (
            <li key={m.id}>
              <button className="btn btn--ghost" onClick={() => resume(m.id)}>
                {m.name} · desde {new Date(m.createdAt).toLocaleDateString('pt-BR')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="welcome__switch">
        {mode === 'new' ? (
          <>
            Já usou antes neste ou em outro aparelho?{' '}
            <button className="link" onClick={() => switchMode('resume')}>
              Retomar pelo nome
            </button>
          </>
        ) : (
          <>
            Primeira vez aqui?{' '}
            <button className="link" onClick={() => switchMode('new')}>
              Criar perfil novo
            </button>
          </>
        )}
      </p>
    </main>
  );
}

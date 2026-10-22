import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router';
import { api, ApiError, USER_MISSING, type User } from './api';
import { storage } from './util';
import { Welcome } from './pages/Welcome';
import { TodayPage } from './pages/Today';
import { GoalsPage } from './pages/Goals';
import { SettingsPage } from './pages/Settings';

// Recharts pesa ~350 kB: só baixa ao abrir o histórico.
const HistoryPage = lazy(() => import('./pages/History').then((m) => ({ default: m.HistoryPage })));

const KEY = 'hm-user-id';

type UserCtx = { user: User; setUser: (u: User) => void; logout: () => void };
const Ctx = createContext<UserCtx | null>(null);
export const useUser = () => useContext(Ctx)!;

export function App() {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'offline'>('loading');

  const load = useCallback(() => {
    const id = storage.get(KEY);
    if (!id) return setStatus('ready');
    setStatus('loading');
    api
      .getUser(id)
      .then((u) => {
        setUserState(u);
        setStatus('ready');
      })
      .catch((e: ApiError) => {
        if (e.status === 404) {
          storage.set(KEY, null);
          setStatus('ready');
        } else setStatus('offline');
      });
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const onMissing = () => {
      storage.set(KEY, null);
      setUserState(null);
    };
    window.addEventListener(USER_MISSING, onMissing);
    return () => window.removeEventListener(USER_MISSING, onMissing);
  }, []);

  const setUser = (u: User) => {
    storage.set(KEY, u.id);
    setUserState(u);
  };
  const logout = () => {
    storage.set(KEY, null);
    setUserState(null);
  };

  if (status === 'loading') return <div className="boot" aria-busy="true" aria-label="Carregando" />;
  if (status === 'offline')
    return (
      <main className="boot boot--msg">
        <p>Não foi possível falar com o servidor.</p>
        <button className="btn" onClick={load}>
          Tentar de novo
        </button>
      </main>
    );

  return (
    <Routes>
      {user ? (
        <Route element={<Ctx.Provider value={{ user, setUser, logout }}><Shell /></Ctx.Provider>}>
          <Route index element={<TodayPage />} />
          <Route path="historico" element={<Suspense fallback={<div className="skeleton" />}><HistoryPage /></Suspense>} />
          <Route path="metas" element={<GoalsPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Welcome onReady={setUser} />} />
      )}
    </Routes>
  );
}

function Shell() {
  const links = [
    { to: '/', label: 'Hoje', end: true },
    { to: '/historico', label: 'Histórico' },
    { to: '/metas', label: 'Metas' },
    { to: '/ajustes', label: 'Ajustes' },
  ];
  return (
    <>
      <a className="skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topbar">
        <Wordmark />
        <nav aria-label="Principal" className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav__link">
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="conteudo" className="page" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="HidrataMais">
      <svg viewBox="0 0 20 28" aria-hidden="true" className="wordmark__icon">
        <rect x="3" y="1.5" width="14" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="4.5" y="12" width="11" height="13" rx="1.6" className="wordmark__water" />
        <path d="M3 8h5M3 13h5M3 18h5" className="wordmark__ticks" strokeWidth="1.6" />
      </svg>
      <span>
        Hidrata<em>Mais</em>
      </span>
    </span>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { Election } from '../../types';
import { ErrorAlert, Spinner, btnPrimary, inputCls } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

export default function VoterLogin() {
  const { electionId } = useParams<{ electionId: string }>();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [election, setElection] = useState<Election | null | undefined>();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!electionId) return;
    getDoc(doc(db, 'elections', electionId))
      .then((snap) =>
        setElection(
          snap.exists() ? ({ id: snap.id, ...snap.data() } as Election) : null,
        ),
      )
      .catch(() => setElection(null));
  }, [electionId]);

  if (election === undefined) return <Spinner label="Carregando..." />;
  if (!electionId || election === null) {
    return (
      <p className="p-10 text-center text-slate-500">
        Eleição não encontrada ou ainda não aberta.
      </p>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { token } = await api.voterLogin({ electionId, login, password });
      await signInWithCustomToken(auth, token);
      await refresh();
      navigate(`/cabine/${electionId}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">{election.name}</h1>
        {election.description && (
          <p className="mt-1 text-sm text-slate-500">{election.description}</p>
        )}
        <p className="mt-4 mb-6 text-sm text-slate-600">
          Identifique-se com o usuário e a senha que você recebeu.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Usuário</label>
            <input
              required
              className={inputCls}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Senha</label>
            <input
              type="password"
              required
              className={inputCls}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <ErrorAlert message={error} />
          <button type="submit" disabled={submitting} className={`${btnPrimary} w-full`}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

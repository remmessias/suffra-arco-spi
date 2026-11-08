import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { ErrorAlert, Spinner, btnPrimary, inputCls } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

type Phase = 'validating' | 'password' | 'error';

/** Detecta o erro do backend que sinaliza "este link exige senha". */
function passwordRequired(err: unknown): boolean {
  const details = (err as { details?: { reason?: string } })?.details;
  return details?.reason === 'password-required';
}

/** Entrada pelo link único: troca o token da URL por uma sessão de eleitor. */
export default function LinkEntry() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [phase, setPhase] = useState<Phase>('validating');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  const redeem = async (pwd?: string) => {
    if (!token) return;
    const result = await api.redeemAccessLink(
      pwd ? { token, password: pwd } : { token },
    );
    await signInWithCustomToken(auth, result.token);
    await refresh();
    navigate(`/cabine/${result.electionId}`, { replace: true });
  };

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // evita chamada dupla no StrictMode
    (async () => {
      try {
        await redeem();
      } catch (err) {
        if (passwordRequired(err)) {
          setPhase('password');
        } else {
          setError(errorMessage(err));
          setPhase('error');
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await redeem(password);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  if (phase === 'password') {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">Senha de votação</h1>
          <p className="mt-1 text-sm text-slate-500">
            Este link exige a sua senha pessoal para liberar o voto.
          </p>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <input
              type="password"
              autoFocus
              autoComplete="off"
              className={inputCls}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <ErrorAlert message={error} />
            <button
              type="submit"
              className={`${btnPrimary} w-full`}
              disabled={submitting || !password}
            >
              {submitting ? 'Validando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {phase === 'error' ? (
          <ErrorAlert message={error} />
        ) : (
          <Spinner label="Validando seu link de votação..." />
        )}
      </div>
    </div>
  );
}

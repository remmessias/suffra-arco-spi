import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { ErrorAlert, Spinner } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

/** Entrada pelo link único: troca o token da URL por uma sessão de eleitor. */
export default function LinkEntry() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // evita chamada dupla no StrictMode
    (async () => {
      try {
        const result = await api.redeemAccessLink({ token });
        await signInWithCustomToken(auth, result.token);
        await refresh();
        navigate(`/cabine/${result.electionId}`, { replace: true });
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [token, navigate, refresh]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <ErrorAlert message={error} />
        ) : (
          <Spinner label="Validando seu link de votação..." />
        )}
      </div>
    </div>
  );
}

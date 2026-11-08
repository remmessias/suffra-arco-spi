import { useEffect, useState, type FormEvent } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Election, PollWorker, PollWorkerAccessRow } from '../../../types';
import {
  Card,
  ErrorAlert,
  Spinner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';

export default function PollWorkersTab({ election }: { election: Election }) {
  const [workers, setWorkers] = useState<PollWorker[] | null>(null);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<PollWorkerAccessRow | null>(null);
  const [busy, setBusy] = useState('');

  const mesaUrl = `${window.location.origin}/mesa/${election.id}`;

  useEffect(() => {
    const q = query(
      collection(db, 'elections', election.id, 'pollworkers'),
      orderBy('name'),
    );
    return onSnapshot(q, (snap) => {
      setWorkers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PollWorker));
    });
  }, [election.id]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const row = await api.createPollWorker({
        electionId: election.id,
        name: name.trim(),
        login: login.trim() || undefined,
      });
      setCreated(row);
      setName('');
      setLogin('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onReset = async (w: PollWorker) => {
    if (!window.confirm(`Gerar nova senha para ${w.name}?`)) return;
    setBusy(w.id);
    try {
      setCreated(
        await api.resetPollWorkerAccess({
          electionId: election.id,
          pollWorkerId: w.id,
        }),
      );
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const onDelete = async (w: PollWorker) => {
    if (!window.confirm(`Remover o mesário ${w.name}?`)) return;
    setBusy(w.id);
    try {
      await api.deletePollWorker({ electionId: election.id, pollWorkerId: w.id });
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  if (!workers) return <Spinner label="Carregando mesários..." />;

  return (
    <div className="space-y-4">
      <Card title="Cadastrar mesário">
        <p className="mb-3 text-sm text-slate-600">
          Cada mesário recebe usuário e senha para operar o credenciamento na
          página da mesa. Compartilhe o endereço:{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            {mesaUrl}
          </code>
        </p>
        <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            required
            className={inputCls}
            placeholder="Nome do mesário *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Usuário (opcional)"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoCapitalize="none"
          />
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? 'Criando...' : 'Cadastrar'}
          </button>
        </form>
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      </Card>

      {created && (
        <Card
          title={`Acesso de ${created.name}`}
          actions={
            <button className={btnSecondary} onClick={() => setCreated(null)}>
              Fechar
            </button>
          }
        >
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Copie agora — a senha não fica salva no sistema.
          </p>
          <div className="mt-3 space-y-1 font-mono text-sm">
            <p>Usuário: {created.login}</p>
            <p>Senha: {created.password}</p>
            <p className="break-all">Mesa: {mesaUrl}</p>
          </div>
        </Card>
      )}

      <Card title={`Mesários (${workers.length})`}>
        {workers.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum mesário cadastrado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {workers.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{w.name}</p>
                  <p className="font-mono text-xs text-slate-500">{w.login}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    className={btnSecondary}
                    disabled={busy === w.id}
                    onClick={() => onReset(w)}
                  >
                    Nova senha
                  </button>
                  <button
                    className={btnDanger}
                    disabled={busy === w.id}
                    onClick={() => onDelete(w)}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

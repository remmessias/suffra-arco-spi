import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Election } from '../../types';
import { Spinner, StatusBadge, btnPrimary } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

export default function Dashboard() {
  const [elections, setElections] = useState<Election[] | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'elections'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setElections(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Election),
      );
    });
  }, []);

  if (!elections) return <Spinner label="Carregando eleições..." />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Eventos</h1>
        <Link to="/admin/eleicoes/nova" className={btnPrimary}>
          + Novo evento
        </Link>
      </div>

      {elections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          Nenhum evento criado ainda. Comece criando o primeiro.
        </p>
      ) : (
        <ul className="space-y-3">
          {elections.map((e) => (
            <li key={e.id}>
              <Link
                to={`/admin/eleicoes/${e.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-300"
              >
                <div>
                  <p className="font-semibold text-slate-900">{e.name}</p>
                  <p className="text-sm text-slate-500">
                    {e.kind === 'attendance'
                      ? 'Somente credenciamento'
                      : e.authMode === 'credentials'
                        ? 'Acesso por login e senha'
                        : 'Acesso por link único'}{' '}
                    · criado em {formatDateTime(e.createdAt)}
                  </p>
                </div>
                <StatusBadge status={e.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

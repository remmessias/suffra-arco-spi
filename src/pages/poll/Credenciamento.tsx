import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { Election, Voter, VoterSearchResult } from '../../types';
import {
  ErrorAlert,
  Spinner,
  btnDanger,
  btnPrimary,
  inputCls,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useElectionStats } from '../../hooks/election';
import { formatCpf, percent } from '../../utils/format';

type Row = VoterSearchResult;

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function Credenciamento() {
  const { electionId } = useParams<{ electionId: string }>();
  const { loading, pollWorker } = useAuth();

  if (loading) return <Spinner label="Carregando..." />;
  if (!electionId || !pollWorker || pollWorker.electionId !== electionId) {
    return <Navigate to={`/mesa/${electionId ?? ''}`} replace />;
  }
  return <Booth electionId={electionId} workerName={pollWorker.name} />;
}

function Booth({
  electionId,
  workerName,
}: {
  electionId: string;
  workerName: string;
}) {
  const stats = useElectionStats(electionId);
  const [election, setElection] = useState<Election | null>(null);
  const [queryText, setQueryText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  // Estado do modo online (busca via Cloud Function).
  const [onlineResults, setOnlineResults] = useState<Row[] | null>(null);
  const [searching, setSearching] = useState(false);
  const reqId = useRef(0);

  // Estado do modo offline (lista local + fila do SDK).
  const [roll, setRoll] = useState<Voter[] | null>(null);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  const offline = election?.offlinePresence === true;

  useEffect(() => {
    getDoc(doc(db, 'elections', electionId)).then((snap) =>
      setElection({ id: snap.id, ...snap.data() } as Election),
    );
  }, [electionId]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Modo offline: carrega a lista do evento e mantém em cache; conta as escritas
  // ainda não sincronizadas (fila local do SDK).
  useEffect(() => {
    if (!offline) return;
    const q = query(
      collection(db, 'elections', electionId, 'voters'),
      orderBy('name'),
    );
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      setRoll(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Voter));
      setPending(snap.docs.filter((d) => d.metadata.hasPendingWrites).length);
    });
  }, [offline, electionId]);

  // Modo online: busca no servidor com debounce.
  useEffect(() => {
    if (offline) return;
    const term = queryText.trim();
    if (term.length < 2) {
      setOnlineResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const { voters } = await api.searchVoters({ query: term });
        if (id === reqId.current) setOnlineResults(voters);
      } catch (err) {
        if (id === reqId.current) setError(errorMessage(err));
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [offline, queryText]);

  // Modo offline: filtra a lista localmente (sem rede).
  const offlineResults = useMemo<Row[] | null>(() => {
    if (!offline) return null;
    const term = normalize(queryText);
    if (term.length < 2 || !roll) return null;
    const digits = queryText.replace(/\D/g, '');
    return roll
      .filter((v) => {
        const byName = normalize(v.name).includes(term);
        const byCpf = digits.length >= 3 && (v.cpf ?? '').includes(digits);
        const byMat =
          !!v.matricula && normalize(v.matricula).includes(term);
        return byName || byCpf || byMat;
      })
      .slice(0, 20)
      .map((v) => ({
        id: v.id,
        name: v.name,
        cpf: formatCpf(v.cpf),
        matricula: v.matricula ?? '',
        present: !!v.present,
        presentBy: v.presentBy,
      }));
  }, [offline, queryText, roll]);

  const results = offline ? offlineResults : onlineResults;
  const closed = election?.status === 'closed';
  const paused = election?.status === 'open' && election?.paused === true;
  const blocked = closed || paused;

  const toggle = async (row: Row, present: boolean) => {
    if (blocked) return;
    setError('');
    setBusy(row.id);
    try {
      if (offline) {
        // Escrita direta: durante quedas, o SDK enfileira e sincroniza depois.
        await updateDoc(
          doc(db, 'elections', electionId, 'voters', row.id),
          present
            ? { present: true, presentAt: serverTimestamp(), presentBy: workerName }
            : { present: false, presentAt: deleteField(), presentBy: deleteField() },
        );
        // A UI atualiza pelo listener (com latência local ~imediata).
      } else {
        await api.setVoterPresence({ voterId: row.id, present });
        setOnlineResults((prev) =>
          prev
            ? prev.map((v) =>
                v.id === row.id
                  ? { ...v, present, presentBy: present ? workerName : undefined }
                  : v,
              )
            : prev,
        );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  };

  // Contadores: offline usa a lista local (instantâneo); online usa meta/stats.
  const presentCount = offline
    ? (roll?.filter((v) => v.present).length ?? 0)
    : (stats?.presentCount ?? 0);
  const totalCount = offline
    ? (roll?.length ?? stats?.totalVoters ?? 0)
    : (stats?.totalVoters ?? 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col p-4">
      <header className="flex items-center justify-between py-3">
        <div>
          <p className="text-xs font-semibold text-primary-600">Credenciamento</p>
          <h1 className="text-lg font-bold text-slate-900">
            {election?.name ?? '...'}
          </h1>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="text-sm font-medium text-slate-600 hover:text-primary-600"
        >
          Sair
        </button>
      </header>

      {offline && <SyncBadge online={online} pending={pending} />}

      {(offline ? roll : stats) && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <p className="text-sm text-slate-500">Presenças confirmadas</p>
          <p className="text-3xl font-bold text-slate-900">
            {presentCount}
            <span className="text-base font-normal text-slate-400">
              {' '}
              / {totalCount}
            </span>
          </p>
          <p className="text-xs text-slate-400">
            {percent(presentCount, totalCount)} do total · mesário: {workerName}
          </p>
        </div>
      )}

      {closed && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Credenciamento encerrado — não é possível alterar presenças.
        </p>
      )}

      {paused && (
        <p className="mb-4 rounded-lg bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
          Credenciamento pausado — aguarde a retomada para confirmar presenças.
        </p>
      )}

      <input
        className={inputCls}
        placeholder="Buscar por CPF, nome ou matrícula..."
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        autoFocus
        autoCapitalize="none"
      />

      <div className="mt-3">
        <ErrorAlert message={error} />
      </div>

      <div className="mt-2 flex-1 space-y-2">
        {offline && queryText.trim().length >= 2 && !roll && (
          <Spinner label="Carregando lista..." />
        )}
        {searching && <Spinner label="Buscando..." />}
        {!searching && results && results.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">
            Nenhum eleitor encontrado para “{queryText.trim()}”.
          </p>
        )}
        {!searching &&
          results?.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{v.name}</p>
                <p className="text-xs text-slate-500">
                  {v.cpf && <span>CPF {v.cpf}</span>}
                  {v.cpf && v.matricula && <span> · </span>}
                  {v.matricula && <span>Matrícula {v.matricula}</span>}
                </p>
                {v.present && (
                  <p className="mt-0.5 text-xs font-medium text-green-700">
                    ✓ Presente{v.presentBy ? ` (${v.presentBy})` : ''}
                  </p>
                )}
              </div>
              {v.present ? (
                <button
                  className={btnDanger}
                  disabled={busy === v.id || blocked}
                  onClick={() => toggle(v, false)}
                >
                  Remover
                </button>
              ) : (
                <button
                  className={btnPrimary}
                  disabled={busy === v.id || blocked}
                  onClick={() => toggle(v, true)}
                >
                  Confirmar
                </button>
              )}
            </div>
          ))}
        {!results && !searching && (
          <p className="py-8 text-center text-sm text-slate-400">
            Digite ao menos 2 caracteres para buscar o eleitor.
          </p>
        )}
      </div>
    </div>
  );
}

function SyncBadge({ online, pending }: { online: boolean; pending: number }) {
  let cls = 'bg-green-100 text-green-800';
  let label = 'Online · sincronizado';
  if (!online) {
    cls = 'bg-amber-100 text-amber-800';
    label =
      pending > 0
        ? `Offline · ${pending} pendente${pending > 1 ? 's' : ''}`
        : 'Offline';
  } else if (pending > 0) {
    cls = 'bg-sky-100 text-sky-800';
    label = `Sincronizando · ${pending} pendente${pending > 1 ? 's' : ''}`;
  }
  return (
    <div className="mb-3 flex justify-center">
      <span className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`}>
        {label}
      </span>
    </div>
  );
}

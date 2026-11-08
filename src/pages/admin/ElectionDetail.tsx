import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Election } from '../../types';
import { Spinner, StatusBadge, btnPrimary, btnSecondary } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import ConfigTab from './tabs/ConfigTab';
import CandidatesTab from './tabs/CandidatesTab';
import VotersTab from './tabs/VotersTab';
import LivePanelTab from './tabs/LivePanelTab';
import ResultsTab from './tabs/ResultsTab';
import PollWorkersTab from './tabs/PollWorkersTab';
import AttendancePanelTab from './tabs/AttendancePanelTab';

type TabKey =
  | 'config'
  | 'candidates'
  | 'voters'
  | 'pollworkers'
  | 'live'
  | 'results'
  | 'attendance';

const ELECTION_TABS: { key: TabKey; label: string }[] = [
  { key: 'config', label: 'Configuração' },
  { key: 'candidates', label: 'Chapas/Candidatos' },
  { key: 'voters', label: 'Eleitores' },
  { key: 'live', label: 'Painel ao Vivo' },
  { key: 'results', label: 'Apuração' },
];

const ATTENDANCE_TABS: { key: TabKey; label: string }[] = [
  { key: 'config', label: 'Configuração' },
  { key: 'voters', label: 'Eleitores' },
  { key: 'pollworkers', label: 'Mesários' },
  { key: 'attendance', label: 'Presença' },
];

export default function ElectionDetail() {
  const { electionId } = useParams<{ electionId: string }>();
  const navigate = useNavigate();
  const [election, setElection] = useState<Election | null | undefined>();
  const [tab, setTab] = useState<TabKey>('config');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!electionId) return;
    return onSnapshot(doc(db, 'elections', electionId), (snap) => {
      setElection(
        snap.exists() ? ({ id: snap.id, ...snap.data() } as Election) : null,
      );
    });
  }, [electionId]);

  if (election === undefined) return <Spinner label="Carregando evento..." />;
  if (election === null || !electionId) {
    return <p className="text-slate-500">Evento não encontrado.</p>;
  }

  const isAttendance = election.kind === 'attendance';
  const tabs = isAttendance ? ATTENDANCE_TABS : ELECTION_TABS;
  // Se o tipo do evento não tem a aba atualmente selecionada, volta para Config.
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'config';

  const setStatus = async (status: 'open' | 'closed', confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      // Ao encerrar, limpa a pausa (não faz sentido ficar "pausada e encerrada").
      const patch = status === 'closed' ? { status, paused: false } : { status };
      await updateDoc(doc(db, 'elections', electionId), patch);
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setPaused = async (paused: boolean) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'elections', electionId), { paused });
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (
      !window.confirm(
        `Excluir a eleição "${election.name}" e todos os seus dados? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.deleteElection({ electionId });
      navigate('/admin', { replace: true });
    } catch (err) {
      window.alert(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{election.name}</h1>
            <StatusBadge status={election.status} paused={election.paused} />
          </div>
          <p className="text-sm text-slate-500">
            {isAttendance
              ? 'Somente credenciamento (presença)'
              : election.authMode === 'credentials'
                ? 'Acesso por login e senha'
                : 'Acesso por link único'}
          </p>
        </div>
        <div className="flex gap-2">
          {election.status === 'draft' && (
            <button
              disabled={busy}
              className={btnPrimary}
              onClick={() =>
                setStatus(
                  'open',
                  isAttendance
                    ? 'Abrir o credenciamento? Os mesários poderão confirmar presenças.'
                    : 'Abrir a eleição? Os eleitores poderão confirmar presença e votar.',
                )
              }
            >
              {isAttendance ? 'Abrir credenciamento' : 'Abrir eleição'}
            </button>
          )}
          {election.status === 'open' &&
            (election.paused ? (
              <button
                disabled={busy}
                className={btnSecondary}
                onClick={() => setPaused(false)}
              >
                {isAttendance ? 'Retomar credenciamento' : 'Retomar votação'}
              </button>
            ) : (
              <button
                disabled={busy}
                className={btnSecondary}
                onClick={() => {
                  if (
                    window.confirm(
                      isAttendance
                        ? 'Pausar o credenciamento? Os mesários não poderão confirmar presenças até retomar.'
                        : 'Pausar a votação? Os eleitores não poderão votar até retomar.',
                    )
                  ) {
                    setPaused(true);
                  }
                }}
              >
                {isAttendance ? 'Pausar credenciamento' : 'Pausar votação'}
              </button>
            ))}
          {election.status === 'open' && (
            <button
              disabled={busy}
              className={btnPrimary}
              onClick={() =>
                setStatus(
                  'closed',
                  isAttendance
                    ? 'Encerrar o credenciamento? Nenhuma presença nova será aceita.'
                    : 'Encerrar a eleição? Nenhum voto novo será aceito.',
                )
              }
            >
              {isAttendance ? 'Encerrar credenciamento' : 'Encerrar eleição'}
            </button>
          )}
          {election.status !== 'open' && (
            <button disabled={busy} className={btnSecondary} onClick={onDelete}>
              Excluir
            </button>
          )}
        </div>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab === 'config' && <ConfigTab election={election} />}
      {activeTab === 'candidates' && <CandidatesTab election={election} />}
      {activeTab === 'voters' && <VotersTab election={election} />}
      {activeTab === 'pollworkers' && <PollWorkersTab election={election} />}
      {activeTab === 'live' && <LivePanelTab election={election} />}
      {activeTab === 'results' && <ResultsTab election={election} />}
      {activeTab === 'attendance' && <AttendancePanelTab election={election} />}
    </div>
  );
}

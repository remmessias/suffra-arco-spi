import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  BLANK_VOTE_ID,
  type Candidate,
  type Election,
  type Voter,
} from '../../types';
import {
  ErrorAlert,
  Spinner,
  btnPrimary,
  btnSecondary,
} from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCandidates } from '../../hooks/election';
import { formatDateTime } from '../../utils/format';

export default function VoterFlow() {
  const { electionId } = useParams<{ electionId: string }>();
  const { loading, voter } = useAuth();

  if (loading) return <Spinner label="Carregando..." />;
  if (!electionId || !voter || voter.electionId !== electionId) {
    return <Navigate to={`/votar/${electionId ?? ''}`} replace />;
  }
  return <Booth electionId={electionId} voterId={voter.voterId} />;
}

function Booth({ electionId, voterId }: { electionId: string; voterId: string }) {
  const [election, setElection] = useState<Election | null>(null);
  const [me, setMe] = useState<Voter | null>(null);
  const candidates = useCandidates(electionId);

  useEffect(() => {
    const stop1 = onSnapshot(doc(db, 'elections', electionId), (snap) => {
      setElection({ id: snap.id, ...snap.data() } as Election);
    });
    const stop2 = onSnapshot(
      doc(db, 'elections', electionId, 'voters', voterId),
      (snap) => setMe({ id: snap.id, ...snap.data() } as Voter),
    );
    return () => {
      stop1();
      stop2();
    };
  }, [electionId, voterId]);

  if (!election || !me || !candidates) {
    return <Spinner label="Carregando..." />;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col p-4">
      <header className="py-4 text-center">
        <h1 className="text-xl font-bold text-slate-900">{election.name}</h1>
        <p className="text-sm text-slate-500">Olá, {me.name}</p>
      </header>

      {election.status === 'closed' ? (
        <Step
          icon="🏁"
          title="Eleição encerrada"
          text="O período de votação desta eleição já foi encerrado."
        >
          <Link to={`/resultado/${electionId}`} className={btnPrimary}>
            Ver resultado
          </Link>
        </Step>
      ) : me.hasVoted ? (
        <Step
          icon="✅"
          title="Voto registrado"
          text={`Seu voto foi registrado com sucesso em ${formatDateTime(me.votedAt)}. O voto é secreto: o sistema não guarda em quem você votou.`}
        />
      ) : election.paused ? (
        <Step
          icon="⏸️"
          title="Votação pausada"
          text="A votação está temporariamente pausada. Aguarde a retomada para registrar seu voto."
        />
      ) : !me.present ? (
        <PresenceStep />
      ) : (
        <BallotStep election={election} candidates={candidates} />
      )}
    </div>
  );
}

function Step({
  icon,
  title,
  text,
  children,
}: {
  icon: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="text-5xl">{icon}</span>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-slate-600">{text}</p>
      {children}
    </div>
  );
}

function PresenceStep() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onConfirm = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api.confirmPresence({});
      // O listener do doc do eleitor atualiza a tela automaticamente.
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="text-5xl">🪪</span>
      <h2 className="text-lg font-bold">Confirmação de presença</h2>
      <p className="text-sm text-slate-600">
        Confirme sua presença para liberar a votação.
      </p>
      <ErrorAlert message={error} />
      <button className={btnPrimary} disabled={submitting} onClick={onConfirm}>
        {submitting ? 'Confirmando...' : 'Confirmar presença'}
      </button>
    </div>
  );
}

function BallotStep({
  election,
  candidates,
}: {
  election: Election;
  candidates: Candidate[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const options = [
    ...candidates,
    ...(election.allowBlank
      ? [{ id: BLANK_VOTE_ID, name: 'Voto em branco', order: 9999 } as Candidate]
      : []),
  ];
  const selectedOption = options.find((o) => o.id === selected);

  const onVote = async () => {
    if (!selected) return;
    setError('');
    setSubmitting(true);
    try {
      await api.castVote({ candidateId: selected });
      // O listener do doc do eleitor leva à tela de comprovante.
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-bold">Cédula de votação</h2>
        <p className="mb-4 text-sm text-slate-500">
          Selecione uma opção e confirme. Seu voto é secreto.
        </p>
        <div className="space-y-2">
          {options.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full rounded-xl border-2 p-4 text-left transition ${
                selected === c.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-3">
                {c.number && (
                  <span className="rounded bg-slate-900 px-2 py-1 font-mono text-sm font-bold text-white">
                    {c.number}
                  </span>
                )}
                <span>
                  <span className="block font-semibold">{c.name}</span>
                  {c.description && (
                    <span className="block text-sm text-slate-500">
                      {c.description}
                    </span>
                  )}
                </span>
              </span>
            </button>
          ))}
          {options.length === 0 && (
            <p className="text-sm text-slate-500">
              Nenhuma opção disponível na cédula.
            </p>
          )}
        </div>
        <ErrorAlert message={error} />
        <button
          className={`${btnPrimary} mt-4 w-full`}
          disabled={!selected}
          onClick={() => setConfirming(true)}
        >
          Votar
        </button>
      </div>

      {confirming && selectedOption && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <h3 className="text-lg font-bold">Confirmar voto</h3>
            <p className="mt-2 text-sm text-slate-600">Você está votando em:</p>
            <p className="mt-1 text-lg font-semibold text-primary-700">
              {selectedOption.name}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                className={`${btnSecondary} flex-1`}
                disabled={submitting}
                onClick={() => setConfirming(false)}
              >
                Voltar
              </button>
              <button
                className={`${btnPrimary} flex-1`}
                disabled={submitting}
                onClick={onVote}
              >
                {submitting ? 'Registrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Election } from '../../types';
import { Card, Spinner, StatCard } from '../../components/ui';
import { percent } from '../../utils/format';
import {
  ResultBars,
  useCandidates,
  useElectionStats,
} from '../../hooks/election';

export default function PublicResults() {
  const { electionId } = useParams<{ electionId: string }>();
  const [election, setElection] = useState<Election | null | undefined>();

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
        Resultado não disponível.
      </p>
    );
  }
  if (election.status !== 'closed') {
    return (
      <p className="p-10 text-center text-slate-500">
        O resultado será publicado após o encerramento da eleição.
      </p>
    );
  }

  return <ResultsView election={election} />;
}

function ResultsView({ election }: { election: Election }) {
  const stats = useElectionStats(election.id);
  const candidates = useCandidates(election.id);

  if (!stats || !candidates) return <Spinner label="Carregando resultado..." />;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="py-4 text-center">
        <h1 className="text-2xl font-bold">{election.name}</h1>
        <p className="text-sm text-slate-500">Resultado oficial</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Eleitores" value={stats.totalVoters} />
        <StatCard
          label="Presentes"
          value={stats.presentCount}
          hint={percent(stats.presentCount, stats.totalVoters) + ' do total'}
        />
        <StatCard label="Votos" value={stats.votedCount} />
      </div>

      <Card title="Apuração final">
        <ResultBars election={election} candidates={candidates} stats={stats} />
      </Card>
    </div>
  );
}

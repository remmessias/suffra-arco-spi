import type { Election } from '../../../types';
import { Card, Spinner, StatCard } from '../../../components/ui';
import { percent } from '../../../utils/format';
import {
  ResultBars,
  useCandidates,
  useElectionStats,
} from '../../../hooks/election';

export default function LivePanelTab({ election }: { election: Election }) {
  const stats = useElectionStats(election.id);
  const candidates = useCandidates(election.id);

  if (!stats || !candidates) return <Spinner label="Carregando painel..." />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Eleitores" value={stats.totalVoters} />
        <StatCard
          label="Presentes"
          value={stats.presentCount}
          hint={percent(stats.presentCount, stats.totalVoters) + ' do total'}
        />
        <StatCard
          label="Votaram"
          value={stats.votedCount}
          hint={percent(stats.votedCount, stats.presentCount) + ' dos presentes'}
        />
        <StatCard
          label="Faltam votar"
          value={Math.max(0, stats.presentCount - stats.votedCount)}
          hint="entre os presentes"
        />
      </div>

      <Card title="Apuração parcial (tempo real)">
        <ResultBars election={election} candidates={candidates} stats={stats} />
      </Card>
    </div>
  );
}

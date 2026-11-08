import type { Election } from '../../../types';
import { Card, Spinner, StatCard, btnPrimary } from '../../../components/ui';
import { percent } from '../../../utils/format';
import { exportPresenceCsv } from '../../../utils/exports';
import { useElectionStats } from '../../../hooks/election';

export default function AttendancePanelTab({ election }: { election: Election }) {
  const stats = useElectionStats(election.id);
  if (!stats) return <Spinner label="Carregando presença..." />;

  const absent = Math.max(0, stats.totalVoters - stats.presentCount);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Eleitores" value={stats.totalVoters} />
        <StatCard
          label="Presentes"
          value={stats.presentCount}
          hint={percent(stats.presentCount, stats.totalVoters) + ' do total'}
        />
        <StatCard label="Ausentes" value={absent} />
      </div>

      <Card
        title="Lista de presença"
        actions={
          <button
            className={btnPrimary}
            onClick={() => exportPresenceCsv(election.id)}
          >
            Exportar presença (CSV)
          </button>
        }
      >
        <p className="text-sm text-slate-600">
          {stats.presentCount} de {stats.totalVoters}{' '}
          {stats.totalVoters === 1 ? 'eleitor confirmado' : 'eleitores confirmados'}.
          A confirmação é feita pelos mesários na página da mesa; este painel
          atualiza em tempo real.
        </p>
      </Card>
    </div>
  );
}

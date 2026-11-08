import { BLANK_VOTE_ID, type Election } from '../../../types';
import { Card, Spinner, StatCard, btnPrimary, btnSecondary } from '../../../components/ui';
import { downloadCsv } from '../../../utils/csv';
import { exportPresenceCsv } from '../../../utils/exports';
import { percent } from '../../../utils/format';
import { useCandidates, useElectionStats } from '../../../hooks/election';

export default function ResultsTab({ election }: { election: Election }) {
  const stats = useElectionStats(election.id);
  const candidates = useCandidates(election.id);

  if (!stats || !candidates) return <Spinner label="Carregando apuração..." />;

  const rows = [
    ...candidates.map((c) => ({
      label: c.name,
      number: c.number ?? '',
      votes: stats.results[c.id] ?? 0,
    })),
    ...(election.allowBlank
      ? [
          {
            label: 'Em branco',
            number: '',
            votes: stats.results[BLANK_VOTE_ID] ?? 0,
          },
        ]
      : []),
  ].sort((a, b) => b.votes - a.votes);

  const abstentions = Math.max(0, stats.presentCount - stats.votedCount);
  const absents = Math.max(0, stats.totalVoters - stats.presentCount);

  const exportResults = () => {
    downloadCsv(
      `apuracao-${election.id}.csv`,
      ['Posição', 'Chapa/Candidato', 'Número', 'Votos', 'Percentual'],
      [
        ...rows.map((r, i) => [
          i + 1,
          r.label,
          r.number,
          r.votes,
          percent(r.votes, stats.votedCount),
        ]),
        [],
        ['', 'Total de eleitores', '', stats.totalVoters, ''],
        ['', 'Presentes', '', stats.presentCount, percent(stats.presentCount, stats.totalVoters)],
        ['', 'Votos registrados', '', stats.votedCount, percent(stats.votedCount, stats.presentCount)],
        ['', 'Abstenções (presentes que não votaram)', '', abstentions, ''],
        ['', 'Ausentes', '', absents, ''],
      ],
    );
  };

  const exportPresence = () => exportPresenceCsv(election.id);

  return (
    <div className="space-y-4">
      {election.status === 'open' && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          A eleição ainda está aberta — os números abaixo são parciais.
        </p>
      )}
      {election.status === 'closed' && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Eleição encerrada — resultado final.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Eleitores" value={stats.totalVoters} />
        <StatCard label="Presentes" value={stats.presentCount} />
        <StatCard label="Votos" value={stats.votedCount} />
        <StatCard label="Abstenções" value={abstentions} hint="presentes que não votaram" />
        <StatCard label="Ausentes" value={absents} />
      </div>

      <Card
        title="Resultado"
        actions={
          <div className="flex gap-2">
            <button className={btnPrimary} onClick={exportResults}>
              Exportar resultado (CSV)
            </button>
            <button className={btnSecondary} onClick={exportPresence}>
              Exportar presença (CSV)
            </button>
          </div>
        }
      >
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2 w-10">#</th>
              <th className="px-2 py-2">Chapa/Candidato</th>
              <th className="px-2 py-2">Número</th>
              <th className="px-2 py-2 text-right">Votos</th>
              <th className="px-2 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.label} className={i === 0 && r.votes > 0 ? 'bg-green-50/60' : ''}>
                <td className="px-2 py-2 text-slate-400">{i + 1}º</td>
                <td className="px-2 py-2 font-medium">{r.label}</td>
                <td className="px-2 py-2">{r.number || '—'}</td>
                <td className="px-2 py-2 text-right font-semibold">{r.votes}</td>
                <td className="px-2 py-2 text-right">
                  {percent(r.votes, stats.votedCount)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-slate-500">
                  Nenhuma chapa cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

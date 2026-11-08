import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BLANK_VOTE_ID,
  type Candidate,
  type Election,
  type ElectionStats,
} from '../types';
import { percent } from '../utils/format';

const EMPTY_STATS: ElectionStats = {
  totalVoters: 0,
  presentCount: 0,
  votedCount: 0,
  results: {},
};

/** Escuta apenas o doc agregado meta/stats — 1 listener, leituras mínimas. */
export function useElectionStats(electionId: string) {
  const [stats, setStats] = useState<ElectionStats | null>(null);
  useEffect(() => {
    return onSnapshot(
      doc(db, 'elections', electionId, 'meta', 'stats'),
      (snap) => {
        setStats(
          snap.exists() ? { ...EMPTY_STATS, ...snap.data() } : EMPTY_STATS,
        );
      },
    );
  }, [electionId]);
  return stats;
}

export function useCandidates(electionId: string) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  useEffect(() => {
    const q = query(
      collection(db, 'elections', electionId, 'candidates'),
      orderBy('order'),
    );
    getDocs(q).then((snap) => {
      setCandidates(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Candidate),
      );
    });
  }, [electionId]);
  return candidates;
}

export function ResultBars({
  election,
  candidates,
  stats,
}: {
  election: Election;
  candidates: Candidate[];
  stats: ElectionStats;
}) {
  const rows = [
    ...candidates.map((c) => ({
      id: c.id,
      label: c.number ? `${c.number} · ${c.name}` : c.name,
      votes: stats.results[c.id] ?? 0,
    })),
    ...(election.allowBlank
      ? [
          {
            id: BLANK_VOTE_ID,
            label: 'Em branco',
            votes: stats.results[BLANK_VOTE_ID] ?? 0,
          },
        ]
      : []),
  ].sort((a, b) => b.votes - a.votes);

  const max = Math.max(1, ...rows.map((r) => r.votes));

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-slate-800">{r.label}</span>
            <span className="shrink-0 text-slate-500">
              {r.votes} {r.votes === 1 ? 'voto' : 'votos'} ·{' '}
              {percent(r.votes, stats.votedCount)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-500"
              style={{ width: `${(r.votes / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-slate-500">Nenhuma chapa cadastrada.</p>
      )}
    </div>
  );
}

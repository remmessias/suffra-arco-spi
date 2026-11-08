import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Voter } from '../types';
import { downloadCsv } from './csv';
import { formatCpf, formatDateTime } from './format';

/** Lê todos os eleitores em páginas de 500 (apenas para exports pontuais). */
export async function fetchAllVoters(electionId: string): Promise<Voter[]> {
  const all: Voter[] = [];
  let last: QueryDocumentSnapshot | null = null;
  const base = collection(db, 'elections', electionId, 'voters');
  for (;;) {
    const q: Query = last
      ? query(base, orderBy('name'), startAfter(last), limit(500))
      : query(base, orderBy('name'), limit(500));
    const snap = await getDocs(q);
    all.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Voter));
    if (snap.docs.length < 500) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return all;
}

export async function exportPresenceCsv(electionId: string) {
  const all = await fetchAllVoters(electionId);
  downloadCsv(
    `presenca-${electionId}.csv`,
    [
      'Nome',
      'CPF',
      'Matrícula',
      'Presente',
      'Horário da presença',
      'Confirmado por',
      'Votou',
    ],
    all.map((v) => [
      v.name,
      formatCpf(v.cpf),
      v.matricula ?? '',
      v.present ? 'Sim' : 'Não',
      v.present ? formatDateTime(v.presentAt) : '',
      v.presentBy ?? '',
      v.hasVoted ? 'Sim' : 'Não',
    ]),
  );
}

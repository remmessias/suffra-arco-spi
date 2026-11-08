import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from './init.js';
import {
  assertStaff,
  maskCpf,
  normalizeName,
  onlyDigits,
  requireString,
} from './helpers.js';

const SEARCH_LIMIT = 15;

interface VoterResult {
  id: string;
  name: string;
  cpf: string;
  matricula: string;
  present: boolean;
  presentBy?: string;
}

function toResult(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): VoterResult {
  const v = doc.data();
  return {
    id: doc.id,
    name: v.name,
    cpf: maskCpf(v.cpf),
    matricula: v.matricula ?? '',
    present: !!v.present,
    presentBy: v.presentBy,
  };
}

/**
 * Busca eleitores por CPF (exato), matrícula (exato) ou nome (prefixo do nome
 * completo e palavra exata). Acessível a mesário (claim) ou admin (electionId
 * no payload). Mescla os resultados das consultas por id.
 */
export const searchVoters = onCall(async (request) => {
  const { electionId } = await assertStaff(request, request.data);
  const raw = requireString(request.data?.query, 'busca');
  const voters = db.collection(`elections/${electionId}/voters`);

  const digits = onlyDigits(raw);
  const name = normalizeName(raw);
  const HIGH = ''; // sentinel para consulta de prefixo no Firestore
  const queries: FirebaseFirestore.Query[] = [];

  // Matrícula é casada de forma exata (aceita alfanumérica).
  queries.push(voters.where('matricula', '==', raw.trim()).limit(5));
  if (digits.length >= 3) {
    queries.push(voters.where('cpf', '==', digits).limit(5));
    if (digits !== raw.trim()) {
      queries.push(voters.where('matricula', '==', digits).limit(5));
    }
  }
  if (name.length >= 2) {
    queries.push(
      voters
        .orderBy('nameLower')
        .startAt(name)
        .endAt(name + HIGH)
        .limit(SEARCH_LIMIT),
    );
    queries.push(
      voters.where('nameTokens', 'array-contains', name).limit(SEARCH_LIMIT),
    );
  }
  if (queries.length === 0) return { voters: [] };

  const snaps = await Promise.all(queries.map((q) => q.get()));
  const byId = new Map<string, VoterResult>();
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      if (!byId.has(doc.id)) byId.set(doc.id, toResult(doc));
    }
  }
  const results = [...byId.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, SEARCH_LIMIT);
  return { voters: results };
});

/**
 * Confirma (present=true) ou desfaz (present=false) a presença de um eleitor.
 * Mesário ou admin. Transação idempotente que ajusta meta/stats.presentCount.
 * Não permite desfazer presença de quem já votou.
 */
export const setVoterPresence = onCall(async (request) => {
  const { electionId, actor } = await assertStaff(request, request.data);
  const voterId = requireString(request.data?.voterId, 'eleitor');
  const present = request.data?.present !== false; // default: confirmar

  const electionRef = db.doc(`elections/${electionId}`);
  const voterRef = electionRef.collection('voters').doc(voterId);
  const statsRef = electionRef.collection('meta').doc('stats');

  const result = await db.runTransaction(async (tx) => {
    const [electionSnap, voterSnap] = await Promise.all([
      tx.get(electionRef),
      tx.get(voterRef),
    ]);
    if (electionSnap.data()?.status !== 'open') {
      throw new HttpsError('failed-precondition', 'O evento não está aberto.');
    }
    if (electionSnap.data()?.paused === true) {
      throw new HttpsError(
        'failed-precondition',
        'O credenciamento está pausado no momento.',
      );
    }
    if (!voterSnap.exists) {
      throw new HttpsError('not-found', 'Eleitor não encontrado.');
    }
    const voter = voterSnap.data()!;
    if (!present && voter.hasVoted) {
      throw new HttpsError(
        'failed-precondition',
        'Não é possível remover a presença de quem já votou.',
      );
    }
    if (!!voter.present === present) {
      return { name: voter.name, present }; // já está no estado pedido
    }

    tx.update(voterRef, {
      present,
      presentAt: present ? FieldValue.serverTimestamp() : FieldValue.delete(),
      presentBy: present ? actor : FieldValue.delete(),
    });
    // Em eventos offline, meta/stats.presentCount é mantido pelo gatilho
    // syncOfflinePresence (o mesário também escreve present direto no cliente).
    if (electionSnap.data()?.offlinePresence !== true) {
      tx.set(
        statsRef,
        { presentCount: FieldValue.increment(present ? 1 : -1) },
        { merge: true },
      );
    }
    return { name: voter.name, present };
  });

  return { ok: true, ...result };
});

/**
 * Mantém meta/stats.presentCount nos eventos de credenciamento OFFLINE, onde os
 * mesários gravam o campo `present` direto no cliente (sem passar pela função).
 * Reage à mudança do campo `present` e é idempotente: reconfirmar alguém já
 * presente não altera a contagem (delta 0). Para eventos não-offline, a
 * contagem continua sendo mantida de forma síncrona pelas funções.
 */
export const syncOfflinePresence = onDocumentWritten(
  'elections/{electionId}/voters/{voterId}',
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    const beforePresent = before?.exists ? !!before.data()!.present : false;
    const afterPresent = after?.exists ? !!after.data()!.present : false;
    const delta = (afterPresent ? 1 : 0) - (beforePresent ? 1 : 0);
    if (delta === 0) return;

    const { electionId } = event.params;
    const electionSnap = await db.doc(`elections/${electionId}`).get();
    if (electionSnap.data()?.offlinePresence !== true) return;

    await db
      .doc(`elections/${electionId}/meta/stats`)
      .set({ presentCount: FieldValue.increment(delta) }, { merge: true });
  },
);

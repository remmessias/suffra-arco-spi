import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './init.js';
import { BLANK_VOTE_ID, getVoterClaims, requireString } from './helpers.js';

/**
 * Confirma a presença do eleitor autenticado. Idempotente: confirmar duas
 * vezes não duplica o contador.
 */
export const confirmPresence = onCall(async (request) => {
  const { electionId, voterId } = getVoterClaims(request);
  const electionRef = db.doc(`elections/${electionId}`);
  const voterRef = electionRef.collection('voters').doc(voterId);
  const statsRef = electionRef.collection('meta').doc('stats');

  await db.runTransaction(async (tx) => {
    const [electionSnap, voterSnap] = await Promise.all([
      tx.get(electionRef),
      tx.get(voterRef),
    ]);
    if (electionSnap.data()?.status !== 'open') {
      throw new HttpsError('failed-precondition', 'A eleição não está aberta.');
    }
    if (electionSnap.data()?.paused === true) {
      throw new HttpsError(
        'failed-precondition',
        'A votação está pausada no momento.',
      );
    }
    if (!voterSnap.exists) {
      throw new HttpsError('not-found', 'Eleitor não encontrado.');
    }
    if (voterSnap.data()!.present) return; // já confirmada

    tx.update(voterRef, {
      present: true,
      presentAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      statsRef,
      { presentCount: FieldValue.increment(1) },
      { merge: true },
    );
  });

  return { ok: true };
});

/**
 * Registra o voto secreto do eleitor autenticado.
 *
 * Na mesma transação: valida eleição aberta, presença confirmada e que ainda
 * não votou; marca hasVoted; cria a cédula com ID aleatório SEM referência ao
 * eleitor; e incrementa os agregados em meta/stats.
 */
export const castVote = onCall(async (request) => {
  const { electionId, voterId } = getVoterClaims(request);
  const candidateId = requireString(request.data?.candidateId, 'candidato');

  const electionRef = db.doc(`elections/${electionId}`);
  const voterRef = electionRef.collection('voters').doc(voterId);
  const statsRef = electionRef.collection('meta').doc('stats');
  const ballotRef = electionRef.collection('ballots').doc(); // ID aleatório

  await db.runTransaction(async (tx) => {
    const [electionSnap, voterSnap] = await Promise.all([
      tx.get(electionRef),
      tx.get(voterRef),
    ]);

    const election = electionSnap.data();
    if (election?.status !== 'open') {
      throw new HttpsError('failed-precondition', 'A votação não está aberta.');
    }
    if (election.paused === true) {
      throw new HttpsError(
        'failed-precondition',
        'A votação está pausada no momento.',
      );
    }

    if (candidateId === BLANK_VOTE_ID) {
      if (!election.allowBlank) {
        throw new HttpsError(
          'invalid-argument',
          'Voto em branco não é permitido nesta eleição.',
        );
      }
    } else {
      const candidateSnap = await tx.get(
        electionRef.collection('candidates').doc(candidateId),
      );
      if (!candidateSnap.exists) {
        throw new HttpsError('not-found', 'Candidato/chapa não encontrado.');
      }
    }

    const voter = voterSnap.data();
    if (!voterSnap.exists || !voter) {
      throw new HttpsError('not-found', 'Eleitor não encontrado.');
    }
    if (!voter.present) {
      throw new HttpsError(
        'failed-precondition',
        'Confirme sua presença antes de votar.',
      );
    }
    if (voter.hasVoted) {
      throw new HttpsError('already-exists', 'Você já votou nesta eleição.');
    }

    tx.update(voterRef, {
      hasVoted: true,
      votedAt: FieldValue.serverTimestamp(),
    });
    tx.create(ballotRef, {
      candidateId,
      castAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      statsRef,
      {
        votedCount: FieldValue.increment(1),
        results: { [candidateId]: FieldValue.increment(1) },
      },
      { merge: true },
    );
  });

  return { ok: true };
});

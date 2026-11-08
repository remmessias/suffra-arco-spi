import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { adminAuth, db } from './init.js';
import {
  normalizeLogin,
  pollWorkerUid,
  requireString,
  sha256,
  verifyPassword,
  voterUid,
} from './helpers.js';

async function mintVoterToken(
  electionId: string,
  voterId: string,
): Promise<string> {
  return adminAuth.createCustomToken(voterUid(electionId, voterId), {
    role: 'voter',
    electionId,
    voterId,
  });
}

/** Garante que a eleição existe e já saiu do rascunho. */
async function getActiveElection(electionId: string) {
  const snap = await db.doc(`elections/${electionId}`).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Eleição não encontrada.');
  }
  const election = snap.data()!;
  if (election.status === 'draft') {
    throw new HttpsError(
      'failed-precondition',
      'Esta eleição ainda não foi aberta.',
    );
  }
  return election;
}

/**
 * Login do eleitor no modo credentials.
 * Retorna um custom token com claims { role, electionId, voterId }.
 */
export const voterLogin = onCall(async (request) => {
  const electionId = requireString(request.data?.electionId, 'eleição');
  const login = normalizeLogin(requireString(request.data?.login, 'usuário'));
  const password = requireString(request.data?.password, 'senha');

  const election = await getActiveElection(electionId);
  if (election.authMode !== 'credentials') {
    throw new HttpsError(
      'failed-precondition',
      'Esta eleição usa acesso por link único.',
    );
  }

  const voters = await db
    .collection(`elections/${electionId}/voters`)
    .where('login', '==', login)
    .limit(1)
    .get();

  const voter = voters.docs[0];
  const credentialHash = voter?.data().credentialHash as string | undefined;
  if (!voter || !credentialHash || !verifyPassword(password, credentialHash)) {
    throw new HttpsError('permission-denied', 'Usuário ou senha incorretos.');
  }

  return { token: await mintVoterToken(electionId, voter.id) };
});

/**
 * Troca o token do link único (/v/:token) por um custom token de eleitor.
 */
export const redeemAccessLink = onCall(async (request) => {
  const token = requireString(request.data?.token, 'token');
  const password =
    typeof request.data?.password === 'string' ? request.data.password : '';

  const tokenDoc = await db.doc(`accessTokens/${sha256(token)}`).get();
  if (!tokenDoc.exists) {
    throw new HttpsError('permission-denied', 'Link de votação inválido.');
  }

  const { electionId, voterId } = tokenDoc.data() as {
    electionId: string;
    voterId: string;
  };
  const election = await getActiveElection(electionId);

  // Camada extra: quando a eleição exige senha individual, o link não basta.
  if (election.linkRequiresPassword === true) {
    const voterSnap = await db
      .doc(`elections/${electionId}/voters/${voterId}`)
      .get();
    const credentialHash = voterSnap.data()?.credentialHash as
      | string
      | undefined;
    if (!credentialHash) {
      throw new HttpsError(
        'failed-precondition',
        'Acesso sem senha configurada. Peça um novo acesso ao organizador.',
      );
    }
    if (!password) {
      throw new HttpsError('failed-precondition', 'Senha necessária.', {
        reason: 'password-required',
      });
    }
    if (!verifyPassword(password, credentialHash)) {
      throw new HttpsError('permission-denied', 'Senha incorreta.');
    }
  }

  return { token: await mintVoterToken(electionId, voterId), electionId };
});

/**
 * Login do mesário (credenciamento). Valida usuário/senha na subcoleção
 * pollworkers da eleição e emite custom token com claims
 * { role: 'pollworker', electionId, pollworkerId, name }.
 */
export const pollWorkerLogin = onCall(async (request) => {
  const electionId = requireString(request.data?.electionId, 'eleição');
  const login = normalizeLogin(requireString(request.data?.login, 'usuário'));
  const password = requireString(request.data?.password, 'senha');

  await getActiveElection(electionId);

  const matches = await db
    .collection(`elections/${electionId}/pollworkers`)
    .where('login', '==', login)
    .limit(1)
    .get();

  const worker = matches.docs[0];
  const credentialHash = worker?.data().credentialHash as string | undefined;
  if (!worker || !credentialHash || !verifyPassword(password, credentialHash)) {
    throw new HttpsError('permission-denied', 'Usuário ou senha incorretos.');
  }

  const token = await adminAuth.createCustomToken(
    pollWorkerUid(electionId, worker.id),
    {
      role: 'pollworker',
      electionId,
      pollworkerId: worker.id,
      name: worker.data().name ?? 'Mesário',
    },
  );
  return { token, electionId };
});

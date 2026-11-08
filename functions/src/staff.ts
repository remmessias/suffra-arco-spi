import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './init.js';
import {
  assertAdmin,
  generatePassword,
  hashPassword,
  loginFromName,
  normalizeLogin,
  requireString,
} from './helpers.js';

/** Garante login único de mesário na eleição, derivando do nome se preciso. */
async function uniquePollWorkerLogin(
  electionId: string,
  desired: string | undefined,
  name: string,
): Promise<string> {
  const workers = db.collection(`elections/${electionId}/pollworkers`);
  const taken = new Set<string>();
  const existing = await workers.select('login').get();
  for (const doc of existing.docs) {
    const login = doc.data().login;
    if (login) taken.add(login);
  }
  const base = desired ? normalizeLogin(desired) : loginFromName(name);
  if (desired && taken.has(base)) {
    throw new HttpsError('already-exists', `Login de mesário já existe: ${base}`);
  }
  let candidate = base;
  let seq = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${seq}`;
    seq += 1;
  }
  return candidate;
}

/** Cria um mesário e devolve a senha em claro (exibida uma única vez). */
export const createPollWorker = onCall(async (request) => {
  await assertAdmin(request);
  const electionId = requireString(request.data?.electionId, 'eleição');
  const name = requireString(request.data?.name, 'nome do mesário');
  const desiredLogin =
    typeof request.data?.login === 'string' && request.data.login.trim()
      ? request.data.login
      : undefined;

  const electionRef = db.doc(`elections/${electionId}`);
  if (!(await electionRef.get()).exists) {
    throw new HttpsError('not-found', 'Eleição não encontrada.');
  }

  const login = await uniquePollWorkerLogin(electionId, desiredLogin, name);
  const password = generatePassword();
  const ref = await electionRef.collection('pollworkers').add({
    name,
    login,
    credentialHash: hashPassword(password),
    createdAt: FieldValue.serverTimestamp(),
  });

  return { pollWorkerId: ref.id, name, login, password };
});

/** Gera nova senha para um mesário, invalidando a anterior. */
export const resetPollWorkerAccess = onCall(async (request) => {
  await assertAdmin(request);
  const electionId = requireString(request.data?.electionId, 'eleição');
  const pollWorkerId = requireString(request.data?.pollWorkerId, 'mesário');

  const ref = db.doc(`elections/${electionId}/pollworkers/${pollWorkerId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Mesário não encontrado.');
  }
  const password = generatePassword();
  await ref.update({ credentialHash: hashPassword(password) });
  const data = snap.data()!;
  return { pollWorkerId, name: data.name, login: data.login, password };
});

export const deletePollWorker = onCall(async (request) => {
  await assertAdmin(request);
  const electionId = requireString(request.data?.electionId, 'eleição');
  const pollWorkerId = requireString(request.data?.pollWorkerId, 'mesário');
  await db.doc(`elections/${electionId}/pollworkers/${pollWorkerId}`).delete();
  return { ok: true };
});

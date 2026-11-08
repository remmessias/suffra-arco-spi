import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { db } from './init.js';
import {
  assertAdmin,
  generatePassword,
  generateToken,
  hashPassword,
  loginFromName,
  nameTokens,
  normalizeLogin,
  normalizeName,
  onlyDigits,
  requireString,
  sha256,
} from './helpers.js';

const MAX_IMPORT = 5000;
// 2 docs por eleitor no modo link (voter + accessToken); limite de 500 ops/batch
const BATCH_CHUNK = 200;

interface ImportRow {
  name: string;
  login?: string;
  cpf?: string;
  matricula?: string;
}

interface AccessRow {
  voterId: string;
  name: string;
  login?: string;
  password?: string;
  token?: string;
}

/**
 * Importa eleitores em lote. No modo credentials gera login+senha (guarda só
 * o hash); no modo link gera token único (guarda só o hash em accessTokens).
 * As credenciais/links em claro só existem na resposta desta chamada.
 */
export const importVoters = onCall({ timeoutSeconds: 300 }, async (request) => {
  await assertAdmin(request);
  const electionId = requireString(request.data?.electionId, 'eleição');
  const input = request.data?.voters;
  if (!Array.isArray(input) || input.length === 0) {
    throw new HttpsError('invalid-argument', 'Lista de eleitores vazia.');
  }
  if (input.length > MAX_IMPORT) {
    throw new HttpsError(
      'invalid-argument',
      `Importe no máximo ${MAX_IMPORT} eleitores por vez.`,
    );
  }

  const electionRef = db.doc(`elections/${electionId}`);
  const electionSnap = await electionRef.get();
  if (!electionSnap.exists) {
    throw new HttpsError('not-found', 'Eleição não encontrada.');
  }
  const electionData = electionSnap.data()!;
  const authMode = electionData.authMode as 'credentials' | 'link';
  // Eventos de credenciamento (attendance) não geram acesso para o eleitor.
  const kind = (electionData.kind as 'election' | 'attendance') ?? 'election';
  const generatesAccess = kind === 'election';

  const str = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

  const rows: ImportRow[] = input.map((row: Record<string, unknown>) => {
    const cpfDigits = str(row?.cpf) ? onlyDigits(row.cpf as string) : undefined;
    return {
      name: requireString(row?.name, 'nome do eleitor'),
      login: typeof row?.login === 'string' ? normalizeLogin(row.login) : undefined,
      cpf: cpfDigits || undefined,
      matricula: str(row?.matricula),
    };
  });

  // Logins já usados na eleição (modo credentials) para evitar duplicidade.
  const usedLogins = new Set<string>();
  if (generatesAccess && authMode === 'credentials') {
    const existing = await electionRef
      .collection('voters')
      .select('login')
      .get();
    for (const doc of existing.docs) {
      const login = doc.data().login;
      if (login) usedLogins.add(login);
    }
  }

  // CPF único na eleição (quando informado).
  const usedCpfs = new Set<string>();
  if (rows.some((r) => r.cpf)) {
    const existing = await electionRef.collection('voters').select('cpf').get();
    for (const doc of existing.docs) {
      const cpf = doc.data().cpf;
      if (cpf) usedCpfs.add(cpf);
    }
  }
  const claimCpf = (cpf?: string) => {
    if (!cpf) return;
    if (usedCpfs.has(cpf)) {
      throw new HttpsError('already-exists', `CPF duplicado na eleição: ${cpf}`);
    }
    usedCpfs.add(cpf);
  };

  const uniqueLogin = (row: ImportRow): string => {
    const base = row.login || loginFromName(row.name);
    if (row.login && usedLogins.has(row.login)) {
      throw new HttpsError(
        'already-exists',
        `Login duplicado na eleição: ${row.login}`,
      );
    }
    let candidate = base;
    let seq = 2;
    while (usedLogins.has(candidate)) {
      candidate = `${base}${seq}`;
      seq += 1;
    }
    usedLogins.add(candidate);
    return candidate;
  };

  const access: AccessRow[] = [];
  for (let start = 0; start < rows.length; start += BATCH_CHUNK) {
    const batch = db.batch();
    for (const row of rows.slice(start, start + BATCH_CHUNK)) {
      const voterRef = electionRef.collection('voters').doc();
      claimCpf(row.cpf);
      const voter: Record<string, unknown> = {
        name: row.name,
        nameLower: normalizeName(row.name),
        nameTokens: nameTokens(row.name),
        present: false,
        hasVoted: false,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (row.cpf) voter.cpf = row.cpf;
      if (row.matricula) voter.matricula = row.matricula;
      const accessRow: AccessRow = { voterId: voterRef.id, name: row.name };

      if (generatesAccess && authMode === 'credentials') {
        const login = uniqueLogin(row);
        const password = generatePassword();
        voter.login = login;
        voter.credentialHash = hashPassword(password);
        accessRow.login = login;
        accessRow.password = password;
      } else if (generatesAccess) {
        const token = generateToken();
        const tokenHash = sha256(token);
        voter.tokenHash = tokenHash;
        batch.set(db.doc(`accessTokens/${tokenHash}`), {
          electionId,
          voterId: voterRef.id,
        });
        accessRow.token = token;
      }

      batch.set(voterRef, voter);
      access.push(accessRow);
    }
    await batch.commit();
  }

  await electionRef
    .collection('meta')
    .doc('stats')
    .set({ totalVoters: FieldValue.increment(rows.length) }, { merge: true });

  return { voters: access };
});

/**
 * Regenera o acesso de um eleitor (nova senha ou novo link), invalidando o
 * anterior. Retorna a nova credencial em claro — única oportunidade de copiá-la.
 */
export const resetVoterAccess = onCall(async (request) => {
  await assertAdmin(request);
  const electionId = requireString(request.data?.electionId, 'eleição');
  const voterId = requireString(request.data?.voterId, 'eleitor');

  const electionRef = db.doc(`elections/${electionId}`);
  const voterRef = electionRef.collection('voters').doc(voterId);
  const [electionSnap, voterSnap] = await Promise.all([
    electionRef.get(),
    voterRef.get(),
  ]);
  if (!electionSnap.exists || !voterSnap.exists) {
    throw new HttpsError('not-found', 'Eleição ou eleitor não encontrado.');
  }

  const voter = voterSnap.data()!;
  const result: AccessRow = { voterId, name: voter.name };

  if (electionSnap.data()!.authMode === 'credentials') {
    const password = generatePassword();
    await voterRef.update({ credentialHash: hashPassword(password) });
    result.login = voter.login;
    result.password = password;
  } else {
    const token = generateToken();
    const tokenHash = sha256(token);
    const batch = db.batch();
    if (voter.tokenHash) {
      batch.delete(db.doc(`accessTokens/${voter.tokenHash}`));
    }
    batch.set(db.doc(`accessTokens/${tokenHash}`), { electionId, voterId });
    batch.update(voterRef, { tokenHash });
    await batch.commit();
    result.token = token;
  }

  return result;
});

/** Remove um eleitor (que ainda não votou) e ajusta os agregados. */
export const deleteVoter = onCall(async (request) => {
  await assertAdmin(request);
  const electionId = requireString(request.data?.electionId, 'eleição');
  const voterId = requireString(request.data?.voterId, 'eleitor');

  const electionRef = db.doc(`elections/${electionId}`);
  const voterRef = electionRef.collection('voters').doc(voterId);
  const statsRef = electionRef.collection('meta').doc('stats');

  await db.runTransaction(async (tx) => {
    const [voterSnap, electionSnap] = await Promise.all([
      tx.get(voterRef),
      tx.get(electionRef),
    ]);
    if (!voterSnap.exists) {
      throw new HttpsError('not-found', 'Eleitor não encontrado.');
    }
    const voter = voterSnap.data()!;
    if (voter.hasVoted) {
      throw new HttpsError(
        'failed-precondition',
        'Não é possível remover um eleitor que já votou.',
      );
    }
    if (voter.tokenHash) {
      tx.delete(db.doc(`accessTokens/${voter.tokenHash}`));
    }
    tx.delete(voterRef);
    // Em eventos offline, o presentCount é ajustado pelo gatilho ao apagar o doc.
    const offline = electionSnap.data()?.offlinePresence === true;
    tx.set(
      statsRef,
      {
        totalVoters: FieldValue.increment(-1),
        ...(voter.present && !offline
          ? { presentCount: FieldValue.increment(-1) }
          : {}),
      },
      { merge: true },
    );
  });

  return { ok: true };
});

/**
 * Exclui uma eleição (não aberta) com todas as subcoleções e tokens de acesso.
 */
export const deleteElection = onCall(
  { timeoutSeconds: 300 },
  async (request) => {
    await assertAdmin(request);
    const electionId = requireString(request.data?.electionId, 'eleição');

    const electionRef = db.doc(`elections/${electionId}`);
    const snap = await electionRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Eleição não encontrada.');
    }
    if (snap.data()!.status === 'open') {
      throw new HttpsError(
        'failed-precondition',
        'Encerre a eleição antes de excluí-la.',
      );
    }

    const tokens = await db
      .collection('accessTokens')
      .where('electionId', '==', electionId)
      .get();
    for (let start = 0; start < tokens.docs.length; start += 500) {
      const batch = db.batch();
      for (const doc of tokens.docs.slice(start, start + 500)) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    await db.recursiveDelete(electionRef);
    return { ok: true };
  },
);

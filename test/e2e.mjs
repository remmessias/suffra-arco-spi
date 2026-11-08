/**
 * Teste end-to-end contra os EMULADORES (rodar após `npm run seed`):
 * exercita login admin, criação de eleições nos dois modos de acesso,
 * importação de eleitores, presença, voto secreto, voto duplo rejeitado
 * e agregados em meta/stats.
 *
 * Uso: node test/e2e.mjs
 */
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

const PROJECT = 'demo-suffra2';
const REGION = 'southamerica-east1';
const AUTH_URL = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
const FN_URL = `http://127.0.0.1:5001/${PROJECT}/${REGION}`;

const db = getFirestore(initializeApp({ projectId: PROJECT }));

async function authRest(path, body) {
  const res = await fetch(`${AUTH_URL}/${path}?key=demo-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`auth ${path}: ${JSON.stringify(json)}`);
  return json;
}

async function callFn(name, data, idToken) {
  const res = await fetch(`${FN_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const json = await res.json();
  return { ok: res.ok && !json.error, json };
}

async function mustCall(name, data, idToken) {
  const { ok, json } = await callFn(name, data, idToken);
  if (!ok) throw new Error(`${name} falhou: ${JSON.stringify(json)}`);
  return json.result;
}

async function voterSession(customToken) {
  const session = await authRest('accounts:signInWithCustomToken', {
    token: customToken,
    returnSecureToken: true,
  });
  return session.idToken;
}

const log = (msg) => console.log(`✔ ${msg}`);

// ---------------------------------------------------------------------------
// 1. Login do admin
const adminSession = await authRest('accounts:signInWithPassword', {
  email: 'admin@suffra.test',
  password: 'suffra123',
  returnSecureToken: true,
});
const adminToken = adminSession.idToken;
const adminUid = adminSession.localId;
log('admin autenticado');

// 2. Eleição modo credentials
const credElection = await db.collection('elections').add({
  name: 'E2E Credentials',
  description: '',
  status: 'draft',
  authMode: 'credentials',
  allowBlank: true,
  createdAt: FieldValue.serverTimestamp(),
  createdBy: adminUid,
});
const candA = await credElection.collection('candidates').add({ name: 'Chapa A', number: '1', order: 0 });
const candB = await credElection.collection('candidates').add({ name: 'Chapa B', number: '2', order: 1 });

const imported = await mustCall(
  'importVoters',
  {
    electionId: credElection.id,
    voters: [{ name: 'Ana Souza' }, { name: 'Bruno Lima' }, { name: 'Carla Dias' }],
  },
  adminToken,
);
assert.equal(imported.voters.length, 3);
assert.ok(imported.voters[0].login && imported.voters[0].password);
log('importVoters (credentials) gerou logins e senhas');

// Voto antes de abrir deve falhar
const earlyLogin = await callFn('voterLogin', {
  electionId: credElection.id,
  login: imported.voters[0].login,
  password: imported.voters[0].password,
});
assert.equal(earlyLogin.ok, false);
log('login de eleitor bloqueado com eleição em rascunho');

await credElection.update({ status: 'open' });

// 3. Fluxo do eleitor 1: login → presença → voto
const v1 = imported.voters[0];
const login1 = await mustCall('voterLogin', {
  electionId: credElection.id,
  login: v1.login,
  password: v1.password,
});
const v1Token = await voterSession(login1.token);
log('voterLogin com credenciais corretas');

const badLogin = await callFn('voterLogin', {
  electionId: credElection.id,
  login: v1.login,
  password: 'SENHA-ERRADA',
});
assert.equal(badLogin.ok, false);
log('voterLogin com senha errada rejeitado');

// Votar sem presença deve falhar
const earlyVote = await callFn('castVote', { candidateId: candA.id }, v1Token);
assert.equal(earlyVote.ok, false);
log('voto sem presença confirmada rejeitado');

await mustCall('confirmPresence', {}, v1Token);
await mustCall('confirmPresence', {}, v1Token); // idempotente
log('presença confirmada (idempotente)');

await mustCall('castVote', { candidateId: candA.id }, v1Token);
log('voto registrado');

const doubleVote = await callFn('castVote', { candidateId: candB.id }, v1Token);
assert.equal(doubleVote.ok, false);
log('segundo voto rejeitado');

// 4. Eleitor 2 vota em branco
const v2 = imported.voters[1];
const login2 = await mustCall('voterLogin', {
  electionId: credElection.id,
  login: v2.login,
  password: v2.password,
});
const v2Token = await voterSession(login2.token);
await mustCall('confirmPresence', {}, v2Token);
await mustCall('castVote', { candidateId: 'BRANCO' }, v2Token);
log('voto em branco registrado');

// 5. Confere agregados e sigilo
const stats = (await credElection.collection('meta').doc('stats').get()).data();
assert.equal(stats.totalVoters, 3);
assert.equal(stats.presentCount, 2);
assert.equal(stats.votedCount, 2);
assert.equal(stats.results[candA.id], 1);
assert.equal(stats.results.BRANCO, 1);
log('meta/stats com agregados corretos');

const ballots = await credElection.collection('ballots').get();
assert.equal(ballots.size, 2);
for (const b of ballots.docs) {
  const keys = Object.keys(b.data()).sort();
  assert.deepEqual(keys, ['candidateId', 'castAt']);
}
log('cédulas sem qualquer vínculo com o eleitor (voto secreto)');

// 6. resetVoterAccess (credentials)
const v3 = imported.voters[2];
const reset = await mustCall(
  'resetVoterAccess',
  { electionId: credElection.id, voterId: v3.voterId },
  adminToken,
);
assert.ok(reset.password && reset.password !== v3.password);
const oldPwd = await callFn('voterLogin', {
  electionId: credElection.id,
  login: v3.login,
  password: v3.password,
});
assert.equal(oldPwd.ok, false);
await mustCall('voterLogin', {
  electionId: credElection.id,
  login: v3.login,
  password: reset.password,
});
log('resetVoterAccess invalida a senha antiga e a nova funciona');

// 6.5. Pausa manual: bloqueia presença/voto enquanto aberta; retomar libera
const v3Login = await mustCall('voterLogin', {
  electionId: credElection.id,
  login: v3.login,
  password: reset.password,
});
const v3Token = await voterSession(v3Login.token);
await credElection.update({ paused: true });
const pausedPresence = await callFn('confirmPresence', {}, v3Token);
assert.equal(pausedPresence.ok, false);
log('confirmar presença bloqueado com votação pausada');
await credElection.update({ paused: false });
await mustCall('confirmPresence', {}, v3Token);
await credElection.update({ paused: true });
const pausedVote = await callFn('castVote', { candidateId: candA.id }, v3Token);
assert.equal(pausedVote.ok, false);
log('voto bloqueado com votação pausada');
await credElection.update({ paused: false });
await mustCall('castVote', { candidateId: candB.id }, v3Token);
log('voto registrado após retomar');

// 7. Eleição modo link
const linkElection = await db.collection('elections').add({
  name: 'E2E Link',
  description: '',
  status: 'open',
  authMode: 'link',
  allowBlank: false,
  createdAt: FieldValue.serverTimestamp(),
  createdBy: adminUid,
});
const candL = await linkElection.collection('candidates').add({ name: 'Chapa Única', number: '1', order: 0 });
const linkImport = await mustCall(
  'importVoters',
  { electionId: linkElection.id, voters: [{ name: 'Diego Reis' }] },
  adminToken,
);
const linkVoter = linkImport.voters[0];
assert.ok(linkVoter.token);
log('importVoters (link) gerou token');

const redeem = await mustCall('redeemAccessLink', { token: linkVoter.token });
assert.equal(redeem.electionId, linkElection.id);
const lvToken = await voterSession(redeem.token);
await mustCall('confirmPresence', {}, lvToken);
await mustCall('castVote', { candidateId: candL.id }, lvToken);
log('fluxo completo pelo link único');

const badRedeem = await callFn('redeemAccessLink', { token: 'token-invalido' });
assert.equal(badRedeem.ok, false);
log('link inválido rejeitado');

// 7.5. Link com senha individual por eleitor
const linkPwElection = await db.collection('elections').add({
  name: 'E2E Link+Senha',
  description: '',
  status: 'open',
  kind: 'election',
  authMode: 'link',
  allowBlank: false,
  linkRequiresPassword: true,
  createdAt: FieldValue.serverTimestamp(),
  createdBy: adminUid,
});
const candLP = await linkPwElection
  .collection('candidates')
  .add({ name: 'Chapa X', number: '1', order: 0 });
const lpImport = await mustCall(
  'importVoters',
  { electionId: linkPwElection.id, voters: [{ name: 'Elena Prado' }] },
  adminToken,
);
const lpVoter = lpImport.voters[0];
assert.ok(lpVoter.token && lpVoter.password);
log('importVoters (link+senha) gera token e senha');

const noPw = await callFn('redeemAccessLink', { token: lpVoter.token });
assert.equal(noPw.ok, false);
assert.equal(noPw.json.error?.details?.reason, 'password-required');
log('resgate do link sem senha é bloqueado (password-required)');

const wrongPw = await callFn('redeemAccessLink', {
  token: lpVoter.token,
  password: 'senha-errada',
});
assert.equal(wrongPw.ok, false);
log('resgate do link com senha errada é bloqueado');

const okPw = await mustCall('redeemAccessLink', {
  token: lpVoter.token,
  password: lpVoter.password,
});
assert.equal(okPw.electionId, linkPwElection.id);
const lpToken = await voterSession(okPw.token);
await mustCall('confirmPresence', {}, lpToken);
await mustCall('castVote', { candidateId: candLP.id }, lpToken);
log('resgate do link com senha correta permite votar');

// Import com senha informada (coluna "senha") vs gerada automaticamente.
const lpImport2 = await mustCall(
  'importVoters',
  {
    electionId: linkPwElection.id,
    voters: [
      { name: 'Com Senha', password: 'MinhaSenha123' },
      { name: 'Sem Senha' },
    ],
  },
  adminToken,
);
const comSenha = lpImport2.voters.find((v) => v.name === 'Com Senha');
const semSenha = lpImport2.voters.find((v) => v.name === 'Sem Senha');
assert.equal(comSenha.password, 'MinhaSenha123');
assert.ok(semSenha.password && semSenha.password !== 'MinhaSenha123');
log('importVoters usa a senha informada e gera para quem não tem');

const okProvided = await mustCall('redeemAccessLink', {
  token: comSenha.token,
  password: 'MinhaSenha123',
});
assert.equal(okProvided.electionId, linkPwElection.id);
log('senha informada no import funciona no resgate do link');

// 8. Funções de admin exigem admin
const notAdmin = await callFn(
  'importVoters',
  { electionId: credElection.id, voters: [{ name: 'X' }] },
  v1Token,
);
assert.equal(notAdmin.ok, false);
log('importVoters bloqueado para não-admin');

// 9. Encerramento + deleteElection
await credElection.update({ status: 'closed' });
await linkElection.update({ status: 'closed' });
await mustCall('deleteElection', { electionId: linkElection.id }, adminToken);
const gone = await db.doc(`elections/${linkElection.id}`).get();
assert.equal(gone.exists, false);
const orphanTokens = await db
  .collection('accessTokens')
  .where('electionId', '==', linkElection.id)
  .get();
assert.equal(orphanTokens.size, 0);
log('deleteElection remove eleição e tokens');

// ---------------------------------------------------------------------------
// 10. Evento de credenciamento (attendance) + mesário
const att = await db.collection('elections').add({
  name: 'E2E Credenciamento',
  description: '',
  status: 'draft',
  kind: 'attendance',
  authMode: 'credentials',
  allowBlank: false,
  createdAt: FieldValue.serverTimestamp(),
  createdBy: adminUid,
});

const attImport = await mustCall(
  'importVoters',
  {
    electionId: att.id,
    voters: [
      { name: 'Alice Souza', cpf: '111.444.777-35', matricula: 'A1' },
      { name: 'Bruno Lima', matricula: 'B2' },
      { name: 'Carla Dias', cpf: '52998224725' },
    ],
  },
  adminToken,
);
assert.equal(attImport.voters.length, 3);
// Em attendance não há acesso para o eleitor.
assert.ok(!attImport.voters[0].login && !attImport.voters[0].token);
log('importVoters (attendance) cadastra a lista sem gerar acesso de eleitor');

const dupCpf = await callFn(
  'importVoters',
  { electionId: att.id, voters: [{ name: 'Clone', cpf: '111.444.777-35' }] },
  adminToken,
);
assert.equal(dupCpf.ok, false);
log('CPF duplicado rejeitado na importação');

const worker = await mustCall(
  'createPollWorker',
  { electionId: att.id, name: 'Mesário João' },
  adminToken,
);
assert.ok(worker.login && worker.password);
log('createPollWorker gera login e senha');

// Login do mesário antes de abrir deve falhar
const earlyWorker = await callFn('pollWorkerLogin', {
  electionId: att.id,
  login: worker.login,
  password: worker.password,
});
assert.equal(earlyWorker.ok, false);
log('login de mesário bloqueado com evento em rascunho');

await att.update({ status: 'open' });

const workerLogin = await mustCall('pollWorkerLogin', {
  electionId: att.id,
  login: worker.login,
  password: worker.password,
});
const workerToken = await voterSession(workerLogin.token);
log('pollWorkerLogin com credenciais corretas');

// Buscas
const byName = await mustCall('searchVoters', { query: 'alice' }, workerToken);
assert.ok(byName.voters.some((v) => v.name === 'Alice Souza'));
assert.ok(byName.voters[0].cpf.startsWith('***')); // CPF mascarado
log('searchVoters por nome (prefixo) com CPF mascarado');

const byToken = await mustCall('searchVoters', { query: 'souza' }, workerToken);
assert.ok(byToken.voters.some((v) => v.name === 'Alice Souza'));
log('searchVoters por palavra do nome (token)');

const byCpf = await mustCall('searchVoters', { query: '11144477735' }, workerToken);
assert.ok(byCpf.voters.some((v) => v.name === 'Alice Souza'));
log('searchVoters por CPF');

const byMat = await mustCall('searchVoters', { query: 'B2' }, workerToken);
assert.ok(byMat.voters.some((v) => v.name === 'Bruno Lima'));
log('searchVoters por matrícula');

const aliceId = byName.voters.find((v) => v.name === 'Alice Souza').id;
await mustCall('setVoterPresence', { voterId: aliceId, present: true }, workerToken);
await mustCall('setVoterPresence', { voterId: aliceId, present: true }, workerToken); // idempotente
let attStats = (await att.collection('meta').doc('stats').get()).data();
assert.equal(attStats.presentCount, 1);
log('setVoterPresence confirma presença (idempotente)');

const aliceDoc = (await att.collection('voters').doc(aliceId).get()).data();
assert.equal(aliceDoc.present, true);
assert.equal(aliceDoc.presentBy, 'Mesário João');
log('presença registra quem confirmou (presentBy)');

await mustCall('setVoterPresence', { voterId: aliceId, present: false }, workerToken);
attStats = (await att.collection('meta').doc('stats').get()).data();
assert.equal(attStats.presentCount, 0);
log('setVoterPresence desfaz presença e ajusta o contador');

// Pausa no credenciamento bloqueia o mesário; retomar libera.
await att.update({ paused: true });
const pausedStaff = await callFn(
  'setVoterPresence',
  { voterId: aliceId, present: true },
  workerToken,
);
assert.equal(pausedStaff.ok, false);
log('credenciamento bloqueado com evento pausado');
await att.update({ paused: false });

// searchVoters exige staff
const anon = await callFn('searchVoters', { query: 'alice' });
assert.equal(anon.ok, false);
log('searchVoters bloqueado sem autenticação');

// Mesário não pode usar funções de admin
const workerImport = await callFn(
  'importVoters',
  { electionId: att.id, voters: [{ name: 'X' }] },
  workerToken,
);
assert.equal(workerImport.ok, false);
log('importVoters bloqueado para mesário');

// ---------------------------------------------------------------------------
// 11. Credenciamento OFFLINE: write direto + gatilho de contagem + rules
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;

async function fsPatch(path, fields, mask, idToken) {
  const qs = mask.map((f) => `updateMask.fieldPaths=${f}`).join('&');
  const res = await fetch(`${FS}/${path}?${qs}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields }),
  });
  return res.status;
}

async function waitStat(ref, field, expected, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const data = (await ref.get()).data() ?? {};
    if ((data[field] ?? 0) === expected) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  const data = (await ref.get()).data() ?? {};
  throw new Error(
    `timeout: ${field}==${expected}, atual ${data[field] ?? 0}`,
  );
}

const off = await db.collection('elections').add({
  name: 'E2E Offline',
  description: '',
  status: 'open',
  kind: 'attendance',
  authMode: 'credentials',
  allowBlank: false,
  offlinePresence: true,
  createdAt: FieldValue.serverTimestamp(),
  createdBy: adminUid,
});
const offImport = await mustCall(
  'importVoters',
  {
    electionId: off.id,
    voters: [
      { name: 'Diana Prince', cpf: '39053344705' },
      { name: 'Elias Moraes', matricula: 'M9' },
    ],
    // (importVoters não usa authMode aqui; attendance ignora acesso do eleitor)
  },
  adminToken,
);
const offA = offImport.voters[0].voterId;
const offB = offImport.voters[1].voterId;

const offWorker = await mustCall(
  'createPollWorker',
  { electionId: off.id, name: 'Mesário Offline', login: 'offmesa' },
  adminToken,
);
const offLogin = await mustCall('pollWorkerLogin', {
  electionId: off.id,
  login: offWorker.login,
  password: offWorker.password,
});
const offToken = await voterSession(offLogin.token);
const offStats = off.collection('meta').doc('stats');

// Escrita direta do mesário (simula o cliente offline) — permitida pelas rules.
const s1 = await fsPatch(
  `elections/${off.id}/voters/${offA}`,
  { present: { booleanValue: true } },
  ['present'],
  offToken,
);
assert.equal(s1, 200);
await waitStat(offStats, 'presentCount', 1);
log('write direto de presença permitido e gatilho conta (offline)');

// Reconfirmar não conta de novo (idempotente no gatilho).
await fsPatch(
  `elections/${off.id}/voters/${offA}`,
  { present: { booleanValue: true } },
  ['present'],
  offToken,
);
await new Promise((r) => setTimeout(r, 800));
assert.equal((await offStats.get()).data().presentCount, 1);
log('reconfirmar presença não infla a contagem (idempotente)');

// setVoterPresence (callable) num evento offline não conta duas vezes.
await mustCall('setVoterPresence', { voterId: offB, present: true }, offToken);
await waitStat(offStats, 'presentCount', 2);
log('setVoterPresence em evento offline não duplica a contagem');

// Desfazer presença ajusta o contador.
await fsPatch(
  `elections/${off.id}/voters/${offA}`,
  { present: { booleanValue: false } },
  ['present'],
  offToken,
);
await waitStat(offStats, 'presentCount', 1);
log('desfazer presença (write direto) decrementa via gatilho');

// Rules: mesário não pode alterar outros campos.
const sName = await fsPatch(
  `elections/${off.id}/voters/${offA}`,
  { name: { stringValue: 'Hack' } },
  ['name'],
  offToken,
);
assert.equal(sName, 403);
log('mesário não pode alterar campos além de presença (rules)');

// Rules: write direto bloqueado em evento sem offline habilitado.
const attVoterId = attImport.voters[0].voterId;
const sNonOffline = await fsPatch(
  `elections/${att.id}/voters/${attVoterId}`,
  { present: { booleanValue: true } },
  ['present'],
  workerToken,
);
assert.equal(sNonOffline, 403);
log('write direto bloqueado em evento sem credenciamento offline (rules)');

console.log('\n🎉 Todos os testes E2E passaram.');
process.exit(0);

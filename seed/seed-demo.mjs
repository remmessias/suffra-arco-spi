/**
 * Popula os EMULADORES com dados de demonstração "bonitos" para capturas de
 * tela (landing page): uma eleição em andamento com apuração parcial realista
 * e um evento de credenciamento com mesário.
 *
 * Uso: com os emuladores rodando, `node seed/seed-demo.mjs`.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

const PROJECT = 'demo-suffra2';
const FN = `http://127.0.0.1:5001/${PROJECT}/southamerica-east1`;
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

const app = initializeApp({ projectId: PROJECT });
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = 'admin@suffra.test';
const ADMIN_PASSWORD = 'suffra123';

async function call(name, data, idToken) {
  const res = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${name}: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function ensureAdmin() {
  let user;
  try {
    user = await auth.getUserByEmail(ADMIN_EMAIL);
  } catch {
    user = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: 'Admin Suffra',
    });
  }
  await db.doc(`admins/${user.uid}`).set({ name: 'Admin Suffra', email: ADMIN_EMAIL });
  const session = await (
    await fetch(`${AUTH}/accounts:signInWithPassword?key=demo-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        returnSecureToken: true,
      }),
    })
  ).json();
  return { uid: user.uid, idToken: session.idToken };
}

const NOMES = [
  'Ana Beatriz Ferreira', 'Carlos Eduardo Ramos', 'Mariana Costa Lima',
  'Rafael Oliveira Souza', 'Juliana Almeida Rocha', 'Pedro Henrique Barros',
  'Camila Nogueira Dias', 'Lucas Martins Pereira', 'Fernanda Ribeiro Gomes',
  'Thiago Cardoso Melo', 'Patrícia Azevedo Cruz', 'Bruno Carvalho Pinto',
];

function cpf(i) {
  return String(10000000000 + i * 7654321).slice(0, 11);
}

async function main() {
  const admin = await ensureAdmin();

  // ---------------------------------------------------------------- Eleição
  const eleicao = await db.collection('elections').add({
    name: 'Conferência Estadual 2026',
    description: 'Eleição da nova direção estadual',
    status: 'open',
    kind: 'election',
    authMode: 'credentials',
    allowBlank: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: admin.uid,
  });

  const chapas = [
    { name: 'Chapa Unidade e Luta', number: '10', description: 'Renovação com participação de base' },
    { name: 'Chapa Construir o Futuro', number: '20', description: 'Fortalecimento das instâncias municipais' },
    { name: 'Chapa Avança Estadual', number: '30', description: 'Ampliação da formação política' },
  ];
  const ids = [];
  for (const [i, c] of chapas.entries()) {
    const ref = await eleicao.collection('candidates').add({ ...c, order: i });
    ids.push(ref.id);
  }

  // Eleitores reais (para a tela de login/cédula funcionar de verdade)
  const acessos = await call(
    'importVoters',
    { electionId: eleicao.id, voters: NOMES.map((name) => ({ name })) },
    admin.idToken,
  );

  // Apuração parcial realista no agregado meta/stats.
  await eleicao.collection('meta').doc('stats').set(
    {
      totalVoters: 342,
      presentCount: 298,
      votedCount: 271,
      results: { [ids[0]]: 128, [ids[1]]: 94, [ids[2]]: 41, BRANCO: 8 },
    },
    { merge: true },
  );

  // --------------------------------------------------------- Credenciamento
  const cred = await db.collection('elections').add({
    name: 'Congresso Nacional 2026',
    description: 'Credenciamento de delegados',
    status: 'open',
    kind: 'attendance',
    authMode: 'credentials',
    allowBlank: false,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: admin.uid,
  });

  await call(
    'importVoters',
    {
      electionId: cred.id,
      voters: NOMES.map((name, i) => ({
        name,
        cpf: cpf(i),
        matricula: `DEL${String(2026000 + i)}`,
      })),
    },
    admin.idToken,
  );

  const mesario = await call(
    'createPollWorker',
    { electionId: cred.id, name: 'Helena Martins', login: 'helena' },
    admin.idToken,
  );

  await cred.collection('meta').doc('stats').set(
    { totalVoters: 512, presentCount: 389 },
    { merge: true },
  );

  console.log(JSON.stringify(
    {
      eleicaoId: eleicao.id,
      credId: cred.id,
      eleitor: { login: acessos.voters[0].login, password: acessos.voters[0].password },
      mesario: { login: mesario.login, password: mesario.password },
    },
    null,
    2,
  ));
}

main().then(() => process.exit(0));

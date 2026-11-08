/**
 * Popula os EMULADORES com dados de teste:
 *  - admin: admin@suffra.test / suffra123
 *  - uma eleição em rascunho com 3 chapas (modo login/senha)
 *
 * Uso: com os emuladores rodando, `npm run seed`.
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';

const app = initializeApp({ projectId: 'demo-suffra2' });
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = 'admin@suffra.test';
const ADMIN_PASSWORD = 'suffra123';

async function main() {
  // Admin
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
  await db.doc(`admins/${user.uid}`).set({
    name: 'Admin Suffra',
    email: ADMIN_EMAIL,
  });
  console.log(`Admin pronto: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  // Eleição de exemplo
  const election = await db.collection('elections').add({
    name: 'Eleição de Demonstração',
    description: 'Criada pelo seed dos emuladores',
    status: 'draft',
    kind: 'election',
    authMode: 'credentials',
    allowBlank: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: user.uid,
  });
  const chapas = ['Chapa Unidade', 'Chapa Renovação', 'Chapa Esperança'];
  await Promise.all(
    chapas.map((name, i) =>
      election.collection('candidates').add({
        name,
        number: String(i + 1),
        description: '',
        order: i,
      }),
    ),
  );
  console.log(`Eleição de demonstração criada: ${election.id}`);
  console.log('Importe eleitores pela interface admin para gerar acessos.');
}

main().then(() => process.exit(0));

/**
 * Bootstrap do primeiro administrador no projeto Firebase REAL.
 *
 * 1. Baixe a chave de service account no Console Firebase
 *    (Configurações → Contas de serviço → Gerar nova chave privada)
 *    e salve como serviceAccountKey.json na raiz do projeto.
 * 2. Rode: node scripts/set-admin.mjs email@exemplo.com "Senha123" "Nome"
 *
 * Cria (ou reaproveita) o usuário no Firebase Auth e o registra em admins/{uid}.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [email, password, name = 'Administrador'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/set-admin.mjs <email> <senha> [nome]');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app);

let user;
try {
  user = await auth.getUserByEmail(email);
  console.log('Usuário já existe no Auth, reaproveitando.');
} catch {
  user = await auth.createUser({ email, password, displayName: name });
  console.log('Usuário criado no Firebase Auth.');
}

await db.doc(`admins/${user.uid}`).set({ name, email });
console.log(`✔ ${email} agora é administrador (uid: ${user.uid}).`);
process.exit(0);

/**
 * Remove um administrador do projeto Firebase REAL.
 *
 * Usa o serviceAccountKey.json (mesma chave do set-admin.mjs).
 * Apaga o usuário do Firebase Auth e o registro em admins/{uid}.
 *
 * Uso: node scripts/remove-admin.mjs email@exemplo.com
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [email] = process.argv.slice(2);
if (!email) {
  console.error('Uso: node scripts/remove-admin.mjs <email>');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'));
const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app);

let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  console.error(`Nenhum usuário com e-mail ${email} encontrado no Auth.`);
  process.exit(1);
}

await db.doc(`admins/${user.uid}`).delete();
await auth.deleteUser(user.uid);
console.log(`✔ ${email} removido (Auth + admins/${user.uid}).`);
process.exit(0);

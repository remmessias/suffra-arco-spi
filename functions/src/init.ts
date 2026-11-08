import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { setGlobalOptions } from 'firebase-functions/v2';

// Precisa rodar antes de qualquer onCall(); este módulo é importado primeiro.
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 10 });

initializeApp();

export const db = getFirestore();
export const adminAuth = getAuth();

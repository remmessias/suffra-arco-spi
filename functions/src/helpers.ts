import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { db } from './init.js';

export const BLANK_VOTE_ID = 'BRANCO';

export interface VoterClaims {
  electionId: string;
  voterId: string;
}

/** Garante que o chamador é admin (existe em admins/{uid}). */
export async function assertAdmin(request: CallableRequest): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Faça login para continuar.');
  }
  const adminDoc = await db.doc(`admins/${uid}`).get();
  if (!adminDoc.exists) {
    throw new HttpsError('permission-denied', 'Acesso restrito a administradores.');
  }
  return uid;
}

/** Extrai as claims de eleitor do token do chamador. */
export function getVoterClaims(request: CallableRequest): VoterClaims {
  const token = request.auth?.token as Record<string, unknown> | undefined;
  if (!token || token.role !== 'voter') {
    throw new HttpsError('unauthenticated', 'Sessão de eleitor inválida.');
  }
  return {
    electionId: token.electionId as string,
    voterId: token.voterId as string,
  };
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpsError('invalid-argument', `Campo obrigatório: ${field}.`);
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// Credenciais e tokens
// ---------------------------------------------------------------------------

/** Hash scrypt no formato "saltHex:hashHex". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize('NFKC'), salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), 32);
  return timingSafeEqual(hash, Buffer.from(hashHex, 'hex'));
}

/** Senha legível sem caracteres ambíguos (ex.: K7QM-2XJP). */
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const pick = () => alphabet[randomBytes(1)[0] % alphabet.length];
  const block = () => Array.from({ length: 4 }, pick).join('');
  return `${block()}-${block()}`;
}

/** Token opaco para links únicos de votação. */
export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Gera login a partir do nome: "Maria da Silva" → "maria.silva". */
export function loginFromName(name: string): string {
  const parts = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return 'eleitor';
  if (parts.length === 1) return parts[0];
  return `${parts[0]}.${parts[parts.length - 1]}`;
}

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

/** UID determinístico do usuário Firebase Auth de um eleitor. */
export function voterUid(electionId: string, voterId: string): string {
  return `voter_${electionId}_${voterId}`;
}

/** UID determinístico do usuário Firebase Auth de um mesário. */
export function pollWorkerUid(electionId: string, pollWorkerId: string): string {
  return `poll_${electionId}_${pollWorkerId}`;
}

// ---------------------------------------------------------------------------
// Busca de eleitores (credenciamento)
// ---------------------------------------------------------------------------

/** Nome sem acentos, minúsculo, espaços colapsados — para busca por prefixo. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palavras do nome normalizado — para busca por qualquer termo. */
export function nameTokens(name: string): string[] {
  const normalized = normalizeName(name);
  return normalized ? Array.from(new Set(normalized.split(' '))) : [];
}

/** Mantém apenas os dígitos (CPF/matrícula numérica). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Mascara o CPF para exibição: 123.456.789-01 → ***.456.789-**. */
export function maskCpf(cpf?: string): string {
  const digits = cpf ? onlyDigits(cpf) : '';
  if (digits.length !== 11) return cpf ?? '';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

export interface StaffContext {
  electionId: string;
  /** Nome legível de quem está confirmando (mesário ou "Administração"). */
  actor: string;
}

/**
 * Resolve o contexto de "staff": aceita um mesário (claim role=pollworker) ou
 * um admin (com electionId no payload). Usado por searchVoters/setVoterPresence.
 */
export async function assertStaff(
  request: CallableRequest,
  data: Record<string, unknown> | undefined,
): Promise<StaffContext> {
  const token = request.auth?.token as Record<string, unknown> | undefined;
  if (token?.role === 'pollworker') {
    return {
      electionId: token.electionId as string,
      actor: (token.name as string) || 'Mesário',
    };
  }
  await assertAdmin(request);
  return { electionId: requireString(data?.electionId, 'eleição'), actor: 'Administração' };
}

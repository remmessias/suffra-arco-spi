import type { Timestamp } from 'firebase/firestore';

export type ElectionStatus = 'draft' | 'open' | 'closed';
export type AuthMode = 'credentials' | 'link';
/** election = presença + voto · attendance = somente credenciamento (mesário). */
export type ElectionKind = 'election' | 'attendance';

/** Pseudo-candidato para voto em branco (quando habilitado na eleição). */
export const BLANK_VOTE_ID = 'BRANCO';

export interface Election {
  id: string;
  name: string;
  description: string;
  status: ElectionStatus;
  kind: ElectionKind;
  authMode: AuthMode;
  allowBlank: boolean;
  /** Credenciamento tolerante a internet instável (só eventos attendance). */
  offlinePresence?: boolean;
  /** Pausa manual: enquanto aberta, bloqueia voto/credenciamento até retomar. */
  paused?: boolean;
  /** Modo link: exige senha individual por eleitor além do link único. */
  linkRequiresPassword?: boolean;
  createdAt: Timestamp;
  createdBy: string;
}

export interface Candidate {
  id: string;
  name: string;
  number?: string;
  description?: string;
  order: number;
}

export interface Voter {
  id: string;
  name: string;
  /** Apenas no modo credentials. */
  login?: string;
  cpf?: string;
  matricula?: string;
  present: boolean;
  presentAt?: Timestamp;
  /** Quem confirmou a presença (mesário ou "Administração"). */
  presentBy?: string;
  hasVoted: boolean;
  votedAt?: Timestamp;
}

/** Mesário (operador de credenciamento) de uma eleição. */
export interface PollWorker {
  id: string;
  name: string;
  login: string;
  createdAt?: Timestamp;
}

/** Resultado de busca de eleitor (CPF mascarado). */
export interface VoterSearchResult {
  id: string;
  name: string;
  cpf: string;
  matricula: string;
  present: boolean;
  presentBy?: string;
}

export interface ElectionStats {
  totalVoters: number;
  presentCount: number;
  votedCount: number;
  /** Contagem por candidato; chave BLANK_VOTE_ID para votos em branco. */
  results: Record<string, number>;
}

/** Claims do token de um eleitor autenticado. */
export interface VoterClaims {
  role: 'voter';
  electionId: string;
  voterId: string;
}

/** Claims do token de um mesário autenticado. */
export interface PollWorkerClaims {
  role: 'pollworker';
  electionId: string;
  pollworkerId: string;
  name: string;
}

/** Linha retornada pelo importVoters/resetVoterAccess para export único. */
export interface VoterAccessRow {
  voterId: string;
  name: string;
  login?: string;
  password?: string;
  token?: string;
}

/** Acesso de mesário retornado por createPollWorker/resetPollWorkerAccess. */
export interface PollWorkerAccessRow {
  pollWorkerId: string;
  name: string;
  login: string;
  password: string;
}

import { httpsCallable } from 'firebase/functions';
import { FirebaseError } from 'firebase/app';
import { functions } from './firebase';
import type {
  PollWorkerAccessRow,
  VoterAccessRow,
  VoterSearchResult,
} from '../types';

interface ImportRow {
  name: string;
  login?: string;
  cpf?: string;
  matricula?: string;
}

function call<Req, Res>(name: string) {
  const fn = httpsCallable<Req, Res>(functions, name);
  return async (data: Req): Promise<Res> => (await fn(data)).data;
}

export const api = {
  voterLogin: call<
    { electionId: string; login: string; password: string },
    { token: string }
  >('voterLogin'),

  redeemAccessLink: call<
    { token: string },
    { token: string; electionId: string }
  >('redeemAccessLink'),

  pollWorkerLogin: call<
    { electionId: string; login: string; password: string },
    { token: string; electionId: string }
  >('pollWorkerLogin'),

  confirmPresence: call<Record<string, never>, { ok: boolean }>(
    'confirmPresence',
  ),

  castVote: call<{ candidateId: string }, { ok: boolean }>('castVote'),

  searchVoters: call<{ query: string }, { voters: VoterSearchResult[] }>(
    'searchVoters',
  ),

  setVoterPresence: call<
    { electionId?: string; voterId: string; present: boolean },
    { ok: boolean; name: string; present: boolean }
  >('setVoterPresence'),

  createPollWorker: call<
    { electionId: string; name: string; login?: string },
    PollWorkerAccessRow
  >('createPollWorker'),

  resetPollWorkerAccess: call<
    { electionId: string; pollWorkerId: string },
    PollWorkerAccessRow
  >('resetPollWorkerAccess'),

  deletePollWorker: call<
    { electionId: string; pollWorkerId: string },
    { ok: boolean }
  >('deletePollWorker'),

  importVoters: call<
    { electionId: string; voters: ImportRow[] },
    { voters: VoterAccessRow[] }
  >('importVoters'),

  resetVoterAccess: call<
    { electionId: string; voterId: string },
    VoterAccessRow
  >('resetVoterAccess'),

  deleteVoter: call<{ electionId: string; voterId: string }, { ok: boolean }>(
    'deleteVoter',
  ),

  deleteElection: call<{ electionId: string }, { ok: boolean }>(
    'deleteElection',
  ),
};

/** Mensagem amigável de erros das callables (HttpsError do backend). */
export function errorMessage(err: unknown): string {
  if (err instanceof FirebaseError) return err.message.replace(/^.*?: /, '');
  if (err instanceof Error) return err.message;
  return 'Erro inesperado. Tente novamente.';
}

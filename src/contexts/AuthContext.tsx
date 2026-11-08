import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { PollWorkerClaims, VoterClaims } from '../types';

interface AuthState {
  /** Carregando o estado inicial de autenticação. */
  loading: boolean;
  user: User | null;
  isAdmin: boolean;
  /** Claims do eleitor, quando autenticado via voterLogin/redeemAccessLink. */
  voter: VoterClaims | null;
  /** Claims do mesário, quando autenticado via pollWorkerLogin. */
  pollWorker: PollWorkerClaims | null;
  /** Força a releitura das claims (após signInWithCustomToken). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  user: null,
  isAdmin: false,
  voter: null,
  pollWorker: null,
  refresh: async () => {},
});

async function resolveRoles(
  user: User | null,
): Promise<Pick<AuthState, 'isAdmin' | 'voter' | 'pollWorker'>> {
  if (!user) return { isAdmin: false, voter: null, pollWorker: null };

  const token = await user.getIdTokenResult();
  if (token.claims.role === 'voter') {
    return {
      isAdmin: false,
      pollWorker: null,
      voter: {
        role: 'voter',
        electionId: token.claims.electionId as string,
        voterId: token.claims.voterId as string,
      },
    };
  }
  if (token.claims.role === 'pollworker') {
    return {
      isAdmin: false,
      voter: null,
      pollWorker: {
        role: 'pollworker',
        electionId: token.claims.electionId as string,
        pollworkerId: token.claims.pollworkerId as string,
        name: token.claims.name as string,
      },
    };
  }

  const adminDoc = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
  return { isAdmin: adminDoc?.exists() ?? false, voter: null, pollWorker: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refresh'>>({
    loading: true,
    user: null,
    isAdmin: false,
    voter: null,
    pollWorker: null,
  });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      const roles = await resolveRoles(user);
      setState({ loading: false, user, ...roles });
    });
  }, []);

  const refresh = async () => {
    const user = auth.currentUser;
    if (user) await user.getIdToken(true);
    const roles = await resolveRoles(user);
    setState({ loading: false, user, ...roles });
  };

  return (
    <AuthContext.Provider value={{ ...state, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

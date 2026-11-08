import { Link, Navigate, Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Spinner } from '../../components/ui';

export default function AdminLayout() {
  const { loading, user, isAdmin } = useAuth();

  if (loading) return <Spinner label="Carregando..." />;
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/admin" className="text-lg font-bold text-slate-900">
            Suffra <span className="text-primary-600">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{user.email}</span>
            <button
              onClick={() => signOut(auth)}
              className="font-medium text-slate-600 hover:text-primary-600"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

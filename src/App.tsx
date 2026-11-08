import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import ElectionNew from './pages/admin/ElectionNew';
import ElectionDetail from './pages/admin/ElectionDetail';
import VoterLogin from './pages/voter/VoterLogin';
import LinkEntry from './pages/voter/LinkEntry';
import VoterFlow from './pages/voter/VoterFlow';
import PublicResults from './pages/voter/PublicResults';
import PollWorkerLogin from './pages/poll/PollWorkerLogin';
import Credenciamento from './pages/poll/Credenciamento';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="eleicoes/nova" element={<ElectionNew />} />
        <Route path="eleicoes/:electionId" element={<ElectionDetail />} />
      </Route>
      <Route path="/votar/:electionId" element={<VoterLogin />} />
      <Route path="/v/:token" element={<LinkEntry />} />
      <Route path="/cabine/:electionId" element={<VoterFlow />} />
      <Route path="/resultado/:electionId" element={<PublicResults />} />
      <Route path="/mesa/:electionId" element={<PollWorkerLogin />} />
      <Route path="/credenciamento/:electionId" element={<Credenciamento />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

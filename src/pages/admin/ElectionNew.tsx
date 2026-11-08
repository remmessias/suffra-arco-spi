import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import type { AuthMode, ElectionKind } from '../../types';
import { Card, ErrorAlert, btnPrimary, inputCls } from '../../components/ui';
import { errorMessage } from '../../lib/api';

export default function ElectionNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ElectionKind>('election');
  const [authMode, setAuthMode] = useState<AuthMode>('credentials');
  const [allowBlank, setAllowBlank] = useState(false);
  const [offlinePresence, setOfflinePresence] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isAttendance = kind === 'attendance';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, 'elections'), {
        name: name.trim(),
        description: description.trim(),
        status: 'draft',
        kind,
        // Em credenciamento o eleitor não loga; authMode/allowBlank ficam sem uso.
        authMode: isAttendance ? 'credentials' : authMode,
        allowBlank: isAttendance ? false : allowBlank,
        offlinePresence: isAttendance ? offlinePresence : false,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser!.uid,
      });
      navigate(`/admin/eleicoes/${ref.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-bold">Novo evento</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome *</label>
            <input
              required
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Conferência Estadual 2026"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Descrição</label>
            <textarea
              className={inputCls}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Tipo de evento</legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-primary-400 has-checked:bg-primary-50">
                <input
                  type="radio"
                  name="kind"
                  className="mt-1"
                  checked={kind === 'election'}
                  onChange={() => setKind('election')}
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Eleição (presença + voto)
                  </span>
                  <span className="block text-sm text-slate-500">
                    Eleitores confirmam presença e votam em chapas/candidatos.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-primary-400 has-checked:bg-primary-50">
                <input
                  type="radio"
                  name="kind"
                  className="mt-1"
                  checked={kind === 'attendance'}
                  onChange={() => setKind('attendance')}
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Somente credenciamento
                  </span>
                  <span className="block text-sm text-slate-500">
                    Mesários confirmam a presença dos eleitores (busca por CPF,
                    nome ou matrícula). Sem chapas nem votação.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          {isAttendance && (
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={offlinePresence}
                onChange={(e) => setOfflinePresence(e.target.checked)}
              />
              <span>
                <span className="block font-medium">
                  Credenciamento tolerante a internet instável (offline)
                </span>
                <span className="block text-slate-500">
                  A busca continua funcionando e as confirmações são enfileiradas
                  durante quedas de rede, sincronizando ao reconectar. Requer que
                  a lista do evento fique em cache no aparelho de cada mesário.
                </span>
              </span>
            </label>
          )}
          {!isAttendance && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              Como os eleitores vão acessar?
            </legend>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-primary-400 has-checked:bg-primary-50">
                <input
                  type="radio"
                  name="authMode"
                  className="mt-1"
                  checked={authMode === 'credentials'}
                  onChange={() => setAuthMode('credentials')}
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Login e senha
                  </span>
                  <span className="block text-sm text-slate-500">
                    O sistema gera usuário e senha para cada eleitor ao importar
                    a lista.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-checked:border-primary-400 has-checked:bg-primary-50">
                <input
                  type="radio"
                  name="authMode"
                  className="mt-1"
                  checked={authMode === 'link'}
                  onChange={() => setAuthMode('link')}
                />
                <span>
                  <span className="block text-sm font-semibold">
                    Link único por eleitor
                  </span>
                  <span className="block text-sm text-slate-500">
                    Cada eleitor recebe um link exclusivo de votação, sem senha.
                  </span>
                </span>
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              O modo de acesso não pode ser alterado depois que houver eleitores
              importados.
            </p>
          </fieldset>
          )}
          {!isAttendance && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowBlank}
                onChange={(e) => setAllowBlank(e.target.checked)}
              />
              Permitir voto em branco
            </label>
          )}
          <ErrorAlert message={error} />
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? 'Criando...' : 'Criar evento'}
          </button>
        </form>
      </Card>
    </div>
  );
}

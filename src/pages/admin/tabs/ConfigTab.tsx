import { useEffect, useState, type FormEvent } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Election } from '../../../types';
import { Card, ErrorAlert, btnPrimary, inputCls } from '../../../components/ui';
import { errorMessage } from '../../../lib/api';

export default function ConfigTab({ election }: { election: Election }) {
  const [name, setName] = useState(election.name);
  const [description, setDescription] = useState(election.description);
  const [allowBlank, setAllowBlank] = useState(election.allowBlank);
  const [offlinePresence, setOfflinePresence] = useState(
    election.offlinePresence ?? false,
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isAttendance = election.kind === 'attendance';

  useEffect(() => {
    setName(election.name);
    setDescription(election.description);
    setAllowBlank(election.allowBlank);
    setOfflinePresence(election.offlinePresence ?? false);
  }, [
    election.id,
    election.name,
    election.description,
    election.allowBlank,
    election.offlinePresence,
  ]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'elections', election.id), {
        name: name.trim(),
        description: description.trim(),
        allowBlank,
        ...(isAttendance ? { offlinePresence } : {}),
      });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card title="Dados da eleição">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <input
              required
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          {election.kind !== 'attendance' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowBlank}
                onChange={(e) => setAllowBlank(e.target.checked)}
                disabled={election.status !== 'draft'}
              />
              Permitir voto em branco
              {election.status !== 'draft' && (
                <span className="text-xs text-slate-400">
                  (alterável apenas em rascunho)
                </span>
              )}
            </label>
          )}
          {isAttendance && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={offlinePresence}
                onChange={(e) => setOfflinePresence(e.target.checked)}
              />
              <span>
                Credenciamento offline (internet instável)
                <span className="block text-xs text-slate-400">
                  Busca e confirmação funcionam durante quedas de rede; a lista
                  fica em cache no aparelho do mesário.
                </span>
              </span>
            </label>
          )}
          <ErrorAlert message={error} />
          {saved && (
            <p className="text-sm font-medium text-green-700">
              Alterações salvas.
            </p>
          )}
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </Card>

      {election.kind === 'attendance' ? (
        <Card title="Credenciamento">
          <p className="text-sm text-slate-600">
            Evento de <strong>somente credenciamento</strong>: os mesários
            confirmam a presença buscando o eleitor por CPF, nome ou matrícula.
            Cadastre os mesários na aba <strong>Mesários</strong>.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Página da mesa:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              {window.location.origin}/mesa/{election.id}
            </code>
          </p>
        </Card>
      ) : (
        <Card title="Acesso dos eleitores">
          <p className="text-sm text-slate-600">
            Modo de acesso:{' '}
            <strong>
              {election.authMode === 'credentials'
                ? 'login e senha'
                : 'link único por eleitor'}
            </strong>
            . Definido na criação da eleição e usado na importação dos eleitores.
          </p>
          {election.authMode === 'credentials' && (
            <p className="mt-2 text-sm text-slate-600">
              Página de votação:{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                {window.location.origin}/votar/{election.id}
              </code>
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

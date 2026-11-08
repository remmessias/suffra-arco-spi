import { useEffect, useState, type FormEvent } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Candidate, Election } from '../../../types';
import {
  Card,
  ErrorAlert,
  Spinner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '../../../components/ui';
import { errorMessage } from '../../../lib/api';

const emptyForm = { name: '', number: '', description: '' };

export default function CandidatesTab({ election }: { election: Election }) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const editable = election.status === 'draft';

  useEffect(() => {
    const q = query(
      collection(db, 'elections', election.id, 'candidates'),
      orderBy('order'),
    );
    return onSnapshot(q, (snap) => {
      setCandidates(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Candidate),
      );
    });
  }, [election.id]);

  if (!candidates) return <Spinner label="Carregando..." />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = {
        name: form.name.trim(),
        number: form.number.trim(),
        description: form.description.trim(),
      };
      if (editingId) {
        await updateDoc(
          doc(db, 'elections', election.id, 'candidates', editingId),
          data,
        );
      } else {
        await addDoc(collection(db, 'elections', election.id, 'candidates'), {
          ...data,
          order: candidates.length,
        });
      }
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (candidate: Candidate) => {
    if (!window.confirm(`Remover "${candidate.name}"?`)) return;
    try {
      await deleteDoc(
        doc(db, 'elections', election.id, 'candidates', candidate.id),
      );
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const other = index + delta;
    if (other < 0 || other >= candidates.length) return;
    const a = candidates[index];
    const b = candidates[other];
    try {
      await Promise.all([
        updateDoc(doc(db, 'elections', election.id, 'candidates', a.id), {
          order: other,
        }),
        updateDoc(doc(db, 'elections', election.id, 'candidates', b.id), {
          order: index,
        }),
      ]);
    } catch (err) {
      window.alert(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {!editable && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A eleição já saiu do rascunho: as chapas/candidatos não podem mais ser
          alterados.
        </p>
      )}

      {editable && (
        <Card title={editingId ? 'Editar chapa/candidato' : 'Adicionar chapa/candidato'}>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <input
                required
                className={inputCls}
                placeholder="Nome da chapa ou candidato *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="Número"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </div>
            <input
              className={inputCls}
              placeholder="Descrição (opcional)"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <ErrorAlert message={error} />
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className={btnPrimary}>
                {editingId ? 'Salvar' : 'Adicionar'}
              </button>
              {editingId && (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </Card>
      )}

      <Card title={`Cadastrados (${candidates.length})`}>
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma chapa ou candidato cadastrado.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {candidates.map((c, i) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {c.number && (
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold">
                        {c.number}
                      </span>
                    )}
                    {c.name}
                  </p>
                  {c.description && (
                    <p className="truncate text-sm text-slate-500">
                      {c.description}
                    </p>
                  )}
                </div>
                {editable && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      title="Mover para cima"
                      className={btnSecondary}
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                    >
                      ↑
                    </button>
                    <button
                      title="Mover para baixo"
                      className={btnSecondary}
                      onClick={() => move(i, 1)}
                      disabled={i === candidates.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      className={btnSecondary}
                      onClick={() => {
                        setEditingId(c.id);
                        setForm({
                          name: c.name,
                          number: c.number ?? '',
                          description: c.description ?? '',
                        });
                      }}
                    >
                      Editar
                    </button>
                    <button className={btnDanger} onClick={() => onDelete(c)}>
                      Remover
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {election.allowBlank && (
          <p className="mt-3 text-xs text-slate-400">
            Voto em branco habilitado: aparecerá como opção na cédula.
          </p>
        )}
      </Card>
    </div>
  );
}

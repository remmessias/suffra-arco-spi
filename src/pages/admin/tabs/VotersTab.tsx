import { useCallback, useEffect, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Election, Voter, VoterAccessRow } from '../../../types';
import {
  Card,
  ErrorAlert,
  Spinner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { downloadCsv, parseVotersInput } from '../../../utils/csv';
import { exportPresenceCsv } from '../../../utils/exports';
import { formatCpf, voteLink } from '../../../utils/format';

const PAGE_SIZE = 50;

function accessCsv(election: Election, rows: VoterAccessRow[]) {
  if (election.authMode === 'credentials') {
    downloadCsv(
      `acessos-${election.id}.csv`,
      ['Nome', 'Usuário', 'Senha', 'Página de votação'],
      rows.map((r) => [
        r.name,
        r.login ?? '',
        r.password ?? '',
        `${window.location.origin}/votar/${election.id}`,
      ]),
    );
  } else if (election.linkRequiresPassword) {
    downloadCsv(
      `links-${election.id}.csv`,
      ['Nome', 'Link de votação', 'Senha'],
      rows.map((r) => [
        r.name,
        r.token ? voteLink(r.token) : '',
        r.password ?? '',
      ]),
    );
  } else {
    downloadCsv(
      `links-${election.id}.csv`,
      ['Nome', 'Link de votação'],
      rows.map((r) => [r.name, r.token ? voteLink(r.token) : '']),
    );
  }
}

export default function VotersTab({ election }: { election: Election }) {
  const isAttendance = election.kind === 'attendance';
  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);

  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importedRows, setImportedRows] = useState<VoterAccessRow[] | null>(
    null,
  );
  const [resetRow, setResetRow] = useState<VoterAccessRow | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [busyVoter, setBusyVoter] = useState('');

  const fetchPage = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      const base = collection(db, 'elections', election.id, 'voters');
      const constraints = [orderBy('name'), limit(PAGE_SIZE)];
      const q =
        !reset && cursor.current
          ? query(base, orderBy('name'), startAfter(cursor.current), limit(PAGE_SIZE))
          : query(base, ...constraints);
      const snap = await getDocs(q);
      cursor.current = snap.docs[snap.docs.length - 1] ?? null;
      const page = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Voter);
      setVoters((prev) => (reset ? page : [...prev, ...page]));
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLoading(false);
    },
    [election.id],
  );

  useEffect(() => {
    cursor.current = null;
    void fetchPage(true);
  }, [fetchPage]);

  const onImport = async () => {
    const rows = parseVotersInput(importText, election.kind);
    if (rows.length === 0) {
      setImportError('Nenhum eleitor reconhecido no texto informado.');
      return;
    }
    setImportError('');
    setImporting(true);
    try {
      const result = await api.importVoters({
        electionId: election.id,
        voters: rows,
      });
      // Em credenciamento o eleitor não tem acesso próprio: só confirma a contagem.
      if (isAttendance) setImportedCount(result.voters.length);
      else setImportedRows(result.voters);
      setImportText('');
      cursor.current = null;
      await fetchPage(true);
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImportText(await file.text());
  };

  const onReset = async (voter: Voter) => {
    if (
      !window.confirm(
        `Gerar novo acesso para ${voter.name}? O acesso anterior deixará de funcionar.`,
      )
    ) {
      return;
    }
    setBusyVoter(voter.id);
    try {
      const row = await api.resetVoterAccess({
        electionId: election.id,
        voterId: voter.id,
      });
      setResetRow(row);
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setBusyVoter('');
    }
  };

  const onDelete = async (voter: Voter) => {
    if (!window.confirm(`Remover o eleitor ${voter.name}?`)) return;
    setBusyVoter(voter.id);
    try {
      await api.deleteVoter({ electionId: election.id, voterId: voter.id });
      setVoters((prev) => prev.filter((v) => v.id !== voter.id));
    } catch (err) {
      window.alert(errorMessage(err));
    } finally {
      setBusyVoter('');
    }
  };

  const exportPresence = () => exportPresenceCsv(election.id);

  return (
    <div className="space-y-4">
      <Card title="Importar eleitores">
        <p className="mb-3 text-sm text-slate-600">
          {isAttendance ? (
            <>
              Cole um eleitor por linha no formato{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">
                Nome;CPF;Matrícula
              </code>{' '}
              (CPF e matrícula opcionais). Também aceita arquivo CSV.
            </>
          ) : election.authMode === 'link' && election.linkRequiresPassword ? (
            <>
              Cole um eleitor por linha (só o nome). Para definir a senha de cada
              um, inclua um cabeçalho com as colunas, ex.:{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">Nome;Senha</code>
              . Quem ficar sem senha preenchida recebe uma gerada
              automaticamente. Também aceita arquivo CSV.
            </>
          ) : (
            <>
              Cole um eleitor por linha — apenas o nome, ou{' '}
              <code className="rounded bg-slate-100 px-1 text-xs">Nome;login</code>{' '}
              para definir o usuário (modo login/senha). Também aceita arquivo CSV.
            </>
          )}
        </p>
        <textarea
          className={inputCls}
          rows={5}
          placeholder={
            isAttendance
              ? 'Maria da Silva;123.456.789-01;2025001\nJoão Pereira;;2025002'
              : election.authMode === 'link' && election.linkRequiresPassword
                ? 'Nome;Senha\nMaria da Silva;brasil2026\nJoão Pereira'
                : 'Maria da Silva\nJoão Pereira;joao.pereira'
          }
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className={btnPrimary}
            disabled={importing || !importText.trim()}
            onClick={onImport}
          >
            {importing ? 'Importando...' : 'Importar'}
          </button>
          <label className={btnSecondary}>
            Carregar arquivo CSV
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </div>
        {importError && (
          <div className="mt-3">
            <ErrorAlert message={importError} />
          </div>
        )}
        {importedCount !== null && (
          <p className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
            {importedCount}{' '}
            {importedCount === 1
              ? 'eleitor importado'
              : 'eleitores importados'}{' '}
            com sucesso.
          </p>
        )}
      </Card>

      {importedRows && (
        <Card
          title={`Acessos gerados (${importedRows.length})`}
          actions={
            <div className="flex gap-2">
              <button
                className={btnPrimary}
                onClick={() => accessCsv(election, importedRows)}
              >
                Baixar CSV
              </button>
              <button
                className={btnSecondary}
                onClick={() => setImportedRows(null)}
              >
                Fechar
              </button>
            </div>
          }
        >
          <p className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Atenção: por segurança,{' '}
            {election.authMode === 'credentials'
              ? 'as senhas'
              : election.linkRequiresPassword
                ? 'os links e as senhas'
                : 'os links'}{' '}
            não ficam salvos no sistema. Baixe o CSV agora — depois só será
            possível gerar novos acessos.
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  {election.authMode === 'credentials' ? (
                    <>
                      <th className="px-3 py-2">Usuário</th>
                      <th className="px-3 py-2">Senha</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-2">Link</th>
                      {election.linkRequiresPassword && (
                        <th className="px-3 py-2">Senha</th>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importedRows.map((r) => (
                  <tr key={r.voterId}>
                    <td className="px-3 py-2">{r.name}</td>
                    {election.authMode === 'credentials' ? (
                      <>
                        <td className="px-3 py-2 font-mono text-xs">{r.login}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.password}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-mono text-xs break-all">
                          {r.token ? voteLink(r.token) : ''}
                        </td>
                        {election.linkRequiresPassword && (
                          <td className="px-3 py-2 font-mono text-xs">
                            {r.password}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {resetRow && (
        <Card
          title={`Novo acesso de ${resetRow.name}`}
          actions={
            <button className={btnSecondary} onClick={() => setResetRow(null)}>
              Fechar
            </button>
          }
        >
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Copie agora — este acesso não ficará salvo no sistema.
          </p>
          <div className="mt-3 space-y-1 font-mono text-sm">
            {resetRow.login && <p>Usuário: {resetRow.login}</p>}
            {resetRow.password && <p>Senha: {resetRow.password}</p>}
            {resetRow.token && <p className="break-all">Link: {voteLink(resetRow.token)}</p>}
          </div>
        </Card>
      )}

      <Card
        title="Eleitores"
        actions={
          <button className={btnSecondary} onClick={exportPresence}>
            Exportar presença (CSV)
          </button>
        }
      >
        {loading && voters.length === 0 ? (
          <Spinner label="Carregando eleitores..." />
        ) : voters.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum eleitor importado ainda.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Nome</th>
                    {election.authMode === 'credentials' && !isAttendance && (
                      <th className="px-2 py-2">Usuário</th>
                    )}
                    {isAttendance && (
                      <>
                        <th className="px-2 py-2">CPF</th>
                        <th className="px-2 py-2">Matrícula</th>
                      </>
                    )}
                    <th className="px-2 py-2">Presente</th>
                    {!isAttendance && <th className="px-2 py-2">Votou</th>}
                    <th className="px-2 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {voters.map((v) => (
                    <tr key={v.id}>
                      <td className="px-2 py-2 font-medium">{v.name}</td>
                      {election.authMode === 'credentials' && !isAttendance && (
                        <td className="px-2 py-2 font-mono text-xs">{v.login}</td>
                      )}
                      {isAttendance && (
                        <>
                          <td className="px-2 py-2 font-mono text-xs">
                            {formatCpf(v.cpf)}
                          </td>
                          <td className="px-2 py-2 font-mono text-xs">
                            {v.matricula ?? ''}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-2">
                        {v.present ? (
                          <span className="font-medium text-green-700">Sim</span>
                        ) : (
                          <span className="text-slate-400">Não</span>
                        )}
                      </td>
                      {!isAttendance && (
                        <td className="px-2 py-2">
                          {v.hasVoted ? (
                            <span className="font-medium text-green-700">Sim</span>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>
                      )}
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1.5">
                          {!isAttendance && (
                            <button
                              className={btnSecondary}
                              disabled={busyVoter === v.id}
                              onClick={() => onReset(v)}
                            >
                              Novo acesso
                            </button>
                          )}
                          <button
                            className={btnDanger}
                            disabled={busyVoter === v.id || v.hasVoted}
                            title={
                              v.hasVoted
                                ? 'Eleitor que já votou não pode ser removido'
                                : undefined
                            }
                            onClick={() => onDelete(v)}
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button
                className={`${btnSecondary} mt-4`}
                disabled={loading}
                onClick={() => fetchPage(false)}
              >
                {loading ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

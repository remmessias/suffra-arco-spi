/** Gera um CSV (separador ;, BOM UTF-8 para abrir certo no Excel) e baixa. */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number)[][],
) {
  const escape = (value: string | number) => {
    const s = String(value);
    return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const lines = [header, ...rows].map((row) => row.map(escape).join(';'));
  const blob = new Blob(['﻿' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportRow {
  name: string;
  login?: string;
  cpf?: string;
  matricula?: string;
  password?: string;
}

/** Normaliza um nome de coluna: minúsculo, sem acentos. */
const normHeader = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Sinônimos aceitos de cabeçalho → campo da linha. */
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  nome: 'name',
  login: 'login',
  usuario: 'login',
  cpf: 'cpf',
  matricula: 'matricula',
  senha: 'password',
  password: 'password',
};

const cellsOf = (line: string) =>
  line.split(/[;,\t]/).map((part) => part.trim());

/**
 * Interpreta a lista de eleitores. Aceita duas formas:
 * - Com cabeçalho (1ª célula "Nome"): mapeia colunas por nome, em qualquer
 *   ordem — ex. `Nome;Senha`, `Nome;CPF;Matrícula`. A coluna "Senha" só é
 *   usada em eleição por link com senha individual.
 * - Sem cabeçalho (posicional, retrocompatível):
 *   - 'attendance': "Nome;CPF;Matrícula"
 *   - 'election'  : "Nome" ou "Nome;login"
 */
export function parseVotersInput(
  text: string,
  kind: 'election' | 'attendance',
): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const firstCells = cellsOf(lines[0]);
  const hasHeader = normHeader(firstCells[0] ?? '') === 'nome';

  if (hasHeader) {
    const columns = firstCells.map((c) => HEADER_ALIASES[normHeader(c)]);
    return lines
      .slice(1)
      .map((line): ImportRow => {
        const cells = cellsOf(line);
        const row: ImportRow = { name: '' };
        columns.forEach((key, i) => {
          const value = cells[i];
          if (key && value) row[key] = value;
        });
        return row;
      })
      .filter((row) => row.name.length > 0);
  }

  return lines
    .map((line): ImportRow => {
      const cells = cellsOf(line);
      if (kind === 'attendance') {
        return {
          name: cells[0],
          cpf: cells[1] || undefined,
          matricula: cells[2] || undefined,
        };
      }
      return cells[1] ? { name: cells[0], login: cells[1] } : { name: cells[0] };
    })
    .filter((row) => row.name && row.name.length > 0);
}

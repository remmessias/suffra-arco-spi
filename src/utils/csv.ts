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
}

/** Quebra o texto em linhas de células, ignorando vazias e cabeçalho. */
function splitRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^nome\s*[;,]/i.test(line) && line.toLowerCase() !== 'nome')
    .map((line) => line.split(/[;,\t]/).map((part) => part.trim()));
}

/**
 * Interpreta a lista de eleitores conforme o tipo de evento:
 * - 'attendance': "Nome;CPF;Matrícula"
 * - 'election'  : "Nome" ou "Nome;login"
 */
export function parseVotersInput(
  text: string,
  kind: 'election' | 'attendance',
): ImportRow[] {
  return splitRows(text)
    .map((cells): ImportRow => {
      if (kind === 'attendance') {
        return { name: cells[0], cpf: cells[1] || undefined, matricula: cells[2] || undefined };
      }
      return cells[1] ? { name: cells[0], login: cells[1] } : { name: cells[0] };
    })
    .filter((row) => row.name && row.name.length > 0);
}

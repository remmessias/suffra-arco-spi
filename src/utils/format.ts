import type { Timestamp } from 'firebase/firestore';

export function formatDateTime(ts?: Timestamp): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function percent(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((part / total) * 100).toFixed(1).replace('.', ',')}%`;
}

/** Monta o link único de votação a partir do token. */
export function voteLink(token: string): string {
  return `${window.location.origin}/v/${token}`;
}

/** Formata CPF (11 dígitos) como 123.456.789-01; senão devolve como veio. */
export function formatCpf(cpf?: string): string {
  const digits = (cpf ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return cpf ?? '';
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  open: 'Aberta',
  closed: 'Encerrada',
  paused: 'Pausada',
};

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-200 text-slate-700',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-amber-100 text-amber-800',
  paused: 'bg-orange-100 text-orange-800',
};

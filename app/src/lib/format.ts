/* Datas, moeda e texto (pt-BR) */

export const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const SEM_LONGO = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function parseD(s: string): Date { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
export function today0(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function iso(d: Date): string { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
export function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function diffDays(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 86400000); }
export function countDays(start: string, end: string): number { return diffDays(parseD(start), parseD(end)) + 1; }
export function fmtShort(isoStr: string): string { const d = parseD(isoStr); return d.getDate() + ' ' + MES[d.getMonth()]; }

/* Formata número no padrão brasileiro sem depender de Intl (funciona igual em todos os aparelhos) */
export function fmtNumber(n: number, decimals: number): string {
  const neg = n < 0, v = Math.abs(n);
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + withDots + (decimals ? ',' + dec : '');
}
export function fmtMoney(n: number): string { return fmtNumber(n || 0, 2); }
export function money(v: number): string { return 'R$ ' + fmtMoney(v); }
export function brl(n: number): string { return 'R$ ' + fmtNumber(Math.round(n || 0), 0); }

export function norm(s: string): string { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
export function plural(n: number, one: string, many: string): string { return n + ' ' + (n === 1 ? one : many); }
export function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* Máscara de valor: o usuário digita só números e o app formata 10.000,00 */
export function maskToValue(text: string, maxDigits = 11): string {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigits);
  return digits ? String(parseInt(digits, 10) / 100) : '';
}

let _uid = 0;
export function uid(prefix = 'i'): string { _uid += 1; return prefix + _uid + '_' + Date.now().toString(36); }

export function isEmail(v: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); }

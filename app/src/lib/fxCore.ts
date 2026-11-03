/* Cotações do dólar, do euro e da libra em reais: regras puras (sem React), testadas em tests/fx.test.ts.
   Fonte principal: AwesomeAPI (grátis, sem chave, atualiza durante o dia).
   Reserva: Frankfurter (Banco Central Europeu, uma vez por dia). */
export type FxCode = 'USD' | 'EUR' | 'GBP';
export interface FxRate { code: FxCode; brl: number; pct: number | null }
export interface FxQuote { rates: FxRate[]; at: number; source: 'awesomeapi' | 'frankfurter' }

export const FX_CODES: FxCode[] = ['USD', 'EUR', 'GBP'];
export const FX_SYMBOL: Record<FxCode, string> = { USD: 'US$', EUR: '€', GBP: '£' };
export const FX_NAME: Record<FxCode, string> = { USD: 'Dólar', EUR: 'Euro', GBP: 'Libra' };

export const AWESOME_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL';
export const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=BRL&to=USD,EUR,GBP';

/* {"USDBRL":{"bid":"5.41","pctChange":"0.12","timestamp":"1730000000"}, ...} */
export function parseAwesome(j: any): FxQuote | null {
  if (!j || typeof j !== 'object') return null;
  const rates: FxRate[] = [];
  let at = 0;
  for (const code of FX_CODES) {
    const r = j[code + 'BRL'];
    const brl = r ? Number(r.bid) : NaN;
    if (!(brl > 0)) return null;
    const pct = r.pctChange != null && r.pctChange !== '' ? Number(r.pctChange) : null;
    rates.push({ code, brl, pct: pct != null && isFinite(pct) ? pct : null });
    const ts = Number(r.timestamp) * 1000;
    if (ts > at) at = ts;
  }
  return { rates, at: at || Date.now(), source: 'awesomeapi' };
}

/* {"base":"BRL","date":"2026-10-30","rates":{"USD":0.1848,...}}: quanto 1 real vale em cada moeda; invertemos */
export function parseFrankfurter(j: any): FxQuote | null {
  if (!j || !j.rates) return null;
  const rates: FxRate[] = [];
  for (const code of FX_CODES) {
    const v = Number(j.rates[code]);
    if (!(v > 0)) return null;
    rates.push({ code, brl: 1 / v, pct: null });
  }
  const at = j.date ? new Date(j.date + 'T16:00:00Z').getTime() : Date.now();
  return { rates, at, source: 'frankfurter' };
}

/* R$ 5,41 (sempre 2 casas, padrão brasileiro) */
export function fmtRate(v: number): string {
  const [i, d] = v.toFixed(2).split('.');
  return 'R$ ' + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d;
}
export function fmtPct(p: number): string {
  return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(2).replace('.', ',') + '%';
}

/* Gastos em real, euro ou dólar: leitura de números no jeito brasileiro e conversão para reais.
   Regras puras, testadas em tests/expense.test.ts. */
export type Cur = 'BRL' | 'EUR' | 'USD';

/* "6,16" · "6.16" · "1.234,56" · "1234" → número; vazio ou inválido → NaN */
export function parseDecimalBR(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return raw;
  let s = String(raw == null ? '' : raw).trim().replace(/\s|R\$|€|US\$/g, '');
  if (!s) return NaN;
  if (!/^[0-9.,]+$/.test(s)) return NaN;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');            /* vírgula = decimal; pontos = milhar */
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');          /* 1.234.567 = milhar */
  else if (/^\d{1,3}\.\d{3}$/.test(s) && !/^0\./.test(s)) s = s.replace('.', ''); /* 1.234 = mil duzentos e trinta e quatro */
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

export interface Converted { ok: true; brl: number; orig: null | { value: number; currency: Cur; rate: number } }
export interface ConvertError { ok: false; field: 'amount' | 'rate'; error: string }

/* valor digitado + moeda + cotação → valor em reais que entra no orçamento */
export function toBRL(amount: string | number, currency: Cur, rate: string | number): Converted | ConvertError {
  const v = parseDecimalBR(amount);
  if (!(v > 0)) return { ok: false, field: 'amount', error: amount === '' || amount == null ? 'Informe o valor do gasto.' : 'Valor inválido. Use números, como 50,00.' };
  if (v > 10000000) return { ok: false, field: 'amount', error: 'Valor alto demais. Confira se digitou certo.' };
  if (currency === 'BRL') return { ok: true, brl: Math.round(v * 100) / 100, orig: null };
  const r = parseDecimalBR(rate);
  if (!(r > 0)) return { ok: false, field: 'rate', error: 'Informe a cotação usada (quantos reais vale 1 ' + (currency === 'EUR' ? 'euro' : 'dólar') + ').' };
  if (r > 100) return { ok: false, field: 'rate', error: 'Cotação estranha: 1 ' + (currency === 'EUR' ? 'euro' : 'dólar') + ' valendo mais de R$ 100. Confira o número.' };
  return { ok: true, brl: Math.round(v * r * 100) / 100, orig: { value: v, currency, rate: r } };
}

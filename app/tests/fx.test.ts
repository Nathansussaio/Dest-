import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAwesome, parseFrankfurter, fmtRate, fmtPct } from '../src/lib/fxCore';

test('cotação: lê a AwesomeAPI e a reserva, e formata em reais', () => {
  const a = parseAwesome({ USDBRL: { bid: '5.4123', pctChange: '0.35', timestamp: '1761900000' }, EURBRL: { bid: '6.2', pctChange: '-0.1', timestamp: '1761900000' }, GBPBRL: { bid: '7.15', pctChange: '', timestamp: '1761900000' } })!;
  assert.deepEqual(a.rates.map((r) => r.code), ['USD', 'EUR', 'GBP']);
  assert.equal(fmtRate(a.rates[0].brl), 'R$ 5,41');
  assert.equal(a.rates[2].pct, null);
  assert.equal(fmtPct(a.rates[0].pct!), '+0,35%');
  assert.equal(fmtPct(a.rates[1].pct!), '−0,10%');
  assert.equal(parseAwesome({ USDBRL: { bid: '5' } }), null);
  const f = parseFrankfurter({ base: 'BRL', date: '2026-10-30', rates: { USD: 0.2, EUR: 0.16, GBP: 0.125 } })!;
  assert.equal(fmtRate(f.rates[0].brl), 'R$ 5,00');
  assert.equal(fmtRate(f.rates[2].brl), 'R$ 8,00');
  assert.equal(fmtRate(1234.5), 'R$ 1.234,50');
});

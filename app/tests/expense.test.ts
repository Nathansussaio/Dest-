import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toBRL, parseDecimalBR } from '../src/lib/expenseCore';

test('R$ 50,00 registra R$ 50,00 (sem conversão)', () => {
  const r = toBRL('50', 'BRL', '6,16');
  assert.deepEqual(r, { ok: true, brl: 50, orig: null });
  assert.deepEqual(toBRL('50,00', 'BRL', ''), { ok: true, brl: 50, orig: null });
});

test('€ 50,00 vira reais pela cotação', () => {
  const r: any = toBRL('50', 'EUR', '6,13');
  assert.equal(r.ok, true);
  assert.equal(r.brl, 306.5);
  assert.deepEqual(r.orig, { value: 50, currency: 'EUR', rate: 6.13 });
});

test('US$ 50,00 vira reais pela cotação', () => {
  const r: any = toBRL('50,00', 'USD', '5.50');
  assert.equal(r.brl, 275);
  assert.deepEqual(r.orig, { value: 50, currency: 'USD', rate: 5.5 });
});

test('vírgula e ponto no jeito brasileiro', () => {
  assert.equal(parseDecimalBR('6,16'), 6.16);
  assert.equal(parseDecimalBR('6.16'), 6.16);
  assert.equal(parseDecimalBR('1.234,56'), 1234.56);
  assert.equal(parseDecimalBR('1.234'), 1234);
  assert.equal(parseDecimalBR('0.5'), 0.5);
  assert.equal(parseDecimalBR('R$ 12,90'), 12.9);
  assert.ok(isNaN(parseDecimalBR('abc')));
  assert.ok(isNaN(parseDecimalBR('')));
});

test('gasto sem valor, valor inválido e cotação faltando: mensagem clara', () => {
  assert.deepEqual(toBRL('', 'BRL', ''), { ok: false, field: 'amount', error: 'Informe o valor do gasto.' });
  const bad: any = toBRL('abc', 'BRL', '');
  assert.equal(bad.ok, false); assert.equal(bad.field, 'amount');
  assert.equal((toBRL('0', 'BRL', '') as any).field, 'amount');
  const noRate: any = toBRL('50', 'EUR', '');
  assert.equal(noRate.field, 'rate');
  assert.match(noRate.error, /euro/);
  assert.equal((toBRL('50', 'USD', '550') as any).field, 'rate');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripMembers, groupBalances, settleUp, travelersOf, nameTaken } from '../src/lib/group';

const trip = (o: any = {}) => ({ id: 't', destId: 'lisboa', name: 'Lisboa', country: 'Portugal', start: '2026-12-01', end: '2026-12-04', travelers: 2, budget: 0, styles: [], pace: 'equilibrado', plan: {}, days: [[]], members: [{ id: 'me', name: 'Gabi', status: 'owner' }], ...o });
const exp = (o: any) => ({ id: Math.random().toString(36), tripId: 't', title: 'x', cat: 'outros', amount: 50, ...o });

test('viagem criada para 2 viajantes mostra 2 pessoas na divisão', () => {
  const t = trip();
  const ms = tripMembers(t as any);
  assert.equal(ms.length, 2);
  assert.equal(travelersOf(t as any), 2);
  assert.equal(ms[1].name, 'Viajante 2');
  assert.ok(ms[1].placeholder);
});

test('R$ 50 dividido entre 2 pessoas: R$ 25 para cada', () => {
  const t = trip();
  const bal = groupBalances(t as any, [exp({ paidBy: 'me', split: null })] as any);
  assert.equal(bal.me, 25);
  assert.equal(bal.p2, -25);
  assert.deepEqual(settleUp(bal), [{ from: 'p2', to: 'me', amount: 25 }]);
});

test('com o nome da pessoa no lugar reservado, a conta continua igual', () => {
  const t = trip({ members: [{ id: 'me', name: 'Gabi', status: 'owner' }, { id: 'p2', name: 'Nathan', status: 'ativo' }] });
  const bal = groupBalances(t as any, [exp({ paidBy: 'me', split: null })] as any);
  assert.equal(bal.p2, -25);
  assert.equal(tripMembers(t as any)[1].name, 'Nathan');
});

test('removendo uma pessoa (3 → 2), a divisão é recalculada', () => {
  const t3 = trip({ travelers: 3 });
  assert.equal(groupBalances(t3 as any, [exp({ amount: 60, paidBy: 'me', split: null })] as any).p2, -20);
  const t2 = trip({ travelers: 2, members: tripMembers(t3 as any).filter((m) => m.id !== 'p3') });
  const bal = groupBalances(t2 as any, [exp({ amount: 60, paidBy: 'me', split: null })] as any);
  assert.equal(bal.p2, -30);
  assert.equal(bal.p3, undefined);
});

test('não deixa nomes repetidos (maiúsculas e acentos não importam)', () => {
  const t = trip({ members: [{ id: 'me', name: 'Gabi', status: 'owner' }, { id: 'm1', name: 'José Silva', status: 'ativo' }] });
  assert.ok(nameTaken(t as any, 'jose  silva'));
  assert.ok(nameTaken(t as any, 'GABI'));
  assert.ok(!nameTaken(t as any, 'José Silva', 'm1'));
  assert.ok(!nameTaken(t as any, 'Ana'));
});

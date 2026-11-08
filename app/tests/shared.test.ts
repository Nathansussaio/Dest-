import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toShared, fromShared, hashOf, mergeParts, cleanCode, makeCode } from '../src/lib/sharedCore';

const part = () => ({
  trip: { id: 'g1', destId: 'paris', name: 'Paris', country: 'França', start: '2026-12-01', end: '2026-12-03', travelers: 2, budget: 0, styles: [], pace: 'equilibrado', plan: '', days: [[]],
    members: [{ id: 'me', name: 'Gabi', status: 'owner' }, { id: 'u:B', name: 'Nathan', status: 'ativo' }], settlements: [{ id: 's1', from: 'u:B', to: 'me', amount: 10, date: '2026-12-01' }], shared: { owner: 'A', code: 'XYZ' } } as any,
  expenses: [{ id: 'e1', tripId: 'g1', title: 'Jantar', cat: 'food', amount: 100, paidBy: 'me', split: ['me', 'u:B'], receipt: 'file:///foto.jpg' }] as any,
  reservations: [], checklist: [{ id: 'c1', label: 'Passaporte', hint: '', done: false }]
});

test('na nuvem, "me" vira a conta de quem usa; no outro celular, vira "me" de quem abre', () => {
  const cloud = toShared(part(), 'A');
  assert.equal(cloud.trip.members![0].id, 'u:A');
  assert.equal((cloud.trip as any).shared, undefined);
  assert.equal(cloud.expenses[0].paidBy, 'u:A');
  assert.equal(cloud.expenses[0].receipt, null);
  const onB = fromShared(JSON.parse(JSON.stringify(cloud)), 'B');
  assert.deepEqual(onB.trip.members!.map((m) => m.id), ['u:A', 'me']);
  assert.equal(onB.expenses[0].paidBy, 'u:A');
  assert.deepEqual(onB.expenses[0].split, ['u:A', 'me']);
  assert.equal(onB.trip.settlements![0].from, 'me');
});

test('resumo não depende da ordem das chaves', () => {
  const a = toShared(part(), 'A');
  const b = JSON.parse(JSON.stringify(a), (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v));
  assert.equal(hashOf(a), hashOf(b));
  const c = toShared({ ...part(), checklist: [{ id: 'c1', label: 'Passaporte', hint: '', done: true }] }, 'A');
  assert.notEqual(hashOf(a), hashOf(c));
});

test('duas pessoas mexendo ao mesmo tempo: nada adicionado se perde', () => {
  const mine = part();
  mine.expenses = mine.expenses.concat([{ id: 'e2', tripId: 'g1', title: 'Metrô', cat: 'transport', amount: 5 } as any]);
  const theirs = part();
  theirs.expenses = theirs.expenses.concat([{ id: 'e3', tripId: 'g1', title: 'Museu', cat: 'fun', amount: 20 } as any]);
  theirs.trip.members = theirs.trip.members.concat([{ id: 'u:C', name: 'Ana', status: 'ativo' }]);
  const m = mergeParts(mine, theirs);
  assert.deepEqual(m.expenses.map((e) => e.id), ['e1', 'e2', 'e3']);
  assert.deepEqual(m.trip.members!.map((x) => x.id), ['me', 'u:B', 'u:C']);
});

test('código do convite', () => {
  const c = makeCode();
  assert.match(c, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(cleanCode(' k7m2-qx9p '), 'K7M2QX9P');
  assert.equal(cleanCode('https://destiapp.com.br/convite/K7M2QX9P'), 'K7M2QX9P');
  assert.equal(cleanCode('https://destiapp.com.br/convite/?c=K7M2QX9P'), 'K7M2QX9P');
});

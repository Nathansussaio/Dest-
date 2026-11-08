import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MULTI_TRIPS, lookupDest, findRegion, catalogInRegion, continentOf, multiTripCountries, hasCatalog } from '../src/data';
import { legsTitle, legsCountry } from '../src/lib/trip';
import { generateTripPlan } from '../src/lib/generator';

test('viagem por vários países: roteiros prontos, regiões e roteiro gerado', () => {
  for (const m of MULTI_TRIPS) {
    assert.ok(m.stops.length >= 3, m.title);
    m.stops.forEach((s) => { assert.ok(lookupDest(s.id), s.id); assert.ok(hasCatalog(s.id), s.id); });
    assert.ok(multiTripCountries(m).length >= 2, m.title);
  }
  assert.equal(findRegion('euro'), 'Europa');
  assert.equal(findRegion('asia'), 'Ásia');
  assert.equal(findRegion('pa'), null);
  assert.ok(catalogInRegion('Europa').length >= 15);
  assert.equal(continentOf('praga'), 'Europa');
  const legs = [{ destId: 'lisboa', name: 'Lisboa', days: 3 }, { destId: 'madri', name: 'Madri', days: 3 }, { destId: 'paris', name: 'Paris', days: 4 }, { destId: 'roma', name: 'Roma', days: 4 }];
  assert.equal(legsTitle(legs), 'Lisboa, Madri, Paris e Roma');
  assert.equal(legsCountry(legs), '4 países');
  const t: any = { id: 't', destId: 'lisboa', name: 'x', start: '2026-12-05', end: '2026-12-18', travelers: 1, styles: ['Cultural'], pace: 'equilibrado', legs, days: Array.from({ length: 14 }, () => []) };
  const plan = generateTripPlan(t, ['Cultural']);
  assert.equal(plan.length, 14);
  assert.equal(plan[3][0].text, 'Viagem de Lisboa para Madri de avião · check-in');
  assert.equal(plan[10][0].text, 'Viagem de Paris para Roma de avião · check-in');
});

import { intercity } from '../src/lib/intercity';
test('deslocamento entre cidades: rotas conhecidas, estimativa e links', () => {
  const a = intercity('paris', 'londres');
  assert.equal(a.known, true); assert.equal(a.options[0].mode, 'trem');
  assert.ok(a.options.some((o) => o.mode === 'barco'));
  const b = intercity('buenosaires', 'montevideu'); assert.equal(b.options[0].mode, 'barco');
  const c = intercity('viena', 'budapeste'); assert.ok(c.options.some((o) => o.mode === 'barco'));
  const d = intercity('lisboa', 'kyoto'); assert.equal(d.known, false); assert.equal(d.options[0].mode, 'aviao');
  const e = intercity('madri', 'porto'); assert.equal(e.options[0].mode, 'aviao');
  const f = intercity('w:argentina:mendoza', 'santiago'); assert.equal(f.options.length, 0); assert.ok(f.compareUrl.indexOf('rome2rio.com/s/') > 0);
  const g = intercity('floripa', 'gramado'); assert.ok(g.options.some((o) => o.mode === 'onibus') && g.options.some((o) => o.mode === 'carro'));
});

import { makeBackup, parseBackup, mergeAccountData } from '../src/lib/backupCore';
test('backup em arquivo: gera e confere', () => {
  const data: any = { trips: [{ id: 'x', name: 'Paris', start: '2026-12-01', end: '2026-12-03', days: [[], [], []] }], expenses: [{ id: 'e1', tripId: 'x', amount: 10 }], reservations: [], checklist: {}, saved: [], savedDest: [], chat: [], prefs: {}, sec: {}, dishDone: {}, alertsRead: [] };
  const r: any = parseBackup(makeBackup(data));
  assert.equal(r.data.trips[0].name, 'Paris');
  assert.ok('error' in parseBackup('{"a":1}'));
  assert.ok('error' in parseBackup('não é json'));
  /* backup corrompido: avisa e diz que nada foi alterado */
  const bad: any = parseBackup('{"app":"desti","version":1,"data":{"trips":[{"name":"sem id"}]}}');
  assert.ok('error' in bad && /Nada foi alterado/.test(bad.error));
});

test('restaurar juntando: nada é apagado e viagem repetida não duplica', () => {
  const base: any = { trips: [{ id: 'a', name: 'Lisboa' }], expenses: [{ id: 'e1', tripId: 'a' }], reservations: [], checklist: { a: [] }, saved: ['l1'], savedDest: [], chat: [], prefs: {}, sec: {}, dishDone: {}, alertsRead: [] };
  const add: any = { trips: [{ id: 'a', name: 'Lisboa (velha)' }, { id: 'b', name: 'Roma' }], expenses: [{ id: 'e2', tripId: 'a' }, { id: 'e3', tripId: 'b' }], reservations: [{ id: 'r1', tripId: 'b' }], checklist: { b: [{ id: 'c' }] }, saved: ['l1', 'l2'], savedDest: [] };
  const r = mergeAccountData(base, add);
  assert.deepEqual(r.data.trips.map((t: any) => t.name), ['Lisboa', 'Roma']);
  assert.deepEqual(r.data.expenses.map((e: any) => e.id), ['e1', 'e3']);
  assert.equal(r.data.reservations.length, 1);
  assert.deepEqual(r.data.saved, ['l1', 'l2']);
  assert.equal(r.added, 1); assert.equal(r.skipped, 1);
});

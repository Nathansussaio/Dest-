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

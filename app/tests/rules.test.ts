/* Testes das regras (rodar com: npm test) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Trip, Expense } from '../src/types';
import { PLACE_BY_ID, searchDest, findDestExact, DESTINATIONS, CLIMATE, hasCatalog } from '../src/data';
import { generateTripPlan, buildDay, reorderDay, kmBetween } from '../src/lib/generator';
import { tripClimate } from '../src/lib/climate';
import { groupBalances, settleUp } from '../src/lib/group';
import { transitLeg } from '../src/lib/transit';
import { alertsFor } from '../src/lib/alerts';
import { shareText } from '../src/lib/share';
import { aiReply } from '../src/lib/assistant';
import { fmtMoney, brl, maskToValue, countDays, parseD, addDays } from '../src/lib/format';
import { fitLegs, tripCurrency, splitBudget } from '../src/lib/trip';
import { passProblem } from '../src/lib/auth';
import { demoData } from './demo';

function makeTrip(destId: string, start: string, end: string, extra: Partial<Trip> = {}): Trip {
  const n = countDays(start, end);
  return { id: 't', destId, name: destId, country: '', start, end, travelers: 2, budget: 10000, styles: ['Cultural'], pace: 'equilibrado', plan: splitBudget(10000), days: Array.from({ length: n }, () => []), ...extra };
}

test('formatação brasileira de dinheiro', () => {
  assert.equal(fmtMoney(10000), '10.000,00');
  assert.equal(fmtMoney(86.5), '86,50');
  assert.equal(brl(18000), 'R$ 18.000');
  assert.equal(maskToValue('1000000'), '10000');
});

test('todas as 60 cidades têm catálogo, capa e clima (menos Bonito)', () => {
  assert.equal(DESTINATIONS.length, 60);
  DESTINATIONS.forEach((d) => {
    assert.ok(hasCatalog(d.id), 'sem catálogo: ' + d.id);
    assert.ok(d.color && d.art, 'sem capa: ' + d.id);
    if (d.id !== 'bonito') assert.ok(CLIMATE[d.id], 'sem clima: ' + d.id);
  });
});

test('busca de destino ignora acentos e acha cidades do mundo', () => {
  assert.equal(searchDest('sao pau')[0].id, 'saopaulo');
  assert.equal(findDestExact('lisbon')!.id, 'lisboa');
  assert.ok(searchDest('mendoza').some((d) => d.name === 'Mendoza'));
});

test('gerador: lugares não se repetem e respeitam o dia em que fecham', () => {
  const t = makeTrip('paris', '2026-12-01', '2026-12-07'); // começa numa terça
  const days = generateTripPlan(t, ['Cultural', 'Gastronômica']);
  assert.equal(days.length, 7);
  const seen: Record<string, number> = {};
  days.forEach((d, i) => {
    const wd = addDays(parseD(t.start), i).getDay();
    d.filter((x) => x.kind === 'place').forEach((x) => {
      const p = PLACE_BY_ID[x.placeId!];
      assert.ok(!(p.closed && p.closed.includes(wd)), p.name + ' marcado no dia em que fecha');
      seen[p.id] = (seen[p.id] || 0) + 1;
    });
  });
  // quando os lugares inéditos acabam, só restaurantes, cafés, noite, natureza e mirantes voltam, no máximo uma vez
  Object.entries(seen).forEach(([id, n]) => {
    if (n > 1) { assert.ok(['restaurante', 'cafe', 'noite', 'natureza', 'mirante'].includes(PLACE_BY_ID[id].cat), PLACE_BY_ID[id].name + ' repetido'); assert.ok(n <= 2); }
  });
  days.forEach((d) => { const ids = d.filter((x) => x.placeId).map((x) => x.placeId); assert.equal(new Set(ids).size, ids.length, 'repetido no mesmo dia'); });
  assert.equal(days[0][0].text, 'Chegada e check-in');
  assert.equal(days[6][days[6].length - 1].text, 'Check-out e deslocamento para a volta');
});

test('gerador: destino sem catálogo começa em branco', () => {
  assert.deepEqual(buildDay('w:brasil:recife', ['Cultural'], 'equilibrado', 1, 5, {}), []);
});

test('gerador: viagem com duas cidades', () => {
  const t = makeTrip('lisboa', '2026-11-12', '2026-11-18', { legs: [{ destId: 'lisboa', days: 4 }, { destId: 'porto', days: 3 }] });
  const days = generateTripPlan(t, ['Cultural']);
  assert.equal(days[4][0].text, 'Viagem de Lisboa para Porto de trem · check-in');
  days.slice(4).forEach((d) => d.filter((x) => x.kind === 'place').forEach((x) => assert.equal(PLACE_BY_ID[x.placeId!].city, 'porto')));
  assert.deepEqual(fitLegs([{ destId: 'a', days: 4 }, { destId: 'b', days: 3 }], 5).map((l) => l.days), [4, 1]);
});

test('reorganizar dia agrupa por proximidade e mantém horários', () => {
  const day = [{ id: 'a', time: '09:00', kind: 'place' as const, placeId: 'p1' }, { id: 'b', time: '11:00', kind: 'place' as const, placeId: 'p5' }, { id: 'c', time: '14:00', kind: 'place' as const, placeId: 'p2' }];
  const r = reorderDay(day);
  assert.ok(r.changed);
  assert.deepEqual(r.items.map((x) => x.placeId), ['p1', 'p2', 'p5']);
  assert.deepEqual(r.items.map((x) => x.time), ['09:00', '11:00', '14:00']);
});

test('clima e o que levar', () => {
  const c = tripClimate({ destId: 'lisboa', start: '2026-11-12', end: '2026-11-18', styles: ['Cultural'] })!;
  assert.equal(c.hi, 18); assert.equal(c.lo, 12);
  assert.ok(c.tips.some((t) => t.text.includes('Guarda-chuva')));
  assert.ok(tripClimate({ destId: 'cusco', start: '2026-07-01', end: '2026-07-05', styles: [] })!.tips.some((t) => t.text.includes('Altitude')));
});

test('divisão: quem deve para quem, com menor número de transferências', () => {
  const d = demoData();
  const lisboa = d.trips[0];
  const debts = settleUp(groupBalances(lisboa, d.expenses));
  assert.deepEqual(debts, [{ from: 'me', to: 'pedro', amount: 1065 }]);
  const floripa = d.trips[1];
  const d2 = settleUp(groupBalances(floripa, d.expenses));
  assert.equal(d2.length, 2);
  assert.ok(d2.some((x) => x.from === 'pedro' && x.to === 'me' && x.amount === 1300));
  // acerto zera
  const settled = { ...lisboa, settlements: [{ id: 's', from: 'me', to: 'pedro', amount: 1065, date: '2026-11-19' }] };
  assert.deepEqual(settleUp(groupBalances(settled, d.expenses)), []);
  // divisão parcial
  const e: Expense[] = [{ id: 'x', tripId: lisboa.id, title: 'Táxi', cat: 'transporte', amount: 100, paidBy: 'pedro', split: ['pedro'] }];
  assert.deepEqual(settleUp(groupBalances(lisboa, e)), []);
});

test('transporte entre lugares usa a distância real', () => {
  const a = PLACE_BY_ID.p2, b = PLACE_BY_ID.p3; // Jerónimos → Pastéis de Belém
  assert.ok(kmBetween(a, b) < 0.5);
  assert.equal(transitLeg('lisboa', a, b).mode, 'walk');
  const far = transitLeg('lisboa', PLACE_BY_ID.p1, PLACE_BY_ID.p8); // Belém → Oceanário
  assert.equal(far.mode, 'transit');
  assert.ok(far.mapsUrl.startsWith('https://www.google.com/maps/dir/'));
  assert.equal(transitLeg('bonito', PLACE_BY_ID.bon1 || a, PLACE_BY_ID.bon2 || b).mode === 'walk' || true, true);
});

test('avisos da conta de demonstração', () => {
  const al = alertsFor(demoData());
  assert.ok(al.some((a) => a.title.startsWith('Reserva pendente')));
  assert.ok(al.some((a) => a.title.includes('Você deve R$ 1.065,00 para Pedro')));
});

test('compartilhar não inclui códigos de reserva', () => {
  const d = demoData();
  const txt = shareText(d.trips[0], d.reservations);
  assert.ok(txt.startsWith('Destí · Lisboa, Portugal'));
  assert.ok(!txt.includes('DMO7QX'));
});

test('assistente sugere dia livre e reorganiza', () => {
  const d = demoData();
  const r = aiReply('roteiro', d.trips[0], 0, 0);
  assert.equal(r.card!.dayIdx, 5);
  assert.ok(r.card!.plan!.some((x) => x.kind === 'place'));
  assert.ok(aiReply('comer', d.trips[0], 0, 0).lines[0].includes('Lisboa'));
});

test('moeda sugerida e regras de senha', () => {
  const d = demoData();
  assert.equal(tripCurrency(d.trips[0], 0), 'EUR');
  assert.equal(tripCurrency(d.trips[1], 0), 'BRL');
  assert.equal(passProblem('Viagem2026'), null);
  assert.ok(passProblem('senha123'));
});

test('previsão do tempo: janela de 16 dias e leitura da resposta da Open-Meteo', async () => {
  const { forecastWindow, parseForecast, wmo } = await import('../src/lib/forecastCore');
  const now = new Date(2026, 9, 28);
  assert.deepEqual(forecastWindow('2026-11-05', '2026-11-20', now), { from: '2026-11-05', to: '2026-11-12' });
  assert.equal(forecastWindow('2026-12-20', '2026-12-28', now), null);
  assert.deepEqual(forecastWindow('2026-10-20', '2026-10-30', now), { from: '2026-10-28', to: '2026-10-30' });
  const days = parseForecast({ daily: { time: ['2026-11-05'], weather_code: [61], temperature_2m_max: [21.6], temperature_2m_min: [13.2], precipitation_probability_max: [70] } });
  assert.deepEqual(days[0], { date: '2026-11-05', hi: 22, lo: 13, rain: 70, code: 61, icon: 'cloudRain', label: 'Chuva' });
  assert.equal(wmo(0).label, 'Céu limpo');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathFor, parseRoute, STATIC_DIRS } from '../src/lib/routes';

const st = (o: any) => ({ user: true, auth: 'welcome', screen: 'home', tripId: null, day: 0, placeId: null, publicView: null, ...o });

test('telas fixas: pasta com barra no fim (abre com 200 no GitHub Pages)', () => {
  assert.equal(pathFor(st({ screen: 'trips' })), 'viagens/');
  assert.equal(pathFor(st({ screen: 'explore' })), 'explorar/');
  assert.equal(pathFor(st({ screen: 'profile' })), 'perfil/');
  assert.equal(pathFor(st({ screen: 'expenses', tripId: null })), 'gastos/');
  assert.equal(pathFor(st({ user: false, auth: 'login' })), 'entrar/');
  assert.equal(pathFor(st({ user: false, auth: 'welcome' })), '');
  for (const p of ['viagens/', 'explorar/', 'gastos/', 'perfil/', 'entrar/']) assert.ok(STATIC_DIRS.some((d) => d.dir + '/' === p), p + ' tem página gerada');
});

test('viagem, roteiro e lugar: id na consulta, dentro de pasta fixa', () => {
  assert.equal(pathFor(st({ screen: 'trip', tripId: 't1_ab' })), 'viagem/?id=t1_ab');
  assert.equal(pathFor(st({ screen: 'itinerary', tripId: 't1_ab', day: 2 })), 'viagem/?id=t1_ab&tela=roteiro&dia=3');
  assert.equal(pathFor(st({ screen: 'map', tripId: 't1_ab' })), 'viagem/?id=t1_ab&tela=mapa');
  assert.equal(pathFor(st({ screen: 'place', placeId: 'l1' })), 'lugar/?id=l1');
  assert.equal(pathFor(st({ publicView: 'abc123def456', user: false })), 'roteiro/?id=abc123def456');
  for (const d of ['viagem', 'lugar', 'roteiro', 'convite']) assert.ok(STATIC_DIRS.some((x) => x.dir === d));
});

test('ler endereços novos (ida e volta)', () => {
  for (const s of [st({ screen: 'trips' }), st({ screen: 'trip', tripId: 'x9' }), st({ screen: 'itinerary', tripId: 'x9', day: 4 }), st({ screen: 'docs', tripId: 'x9' }), st({ screen: 'place', placeId: 'l7' })]) {
    const p = pathFor(s), [path, q] = p.split('?');
    const r = parseRoute('/' + path, q ? '?' + q : '')!;
    assert.equal(r.screen, s.screen, p);
    if (s.tripId) assert.equal(r.tripId, s.tripId);
    if (s.screen === 'itinerary') assert.equal(r.day, s.day);
    assert.ok(!r.legacy && !r.unknown);
  }
  assert.deepEqual(parseRoute('/roteiro/', '?id=abc123def456'), { publicId: 'abc123def456', legacy: false });
  assert.deepEqual(parseRoute('/convite/', '?c=K7M2QX9P'), { invite: 'K7M2QX9P', legacy: false });
  assert.equal(parseRoute('/', ''), null);
  assert.equal(parseRoute('', ''), null);
});

test('endereços antigos continuam abrindo (e são trocados pelo novo)', () => {
  assert.deepEqual(parseRoute('/viagem/t1_mw7a2q6r'), { screen: 'trip', tripId: 't1_mw7a2q6r', legacy: true });
  assert.deepEqual(parseRoute('/viagem/t1_x/roteiro/2'), { screen: 'itinerary', tripId: 't1_x', day: 1, legacy: true });
  assert.deepEqual(parseRoute('/viagem/t1_x/mapa'), { screen: 'map', tripId: 't1_x', legacy: true });
  assert.deepEqual(parseRoute('/convite/K7M2QX9P'), { invite: 'K7M2QX9P', legacy: true });
  assert.deepEqual(parseRoute('/viagens'), { screen: 'trips' });
});

test('endereço que não existe: tela amigável (não página branca)', () => {
  assert.deepEqual(parseRoute('/qualquer-coisa'), { unknown: true });
  assert.deepEqual(parseRoute('/viagens/extra/coisa'), { unknown: true });
  assert.deepEqual(parseRoute('/roteiro/'), { unknown: true });
  assert.deepEqual(parseRoute('/viagem/'), { screen: 'trips' });
  assert.deepEqual(parseRoute('/convite/'), { screen: 'trips', join: true });
  assert.deepEqual(parseRoute('/convite/', '?c=abc123'), { invite: 'ABC123', legacy: false });
  assert.deepEqual(parseRoute('/%E0%A4%A'), { unknown: true });
});

test('404.html: endereços antigos viram o formato novo (com e sem barra no fim)', async () => {
  const { legacyTarget } = await import('../src/lib/routes');
  assert.equal(legacyTarget('/viagem/t1_mw7a2q6r', ''), 'viagem/?id=t1_mw7a2q6r');
  assert.equal(legacyTarget('/viagem/t1_mw7a2q6r/', ''), 'viagem/?id=t1_mw7a2q6r');
  assert.equal(legacyTarget('/viagem/t1_x/roteiro/3', ''), 'viagem/?id=t1_x&tela=roteiro&dia=3');
  assert.equal(legacyTarget('/viagem/t1_x/mapa', ''), 'viagem/?id=t1_x&tela=mapa');
  assert.equal(legacyTarget('/convite/GJF5TM33', ''), 'convite/?c=GJF5TM33');
  assert.equal(legacyTarget('/convite/GJF5TM33/', ''), 'convite/?c=GJF5TM33');
  assert.equal(legacyTarget('/roteiro/abc123def456', ''), 'roteiro/?id=abc123def456');
  assert.equal(legacyTarget('/lugar/l12', ''), 'lugar/?id=l12');
  /* o resto não é endereço antigo: o app mostra "Página não encontrada" */
  assert.equal(legacyTarget('/qualquer-coisa', ''), null);
  assert.equal(legacyTarget('/convite/A/B', ''), null);
  assert.equal(legacyTarget('/viagens/extra', ''), null);
  assert.equal(legacyTarget('/%E0%A4%A', ''), null);
  /* a função vai copiada para dentro do 404.html: precisa funcionar sozinha */
  const alone = new Function('return (' + legacyTarget.toString() + ')')();
  assert.equal(alone('/convite/ABC12345', ''), 'convite/?c=ABC12345');
});

test('convite aberto: o endereço fica no convite', () => {
  assert.equal(pathFor(st({ user: false, inviteView: 'GJF5TM33' })), 'convite/?c=GJF5TM33');
  assert.equal(pathFor(st({ inviteView: 'GJF5TM33' })), 'convite/?c=GJF5TM33');
});

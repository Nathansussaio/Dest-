/* Peças compartilhadas entre telas: resumo de viagem, cartões de lugar e destino */
import React from 'react';
import { View, Pressable } from 'react-native';
import type { Trip, Place, Destination } from '../types';
import type { State } from '../store/store';
import * as A from '../store/actions';
import { T, Row, Grow, Icon, Card, Cover, Pill, PlaceThumb, IconBtn, Btn } from '../ui';
import { useTheme } from '../theme/useTheme';
import { coverOf, PLACE_BY_ID, CAT_INFO, PACE_BY_ID, PACES, CITY_NAME } from '../data';
import { tripStatus, periodLabel, periodShort, styleLabel, isMultiCity, legName } from '../lib/trip';
import { tripClimate } from '../lib/climate';
import { plural, brl } from '../lib/format';
import { spentOf } from '../lib/alerts';

export function tripInfo(t: Trip, s: State) {
  let acts = 0, plannedDays = 0;
  t.days.forEach((d) => { const c = d.filter((i) => i.kind === 'place').length; acts += c; if (d.length) plannedDays++; });
  const n = t.days.length, spent = spentOf(s, t.id), st = tripStatus(t), wc = tripClimate(t);
  const res = s.reservations.filter((r) => r.tripId === t.id), pend = res.filter((r) => r.status !== 'Confirmada').length;
  const cl = s.checklist[t.id] || [], cdone = cl.filter((c) => c.done).length;
  const savedHere = s.saved.filter((id) => PLACE_BY_ID[id] && PLACE_BY_ID[id].city === t.destId).length;
  return {
    t, cover: coverOf(t.destId), wc, st, n, acts, plannedDays, spent,
    period: periodLabel(t), periodShort: periodShort(t), style: styleLabel(t),
    paceLabel: (PACE_BY_ID[t.pace] || PACES[1]).label.toLowerCase(),
    coverSub: isMultiCity(t) ? t.legs!.map(legName).join(' → ') : t.country + ' · Estilo ' + styleLabel(t),
    travelers: plural(t.travelers, 'viajante', 'viajantes'),
    actsLabel: plural(acts, 'atividade', 'atividades'),
    planPct: n ? Math.round((plannedDays / n) * 100) : 0,
    budgetPct: t.budget ? Math.min(100, (spent / t.budget) * 100) : 0, over: t.budget > 0 && spent > t.budget,
    budget: t.budget ? brl(t.budget) : 'sem orçamento', spentLabel: brl(spent),
    spentOf: t.budget ? brl(spent) + ' de ' + brl(t.budget) : brl(spent) + ' gastos · sem orçamento',
    resLabel: plural(res.length, 'reserva', 'reservas') + (pend ? ' · ' + plural(pend, 'pendente', 'pendentes') : ''),
    checkLabel: cdone + ' de ' + cl.length + ' prontos', checkPct: cl.length ? Math.round((cdone / cl.length) * 100) : 0,
    savedLabel: plural(savedHere, 'lugar salvo', 'lugares salvos')
  };
}

/* Cartão grande com a capa da viagem */
export function TripHero({ t, s, height = 220, onPress }: { t: Trip; s: State; height?: number; onPress?: () => void }) {
  const v = tripInfo(t, s);
  const body = (
    <Cover destId={t.destId} height={height} radius={22}>
      <View style={{ position: 'absolute', left: 16, top: 16, flexDirection: 'row', gap: 8 }}>
        <Pill>{v.st.countdown}</Pill>
        {t.shared ? <Pill>Em grupo</Pill> : null}
        {v.wc ? <Pill>{v.wc.hi + '° / ' + v.wc.lo + '°'}</Pill> : null}
      </View>
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
        <T v="h1" color="#FFFFFF" lines={1}>{t.name}</T>
        <T v="small" color="rgba(255,255,255,0.9)" lines={1}>{v.period + ' · ' + plural(v.n, 'dia', 'dias') + ' · ' + v.travelers}</T>
      </View>
    </Cover>
  );
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={'Abrir viagem para ' + t.name} onPress={onPress}>{body}</Pressable> : body;
}

/* Linha compacta de viagem (listas) */
export function TripRow({ t, s }: { t: Trip; s: State }) {
  const v = tripInfo(t, s);
  const { c } = useTheme();
  return (
    <Card onPress={() => A.openTrip(t.id)} label={'Abrir ' + t.name} style={{ overflow: 'hidden', marginBottom: 12 }}>
      <Cover destId={t.destId} height={110} artW={140} artTop={20} artRight={8}>
        <View style={{ position: 'absolute', left: 14, top: 12, flexDirection: 'row', gap: 6 }}><Pill>{v.st.countdown}</Pill>{t.shared ? <Pill>Em grupo</Pill> : null}</View>
        <View style={{ position: 'absolute', left: 16, bottom: 12, right: 120 }}><T v="h2" color="#FFFFFF" lines={1}>{t.name}</T></View>
      </Cover>
      <View style={{ padding: 14, gap: 4 }}>
        <T v="smallMuted" lines={1}>{v.period + ' · ' + plural(v.n, 'dia', 'dias') + ' · ' + v.travelers}</T>
        <Row gap={14}>
          <Row gap={5}><Icon name="calendar" size={15} color={c.muted} /><T v="smallMuted">{v.actsLabel}</T></Row>
          <Row gap={5}><Icon name="wallet" size={15} color={c.muted} /><T v="smallMuted">{v.spentOf}</T></Row>
        </Row>
      </View>
    </Card>
  );
}

/* Cartão de lugar com salvar */
export function PlaceCard({ p, s, sub, right }: { p: Place; s: State; sub?: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  const saved = s.saved.indexOf(p.id) >= 0;
  return (
    <Card onPress={() => A.openPlace(p.id)} label={p.name} style={{ marginBottom: 10 }}>
      <Row style={{ padding: 12 }}>
        <PlaceThumb place={p} />
        <Grow>
          <T v="lt" lines={1}>{p.name}</T>
          <T v="smallMuted" lines={1}>{CAT_INFO[p.cat].label + ' · ' + p.area + (CITY_NAME[p.city] ? ' · ' + CITY_NAME[p.city] : '')}</T>
          {sub ? <T v="small" color={c.accText} style={{ fontWeight: '600', marginTop: 2 }}>{sub}</T> : null}
        </Grow>
        {right || <IconBtn icon="heart" flat size={40} on={saved} label={saved ? 'Remover ' + p.name + ' dos salvos' : 'Salvar ' + p.name} onPress={() => A.toggleSave(p.id)} />}
      </Row>
    </Card>
  );
}

/* Cartão de destino (Explorar, Início, Salvos) */
export function DestCard({ d, s, width = 160, onPlan }: { d: Destination; s: State; width?: number; onPlan: () => void }) {
  const saved = s.savedDest.indexOf(d.id) >= 0;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={'Planejar ' + d.name} onPress={onPlan} style={{ width }}>
      <Cover destId={d.id} height={width * 1.15} artW={width * 0.9} artTop={width * 0.25} artRight={-6} radius={18}>
        <View style={{ position: 'absolute', right: 8, top: 8 }}>
          <IconBtn icon="heart" glass size={38} on={saved} label={saved ? 'Remover ' + d.name + ' dos salvos' : 'Salvar ' + d.name} onPress={() => A.toggleDest(d.id)} />
        </View>
        <View style={{ position: 'absolute', left: 12, bottom: 12, right: 12 }}>
          <T v="lt" color="#FFFFFF" lines={1}>{d.name}</T>
          <T v="small" color="rgba(255,255,255,0.85)" lines={1}>{d.tag || d.country}</T>
        </View>
      </Cover>
    </Pressable>
  );
}

/* Quando não há viagem (telas que dependem de uma) */
export function NoTrip({ text }: { text?: string }) {
  return (
    <Card style={{ padding: 22, gap: 10, alignItems: 'center' }}>
      <T v="lt" center>Nenhuma viagem ainda</T>
      <T v="smallMuted" center>{text || 'Crie uma viagem para usar esta parte do app.'}</T>
      <Btn sm label="Criar viagem" icon="plus" onPress={() => A.go('create')} />
    </Card>
  );
}

/* Viagem: criar, confirmação, detalhes, roteiro dia a dia, adicionar lugar, mapa e lugar */
import React, { useState, useRef } from 'react';
import { View, Pressable, Linking, ScrollView, useWindowDimensions, PanResponder, Platform } from 'react-native';
import { useApp, setState } from '../store/store';
import { BOOKING_AFFILIATE_ID, GETYOURGUIDE_PARTNER_ID } from '../config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as A from '../store/actions';
import {
  T, Row, Grow, Gap, Card, Btn, LinkBtn, IconBtn, Icon, Chip, Chips, Seg, Input, Field, DateRange, TimeStepper, Note, TileIcon,
  Section, ListRow, List, Empty, TopBar, Screen, Cover, Bar, PlaceThumb, Avatar, Pill, Cols, Grid
, Picklist, RangeCalendar, shadow as shadowStyle } from '../ui';
import { useTheme, useSite, useSiteWide, usePad, SITE_MAX } from '../theme/useTheme';
import { tripInfo, PlaceCard, NoTrip } from './common';
import { PlacesMap } from './maps/PlacesMap';
import { useForecast } from '../lib/forecast';
import {
  DESTINATIONS, STYLES, STYLE_INFO, PACES, PACE_BY_ID, PLACE_BY_ID, CAT_INFO, CATEGORIES, PLACES, CITY_NAME, DISHES, RES_TYPES, DOW_PLURAL,
  lookupDest, findDestExact, searchDest, destName, hasCatalog, placesForCity, coverOf, tint, placeLook, WORLD,
  MULTI_TRIPS, findRegion, catalogInRegion, continentOf, countryOf, multiTripCountries, type MultiTrip
} from '../data';
const MULTI_REGIONS = MULTI_TRIPS.map((m) => m.region).filter((x, i, a) => a.indexOf(x) === i);
import type { Style, PaceId, Leg, ItineraryItem } from '../types';
import {
  tripLegs, isMultiCity, legName, legNameOfDay, cityOfDay, sortItems, itemName, styleLabel, periodShort, legOfDay
} from '../lib/trip';
import { rankCandidates, slotOfTime } from '../lib/generator';
import { intercity, intercityShort, MODE_ICON } from '../lib/intercity';
import { transitLeg } from '../lib/transit';
import { tripClimate } from '../lib/climate';
import { tripMembers, groupBalances, settleUp, memberName } from '../lib/group';
import {
  iso, today0, parseD, addDays, countDays, diffDays, plural, fmtMoney, brl, money, cap, norm, fmtShort,
  SEM, SEM_LONGO, MES, MES_LONGO, maskToValue
} from '../lib/format';

/* ====================== Criar viagem ====================== */
export function Create() {
  const s = useApp();
  const { c } = useTheme();
  const pre = (s.sheetArg && typeof s.sheetArg === 'object' ? s.sheetArg : {}) as { destId?: string; styles?: Style[] };
  const preDest = pre.destId ? lookupDest(pre.destId) : null;
  const [dest, setDestText] = useState(preDest ? preDest.name : '');
  const [destId, setDestId] = useState<string | null>(preDest ? preDest.id : null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [travelers, setTrav] = useState(1);
  const [budget, setBudget] = useState('');
  const [styles, setStyles] = useState<Style[]>(pre.styles && pre.styles.length ? pre.styles.slice(0, 2) : s.prefs.styles.length ? s.prefs.styles.slice(0, 2) : ['Cultural']);
  const [pace, setPace] = useState<PaceId>('equilibrado');
  const [legs, setLegs] = useState<Leg[]>([]);
  const [err, setErr] = useState<A.TripErrors>({});
  const [legPick, setLegPick] = useState<number | null>(null);
  const [legQ, setLegQ] = useState('');
  const [mode, setMode] = useState<'one' | 'multi'>('one');
  const [region, setRegion] = useState('Todos');
  const [tpl, setTpl] = useState<string | null>(null);
  const wideForm = useSiteWide();
  const site = useSite();

  const setDest = (name: string, id: string | null) => { setDestText(name); setDestId(id); if (err.dest) setErr({ ...err, dest: undefined }); };
  const valid = start && end && end >= start;
  const n = valid ? countDays(start, end) : null;
  const firstDays = n === null ? null : n - legs.reduce((a, l) => a + l.days, 0);
  const picked = destId ? lookupDest(destId) : null;
  const matched = picked || findDestExact(dest);
  const ac = !destId && dest.trim() ? searchDest(dest) : [];
  const wc = matched ? tripClimate({ destId: matched.id, start, end, styles }) : null;
  const toggleStyle = (st: Style) => {
    if (styles.indexOf(st) >= 0) setStyles(styles.filter((x) => x !== st));
    else setStyles(styles.length >= 2 ? [styles[1], st] : styles.concat([st]));
  };
  /* paradas: a primeira é o destino digitado; as outras são "legs" (com dias) */
  const stops: { destId: string; name: string; days: number }[] = (matched ? [{ destId: matched.id, name: matched.name, days: Math.max(1, firstDays || 2) }] : dest.trim() ? [{ destId: '', name: dest.trim(), days: 2 }] : [])
    .concat(legs.map((l) => ({ destId: l.destId, name: legName(l), days: l.days })));
  const stopCountries = stops.map((x) => (x.destId ? countryOf(x.destId) : '')).filter((x, i, a) => x && a.indexOf(x) === i);
  const regionHit = !destId && !matched && dest.trim() ? findRegion(dest) : null;
  const setStops = (all: { destId: string; name: string; days: number }[]) => {
    if (!all.length) { setDest('', null); setLegs([]); return; }
    setDest(all[0].name, all[0].destId || null);
    setLegs(all.slice(1).map((x) => ({ destId: x.destId, name: x.name, days: Math.max(1, x.days) })));
    setLegPick(null); setTpl(null);
    if (err.legs) setErr({ ...err, legs: undefined });
  };
  const moveStop = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const all = stops.slice(); const tmp = all[i]; all[i] = all[j]; all[j] = tmp;
    setStops(all);
  };
  const removeStop = (i: number) => setStops(stops.filter((_, k) => k !== i));
  /* sugestões para uma parada: cidades com roteiro automático do mesmo continente, ainda não usadas */
  const legSuggest = (li: number) => {
    const used = stops.map((x) => x.destId);
    const ref = li > 0 ? legs[li - 1].destId : matched ? matched.id : '';
    const cont = ref ? continentOf(ref) : '';
    const near = DESTINATIONS.filter((d) => used.indexOf(d.id) < 0 && cont && continentOf(d.id) === cont);
    return near.concat(DESTINATIONS.filter((d) => used.indexOf(d.id) < 0 && near.indexOf(d) < 0)).slice(0, 6);
  };
  const addLeg = () => {
    const sug = legSuggest(legs.length)[0] || DESTINATIONS[0];
    setLegs(legs.concat([{ destId: sug.id, name: sug.name, days: 2 }]));
    setLegPick(legs.length); setLegQ(''); setTpl(null);
  };
  const applyTemplate = (m: MultiTrip) => {
    const first = lookupDest(m.stops[0].id)!;
    setDest(first.name, first.id);
    setLegs(m.stops.slice(1).map((x) => ({ destId: x.id, name: destName(x.id), days: x.days })));
    setTpl(m.id); setLegPick(null);
    const total = m.stops.reduce((a, x) => a + x.days, 0);
    if (start) setEnd(iso(addDays(parseD(start), total - 1)));
    setErr({ ...err, dest: undefined, legs: undefined });
  };
  const setLeg = (i: number, p: Partial<Leg>) => setLegs(legs.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const submit = () => {
    const e = A.createTrip({ dest, destId, legs, start, end, travelers, budget, styles, pace });
    setErr(e);
  };

  /* ---------- medidas: blocos em 1 ou 2 colunas, resumo ao lado no computador ---------- */
  const W = useWindowDimensions().width;
  const pad = usePad();
  const ins = useSafeAreaInsets();
  const avail = (site ? W : Math.min(W, 560)) - pad * 2;
  const sideW = wideForm ? (avail >= 1400 ? 420 : 360) : 0;
  const mainW = wideForm ? avail - sideW - 32 : avail;
  const twoCols = wideForm && mainW >= 1080;
  const blockW = twoCols ? (mainW - 24) / 2 : mainW;
  const inner = blockW - 40;
  const months: 1 | 2 = inner >= 600 ? 2 : 1;
  const daily = n && Number(budget) > 0 ? Number(budget) / travelers / n : null;
  const done = [!!(picked || matched), !!valid, true, styles.length > 0];
  const tileK = Math.max(2, Math.min(4, Math.floor((inner + 10) / 150)));
  const tileW = (inner - 10 * (tileK - 1)) / tileK;
  const tplK = inner >= 820 ? 3 : inner >= 440 ? 2 : 1;
  const tplW = (inner - 10 * (tplK - 1)) / tplK;

  const b1 = (
    <Block fill={twoCols} n={1} done={done[0]} title="Destinos" sub="Uma cidade só ou vários países na mesma viagem">
      <View style={{ marginBottom: 18 }}>
        <Seg value={mode} onChange={(v) => setMode(v)} options={[{ id: 'one', label: 'Um destino' }, { id: 'multi', label: 'Vários países' }]} />
      </View>

      {mode === 'one' ? (
        <View style={{ marginBottom: 18 }}>
          <T v="label">Ideias para se inspirar</T>
          <T v="smallMuted" style={{ marginTop: -2, marginBottom: 10 }}>Ainda não decidiu? Toque num destino para escolher.</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {DESTINATIONS.slice(0, tileK * 2).map((d) => {
              const on = !!matched && matched.id === d.id;
              return (
                <Pressable key={d.id} accessibilityRole="button" accessibilityLabel={d.name} accessibilityState={{ selected: on }} onPress={() => setDest(d.name, d.id)}
                  style={{ width: tileW, borderRadius: 12, overflow: 'hidden', borderWidth: 3, borderColor: on ? c.accBg : 'transparent' }}>
                  <Cover destId={d.id} height={78} artW={90} artTop={8} artRight={4}>
                    <View style={{ position: 'absolute', left: 10, bottom: 8, right: 10 }}><T v="small" color="#FFFFFF" lines={1} style={{ fontWeight: '700' }}>{d.name}</T></View>
                    {on ? <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={13} color={c.accBg} strokeWidth={2.8} /></View> : null}
                  </Cover>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ marginBottom: 18 }}>
          <T v="label">Roteiros prontos por vários países</T>
          <T v="smallMuted" style={{ marginTop: -2, marginBottom: 10 }}>Toque num roteiro para começar. Depois dá para trocar, tirar ou incluir cidades e mudar os dias.</T>
          <Chips scroll>
            {['Todos'].concat(MULTI_REGIONS).map((r) => <Chip key={r} label={r} on={region === r} onPress={() => setRegion(r)} />)}
          </Chips>
          <Gap h={10} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {MULTI_TRIPS.filter((m) => region === 'Todos' || m.region === region).map((m) => {
              const on = tpl === m.id;
              const total = m.stops.reduce((a, s) => a + s.days, 0);
              const cs = multiTripCountries(m);
              return (
                <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={'Roteiro ' + m.title} accessibilityState={{ selected: on }} onPress={() => applyTemplate(m)}
                  style={{ width: tplW, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? c.accBg : c.line2, backgroundColor: on ? c.accTint : c.card, padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {m.stops.map((s) => <View key={s.id} style={{ flex: 1, height: 26, borderRadius: 6, backgroundColor: coverOf(s.id).color }} />)}
                  </View>
                  <T v="lt" color={on ? c.accText : c.ink}>{m.title}</T>
                  <T v="small" color={c.ink2}>{m.stops.map((s) => destName(s.id)).join(' → ')}</T>
                  <T v="smallMuted">{plural(total, 'dia', 'dias') + ' · ' + plural(cs.length, 'país', 'países')}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Field label={mode === 'multi' ? 'Ou monte o seu: primeira parada' : 'Ou digite o destino'} error={err.dest}>
        <Input value={dest} onChangeText={(v) => { setDest(v, null); setTpl(null); }} icon="pin" placeholder={mode === 'multi' ? 'Cidade ou país onde a viagem começa' : 'Cidade, país ou região (ex.: Europa)'} caps="words" error={!!err.dest} />
        {regionHit ? (
          <Card flat style={{ marginTop: 6, padding: 14, gap: 10 }}>
            <Row gap={10}><TileIcon name="map" /><Grow><T v="lt">{'Viagem por vários países: ' + regionHit}</T><T v="smallMuted">Escolha um roteiro pronto ou comece por uma destas cidades.</T></Grow></Row>
            <Chips>{catalogInRegion(regionHit).slice(0, 10).map((d) => <Chip key={d.id} label={d.name} onPress={() => { setMode('multi'); setRegion(MULTI_REGIONS.indexOf(regionHit) >= 0 ? regionHit : 'Todos'); setDest(d.name, d.id); }} />)}</Chips>
            {MULTI_REGIONS.indexOf(regionHit) >= 0 ? <View style={{ alignItems: 'flex-start' }}><LinkBtn label={'Ver roteiros prontos: ' + regionHit} onPress={() => { setMode('multi'); setRegion(regionHit); setDest('', null); }} /></View> : null}
          </Card>
        ) : ac.length ? (
          <Card flat style={{ marginTop: 6, overflow: 'hidden' }}>
            {ac.map((d) => (
              <ListRow key={d.id} iconEl={<View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: d.color }} />} title={d.name}
                sub={(d.kind === 'country' ? 'País · ' + d.country : d.country) + (d.kind === 'catalog' ? ' · roteiro automático' : '')} onPress={() => setDest(d.name, d.id)} />
            ))}
          </Card>
        ) : dest.trim() && !destId && !matched ? <T v="smallMuted" style={{ marginTop: 6 }}>Nenhum destino com esse nome. Confira a grafia.</T> : null}
        {picked && !legs.length ? <T v="small" color={c.accText} style={{ marginTop: 6, fontWeight: '600' }}>{picked.name + (picked.kind === 'country' ? ' (país inteiro)' : ', ' + picked.country) + (picked.kind === 'catalog' ? ' · roteiro automático disponível' : ' · roteiro começa em branco')}</T> : null}
      </Field>

      {matched || (dest.trim() && !regionHit && !ac.length) ? (
        <Field label={'Paradas da viagem' + (stopCountries.length > 1 ? ' · ' + plural(stopCountries.length, 'país', 'países') : '')} error={err.legs} style={{ marginBottom: 0 }}>
          <Card flat style={{ overflow: 'hidden' }}>
            {stops.map((st, i) => {
              const first = i === 0;
              const d = lookupDest(st.destId);
              const sub = (d ? (d.kind === 'country' ? 'País inteiro' : d.country) : 'Destino personalizado') + (d && hasCatalog(st.destId) ? ' · roteiro automático' : ' · roteiro em branco');
              return (
                <View key={i + st.destId} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line, paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
                  {i > 0 && stops[i - 1].destId && st.destId ? (() => { const h = intercityShort(stops[i - 1].destId, st.destId); return (
                    <Row gap={6} style={{ paddingLeft: 6 }}><Icon name={h ? h.icon : 'route'} size={14} color={c.accText} /><T v="smallMuted" color={c.accText}>{(h ? h.text : 'Deslocamento') + ' desde ' + stops[i - 1].name}</T></Row>
                  ); })() : null}
                  <Row gap={10}>
                    <Num n={i + 1} />
                    <Grow>
                      {first ? <T v="lt" lines={1}>{st.name}</T> : (
                        <Pressable accessibilityRole="button" accessibilityLabel={'Trocar ' + st.name} onPress={() => { setLegPick(legPick === i - 1 ? null : i - 1); setLegQ(''); }}>
                          <Row gap={6}><T v="lt" lines={1}>{st.name}</T><Icon name="edit" size={14} color={c.muted} /></Row>
                        </Pressable>
                      )}
                      <T v="smallMuted" lines={1}>{sub}</T>
                    </Grow>
                    {stops.length > 1 ? <IconBtn icon="x" flat size={34} label={'Tirar ' + st.name} onPress={() => removeStop(i)} /> : null}
                  </Row>
                  <Row gap={8} style={{ paddingLeft: 40, flexWrap: 'wrap' }}>
                    {first ? (
                      <T v="small" color={firstDays !== null && firstDays < 1 ? c.warnText : c.ink2} style={{ fontWeight: '600', minHeight: 34, paddingTop: 8 }}>{firstDays === null ? (stops.length > 1 ? 'Fica com os dias que sobrarem' : 'Todos os dias da viagem') : firstDays >= 1 ? plural(firstDays, 'dia', 'dias') + (stops.length > 1 ? ' (os que sobram)' : '') : 'Sem dias sobrando'}</T>
                    ) : (
                      <Row gap={6}>
                        <IconBtn icon="minus" flat size={34} label={'Menos um dia em ' + st.name} onPress={() => setLeg(i - 1, { days: Math.max(1, st.days - 1) })} />
                        <T v="small" style={{ fontWeight: '700', minWidth: 52, textAlign: 'center' }}>{plural(st.days, 'dia', 'dias')}</T>
                        <IconBtn icon="plus" flat size={34} label={'Mais um dia em ' + st.name} onPress={() => setLeg(i - 1, { days: Math.min(60, st.days + 1) })} />
                      </Row>
                    )}
                    <Grow />
                    {stops.length > 1 && matched ? (
                      <Row gap={6}>
                        <IconBtn icon="chevU" flat size={34} label={'Subir ' + st.name} onPress={() => moveStop(i, -1)} />
                        <IconBtn icon="chevD" flat size={34} label={'Descer ' + st.name} onPress={() => moveStop(i, 1)} />
                      </Row>
                    ) : null}
                  </Row>
                  {!first && legPick === i - 1 ? (
                    <View style={{ gap: 8, paddingTop: 4 }}>
                      <Input value={legQ} onChangeText={setLegQ} icon="search" placeholder="Buscar cidade ou país, em qualquer lugar do mundo" caps="words" />
                      {(legQ ? searchDest(legQ) : legSuggest(i - 1)).map((o) => (
                        <ListRow key={o.id} iconEl={<View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: o.color || c.soft }} />} title={o.name}
                          sub={(o.kind === 'country' ? 'País inteiro · ' + o.country : o.country) + (o.kind === 'catalog' ? ' · roteiro automático' : '')}
                          onPress={() => { setLeg(i - 1, { destId: o.id, name: o.name }); setLegPick(null); setTpl(null); }} />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
          {legs.length < 9 && matched ? <View style={{ alignItems: 'flex-start', marginTop: 6 }}><LinkBtn label="+ Adicionar outra parada (cidade ou país)" onPress={addLeg} /></View> : null}
          <T v="smallMuted" color={firstDays !== null && firstDays < 1 ? c.warnText : undefined}>
            {!legs.length ? 'Vai passar por mais de um lugar? Adicione as outras paradas, de qualquer país.' : n === null ? 'Escolha as datas para ver como os dias ficam divididos.' : firstDays! >= 1 ? 'Total de ' + plural(n, 'dia', 'dias') + ' de viagem. Nos dias de mudança de cidade, o roteiro já inclui o deslocamento.' : 'A soma dos dias passa do total da viagem (' + n + '). Diminua os dias de alguma parada.'}
          </T>
        </Field>
      ) : null}
    </Block>
  );

  const dateInfo = (
    <>
      {wc ? <Row gap={6} style={{ marginTop: 10 }}><Icon name={wc.icon} size={16} color={c.muted} /><T v="smallMuted">{wc.hi + '° / ' + wc.lo + '° em ' + wc.monthsLabel + ' · ' + wc.feel.toLowerCase()}</T></Row> : null}
    </>
  );
  const b2 = (
    <Block fill={twoCols} n={2} done={done[1]} title="Datas" sub={wideForm ? (!start ? 'Clique no dia da ida' : !end ? 'Agora clique no dia da volta' : 'Clique de novo para escolher outro período') : 'Ida e volta'}>
      {wideForm ? (
        <>
          <Row gap={10} style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <Pill style={{ backgroundColor: start ? c.accTint : c.soft }}><T v="small" color={start ? c.accText : c.muted} style={{ fontWeight: '600' }}>{'Ida: ' + (start ? fmtShort(start) : '—')}</T></Pill>
            <Pill style={{ backgroundColor: end ? c.accTint : c.soft }}><T v="small" color={end ? c.accText : c.muted} style={{ fontWeight: '600' }}>{'Volta: ' + (end ? fmtShort(end) : '—')}</T></Pill>
            {n ? <T v="small" style={{ fontWeight: '700' }}>{plural(n, 'dia', 'dias') + ' de viagem'}</T> : null}
            {start ? <LinkBtn label="Limpar" onPress={() => { setStart(''); setEnd(''); }} /> : null}
          </Row>
          <RangeCalendar start={start} end={end} min={iso(today0())} months={months} width={inner} onChange={(a, b) => { setStart(a); setEnd(b); if (err.start || err.end) setErr({ ...err, start: undefined, end: undefined }); }} />
          {err.start ? <T v="small" color={c.errText} style={{ marginTop: 6 }}>{err.start}</T> : null}
          {err.end ? <T v="small" color={c.errText} style={{ marginTop: 6 }}>{err.end}</T> : null}
        </>
      ) : (
        <>
          <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} min={iso(today0())} errStart={err.start} errEnd={err.end} />
          {n ? <T v="small" style={{ fontWeight: '700' }}>{plural(n, 'dia', 'dias') + ' de viagem'}</T> : null}
        </>
      )}
      {dateInfo}
    </Block>
  );

  const b3 = (
    <Block fill={twoCols} n={3} done={done[2]} title="Quem vai e orçamento" sub="O orçamento é opcional: preencha só se quiser acompanhar os gastos">
      <Field label="Viajantes">
        <Row gap={14}>
          <IconBtn icon="minus" label="Menos um viajante" onPress={() => setTrav(Math.max(1, travelers - 1))} />
          <T v="lt">{plural(travelers, 'viajante', 'viajantes')}</T>
          <IconBtn icon="plus" label="Mais um viajante" onPress={() => setTrav(Math.min(20, travelers + 1))} />
        </Row>
      </Field>
      <Field label="Orçamento total (opcional)" error={err.budget} style={{ marginBottom: 0 }}>
        <Input prefix="R$" value={budget ? fmtMoney(Number(budget)) : ''} onChangeText={(v) => setBudget(maskToValue(v))} keyboard="number-pad" placeholder="0,00" error={!!err.budget} />
        <Gap h={10} />
        <Chips>{[5000, 10000, 15000, 25000].map((v) => <Chip key={v} label={brl(v)} on={Number(budget) === v} onPress={() => setBudget(String(v))} />)}</Chips>
        {Number(budget) > 0 ? (
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 12, padding: 12 }}>
              <T v="smallMuted">Por pessoa</T>
              <T v="lt">{money(Number(budget) / travelers)}</T>
            </View>
            <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 12, padding: 12 }}>
              <T v="smallMuted">Por pessoa, por dia</T>
              <T v="lt">{daily ? money(daily) : 'Escolha as datas'}</T>
            </View>
          </View>
        ) : null}
      </Field>
    </Block>
  );

  const PACE_ICON: Record<string, string> = { tranquilo: 'coffee', equilibrado: 'compass', intenso: 'route' };
  const paceRow = inner >= 520;
  const b4 = (
    <Block fill={twoCols} n={4} done={done[3]} title="Estilo e ritmo" sub="O que vocês gostam de fazer">
      <Field label="Estilo da viagem" error={err.styles}>
        <Picklist label="Estilo da viagem" placeholder="Escolha até 2 estilos" error={!!err.styles} options={STYLES.map((st) => ({ id: st, label: st, icon: STYLE_INFO[st].icon, hint: STYLE_INFO[st].short }))} value={styles} onToggle={(id) => toggleStyle(id as any)} />
        <T v="smallMuted" style={{ marginTop: 8 }}>{styles.length === 2 ? 'Os dias vão alternar entre ' + styles.join(' e ') + '.' : 'Escolha até 2. Com dois, os dias se alternam entre eles.'}</T>
      </Field>
      <T v="label">Ritmo</T>
      <View style={{ flexDirection: paceRow ? 'row' : 'column', gap: 10 }}>
        {PACES.map((p) => {
          const on = p.id === pace;
          return (
            <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={'Ritmo ' + p.label} accessibilityState={{ selected: on }} onPress={() => setPace(p.id)}
              style={{ flex: paceRow ? 1 : undefined, flexDirection: paceRow ? 'column' : 'row', alignItems: paceRow ? 'flex-start' : 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? c.accBg : c.line2, backgroundColor: on ? c.accTint : c.card }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: on ? c.accBg : c.soft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={PACE_ICON[p.id] || 'compass'} size={18} color={on ? '#FFFFFF' : c.ink} />
              </View>
              <View style={{ flex: paceRow ? undefined : 1 }}>
                <T v="lt" color={on ? c.accText : c.ink}>{p.label}</T>
                <T v="smallMuted">{p.hint}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Block>
  );

  const hasErr = Object.keys(err).filter((k) => (err as any)[k]).length > 0;
  const where = matched ? (legs.length ? [matched.name].concat(legs.map((l) => destName(l.destId))).join(' → ') : matched.name) : dest.trim();
  /* resumo ao lado dos blocos (site em tela larga); acompanha a rolagem */
  const summary = (
    <Card style={{ overflow: 'hidden' }}>
      {matched ? (
        <Cover destId={matched.id} height={150} artW={170} artTop={20} artRight={8}>
          <View style={{ position: 'absolute', left: 16, bottom: 14, right: 16 }}>
            <T v="h2" color="#FFFFFF" lines={1}>{where}</T>
            <T v="small" color="rgba(255,255,255,0.88)">{matched.kind === 'country' ? 'País inteiro' : matched.country}</T>
          </View>
        </Cover>
      ) : (
        <View style={{ height: 150, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="pin" size={28} color={c.muted} />
          <T v="smallMuted">Escolha o destino</T>
        </View>
      )}
      <View style={{ padding: 18, gap: 12 }}>
        <Row between><T v="title">Sua viagem</T><T v="smallMuted">{done.filter(Boolean).length + ' de 4 prontos'}</T></Row>
        <Bar pct={done.filter(Boolean).length / 4 * 100} height={6} />
        {[
          ['calendar', n ? fmtShort(start) + ' a ' + fmtShort(end) + ' · ' + plural(n, 'dia', 'dias') : 'Datas a definir'],
          stops.length > 1 ? ['map', plural(stops.length, 'parada', 'paradas') + (stopCountries.length > 1 ? ' em ' + plural(stopCountries.length, 'país', 'países') + ': ' + stopCountries.join(', ') : '')] : null,
          ['users', plural(travelers, 'viajante', 'viajantes')],
          ['wallet', Number(budget) > 0 ? 'Orçamento de ' + money(Number(budget)) + (daily ? ' · ' + money(daily) + ' por pessoa/dia' : '') : 'Sem orçamento (opcional)'],
          ['sparkle', (styles.length ? styles.join(' + ') : 'Estilo a definir') + ' · ritmo ' + (PACE_BY_ID[pace] || PACES[1]).label.toLowerCase()],
          wc ? [wc.icon, wc.hi + '° / ' + wc.lo + '° em ' + wc.monthsLabel] : null
        ].filter(Boolean).map((r) => <Row key={r![0] + r![1]} gap={10}><Icon name={r![0]} size={18} color={c.ink2} /><Grow><T v="small">{r![1]}</T></Grow></Row>)}
        {hasErr ? <Note kind="err">Confira os campos marcados.</Note> : null}
        <Btn label="Criar viagem" block onPress={submit} />
        <T v="smallMuted">{matched && matched.kind === 'catalog' ? 'O roteiro é montado na hora, e você ajusta o que quiser.' : 'Você pode editar tudo depois em Editar viagem.'}</T>
      </View>
    </Card>
  );

  const head = wideForm ? (
    <Row gap={16} style={{ marginBottom: 24 }}>
      <IconBtn icon="chevL" label="Voltar" onPress={A.back} />
      <Grow>
        <T v="h1">Nova viagem</T>
        <T v="muted">Preencha os 4 blocos. O roteiro é montado na hora, e dá para mudar tudo depois.</T>
      </Grow>
    </Row>
  ) : <TopBar title="Nova viagem" onBack={A.back} />;

  if (wideForm) {
    const sticky: any = { position: 'sticky', top: 24 };
    return (
      <Screen tabs={false}>
        {head}
        <View style={{ flexDirection: 'row', gap: 32, alignItems: 'flex-start' }}>
          <View style={{ width: mainW, gap: 24 }}>
            {twoCols ? (
              <>
                <View style={{ flexDirection: 'row', gap: 24, alignItems: 'stretch' }}><View style={{ flex: 1, flexDirection: 'column' }}>{b1}</View><View style={{ flex: 1, flexDirection: 'column' }}>{b2}</View></View>
                <View style={{ flexDirection: 'row', gap: 24, alignItems: 'stretch' }}><View style={{ flex: 1, flexDirection: 'column' }}>{b3}</View><View style={{ flex: 1, flexDirection: 'column' }}>{b4}</View></View>
              </>
            ) : <>{b1}{b2}{b3}{b4}</>}
          </View>
          <View style={[{ width: sideW }, sticky]}>{summary}</View>
        </View>
      </Screen>
    );
  }
  /* celular e tablet: blocos um embaixo do outro e o botão fixo no rodapé */
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen tabs={false}>
        {head}
        <View style={{ gap: 16 }}>{b1}{b2}{b3}{b4}</View>
      </Screen>
      <View style={{ borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bar, paddingHorizontal: pad, paddingTop: 10, paddingBottom: 10 + ins.bottom }}>
        <View style={{ maxWidth: site ? undefined : 560, width: '100%', alignSelf: 'center', gap: 8 }}>
          {hasErr ? <T v="small" color={c.errText} style={{ fontWeight: '600' }}>Confira os campos marcados acima.</T> : (
            <T v="smallMuted" lines={1}>{(where || 'Escolha o destino') + (n ? ' · ' + plural(n, 'dia', 'dias') : '') + ' · ' + plural(travelers, 'viajante', 'viajantes')}</T>
          )}
          <Btn label="Criar viagem" block onPress={submit} />
        </View>
      </View>
    </View>
  );
}
/* Bloco numerado do formulário de nova viagem */
function Block({ n, done, title, sub, children, fill }: { n: number; done: boolean; title: string; sub?: string; children: React.ReactNode; fill?: boolean }) {
  const { c } = useTheme();
  return (
    <Card style={{ padding: 20, flex: fill ? 1 : undefined }}>
      <Row gap={12} style={{ marginBottom: 18 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: done ? c.accBg : c.soft, alignItems: 'center', justifyContent: 'center' }}>
          {done ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.6} /> : <T v="small" style={{ fontWeight: '700' }}>{String(n)}</T>}
        </View>
        <Grow>
          <T v="title">{title}</T>
          {sub ? <T v="smallMuted">{sub}</T> : null}
        </Grow>
      </Row>
      {children}
    </Card>
  );
}
/* Como ir de uma cidade para a próxima (avião, trem, ônibus, barco, carro) */
export function IntercityCard({ fromId, toId, style }: { fromId: string; toId: string; style?: any }) {
  const { c } = useTheme();
  const ic = intercity(fromId, toId);
  const open = (u: string) => Linking.openURL(u).catch(() => {});
  return (
    <Card style={[{ padding: 16, gap: 12 }, style]}>
      <Row gap={10}>
        <TileIcon name="route" />
        <Grow>
          <T v="lt">{'Como ir de ' + ic.from + ' para ' + ic.to}</T>
          <T v="smallMuted">{(ic.km ? '≈ ' + fmtMoney(ic.km).replace(',00', '') + ' km em linha reta · ' : '') + (ic.known ? 'opções mais usadas nesse trecho' : ic.options.length ? 'estimativa pela distância' : 'compare as opções do trecho')}</T>
        </Grow>
      </Row>
      {ic.options.length ? (
        <View style={{ gap: 8 }}>
          {ic.options.map((o, i) => (
            <Row key={i} gap={12} top style={{ backgroundColor: i === 0 ? c.accTint : c.soft, borderRadius: 12, padding: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: i === 0 ? c.accBg : c.card, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={MODE_ICON[o.mode]} size={18} color={i === 0 ? '#FFFFFF' : c.ink} />
              </View>
              <Grow>
                <Row between top gap={8}>
                  <Grow><T v="small" style={{ fontWeight: '700' }} color={i === 0 ? c.accText : c.ink}>{o.label}</T></Grow>
                  <T v="small" style={{ fontWeight: '700' }} color={i === 0 ? c.accText : c.ink}>{o.time}</T>
                </Row>
                {i === 0 ? <T v="smallMuted">Sugestão principal</T> : null}
                {o.note ? <T v="smallMuted">{o.note}</T> : null}
              </Grow>
            </Row>
          ))}
        </View>
      ) : (
        <T v="small" color={c.ink2}>Dependendo do lugar, o trecho pode ser feito de avião, trem, ônibus, barco ou carro. Compare horários e preços:</T>
      )}
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Btn sm kind="secondary" icon="search" label="Comparar horários e preços" onPress={() => open(ic.compareUrl)} />
        <Btn sm kind="secondary" icon="map" label="Ver no mapa" onPress={() => open(ic.mapsUrl)} />
      </Row>
      <T v="smallMuted">Tempos aproximados, sem contar o trajeto até a estação, o porto ou o aeroporto. Confira antes de comprar.</T>
    </Card>
  );
}
function Num({ n }: { n: number }) {
  const { c } = useTheme();
  return <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}><T v="small" color={c.onInk} style={{ fontWeight: '700' }}>{String(n)}</T></View>;
}

/* ====================== Viagem criada ====================== */
export function Created() {
  const s = useApp();
  const { c } = useTheme();
  const wideSite = useSiteWide();
  const t = s.trips.find((x) => x.id === s.createdId);
  if (!t) return <Screen><NoTrip /></Screen>;
  const plan = s.createdPlan;
  const noCatalog = !tripLegs(t).some((l) => hasCatalog(l.destId));
  let acts = 0;
  (plan || []).forEach((d) => { acts += d.filter((x) => x.kind === 'place').length; });
  const free = (plan || []).filter((d) => d.some((x) => x.kind === 'note' && (x.text || '').indexOf('Dia livre') === 0)).length;
  /* cartões dos dias com o mesmo tamanho: altura do dia com mais atividades */
  const maxItems = Math.max(1, ...(plan || []).map((d) => d.filter((x) => x.kind !== 'move').length));
  const dayCardH = 16 * 2 + 44 + maxItems * 28;
  if (wideSite) {
    /* site em tela larga: cabeçalho com as ações e o roteiro em grade, um cartão por dia */
    return (
      <Screen tabs={false}>
        <Row between top style={{ flexWrap: 'wrap', gap: 20, marginTop: 8 }}>
          <Row gap={16}>
            <TileIcon name="check" size={56} />
            <View><T v="h1">Viagem criada</T><T v="muted">{t.name + ' · ' + periodShort(t) + ' · ' + plural(t.days.length, 'dia', 'dias') + (plan ? ' · ' + styleLabel(t) + ' · ' + plural(acts, 'atividade', 'atividades') : '')}</T></View>
          </Row>
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            <Btn kind="ghost" label="Voltar ao início" onPress={() => A.tab('home')} />
            {plan ? <Btn kind="secondary" label="Começar em branco" onPress={() => { setState({ createdPlan: null, screen: 'trip', history: ['home'], tripId: t.id }); A.showToast('Roteiro em branco. Adicione lugares quando quiser.'); }} /> : null}
            {plan ? <Btn label="Usar este roteiro" icon="check" onPress={A.useCreatedPlan} /> : <Btn label="Ver viagem" onPress={() => setState({ screen: 'trip', history: ['home'], tripId: t.id })} />}
          </Row>
        </Row>
        <Gap h={24} />
        {plan ? (
          <>
            {free ? <Note kind="note" style={{ marginBottom: 16 }}>{plural(free, 'dia ficou livre', 'dias ficaram livres') + ': a estadia é longa para os lugares do catálogo. Considere adicionar outra cidade à viagem.'}</Note> : null}
            <Grid items={plan} min={300} gap={16} render={(d, _w, i) => (
              <Card style={{ padding: 16, gap: 8, flex: 1, minHeight: dayCardH }}>
                <Row between top>
                  <View><T v="lt">{'Dia ' + (i + 1) + ' · ' + cap(SEM_LONGO[addDays(parseD(t.start), i).getDay()])}</T><T v="smallMuted">{addDays(parseD(t.start), i).getDate() + ' de ' + MES_LONGO[addDays(parseD(t.start), i).getMonth()]}</T></View>
                  {isMultiCity(t) ? <T v="smallMuted">{legNameOfDay(t, i)}</T> : null}
                </Row>
                {sortItems(d).filter((x) => x.kind !== 'move').map((x) => (
                  <Row key={x.id} top gap={10}><T v="small" style={{ fontWeight: '700', width: 44 }}>{x.time}</T><Grow><T v="small" color={c.ink2} lines={1}>{itemName(x)}</T></Grow></Row>
                ))}
                {!d.length ? <T v="smallMuted">Dia livre</T> : null}
              </Card>
            )} />
          </>
        ) : (
          <Card style={{ padding: 20, gap: 8 }}>
            <T v="lt">{noCatalog ? 'Roteiro começa em branco' : 'Seu roteiro está pronto para montar'}</T>
            <T v="muted">{noCatalog ? 'Ainda não temos catálogo de lugares para ' + t.name + '. Adicione suas próprias atividades no roteiro.' : 'Adicione lugares do catálogo dia a dia.'}</T>
          </Card>
        )}
      </Screen>
    );
  }
  return (
    <Screen tabs={false}>
      <View style={{ alignItems: 'center', marginTop: 20, gap: 10 }}>
        <TileIcon name="check" size={64} />
        <T v="h1" center>Viagem criada</T>
        <T v="muted" center>{t.name + ' · ' + periodShort(t) + ' · ' + plural(t.days.length, 'dia', 'dias')}</T>
      </View>
      <Gap h={22} />
      {plan ? (
        <Card style={{ padding: 16, gap: 10 }}>
          <Row><TileIcon name="sparkle" /><Grow><T v="lt">Roteiro sugerido</T><T v="smallMuted">{styleLabel(t) + ' · ritmo ' + (PACE_BY_ID[t.pace] || PACES[1]).label.toLowerCase() + ' · ' + plural(acts, 'atividade', 'atividades')}</T></Grow></Row>
          {plan.slice(0, 7).map((d, i) => (
            <Row key={i} top gap={10}>
              <View style={{ width: 82 }}><T v="small" style={{ fontWeight: '700' }}>{'Dia ' + (i + 1)}</T><T v="smallMuted" lines={1} style={{ fontSize: 12 }}>{cap(SEM[addDays(parseD(t.start), i).getDay()]) + ', ' + fmtShort(iso(addDays(parseD(t.start), i)))}</T></View>
              <Grow><T v="small" color={c.ink2} lines={2}>{(isMultiCity(t) ? legNameOfDay(t, i) + ': ' : '') + (d.filter((x) => x.kind !== 'move').map(itemName).join(' · ') || 'Livre')}</T></Grow>
            </Row>
          ))}
          {plan.length > 7 ? <T v="smallMuted">{'+ ' + plural(plan.length - 7, 'dia', 'dias') + ' no roteiro completo'}</T> : null}
          {free ? <Note kind="note">{plural(free, 'dia ficou livre', 'dias ficaram livres') + ': a estadia é longa para os lugares do catálogo. Considere adicionar outra cidade à viagem.'}</Note> : null}
          <Btn label="Usar este roteiro" block onPress={A.useCreatedPlan} />
          <Btn kind="ghost" label="Começar em branco" block onPress={() => { setState({ createdPlan: null, screen: 'trip', history: ['home'], tripId: t.id }); A.showToast('Roteiro em branco. Adicione lugares quando quiser.'); }} />
        </Card>
      ) : (
        <Card style={{ padding: 16, gap: 10 }}>
          <T v="lt">{noCatalog ? 'Roteiro começa em branco' : 'Seu roteiro está pronto para montar'}</T>
          <T v="muted">{noCatalog ? 'Ainda não temos catálogo de lugares para ' + t.name + '. Adicione suas próprias atividades no roteiro.' : 'Adicione lugares do catálogo dia a dia.'}</T>
          <Btn label="Ver viagem" block onPress={() => setState({ screen: 'trip', history: ['home'], tripId: t.id })} />
        </Card>
      )}
      <Gap h={12} />
      <Btn kind="ghost" label="Voltar ao início" block onPress={() => A.tab('home')} />
    </Screen>
  );
}

/* ====================== Detalhes da viagem ====================== */
export function TripScreen() {
  const s = useApp();
  const { c } = useTheme();
  const [wxOpen, setWx] = useState(false);
  const [dishOpen, setDish] = useState(false);
  const site = useSite();
  const siteWide = useSiteWide();
  const pad = usePad();
  const t = A.currentTrip();
  const fc = useForecast(t);
  if (!t) return <Screen><NoTrip /></Screen>;
  const v = tripInfo(t, s);
  let nextItem: { it: ItineraryItem; di: number } | null = null;
  t.days.some((d, di) => sortItems(d).some((it) => (it.kind === 'place' && it.placeId && PLACE_BY_ID[it.placeId] ? ((nextItem = { it, di }), true) : false)));
  const members = tripMembers(t), debts = settleUp(groupBalances(t, s.expenses));
  const mine = debts.filter((d) => d.from === 'me' || d.to === 'me');
  const peopleSub = (t.shared ? 'Editando junto · ' : '') + (members.length < 2 ? (t.shared ? 'mande o convite para o grupo' : 'Convide quem vai junto para editar a viagem e dividir os gastos')
    : mine.length ? mine.map((d) => (d.from === 'me' ? 'Você deve ' + money(d.amount) + ' para ' + memberName(t, d.to) : cap(memberName(t, d.from)) + ' te deve ' + money(d.amount))).join(' · ')
    : debts.length ? 'Há acertos pendentes entre o grupo' : 'Gastos divididos e contas em dia');
  const wc = v.wc;
  const clItems = (s.checklist[t.id] || []).map((x) => x.label);
  const wxMissing = wc ? wc.tips.filter((tp) => clItems.indexOf(tp.text) < 0) : [];
  const daysTo = diffDays(today0(), parseD(t.start));
  const dishCities = tripLegs(t).map((l) => l.destId).filter((x, i, a) => DISHES[x] && a.indexOf(x) === i);
  const done = s.dishDone[t.id] || [];
  const dishTotal = dishCities.reduce((a, x) => a + DISHES[x].length, 0);
  const firstCity = legName(tripLegs(t)[0]);
  const hotelUrl = 'https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(firstCity) + '&checkin=' + t.start + '&checkout=' + t.end + '&group_adults=' + t.travelers + (BOOKING_AFFILIATE_ID ? '&aid=' + BOOKING_AFFILIATE_ID : '');
  /* viagens com várias paradas: datas, clima e hotel de cada cidade */
  const legInfo = (() => {
    let acc = 0;
    const all = tripLegs(t);
    return all.map((L, k) => {
      const from = acc; acc += L.days;
      const a = iso(addDays(parseD(t.start), from)), b = iso(addDays(parseD(t.start), from + L.days - 1));
      const co = k < all.length - 1 ? iso(addDays(parseD(b), 1)) : t.end;
      const cl = tripClimate({ destId: L.destId, start: a, end: b, styles: t.styles });
      const url = 'https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(legName(L)) + '&checkin=' + a + '&checkout=' + (co > a ? co : iso(addDays(parseD(a), 1))) + '&group_adults=' + t.travelers + (BOOKING_AFFILIATE_ID ? '&aid=' + BOOKING_AFFILIATE_ID : '');
      return { L, a, b, co, cl, url };
    });
  })();
  const multiLegs = legInfo.length > 1;
  const legTips = multiLegs ? legInfo.reduce((acc: { icon: string; text: string }[], x) => acc.concat((x.cl ? x.cl.tips : []).filter((tp) => !acc.some((y) => y.text === tp.text))), []) : [];
  const NI = nextItem as { it: ItineraryItem; di: number } | null;
  const nip = NI ? PLACE_BY_ID[NI.it.placeId!] : null;

  return (
    <Screen flush>
      <Cover destId={t.destId} height={300} artW={190} artTop={70} artRight={10}>
        <TopOverlay right={<Row gap={8}>
          <IconBtn icon="share" glass label="Compartilhar roteiro" onPress={() => A.openSheet('share')} />
          <IconBtn icon="edit" glass label="Editar viagem" onPress={() => A.openSheet('editTrip')} />
          <IconBtn icon="sparkle" glass label="Assistente" onPress={() => A.go('assistant')} />
        </Row>} />
        {/* o texto da capa fica 44 px acima da borda para não encostar no cartão de resumo */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 44 }}>
          <View style={{ maxWidth: site ? SITE_MAX : 800, width: '100%', alignSelf: 'center', paddingHorizontal: pad }}>
            <Pill>{v.st.countdown}</Pill>
            <Gap h={8} />
            <T v="big" color="#FFFFFF" lines={2}>{t.name}</T>
            <T v="body" color="rgba(255,255,255,0.9)" lines={1}>{v.coverSub}</T>
          </View>
        </View>
      </Cover>
      <View style={{ paddingHorizontal: pad, marginTop: -24, maxWidth: site ? SITE_MAX : 800, width: '100%', alignSelf: 'center' }}>
        <Card style={{ flexDirection: 'row', padding: 14 }}>
          {[['Período', v.periodShort], ['Duração', v.n + ' dias'], ['Viajantes', String(t.travelers)]].map((x, i) => (
            <View key={x[0]} style={{ flex: 1, borderLeftWidth: i ? 1 : 0, borderLeftColor: c.line, paddingLeft: i ? 12 : 0 }}>
              <T v="smallMuted">{x[0]}</T><T v="lt" lines={1}>{x[1]}</T>
            </View>
          ))}
        </Card>

        {isMultiCity(t) ? (() => {
          const legsT = tripLegs(t);
          const cs = legsT.map((l) => countryOf(l.destId)).filter((x, i, a) => x && a.indexOf(x) === i);
          let acc = 0;
          return (
            <>
              <Section title={'Paradas · ' + plural(legsT.length, 'cidade', 'cidades') + (cs.length > 1 ? ' em ' + plural(cs.length, 'país', 'países') : '')} />
              <Chips scroll>
                {legsT.map((L, k) => {
                  const from = acc; acc += L.days;
                  const a = addDays(parseD(t.start), from), b = addDays(parseD(t.start), from + L.days - 1);
                  const hop = k > 0 ? intercityShort(legsT[k - 1].destId, L.destId) : null;
                  return (
                    <React.Fragment key={k}>
                    {k > 0 ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={'Como ir de ' + legName(legsT[k - 1]) + ' para ' + legName(L)} onPress={() => A.go('itinerary', { day: from })} style={{ alignSelf: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 2 }}>
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.accTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={hop ? hop.icon : 'route'} size={16} color={c.accText} /></View>
                        <T v="smallMuted" style={{ fontSize: 11, maxWidth: 84, textAlign: 'center' }}>{hop ? hop.text : 'Ver opções'}</T>
                      </Pressable>
                    ) : null}
                    <Card onPress={() => A.go('itinerary', { day: from })} label={'Parada ' + (k + 1) + ': ' + legName(L) + ', ' + plural(L.days, 'dia', 'dias')} style={{ width: 196, padding: 12, gap: 6 }}>
                      <Row gap={8}><Num n={k + 1} /><Grow><T v="lt" lines={1}>{legName(L)}</T><T v="smallMuted" lines={1}>{countryOf(L.destId) || 'Destino'}</T></Grow></Row>
                      <T v="small" color={c.ink2}>{fmtShort(iso(a)) + (L.days > 1 ? ' a ' + fmtShort(iso(b)) : '') + ' · ' + plural(L.days, 'dia', 'dias')}</T>
                    </Card>
                    </React.Fragment>
                  );
                })}
              </Chips>
            </>
          );
        })() : null}

        <Cols main={<>
        {NI && nip ? (
          <>
            <Section title="Próximo no roteiro" />
            <Card onPress={() => A.go('itinerary', { day: NI.di })} label={'Próximo: ' + nip.name}>
              <Row style={{ padding: 12 }}>
                <PlaceThumb place={nip} />
                <Grow><T v="kind">{'Dia ' + (NI.di + 1) + ' · ' + NI.it.time}</T><T v="lt" lines={1}>{nip.name}</T><T v="smallMuted" lines={1}>{CAT_INFO[nip.cat].label + ' · ' + nip.area}</T></Grow>
                <Icon name="chevR" color={c.faint} />
              </Row>
            </Card>
          </>
        ) : (
          <Card flat style={{ padding: 16, marginTop: 20, gap: 4 }}>
            <T v="lt">Roteiro ainda vazio</T>
            <T v="smallMuted">Monte os dias automaticamente no seu estilo ou adicione lugares.</T>
          </Card>
        )}
        <Gap h={14} />
        <Btn label="Abrir roteiro dia a dia" icon="calendar" block onPress={() => A.go('itinerary', { day: NI ? NI.di : 0 })} />
        <T v="smallMuted" center style={{ marginTop: 8 }}>{v.actsLabel + ' · ' + v.plannedDays + ' de ' + v.n + ' dias com planos'}</T>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
          <Tile icon="receipt" title="Gastos" sub={v.spentOf} pct={v.budgetPct} over={v.over} onPress={() => A.tab('expenses', { tripId: t.id })} />
          <Tile icon="ticket" title="Reservas" sub={v.resLabel} onPress={() => A.go('docs', { sheetArg: 'reservas' })} />
          <Tile icon="doc" title="Documentos" sub={v.checkLabel} pct={v.checkPct} onPress={() => A.go('docs', { sheetArg: 'docs' })} />
          <Tile icon="map" title="Mapa" sub={plural(v.acts, 'ponto', 'pontos') + ' no mapa'} onPress={() => A.go('map')} />
        </View>

        </>} side={<View style={{ marginTop: siteWide ? 20 : 0 }}>
        <Card onPress={() => A.openSheet('people')} label="Pessoas da viagem" style={{ marginTop: 14 }}>
          <Row style={{ padding: 14 }}>
            <Row gap={-8}>{members.slice(0, 4).map((m, i) => <View key={m.id} style={{ marginLeft: i ? -10 : 0, borderWidth: 2, borderColor: c.card, borderRadius: 20 }}><Avatar size={34} letter={(m.id === 'me' ? (s.user && s.user.name) || '?' : m.name).charAt(0).toUpperCase()} /></View>)}</Row>
            <Grow><T v="lt">{members.length > 1 ? plural(members.length, 'pessoa', 'pessoas') + ' nesta viagem' : 'Só você nesta viagem'}</T><T v="smallMuted">{peopleSub}</T></Grow>
            <T v="small" color={c.acc} style={{ fontWeight: '700' }}>Pessoas</T>
          </Row>
        </Card>

        {fc ? (
          <>
            <Section title="Previsão do tempo" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8 }}>
              {Object.keys(fc).sort().map((d) => {
                const f = fc[d], dt = parseD(d), di = diffDays(parseD(t.start), dt);
                return (
                  <Card key={d} style={{ width: 92, padding: 10, alignItems: 'center', gap: 4 }} label={'Dia ' + (di + 1) + ': ' + f.label + ', máxima ' + f.hi + ' e mínima ' + f.lo + ' graus' + (f.rain != null ? ', ' + f.rain + '% de chance de chuva' : '')}>
                    <T v="smallMuted">{SEM[dt.getDay()] + ' ' + dt.getDate()}</T>
                    <Icon name={f.icon} size={26} color={c.acc} />
                    <T v="lt" style={{ fontSize: 15 }}>{f.hi + '° / ' + f.lo + '°'}</T>
                    <T v="smallMuted">{f.rain != null ? f.rain + '% chuva' : f.label}</T>
                  </Card>
                );
              })}
            </ScrollView>
            <T v="smallMuted" style={{ marginTop: 6 }}>Previsão Open-Meteo, atualizada a cada poucas horas.</T>
          </>
        ) : null}

        <Card style={{ marginTop: 14, overflow: 'hidden' }}>
          {multiLegs && legInfo.some((x) => x.cl) ? (
            <>
              <ListRow iconEl={<TileIcon name="cloudSun" />} title="Clima em cada parada" sub={legInfo.filter((x) => x.cl).map((x) => legName(x.L) + ' ' + x.cl!.hi + '°').join(' · ') + ' · o que levar'}
                right={<Icon name={wxOpen ? 'chevU' : 'chevD'} color={c.faint} />} onPress={() => setWx(!wxOpen)} />
              {wxOpen ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                  {legInfo.map((x, k) => (
                    <Row key={k} gap={10}>
                      <Icon name={x.cl ? x.cl.icon : 'cloudSun'} size={18} color={c.ink2} />
                      <Grow><T v="small" style={{ fontWeight: '700' }}>{legName(x.L) + ' · ' + fmtShort(x.a) + (x.b !== x.a ? ' a ' + fmtShort(x.b) : '')}</T><T v="smallMuted">{x.cl ? x.cl.hi + '° / ' + x.cl.lo + '° · ' + x.cl.feel.toLowerCase() + ' · ' + x.cl.rainLabel : 'Sem dados de clima para este lugar'}</T></Grow>
                    </Row>
                  ))}
                  {legTips.length ? <T v="kind" style={{ marginTop: 4 }}>O que levar</T> : null}
                  {legTips.map((tp) => <Row key={tp.text} gap={10}><Icon name={tp.icon} size={18} color={c.ink2} /><Grow><T v="small">{tp.text}</T></Grow></Row>)}
                  {legTips.length ? <Btn sm kind="secondary" disabled={!legTips.filter((x) => clItems.indexOf(x.text) < 0).length} label={legTips.filter((x) => clItems.indexOf(x.text) < 0).length ? 'Adicionar à lista de preparação' : 'Dicas já estão na sua lista de preparação'} onPress={() => A.addClimateTips(legTips.filter((x) => clItems.indexOf(x.text) < 0).map((x) => x.text))} /> : null}
                  <T v="smallMuted">Média histórica de cada cidade no período em que vocês estarão lá.</T>
                </View>
              ) : null}
              <Line />
            </>
          ) : wc ? (
            <>
              <ListRow iconEl={<TileIcon name={wc.icon} />} title={wc.hi + '° / ' + wc.lo + '° em ' + wc.monthsLabel + ' · ' + wc.feel} sub={wc.rainLabel + ' · o que levar'}
                right={<Icon name={wxOpen ? 'chevU' : 'chevD'} color={c.faint} />} onPress={() => setWx(!wxOpen)} />
              {wxOpen ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
                  {wc.tips.map((tp) => <Row key={tp.text} gap={10}><Icon name={tp.icon} size={18} color={c.ink2} /><Grow><T v="small">{tp.text}</T></Grow></Row>)}
                  <Btn sm kind="secondary" disabled={!wxMissing.length} label={wxMissing.length ? 'Adicionar à lista de preparação' : 'Dicas já estão na sua lista de preparação'} onPress={() => A.addClimateTips(wxMissing.map((x) => x.text))} />
                  <T v="smallMuted">{'Média histórica (' + wc.src + '). ' + (daysTo > 16 ? 'A previsão real fica disponível a partir de ' + fmtShort(iso(addDays(parseD(t.start), -16))) + ', 16 dias antes da viagem.' : daysTo >= 0 ? 'A previsão de cada dia aparece acima quando houver internet.' : '')}</T>
                </View>
              ) : null}
              <Line />
            </>
          ) : null}
          {dishCities.length ? (
            <>
              <ListRow iconEl={<TileIcon name="fork" />} title="Pratos típicos" sub={done.length + ' de ' + dishTotal + ' provados'} right={<Icon name={dishOpen ? 'chevU' : 'chevD'} color={c.faint} />} onPress={() => setDish(!dishOpen)} />
              {dishOpen ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
                  {dishCities.map((city) => (
                    <View key={city} style={{ gap: 8 }}>
                      {dishCities.length > 1 ? <T v="kind">{destName(city)}</T> : null}
                      {DISHES[city].map((d, i) => {
                        const key = city + ':' + i, ok = done.indexOf(key) >= 0, col = coverOf(city).color;
                        return (
                          <Row key={key} top gap={10}>
                            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tint(col, 0.86), alignItems: 'center', justifyContent: 'center' }}><Icon name="fork" size={17} color={col} /></View>
                            <Grow><T v="lt" style={{ fontSize: 15 }}>{d[0]}</T><T v="smallMuted">{d[1]}</T></Grow>
                            <Btn sm kind={ok ? 'added' : 'secondary'} icon={ok ? 'check' : 'plus'} label={ok ? 'Provado' : 'Provar'} onPress={() => A.toggleDish(key)} />
                          </Row>
                        );
                      })}
                    </View>
                  ))}
                </View>
              ) : null}
              <Line />
            </>
          ) : null}
          <ListRow iconEl={<TileIcon name="heart" />} title="Lugares salvos" sub={v.savedLabel + ' neste destino'} chevron onPress={() => A.go('saved')} />
          <Line />
          {multiLegs ? legInfo.map((x, k) => (
            <View key={'h' + k}>
              {k ? <Line /> : null}
              <ListRow iconEl={<TileIcon name="bed" />} title={'Hotéis em ' + legName(x.L)} sub={fmtShort(x.a) + ' a ' + fmtShort(x.co) + ' · ' + plural(t.travelers, 'adulto', 'adultos') + ' · link de parceiro'} chevron onPress={() => Linking.openURL(x.url).catch(() => {})} />
            </View>
          )) : <ListRow iconEl={<TileIcon name="bed" />} title={'Hotéis em ' + firstCity} sub={periodShort(t) + ' · ' + plural(t.travelers, 'adulto', 'adultos') + ' · link de parceiro'} chevron onPress={() => Linking.openURL(hotelUrl).catch(() => {})} />}
        </Card>
        <T v="smallMuted" center style={{ marginTop: 10 }}>Links de parceiros: o Destí pode receber comissão, sem custo a mais para você.</T>
        </View>} />
        <Gap h={site ? 32 : 110} />
      </View>
    </Screen>
  );
}
function Line() { const { c } = useTheme(); return <View style={{ height: 1, backgroundColor: c.line }} />; }
function Tile({ icon, title, sub, pct, over, onPress }: { icon: string; title: string; sub: string; pct?: number; over?: boolean; onPress: () => void }) {
  return (
    <Card onPress={onPress} label={title} style={{ width: '48%', flexGrow: 1, padding: 14, gap: 6 }}>
      <TileIcon name={icon} size={34} />
      <T v="lt">{title}</T>
      <T v="smallMuted" lines={2}>{sub}</T>
      {pct != null ? <Bar pct={pct} over={over} height={6} /> : null}
    </Card>
  );
}
function TopOverlay({ right, title }: { right?: React.ReactNode; title?: string }) {
  const ins = useSafeAreaInsets();
  return (
    <Row between style={{ position: 'absolute', left: 16, right: 16, top: ins.top + 8 }}>
      <IconBtn icon="chevL" glass label="Voltar" onPress={A.back} />
      {title ? <T v="title" color="#FFFFFF">{title}</T> : null}
      {right}
    </Row>
  );
}

/* ====================== Roteiro dia a dia ====================== */
export function Itinerary() {
  const s = useApp();
  const { c, isDark: isDarkTheme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [transitOpen, setTransitOpen] = useState<string | null>(null);
  const [suggest, setSuggest] = useState<Style | null | false>(false);
  const [regenSel, setRegenSel] = useState<number[]>([]);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const site = useSite();
  const siteWide = useSiteWide();
  const pad = usePad();
  const t = A.currentTrip();
  const fc = useForecast(t);
  /* arrastar uma atividade até outro dia (solta em cima do dia, na faixa de dias do topo) */
  const rootRef = useRef<any>(null);
  const chipRefs = useRef<any[]>([]);
  const zones = useRef<{ i: number; x: number; y: number; w: number; h: number }[]>([]);
  const origin = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ id: string; label: string; x: number; y: number; over: number | null } | null>(null);
  const [drag, setDragState] = useState<{ id: string; label: string; x: number; y: number; over: number | null } | null>(null);
  const setDrag = (d: typeof drag) => { dragRef.current = d; setDragState(d); };
  if (!t) return <Screen><NoTrip /></Screen>;
  const dayIdx = Math.min(s.day, t.days.length - 1);
  const start = parseD(t.start), dDate = addDays(start, dayIdx), dayISO = iso(dDate);
  const dayItems = t.days[dayIdx] || [];
  const shown = editing ? dayItems : sortItems(dayItems);
  const tripStyles = (t.styles && t.styles.length ? t.styles : ['Cultural']) as Style[];
  const used: Record<string, number> = {};
  t.days.forEach((d) => d.forEach((x) => { if (x.placeId) used[x.placeId] = 1; }));
  const city = cityOfDay(t, dayIdx);
  const dayRes = s.reservations.filter((r) => r.tripId === t.id && r.date === dayISO).sort((a, b) => ((a.time || '00:00') < (b.time || '00:00') ? -1 : 1));
  const v = tripInfo(t, s);
  const pick = (i: number) => { setSwapFor(null); setMoveFor(null); setState({ day: i }); };
  const measureWin = (ref: any, cb: (x: number, y: number, w: number, h: number) => void) => {
    if (!ref) return;
    if (typeof ref.measureInWindow === 'function') ref.measureInWindow(cb);
    else if (typeof ref.getBoundingClientRect === 'function') { const r = ref.getBoundingClientRect(); cb(r.left, r.top, r.width, r.height); }
  };
  const overDay = (x: number, y: number) => { const z = zones.current.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y - 12 && y <= r.y + r.h + 12); return z ? z.i : null; };
  const dragger = (item: ItineraryItem) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (_e: any, g: any) => {
      zones.current = [];
      measureWin(rootRef.current, (x, y) => { origin.current = { x, y }; });
      chipRefs.current.forEach((r, i) => measureWin(r, (x, y, w, h) => { zones.current.push({ i, x, y, w, h }); }));
      setDrag({ id: item.id, label: itemName(item), x: g.x0, y: g.y0, over: null });
    },
    onPanResponderMove: (_e: any, g: any) => {
      if (!dragRef.current) return;
      setDrag({ ...dragRef.current, x: g.moveX, y: g.moveY, over: overDay(g.moveX, g.moveY) });
    },
    onPanResponderRelease: () => {
      const d = dragRef.current;
      setDrag(null);
      if (d && d.over !== null && d.over !== dayIdx) A.moveToDay(d.id, d.over);
      else if (d && d.over === null) A.showToast('Solte em cima de um dos dias no topo da tela');
    },
    onPanResponderTerminate: () => setDrag(null)
  });
  const grip = (item: ItineraryItem) => (
    <View {...dragger(item).panHandlers} accessibilityLabel={'Arrastar ' + itemName(item) + ' para outro dia'}
      style={[{ width: 34, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }, Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null]}>
      <Icon name="grip" size={18} color={c.faint} strokeWidth={3} />
    </View>
  );
  const prevPlace = (k: number) => { for (let j = k - 1; j >= 0; j--) if (shown[j].kind === 'place' && shown[j].placeId) return PLACE_BY_ID[shown[j].placeId!]; return null; };

  /* deslocamentos entre lugares seguidos */
  let walk = 0, ride = 0, legsN = 0;
  const rows: React.ReactNode[] = [];
  shown.forEach((x, k) => {
    const prev = shown[k - 1];
    if (!editing && x.kind === 'place' && prev && prev.kind === 'place' && x.placeId && prev.placeId && PLACE_BY_ID[x.placeId] && PLACE_BY_ID[prev.placeId]) {
      const a = PLACE_BY_ID[prev.placeId], b = PLACE_BY_ID[x.placeId], lg = transitLeg(city, a, b), key = prev.id + '>' + x.id;
      if (lg.mode === 'walk') walk += lg.minutes; else if (lg.mode !== 'far') ride += lg.minutes;
      legsN++;
      const open = transitOpen === key;
      rows.push(
        <View key={key} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={{ width: 50 }} />
          <View style={{ width: 2, backgroundColor: c.line2, marginHorizontal: 5, borderStyle: 'dashed' }} />
          <Grow>
            <Pressable accessibilityRole="button" accessibilityLabel={lg.label + ', ' + lg.time + '. Ver como ir'} onPress={() => setTransitOpen(open ? null : key)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: c.soft, alignSelf: 'flex-start' }}>
              <Icon name={lg.icon} size={15} color={c.ink2} /><T v="small" color={c.ink2} style={{ fontWeight: '600' }}>{lg.label}</T><T v="smallMuted">{lg.time}</T>
              <Icon name={open ? 'chevU' : 'chevD'} size={14} color={c.faint} />
            </Pressable>
            {open ? (
              <Card flat style={{ marginTop: 6, padding: 12, gap: 6 }}>
                <T v="small" style={{ fontWeight: '700' }}>{a.name + ' → ' + b.name + ' · ' + lg.kmLabel}</T>
                {lg.steps.map((st, i) => <T key={i} v="small">{(i + 1) + '. ' + st}</T>)}
                {lg.mode === 'transit' ? <T v="small"><T v="small" style={{ fontWeight: '700' }}>Pagamento: </T>{lg.info.card}</T> : null}
                {lg.info.tip ? <T v="smallMuted">{lg.info.tip}</T> : null}
                {!a.demo && !b.demo ? <LinkBtn label="Ver rota no Google Maps" onPress={() => Linking.openURL(lg.mapsUrl).catch(() => {})} /> : null}
                <T v="smallMuted">Tempo estimado pela distância. Linhas e horários exatos: veja a rota no mapa.</T>
              </Card>
            ) : null}
          </Grow>
        </View>
      );
    }
    rows.push(<React.Fragment key={x.id}>{renderItem(x, k)}</React.Fragment>);
  });
  const fmtMin = (m: number) => (m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min');
  const transitSummary = legsN ? 'Deslocamentos estimados: ' + [ride ? fmtMin(ride) + ' de transporte' : '', walk ? fmtMin(walk) + ' a pé' : ''].filter(Boolean).join(' e ') : '';

  function renderItem(x: ItineraryItem, k: number) {
    const p = x.kind === 'place' && x.placeId ? PLACE_BY_ID[x.placeId] : null;
    if (editing) {
      return (
        <Card flat style={{ padding: 12, marginBottom: 8, gap: 10 }}>
          <View>
            <T v="lt" style={{ fontSize: 15 }} lines={2}>{itemName(x)}</T>
            <T v="smallMuted">{p ? CAT_INFO[p.cat].label : x.kind === 'move' ? 'Deslocamento' : 'Anotação'}</T>
          </View>
          <Row gap={6}>
            <TimeStepper label={'Horário de ' + itemName(x)} value={x.time} onChange={(v) => A.setItemTime(x.id, v)} />
            <Grow />
            <IconBtn icon="calendar" flat size={38} label={'Mover ' + itemName(x) + ' para outro dia'} onPress={() => setMoveFor(moveFor === x.id ? null : x.id)} />
            <IconBtn icon="arrowUp" flat size={38} label="Subir" onPress={() => k > 0 && A.moveItem(x.id, -1)} />
            <IconBtn icon="arrowDown" flat size={38} label="Descer" onPress={() => k < shown.length - 1 && A.moveItem(x.id, 1)} />
            <IconBtn icon="trash" flat size={38} label={'Remover ' + itemName(x)} onPress={() => A.removeItem(x.id)} />
          </Row>
          {moveFor === x.id ? <View><T v="small" style={{ fontWeight: '700', marginBottom: 6 }}>Mover para</T><Chips>{t!.days.map((_, i) => i).filter((i) => i !== dayIdx).map((i) => <Chip key={i} label={'Dia ' + (i + 1)} onPress={() => { A.moveToDay(x.id, i); setMoveFor(null); }} />)}</Chips></View> : null}
        </Card>
      );
    }
    const closedNow = p && p.closed && p.closed.indexOf(dDate.getDay()) >= 0;
    const swapOpen = !!p && swapFor === x.id;
    const alts = swapOpen ? rankCandidates(city, tripStyles, slotOfTime(x.time), used, prevPlace(k)).slice(0, 3) : [];
    return (
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
        <T v="small" style={{ width: 50, fontWeight: '700', paddingTop: p ? 18 : 10 }}>{x.time}</T>
        <View style={{ width: 12, alignItems: 'center', paddingTop: p ? 22 : 14 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p ? c.accBg : 'transparent', borderWidth: 2, borderColor: p ? c.accBg : c.line3 }} />
        </View>
        <Grow>
          {p ? (
            <>
              <Card>
                <Row gap={0}>
                  <Pressable accessibilityRole="button" accessibilityLabel={p.name} onPress={() => A.openPlace(p.id)} style={{ flex: 1, flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}>
                    <PlaceThumb place={p} size={48} />
                    <Grow>
                      <T v="kind">{CAT_INFO[p.cat].label}</T>
                      <T v="lt" lines={2}>{p.name}</T>
                      <T v="smallMuted" lines={1}>{p.area + ' · ' + p.dur}</T>
                      {p.book ? <T v="small" color={c.noteText} style={{ fontWeight: '700', marginTop: 2 }}>Reserve antes</T> : null}
                    </Grow>
                  </Pressable>
                  <IconBtn icon="refresh" flat size={40} label={'Trocar ' + p.name} onPress={() => setSwapFor(swapOpen ? null : x.id)} />
                  {t!.days.length > 1 ? grip(x) : <View style={{ width: 8 }} />}
                </Row>
                {closedNow ? <Note kind="err" style={{ marginHorizontal: 12, marginBottom: 12 }}>{'Fecha às ' + DOW_PLURAL[dDate.getDay()] + ': troque o lugar ou mude de dia'}</Note> : null}
              </Card>
              {swapOpen ? (
                <Card flat style={{ marginTop: 6, padding: 10, gap: 6 }}>
                  <T v="kind">Trocar por</T>
                  {alts.map((a) => (
                    <Row key={a.p.id}>
                      <PlaceThumb place={a.p} size={40} />
                      <Grow><T v="small" style={{ fontWeight: '700' }}>{a.p.name}</T><T v="smallMuted">{CAT_INFO[a.p.cat].label + ' · ' + a.p.area}</T></Grow>
                      <Btn sm kind="secondary" label="Usar" onPress={() => { A.swapPlace(x.id, a.p.id); setSwapFor(null); }} />
                    </Row>
                  ))}
                  {!alts.length ? <T v="smallMuted">Não há outras opções no catálogo para este horário.</T> : null}
                </Card>
              ) : null}
            </>
          ) : (
            <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: x.kind === 'note' ? c.noteBg : c.soft, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Icon name={x.kind === 'move' ? 'route' : 'info'} size={16} color={x.kind === 'note' ? c.noteText : c.ink2} />
              <Grow><T v="small" color={x.kind === 'note' ? c.noteText : c.ink2}>{x.text || ''}</T></Grow>
              {t!.days.length > 1 ? grip(x) : null}
            </View>
          )}
        </Grow>
      </View>
    );
  }

  const regenLabel = regenSel.length ? 'Montar ' + (regenSel.length === 1 ? 'o Dia ' + (regenSel[0] + 1) : plural(regenSel.length, 'dia', 'dias')) + ' de novo' : 'Gerar roteiro completo';
  const catalogOk = tripLegs(t).some((l) => hasCatalog(l.destId));
  return (
    <View ref={rootRef} style={{ flex: 1 }}>
    <Screen>
      <TopBar title={'Roteiro · ' + t.name} onBack={A.back} right={<IconBtn icon="map" label="Mapa" onPress={() => A.go('map')} />} />
      <Cols main={<>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8 }}>
        {t.days.map((d, i) => {
          const dt = addDays(start, i), on = i === dayIdx;
          return (
            <View key={i} ref={(r: any) => { chipRefs.current[i] = r; }}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={'Dia ' + (i + 1) + ', ' + SEM_LONGO[dt.getDay()] + ' ' + dt.getDate()} onPress={() => pick(i)}
              style={{ width: 58, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: drag && drag.over === i && i !== dayIdx ? c.accTint : on ? c.ink : c.card, borderWidth: drag && drag.over === i && i !== dayIdx ? 2 : 1, borderColor: drag && drag.over === i && i !== dayIdx ? c.accBg : on ? c.ink : c.line2 }}>
              <T v="smallMuted" color={on ? c.onInk : undefined}>{SEM[dt.getDay()]}</T>
              <T v="h2" color={on ? c.onInk : undefined}>{String(dt.getDate())}</T>
              <T v="smallMuted" color={on ? c.onInk : undefined} style={{ fontSize: 11 }}>{'Dia ' + (i + 1)}</T>
              <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: d.length ? (on ? c.onInk : c.accBg) : 'transparent' }} />
            </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Row between style={{ marginTop: 18, marginBottom: 12 }}>
        <Grow><Row gap={8}><T v="h2">{'Dia ' + (dayIdx + 1)}</T>{fc && fc[dayISO] ? <Row gap={4} style={{ backgroundColor: c.soft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}><Icon name={fc[dayISO].icon} size={15} color={c.ink2} /><T v="small" color={c.ink2} style={{ fontWeight: '600' }}>{fc[dayISO].hi + '°/' + fc[dayISO].lo + '°' + (fc[dayISO].rain != null && fc[dayISO].rain! >= 30 ? ' · ' + fc[dayISO].rain + '% chuva' : '')}</T></Row> : null}</Row><T v="smallMuted">{SEM_LONGO[dDate.getDay()] + ', ' + dDate.getDate() + ' de ' + MES_LONGO[dDate.getMonth()] + (isMultiCity(t) ? ' · ' + legNameOfDay(t, dayIdx) : '') + ' · ' + (dayItems.length ? plural(dayItems.length, 'item', 'itens') : 'sem itens')}</T></Grow>
        {dayItems.length || editing ? <Btn sm kind={editing ? 'primary' : 'secondary'} label={editing ? 'Concluir' : 'Editar dia'} onPress={() => { if (editing) A.showToast('Dia ordenado por horário'); setEditing(!editing); setSwapFor(null); }} /> : null}
      </Row>
      {(() => { const L = legOfDay(t, dayIdx); if (!(L.k > 0 && L.i === 0)) return null; const prev = tripLegs(t)[L.k - 1]; return <IntercityCard fromId={prev.destId} toId={L.leg.destId} style={{ marginBottom: 14 }} />; })()}
      {dayRes.length ? (
        <View style={{ gap: 6, marginBottom: 12 }}>
          {dayRes.map((r) => (
            <Pressable key={r.id} accessibilityRole="button" onPress={() => A.go('docs', { sheetArg: 'reservas' })} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: c.accTint, borderRadius: 10, padding: 10 }}>
              <Icon name={(RES_TYPES.find((x) => x.id === r.type) || RES_TYPES[0]).icon} size={16} color={c.accText} />
              <T v="small" color={c.accText} style={{ fontWeight: '600' }}>{(r.time || 'Dia todo') + ' · ' + r.title}</T>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!dayItems.length ? <Empty icon="calendar" title="Nenhuma atividade neste dia" text="Adicione lugares do catálogo ou peça uma sugestão." /> : null}
      {transitSummary && !editing ? <Row gap={6} style={{ marginBottom: 12 }}><Icon name="route" size={15} color={c.muted} /><Grow><T v="smallMuted">{transitSummary + ' · toque num trecho para ver como ir'}</T></Grow></Row> : null}
      {t.days.length > 1 && dayItems.length && !editing ? <Row gap={6} style={{ marginBottom: 12, marginTop: transitSummary ? -6 : 0 }}><Icon name="grip" size={15} color={c.muted} strokeWidth={3} /><Grow><T v="smallMuted">Para mudar uma atividade de dia, segure no ⠿ e arraste até o dia no topo.</T></Grow></Row> : null}
      {rows}
      {editing ? <T v="smallMuted" style={{ marginBottom: 10 }}>Use − e + para mudar o horário. As setas trocam a posição de dois itens vizinhos; o calendário leva o item a outro dia. Ao concluir, o dia é ordenado por horário.</T> : null}

      {suggest !== false ? (
        <Card style={{ padding: 16, gap: 10, marginTop: 6 }}>
          <T v="lt">{'Sugerir o Dia ' + (dayIdx + 1)}</T>
          <T v="smallMuted">Escolha o estilo deste dia. Usamos lugares ainda não incluídos nos outros dias.</T>
          <Chips>{STYLES.map((st) => <Chip key={st} label={st} icon={STYLE_INFO[st].icon} on={suggest === st} onPress={() => setSuggest(st)} />)}</Chips>
          {dayItems.length ? <Note kind="note">Os itens atuais deste dia serão substituídos. Você pode desfazer logo depois.</Note> : null}
          <Row gap={10}>
            <Btn grow kind="secondary" label="Cancelar" onPress={() => setSuggest(false)} />
            <Btn grow label="Montar dia" disabled={!suggest} onPress={() => { if (suggest) { A.suggestDay(suggest); setSuggest(false); } }} />
          </Row>
        </Card>
      ) : null}

      <Row gap={10} style={{ marginTop: 12 }}>
        <Btn grow icon="plus" label="Adicionar" onPress={() => A.go('addPlace')} />
        <Btn grow kind="secondary" icon="sparkle" label="Sugerir dia" onPress={() => { setSuggest(suggest === false ? (tripStyles[0] as Style) : false); setEditing(false); }} />
      </Row>
      <Row gap={10} style={{ marginTop: 10 }}>
        <Btn grow kind="secondary" sm icon="route" label="Deslocamento" onPress={() => A.addMove()} />
        <Btn grow kind="secondary" sm icon="refresh" label="Reorganizar" onPress={() => A.go('assistant')} />
      </Row>

      </>} side={<>
      <Card style={{ padding: 16, gap: 10, marginTop: siteWide ? 0 : 22 }}>
        <Row><TileIcon name={STYLE_INFO[tripStyles[0]].icon} /><Grow><T v="lt">Roteiro por estilo</T><T v="smallMuted">{v.style + ' · ritmo ' + v.paceLabel + ' · ' + v.n + ' dias'}</T></Grow></Row>
        <T v="small" style={{ fontWeight: '700' }}>Quais dias montar?</T>
        <Chips>
          <Chip label="Todos os dias" on={!regenSel.length} onPress={() => setRegenSel([])} />
          {t.days.map((_, i) => <Chip key={i} label={'Dia ' + (i + 1)} on={regenSel.indexOf(i) >= 0} onPress={() => setRegenSel(regenSel.indexOf(i) >= 0 ? regenSel.filter((x) => x !== i) : regenSel.concat([i]))} />)}
        </Chips>
        <T v="smallMuted">{!catalogOk ? 'Roteiro automático ainda não disponível para este destino.' : regenSel.length ? 'Só os dias marcados mudam; os outros ficam como estão. Dá para desfazer.' : 'Monta todos os dias a partir do estilo e do ritmo. Substitui o roteiro atual, e dá para desfazer.'}</T>
        <Btn kind="secondary" label={regenLabel} disabled={!catalogOk} onPress={() => { A.regenTrip(null, regenSel); setRegenSel([]); }} />
      </Card>
      <Card style={{ padding: 16, marginTop: 12 }}>
        <Row top>
          <TileIcon name="sparkle" />
          <Grow style={{ gap: 6 }}>
            <T v="lt">Assistente de viagem</T>
            <T v="smallMuted">Peça sugestões para um dia livre ou reorganize o roteiro.</T>
            <View style={{ alignSelf: 'flex-start' }}><Btn sm label="Abrir assistente" onPress={() => A.go('assistant')} /></View>
          </Grow>
        </Row>
      </Card>
      </>} />
    </Screen>
    {drag ? (
      <>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', paddingTop: 8 }}>
          <View style={{ backgroundColor: c.ink, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
            <T v="small" color={c.onInk} style={{ fontWeight: '700' }}>{drag.over !== null && drag.over !== dayIdx ? 'Solte para mover para o Dia ' + (drag.over + 1) : 'Arraste até um dos dias no topo'}</T>
          </View>
        </View>
        <View pointerEvents="none" style={[{ position: 'absolute', left: drag.x - origin.current.x - 24, top: drag.y - origin.current.y - 22, maxWidth: 260, backgroundColor: c.card, borderRadius: 14, borderWidth: 2, borderColor: drag.over !== null && drag.over !== dayIdx ? c.accBg : c.line2, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8, alignItems: 'center', opacity: 0.96 }, shadowStyle(isDarkTheme)]}>
          <Icon name="grip" size={16} color={c.muted} strokeWidth={3} />
          <T v="small" style={{ fontWeight: '700' }} lines={1}>{drag.label}</T>
        </View>
      </>
    ) : null}
    </View>
  );
}

/* ====================== Adicionar lugar ====================== */
export function AddPlace() {
  const s = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todos');
  const t = A.currentTrip();
  if (!t) return <Screen><NoTrip /></Screen>;
  const dayIdx = Math.min(s.day, t.days.length - 1);
  const cityPlaces = placesForCity(cityOfDay(t, dayIdx));
  const catalog = cityPlaces.length ? cityPlaces : PLACES;
  const nq = norm(q);
  const list = catalog.filter((p) => (cat === 'todos' || p.cat === cat) && (!nq || norm(p.name + ' ' + p.area + ' ' + p.city).indexOf(nq) >= 0));
  const inDay = (id: string) => (t.days[dayIdx] || []).some((x) => x.placeId === id);
  const setDay = (i: number) => setState({ day: i });
  return (
    <Screen>
      <TopBar title="Adicionar lugar" onBack={A.back} />
      <T v="small" style={{ fontWeight: '700', marginBottom: 8 }}>Adicionar ao</T>
      <Chips scroll>{t.days.map((_, i) => <Chip key={i} label={'Dia ' + (i + 1)} on={i === dayIdx} onPress={() => setDay(i)} />)}</Chips>
      <Gap h={14} />
      <Input value={q} onChangeText={setQ} icon="search" placeholder="Buscar lugar ou bairro" caps="none" />
      <Gap h={12} />
      <Chips scroll>{CATEGORIES.map((k) => <Chip key={k.id} label={k.label} on={cat === k.id} onPress={() => setCat(k.id)} />)}</Chips>
      <Gap h={14} />
      {!cityPlaces.length ? <Note kind="info" style={{ marginBottom: 12 }}>{'Ainda não temos lugares de ' + legNameOfDay(t, dayIdx) + ' no catálogo. Mostrando outros destinos como referência.'}</Note> : null}
      {list.map((p) => (
        <PlaceCard key={p.id} p={p} s={s} right={inDay(p.id) ? <Btn sm kind="added" icon="check" label="No dia" onPress={() => A.showToast('Já está no Dia ' + (dayIdx + 1))} /> : <Btn sm icon="plus" label="Adicionar" onPress={() => A.addPlaceToDay(p.id, dayIdx)} />} />
      ))}
      {!list.length ? <Empty icon="search" title="Nenhum lugar encontrado" action="Limpar filtros" onAction={() => { setQ(''); setCat('todos'); }} /> : null}
    </Screen>
  );
}

/* ====================== Mapa ====================== */
export function MapScreen() {
  const s = useApp();
  const { c } = useTheme();
  const [mapDay, setMapDay] = useState<number | 'all'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const site = useSite();
  const siteWide = useSiteWide();
  const pad = usePad();
  const t = A.currentTrip();
  if (!t) return <Screen><NoTrip /></Screen>;
  const multi = isMultiCity(t);
  const ref = typeof mapDay === 'number' ? mapDay : Math.min(s.day, t.days.length - 1);
  const mapCity = cityOfDay(t, ref);
  const planned: { p: typeof PLACES[number]; di: number; time: string; key: string }[] = [];
  t.days.forEach((d, di) => sortItems(d).forEach((x) => {
    if (x.kind === 'place' && x.placeId && PLACE_BY_ID[x.placeId] && (mapDay === 'all' ? !multi || cityOfDay(t, di) === mapCity : mapDay === di)) planned.push({ p: PLACE_BY_ID[x.placeId], di, time: x.time, key: x.id });
  }));
  const selected = planned.find((x) => x.key === sel);
  const filters: { label: string; val: number | 'all' }[] = ([{ label: multi ? 'Todos em ' + legNameOfDay(t, ref) : 'Todos os dias', val: 'all' }] as { label: string; val: number | 'all' }[])
    .concat(t.days.map((_, i) => ({ label: 'Dia ' + (i + 1), val: i as number | 'all' })).filter((f) => !multi || cityOfDay(t, f.val as number) === mapCity));
  const col = coverOf(mapCity).color;
  const items = planned.map((x, i) => ({ ...x, n: i + 1 }));
  return (
    <Screen>
      <TopBar title={'Mapa · ' + (multi ? legNameOfDay(t, ref) : t.name)} onBack={A.back} />
      <Chips scroll>{filters.map((f) => <Chip key={String(f.val)} label={f.label} on={mapDay === f.val} onPress={() => { setMapDay(f.val); setSel(null); }} />)}</Chips>
      <Gap h={12} />
      <Cols ratio={1.6} main={<>
      <PlacesMap items={items} sel={sel} onSelect={setSel} color={col} />
      {selected ? (
        <Card style={{ marginTop: 12 }}>
          <Row style={{ padding: 12 }}>
            <PlaceThumb place={selected.p} />
            <Grow><T v="lt">{selected.p.name}</T><T v="smallMuted">{selected.p.area + ' · Dia ' + (selected.di + 1) + ' · ' + selected.time}</T></Grow>
            <Btn sm kind="secondary" label="Ver" onPress={() => A.openPlace(selected.p.id)} />
          </Row>
          {!selected.p.demo ? <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}><Btn sm kind="secondary" icon="route" label="Como chegar" onPress={() => Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(selected.p.name + ', ' + (CITY_NAME[selected.p.city] || ''))).catch(() => {})} /></View> : null}
        </Card>
      ) : null}
      </>} side={planned.length ? (
        <>
          <Section title={plural(planned.length, 'lugar', 'lugares')} style={siteWide ? { marginTop: 0 } : undefined} />
          <List>
            {planned.map((x, i) => (
              <ListRow key={x.key} iconEl={<View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: x.key === sel ? c.over : c.ink, alignItems: 'center', justifyContent: 'center' }}><T v="small" color={c.onInk} style={{ fontWeight: '700' }}>{String(i + 1)}</T></View>}
                title={x.p.name} sub={x.p.area + ' · Dia ' + (x.di + 1) + ' · ' + x.time} onPress={() => setSel(x.key)} />
            ))}
          </List>
        </>
      ) : null} />
    </Screen>
  );
}

/* ====================== Lugar ====================== */
export function PlaceScreen() {
  const s = useApp();
  const { c } = useTheme();
  const [picking, setPicking] = useState(false);
  const placeSite = useSite();
  const placeWide = useSiteWide();
  const placePad = usePad();
  const P = PLACE_BY_ID[s.placeId || ''] || PLACES[0];
  const t = A.currentTrip();
  const saved = s.saved.indexOf(P.id) >= 0;
  const sched: string[] = [];
  if (t) t.days.forEach((d, di) => d.forEach((x) => { if (x.placeId === P.id) sched.push('Dia ' + (di + 1) + ' · ' + x.time); }));
  const legHas = t ? tripLegs(t).some((l) => l.destId === P.city) : false;
  const canAdd = !!t && (legHas || !tripLegs(t).some((l) => hasCatalog(l.destId)));
  const days = t ? t.days.map((_, i) => i).filter((i) => !legHas || cityOfDay(t, i) === P.city) : [];
  const plDay = days.indexOf(s.day) >= 0 ? s.day : days[0] || 0;
  const look = placeLook(P);
  const ticket = !P.demo && ['atracao', 'museu', 'experiencia', 'esporte', 'mirante', 'natureza'].indexOf(P.cat) >= 0;
  const cityName = CITY_NAME[P.city] || P.city;
  return (
    <Screen flush>
      <Cover destId={P.city} height={250} artW={200} artTop={60} artRight={10}>
        <TopOverlay right={<IconBtn icon="heart" glass on={saved} label={saved ? 'Remover dos salvos' : 'Salvar lugar'} onPress={() => A.toggleSave(P.id)} />} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 22 }}>
          <View style={{ maxWidth: placeSite ? SITE_MAX : 800, width: '100%', alignSelf: 'center', paddingHorizontal: placePad }}>
            <Row gap={8}><Icon name={look.icon} size={16} color="#FFFFFF" /><T v="kind" color="#FFFFFF">{CAT_INFO[P.cat].label}</T></Row>
            <T v="h1" color="#FFFFFF">{P.name}</T>
            <T v="body" color="rgba(255,255,255,0.9)">{P.area + ' · ' + cityName}</T>
          </View>
        </View>
      </Cover>
      <View style={{ paddingVertical: 20, paddingHorizontal: placePad, maxWidth: placeSite ? SITE_MAX : 800, width: '100%', alignSelf: 'center' }}>
        <Cols main={<>
        {P.demo ? <Note kind="info" style={{ marginBottom: 12 }}>Sugestão genérica: escolha o lugar exato na hora, perto de onde você estiver.</Note> : null}
        <T v="body">{P.desc}</T>
        <Gap h={14} />
        <Row gap={10}>
          {[['Duração', P.dur], ['Custo', P.cost], ['Melhor hora', P.best || '—']].map((x) => (
            <View key={x[0]} style={{ flex: 1, backgroundColor: c.soft, borderRadius: 12, padding: 10 }}><T v="smallMuted">{x[0]}</T><T v="lt" style={{ fontSize: 15 }}>{x[1]}</T></View>
          ))}
        </Row>
        <Gap h={12} />
        {P.lat || P.closed ? <Row gap={8} style={{ marginBottom: 6 }}><Icon name="calendar" size={16} color={c.muted} /><T v="smallMuted">{P.closed ? 'Fecha às ' + P.closed.map((d) => DOW_PLURAL[d]).join(' e ') : 'Abre todos os dias (confira feriados)'}</T></Row> : null}
        {P.book ? <Row gap={8} style={{ marginBottom: 6 }}><Icon name="ticket" size={16} color={c.noteText} /><T v="small" color={c.noteText} style={{ fontWeight: '600' }}>Costuma lotar: reserve antes</T></Row> : null}
        {P.styles.length ? <Row gap={8} style={{ marginBottom: 6 }}><Icon name="sparkle" size={16} color={c.muted} /><T v="smallMuted">{'Combina com: ' + P.styles.join(', ')}</T></Row> : null}
        {sched.length && t ? <Note kind="info" style={{ marginTop: 8 }}>{'No roteiro: ' + sched.join(', ') + ' (' + t.name + ')'}</Note> : null}
        </>} side={<>
        <Gap h={placeWide ? 0 : 16} />
        {canAdd ? (
          picking ? (
            <Card style={{ padding: 14, gap: 10 }}>
              <T v="lt">Em qual dia?</T>
              <Chips>{days.map((i) => { const dt = addDays(parseD(t!.start), i); return <Chip key={i} label={'Dia ' + (i + 1) + ' · ' + dt.getDate() + ' ' + MES[dt.getMonth()]} on={i === plDay} onPress={() => setState({ day: i })} />; })}</Chips>
              <Row gap={10}>
                <Btn grow kind="secondary" label="Cancelar" onPress={() => setPicking(false)} />
                <Btn grow label={'Adicionar ao Dia ' + (plDay + 1)} onPress={() => { A.addPlaceToDay(P.id, plDay); setPicking(false); }} />
              </Row>
            </Card>
          ) : <Btn icon="plus" label="Adicionar ao roteiro" block onPress={() => setPicking(true)} />
        ) : (
          <Card flat style={{ padding: 14, gap: 8 }}>
            <T v="small">{t ? 'Este lugar fica em ' + cityName + ', fora das cidades da viagem atual.' : 'Crie uma viagem para adicionar lugares.'}</T>
            <Btn sm kind="secondary" label={'Planejar viagem para ' + cityName} onPress={() => A.go('create', { sheetArg: { destId: P.city } })} />
          </Card>
        )}
        <Gap h={10} />
        {!P.demo ? <Btn kind="secondary" icon="map" label="Abrir no app de mapas" block onPress={() => Linking.openURL('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(P.name + ', ' + cityName)).catch(() => {})} /> : null}
        {ticket ? (
          <>
            <Gap h={10} />
            <Btn kind="secondary" icon="ticket" label="Ingressos e passeios" block href={'https://www.getyourguide.com/s/?q=' + encodeURIComponent(P.name + ' ' + cityName) + (GETYOURGUIDE_PARTNER_ID ? '&partner_id=' + GETYOURGUIDE_PARTNER_ID : '')} />
            <T v="smallMuted" center style={{ marginTop: 6 }}>Link de parceiro: o Destí pode receber comissão.</T>
          </>
        ) : null}
        </>} />
        <Gap h={placeSite ? 24 : 100} />
      </View>
    </Screen>
  );
}

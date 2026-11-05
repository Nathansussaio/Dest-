/* Abas e telas gerais: Início, Viagens, Explorar, Salvos, Estilo, Avisos, Boas-vindas, Perfil */
import { cloudLastError } from '../lib/backend';
import React, { useState } from 'react';
import { View, ScrollView, Pressable, Linking } from 'react-native';
import { useApp, pickData, type State } from '../store/store';
import * as A from '../store/actions';
import {
  Logo, T, Row, Grow, Gap, Card, Btn, LinkBtn, IconBtn, Icon, Chip, Chips, Seg, Toggle, Input, Note, Avatar, TileIcon,
  Section, GroupLabel, ListRow, List, Empty, TopBar, Screen, Cover, Bar, PlaceThumb, Cols, Grid
} from '../ui';
import { useTheme, useWide, useSite, useSiteWide, useNarrow, usePad } from '../theme/useTheme';
import { isWeb } from '../theme/theme';
import { TripHero, TripRow, PlaceCard, DestCard, tripInfo } from './common';
import {
  DESTINATIONS, DEST_BY_ID, FEATURED, PLACES, CATEGORIES, CITY_NAME, STYLE_INFO, STYLES, SLOT_LABEL, hasCatalog,
  placesForCity, searchDest, PLACE_BY_ID
} from '../data';
import type { Style, Slot } from '../types';
import { tripStatus, periodLabel } from '../lib/trip';
import { alertsFor } from '../lib/alerts';
import { norm, plural, SEM_LONGO, MES_LONGO, cap, fmtShort, iso, today0 } from '../lib/format';
import { PRIVACY_URL, TERMS_URL, SUPPORT_EMAIL } from '../config';

const upcomingOf = (s: State) => s.trips.filter((t) => tripStatus(t).key === 'next').sort((a, b) => (a.start < b.start ? -1 : 1));
const pastOf = (s: State) => s.trips.filter((t) => tripStatus(t).key === 'past').sort((a, b) => (a.start > b.start ? -1 : 1));
const planDest = (destId: string) => A.go('create', { sheetArg: { destId } });

/* ---------- Início ---------- */
export function Home() {
  const s = useApp();
  const { c } = useTheme();
  const wide = useWide();
  const now = new Date(), h = now.getHours();
  const greeting = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const today = cap(SEM_LONGO[now.getDay()]) + ', ' + now.getDate() + ' de ' + MES_LONGO[now.getMonth()];
  const next = upcomingOf(s)[0], past = pastOf(s);
  const todayIso = iso(today0());
  const unread = alertsFor(pickData(s)).filter((a) => a.date <= todayIso && s.alertsRead.indexOf(a.id) < 0).length;
  const first = (s.user && s.user.name.split(' ')[0]) || '';
  const site = useSite();
  const siteWide = useSiteWide();
  const narrow = useNarrow();
  const pad = usePad();
  const dueAlerts = alertsFor(pickData(s)).filter((a) => a.date <= todayIso).slice(0, 4);
  const top = (
    <>
      {next ? (
        <>
          <TripHero t={next} s={s} height={siteWide ? 320 : 240} onPress={() => A.openTrip(next.id)} />
          <Row gap={10} style={{ marginTop: 14 }}>
            {[
              { label: 'Roteiro', icon: 'calendar', go: () => A.openTrip(next.id, 'itinerary') },
              { label: 'Mapa', icon: 'map', go: () => A.openTrip(next.id, 'map') },
              { label: 'Gastos', icon: 'receipt', go: () => A.tab('expenses', { tripId: next.id }) },
              { label: 'Reservas', icon: 'ticket', go: () => A.openTrip(next.id, 'docs') }
            ].map((q) => (
              <Card key={q.label} onPress={q.go} label={q.label} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, gap: 6 }}>
                <Icon name={q.icon} color={c.acc} />
                <T v="small" style={{ fontWeight: '600' }}>{q.label}</T>
              </Card>
            ))}
          </Row>
        </>
      ) : (
        <Card style={{ padding: 22, gap: 10 }}>
          <TileIcon name="suitcase" size={52} />
          <T v="h2">Para onde vamos?</T>
          <T v="muted">Escolha o destino e as datas. O Destí monta o roteiro dia a dia, divide o orçamento e lembra do que levar.</T>
          <Btn label="Planejar viagem" icon="plus" onPress={() => A.go('create')} />
        </Card>
      )}
      {next && !siteWide ? <View style={{ marginTop: 14 }}><Btn kind="secondary" icon="plus" label="Planejar outra viagem" onPress={() => A.go('create')} block /></View> : null}
    </>
  );
  /* coluna lateral do site: avisos de hoje */
  const side = (
    <View style={{ gap: 12 }}>
      <Row between><T v="title">Avisos</T>{dueAlerts.length ? <LinkBtn label="Ver todos" onPress={() => A.go('alerts')} /> : null}</Row>
      {dueAlerts.length ? (
        <List>
          {dueAlerts.map((a) => <ListRow key={a.id} iconEl={<TileIcon name={a.icon} />} title={a.title} sub={a.sub} onPress={() => A.openAlert(a)} />)}
        </List>
      ) : <Card style={{ padding: 18 }}><T v="smallMuted">Nenhum aviso agora. Lembretes de reservas, preparação e orçamento aparecem aqui.</T></Card>}
      {next ? <Btn kind="secondary" icon="plus" label="Planejar outra viagem" onPress={() => A.go('create')} block /> : null}
    </View>
  );
  return (
    <Screen>
      {wide || site ? null : <View style={{ marginBottom: 14 }}><Logo size={30} textSize={24} /></View>}
      <Row between style={{ marginBottom: 20 }}>
        <Grow>
          <T v="smallMuted">{today}</T>
          <T v="h1">{greeting + (first ? ', ' + first : '')}</T>
        </Grow>
        {site ? null : <IconBtn icon="bell" label={unread ? plural(unread, 'aviso novo', 'avisos novos') : 'Avisos'} badge={unread} onPress={() => A.go('alerts')} />}
        {site ? null : <Avatar letter={(first || '?').charAt(0).toUpperCase()} label="Perfil" onPress={() => A.tab('profile')} />}
      </Row>
      {siteWide ? <Cols main={top} side={side} /> : top}
      <Section title="Inspiração" action="Explorar" onAction={() => A.tab('explore')} />
      {site ? <Grid fullRows items={FEATURED} min={narrow ? 150 : 200} render={(id, w) => <DestCard d={DEST_BY_ID[id]} s={s} width={w} onPlan={() => planDest(id)} />} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 12 }}>
          {FEATURED.slice(0, 8).map((id) => <DestCard key={id} d={DEST_BY_ID[id]} s={s} width={150} onPlan={() => planDest(id)} />)}
        </ScrollView>
      )}
      <Section title="Viagens anteriores" action={past.length ? 'Ver todas' : undefined} onAction={() => A.tab('trips', { sheetArg: 'past' })} />
      {past.length ? <Grid items={past.slice(0, site ? 3 : 3)} min={340} render={(t) => <TripRow t={t} s={s} />} /> : <T v="muted">Suas viagens concluídas aparecem aqui.</T>}
    </Screen>
  );
}

/* ---------- Viagens ---------- */
export function Trips() {
  const s = useApp();
  const [tabId, setTab] = useState<'next' | 'past'>(s.sheetArg === 'past' ? 'past' : 'next');
  const up = upcomingOf(s), past = pastOf(s), list = tabId === 'next' ? up : past;
  return (
    <Screen>
      <TopBar large title="Viagens" right={<IconBtn icon="plus" accent label="Nova viagem" onPress={() => A.go('create')} />} />
      <Seg value={tabId} onChange={setTab} options={[{ id: 'next', label: 'Próximas (' + up.length + ')' }, { id: 'past', label: 'Anteriores (' + past.length + ')' }]} />
      <Gap h={16} />
      {list.length ? <Grid items={list} min={340} render={(t) => <TripRow t={t} s={s} />} /> : (
        <Empty icon="suitcase" title={tabId === 'next' ? 'Nenhuma viagem marcada' : 'Nenhuma viagem anterior'}
          text={tabId === 'next' ? 'Crie uma viagem para organizar roteiro, mapa e orçamento.' : 'Viagens concluídas aparecem aqui automaticamente.'}
          action={tabId === 'next' ? 'Criar viagem' : undefined} onAction={() => A.go('create')} />
      )}
    </Screen>
  );
}

/* ---------- Explorar ---------- */
export function Explore() {
  const s = useApp();
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('todos');
  const [all, setAll] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const xq = norm(q);
  const exTrips = upcomingOf(s).filter((t) => hasCatalog(t.destId));
  const exTrip = exTrips.find((t) => t.id === tripId) || exTrips[0] || null;
  const scope = xq ? PLACES : exTrip ? placesForCity(exTrip.destId) : [];
  const catIds: Record<string, boolean> = {};
  scope.forEach((p) => { catIds[p.cat] = true; });
  const exCat = cat !== 'todos' && catIds[cat] ? cat : 'todos';
  const found = scope.filter((p) => (exCat === 'todos' || p.cat === exCat) && (!xq || norm(p.name + ' ' + p.area + ' ' + (CITY_NAME[p.city] || '')).indexOf(xq) >= 0));
  const preview = !xq && exCat === 'todos' && !all;
  const places = preview ? found.slice(0, 6) : found;
  const when: Record<string, string> = {};
  if (exTrip) exTrip.days.forEach((d, di) => d.forEach((x) => { if (x.placeId && !when[x.placeId]) when[x.placeId] = 'No roteiro · Dia ' + (di + 1); }));
  const dests = xq ? DESTINATIONS.filter((d) => norm(d.name + ' ' + d.country + ' ' + (d.tag || '') + ' ' + d.aliases.join(' ')).indexOf(xq) >= 0) : FEATURED.map((id) => DEST_BY_ID[id]);
  const world = xq ? searchDest(q).filter((d) => d.kind !== 'catalog') : [];
  const site = useSite();
  const siteWide = useSiteWide();
  const narrow = useNarrow();
  const pad = usePad();
  return (
    <Screen>
      <TopBar large title="Explorar" right={<Btn sm kind="secondary" icon="heart" label={'Salvos · ' + (s.saved.length + s.savedDest.length)} onPress={() => A.go('saved')} />} />
      <Input value={q} onChangeText={setQ} icon="search" placeholder="Buscar cidade, país ou lugar" caps="none"
        right={q ? <IconBtn icon="x" glass size={44} label="Limpar busca" onPress={() => { setQ(''); setCat('todos'); }} /> : undefined} />
      {dests.length ? (
        <>
          <Section title={xq ? 'Destinos' : 'Destinos em alta'} />
          {site ? <Grid fullRows={!xq} items={dests} min={narrow ? 150 : 190} render={(d, w) => <DestCard d={d} s={s} width={w} onPlan={() => planDest(d.id)} />} /> : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 12 }}>
              {dests.map((d) => <DestCard key={d.id} d={d} s={s} width={150} onPlan={() => planDest(d.id)} />)}
            </ScrollView>
          )}
        </>
      ) : null}
      {world.length ? (
        <>
          <Section title="Outros destinos" />
          <List>
            {world.slice(0, 8).map((d) => (
              <ListRow key={d.id} iconEl={<View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: d.color }} />} title={d.name}
                sub={(d.kind === 'country' ? 'País · ' + d.country : d.country) + ' · roteiro começa em branco'} chevron onPress={() => planDest(d.id)} />
            ))}
          </List>
        </>
      ) : null}
      {!xq ? (
        <>
          <Section title="Estilos de viagem" />
          <Grid items={STYLES} min={site && !narrow ? 260 : 150} gap={10} render={(st) => (
            <Card onPress={() => A.go('style', { styleId: st })} label={st} style={{ padding: 14, gap: 6 }}>
              <TileIcon name={STYLE_INFO[st].icon} />
              <T v="lt">{st}</T>
              <T v="smallMuted" lines={2}>{STYLE_INFO[st].short}</T>
            </Card>
          )} />
        </>
      ) : null}
      <Section title={xq ? 'Lugares encontrados' : exTrip ? 'Para sua viagem a ' + exTrip.name : 'Lugares'} />
      {!xq && exTrip ? <T v="smallMuted" style={{ marginTop: -6, marginBottom: 12 }}>{periodLabel(exTrip) + ' · ' + plural(scope.length, 'lugar', 'lugares') + ' no catálogo'}</T> : null}
      {xq ? <T v="smallMuted" style={{ marginTop: -6, marginBottom: 12 }}>Busca em todos os destinos do catálogo</T> : null}
      {!xq && exTrips.length > 1 ? <><Chips scroll>{exTrips.map((t) => <Chip key={t.id} label={t.name} on={!!exTrip && exTrip.id === t.id} onPress={() => { setTripId(t.id); setCat('todos'); setAll(false); }} />)}</Chips><Gap h={10} /></> : null}
      {xq || exTrip ? <><Chips scroll>{CATEGORIES.filter((k) => k.id === 'todos' || catIds[k.id]).map((k) => <Chip key={k.id} label={k.label} on={exCat === k.id} onPress={() => setCat(k.id)} />)}</Chips><Gap h={12} /></> : null}
      {!xq && !exTrip ? <Empty icon="compass" title="Crie uma viagem para ver lugares" text="Ou busque uma cidade acima para ver o catálogo." action="Criar viagem" onAction={() => A.go('create')} /> : null}
      <Grid items={places} min={360} gap={12} render={(p) => <PlaceCard p={p} s={s} sub={!xq ? when[p.id] : undefined} />} />
      {(xq || exTrip) && !places.length && (!xq || (!dests.length && !world.length)) ? <Empty icon="search" title="Nada encontrado" text="Tente outro nome ou outra categoria." /> : null}
      {!xq && exCat === 'todos' && found.length > 6 ? <View style={{ alignItems: 'center' }}><LinkBtn label={all ? 'Mostrar menos' : 'Ver todos os ' + found.length + ' lugares'} onPress={() => setAll(!all)} /></View> : null}
    </Screen>
  );
}

/* ---------- Salvos ---------- */
export function Saved() {
  const s = useApp();
  const [tabId, setTab] = useState<'atracoes' | 'restaurantes' | 'destinos'>('atracoes');
  const places = s.saved.map((id) => PLACE_BY_ID[id]).filter(Boolean);
  const groups = {
    atracoes: places.filter((p) => ['restaurante', 'cafe'].indexOf(p.cat) < 0),
    restaurantes: places.filter((p) => ['restaurante', 'cafe'].indexOf(p.cat) >= 0)
  };
  const dests = s.savedDest.map((id) => DEST_BY_ID[id]).filter(Boolean);
  return (
    <Screen>
      <TopBar title="Salvos" onBack={A.back} />
      <Seg value={tabId} onChange={setTab} options={[
        { id: 'atracoes', label: 'Lugares (' + groups.atracoes.length + ')' },
        { id: 'restaurantes', label: 'Comer (' + groups.restaurantes.length + ')' },
        { id: 'destinos', label: 'Destinos (' + dests.length + ')' }
      ]} />
      <Gap h={16} />
      {tabId === 'destinos' ? (
        dests.length ? <Grid items={dests} min={160} gap={12} render={(d, w) => <DestCard d={d} s={s} width={w} onPlan={() => planDest(d.id)} />} />
          : <Empty icon="heart" title="Nenhum destino salvo" text="Toque no coração de um destino em Explorar." />
      ) : groups[tabId].length ? <Grid items={groups[tabId]} min={360} gap={12} render={(p) => <PlaceCard p={p} s={s} />} />
        : <Empty icon="heart" title="Nada salvo aqui ainda" text="Toque no coração de um lugar para guardar." />}
    </Screen>
  );
}

/* ---------- Estilo de viagem ---------- */
export function StyleScreen() {
  const s = useApp();
  const st = s.styleId, info = STYLE_INFO[st];
  const next = upcomingOf(s).find((t) => hasCatalog(t.destId));
  const places = (next ? placesForCity(next.destId) : PLACES).filter((p) => p.styles.indexOf(st) >= 0).slice(0, 6);
  const slots: Slot[] = ['manha', 'almoco', 'tarde', 'fimtarde', 'noite'];
  return (
    <Screen>
      <TopBar title={'Viagem ' + info.adj} onBack={A.back} />
      <Card style={{ padding: 18, gap: 10 }}>
        <TileIcon name={info.icon} size={52} />
        <T v="h2">{st}</T>
        <T v="muted">{info.desc}</T>
      </Card>
      <Section title="Como fica um dia" />
      <List>
        {slots.map((sl) => <ListRow key={sl} icon="dot" title={SLOT_LABEL[sl]} sub={info.molde[sl]} />)}
      </List>
      <Section title={next ? 'Em ' + next.name : 'Lugares com este estilo'} />
      {places.map((p) => <PlaceCard key={p.id} p={p} s={s} />)}
      <Gap h={8} />
      <Btn label={'Planejar viagem ' + info.adj} icon="plus" block onPress={() => A.go('create', { sheetArg: { styles: [st] } })} />
    </Screen>
  );
}

/* ---------- Avisos ---------- */
export function Alerts() {
  const s = useApp();
  const { c } = useTheme();
  const list = alertsFor(pickData(s));
  const todayIso = iso(today0());
  const due = list.filter((a) => a.date <= todayIso), later = list.filter((a) => a.date > todayIso);
  const unread = due.filter((a) => s.alertsRead.indexOf(a.id) < 0);
  const row = (a: typeof list[number], isNew: boolean) => (
    <ListRow key={a.id} iconEl={<TileIcon name={a.icon} bg={a.kind === 'warn' ? c.warnBg : a.kind === 'money' ? c.noteBg : c.accTint} color={a.kind === 'warn' ? c.warnText : a.kind === 'money' ? c.noteText : c.acc} />}
      title={a.title} sub={a.sub} onPress={() => A.openAlert(a)}
      right={isNew ? <View accessibilityLabel="Novo" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.over }} /> : undefined} />
  );
  return (
    <Screen>
      <TopBar title="Avisos" onBack={A.back} right={unread.length ? <LinkBtn label="Ler todos" onPress={() => A.readAllAlerts(s.alertsRead.concat(unread.map((a) => a.id)))} /> : undefined} />
      {due.length ? <List>{due.map((a) => row(a, s.alertsRead.indexOf(a.id) < 0))}</List> : <Empty icon="bell" title="Nenhum aviso agora" text="Lembretes de reservas, preparação e orçamento aparecem aqui." />}
      {later.length ? (
        <>
          <GroupLabel>Próximos avisos</GroupLabel>
          <List>{later.map((a) => <View key={a.id}>{row({ ...a, sub: a.sub + ' · chega em ' + fmtShort(a.date) }, false)}</View>)}</List>
        </>
      ) : null}
      <Gap h={14} />
      <T v="smallMuted" center>No celular, os avisos também chegam como notificações (ajuste em Perfil).</T>
    </Screen>
  );
}

/* ---------- Primeiros passos (depois de criar a conta) ---------- */
export function Onboard() {
  const s = useApp();
  const obWide = useSiteWide();
  const [step, setStep] = useState(1);
  const [styles, setStyles] = useState<Style[]>([]);
  const [dest, setDest] = useState<string | null>(null);
  const first = (s.user && s.user.name.split(' ')[0]) || '';
  const toggle = (st: Style) => setStyles(styles.indexOf(st) >= 0 ? styles.filter((x) => x !== st) : styles.concat([st]));
  return (
    <Screen tabs={false}>
      <Row between style={{ marginBottom: 18 }}>
        <T v="smallMuted">{'Passo ' + step + ' de 2'}</T>
        <LinkBtn label="Pular" onPress={() => A.finishOnboarding(styles, null)} />
      </Row>
      {step === 1 ? (
        <>
          <T v="h1">{'Como você gosta de viajar' + (first ? ', ' + first : '') + '?'}</T>
          <Gap h={6} />
          <T v="muted">Escolha um ou mais. Isso guia as sugestões do roteiro.</T>
          <Gap h={20} />
          <Grid items={STYLES} min={320} gap={10} render={(st) => {
            const on = styles.indexOf(st) >= 0;
            return (
              <Card onPress={() => toggle(st)} label={st} flat={!on}>
                <Row style={{ padding: 14 }}>
                  <TileIcon name={STYLE_INFO[st].icon} />
                  <Grow><T v="lt">{st}</T><T v="smallMuted">{STYLE_INFO[st].short}</T></Grow>
                  {on ? <Icon name="check" /> : null}
                </Row>
              </Card>
            );
          }} />
          <Gap h={20} />
          <View style={{ alignSelf: obWide ? 'flex-start' : 'stretch', minWidth: obWide ? 320 : undefined }}><Btn label={styles.length ? 'Continuar' : 'Continuar sem escolher'} block onPress={() => setStep(2)} /></View>
        </>
      ) : (
        <>
          <T v="h1">Já tem um destino em mente?</T>
          <Gap h={6} />
          <T v="muted">Escolha um para começar a planejar agora, ou siga para o início.</T>
          <Gap h={20} />
          <Grid items={['lisboa', 'paris', 'rio', 'buenosaires', 'roma', 'novayork']} min={obWide ? 240 : 150} gap={10} render={(id) => {
              const on = dest === id;
              return (
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={DEST_BY_ID[id].name} onPress={() => setDest(on ? null : id)}>
                  <Cover destId={id} height={obWide ? 150 : 100} artW={110} artTop={10} artRight={-6} radius={16}>
                    <View style={{ position: 'absolute', left: 12, bottom: 10 }}><T v="lt" color="#FFFFFF">{DEST_BY_ID[id].name}</T></View>
                    {on ? <View style={{ position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={16} color="#1B1C1E" /></View> : null}
                  </Cover>
                </Pressable>
              );
            }} />
          <Gap h={18} />
          <View style={{ alignSelf: obWide ? 'flex-start' : 'stretch', minWidth: obWide ? 320 : undefined }}><Btn label={dest ? 'Planejar ' + DEST_BY_ID[dest].name : 'Ir para o início'} block onPress={() => A.finishOnboarding(styles, dest)} /></View>
          <Gap h={8} />
          <View style={{ alignItems: obWide ? 'flex-start' : 'center' }}><LinkBtn label="Voltar" onPress={() => setStep(1)} /></View>
        </>
      )}
    </Screen>
  );
}

/* ---------- Perfil ---------- */
export function Profile() {
  const s = useApp();
  const { c } = useTheme();
  const u = s.user!;
  const guest = u.method === 'guest';
  const nTrips = s.trips.length, nPlaces = s.saved.length;
  return (
    <Screen>
      <TopBar large title="Perfil" />
      <Card style={{ padding: 16 }}>
        <Row>
          <Avatar letter={u.name.charAt(0).toUpperCase()} size={56} />
          <Grow>
            <T v="h2" lines={1}>{u.name}</T>
            <T v="smallMuted" lines={1}>{guest ? 'Modo visitante · nada é salvo' : u.email}</T>
          </Grow>
        </Row>
        <Row gap={10} style={{ marginTop: 14 }}>
          <Stat n={nTrips} label={nTrips === 1 ? 'viagem' : 'viagens'} />
          <Stat n={nPlaces} label={nPlaces === 1 ? 'lugar' : 'lugares'} />
          <Stat n={s.savedDest.length} label="destinos" />
        </Row>
      </Card>
      {guest ? (
        <Card style={{ padding: 16, marginTop: 14, gap: 8, backgroundColor: c.accTint }}>
          <T v="lt">Guarde suas viagens</T>
          <T v="small">Crie uma conta: o que você montou agora vem junto.</T>
          <Btn sm label="Criar conta" onPress={A.guestToSignup} />
        </Card>
      ) : null}

      <Cols main={<>
      <GroupLabel>Estilos preferidos</GroupLabel>
      <Chips>{STYLES.map((st) => <Chip key={st} label={st} icon={STYLE_INFO[st].icon} on={s.prefs.styles.indexOf(st) >= 0} onPress={() => A.toggleStylePref(st)} />)}</Chips>

      <GroupLabel>Aparência</GroupLabel>
      <Seg value={s.prefs.theme} onChange={(v) => A.setPref('theme', v)} options={[{ id: 'auto', label: 'Automático' }, { id: 'light', label: 'Claro' }, { id: 'dark', label: 'Escuro' }]} />
      <Gap h={10} />
      <List>
        <ListRow icon="edit" title="Texto maior" sub="Aumenta as letras do app" right={<Toggle label="Texto maior" value={s.prefs.textLg} onChange={() => A.setPref('textLg', !s.prefs.textLg)} />} />
      </List>

      <GroupLabel>Notificações</GroupLabel>
      <List>
        <ListRow icon="calendar" title="Lembretes do roteiro" sub="Reservas e preparação" right={<Toggle label="Lembretes do roteiro" value={s.prefs.notif.roteiro} onChange={() => A.toggleNotif('roteiro')} />} />
        <ListRow icon="wallet" title="Alertas de orçamento" sub="Quando passar de 90%" right={<Toggle label="Alertas de orçamento" value={s.prefs.notif.orcamento} onChange={() => A.toggleNotif('orcamento')} />} />
        <ListRow icon="sparkle" title="Sugestões do assistente" right={<Toggle label="Sugestões do assistente" value={s.prefs.notif.ia} onChange={() => A.toggleNotif('ia')} />} />
      </List>

      </>} side={<>
      {!guest ? (
        <>
          <GroupLabel>Segurança</GroupLabel>
          <List>
            {u.method === 'email' ? <ListRow icon="key" title="Alterar senha" chevron onPress={() => A.openSheet('password')} /> : null}
            {isWeb ? null : <ListRow icon="faceid" title="Desbloqueio por biometria" sub="Face ID, digital ou senha do aparelho" right={<Toggle label="Biometria" value={s.sec.faceId} onChange={() => A.flipSec('faceId')} />} />}
          </List>
        </>
      ) : null}

      <GroupLabel>Backup</GroupLabel>
      <List>
        {u.id ? <ListRow icon="refresh" title="Sincronizar com a conta agora" sub={s.syncState === 'offline' ? 'Última tentativa falhou: ' + (cloudLastError() || 'sem conexão') : s.syncState === 'pending' ? 'Enviando mudanças…' : 'Tudo salvo na sua conta'} chevron onPress={A.syncNow} /> : null}
        <ListRow icon="download" title="Baixar backup das viagens" sub="Um arquivo com viagens, gastos e reservas" chevron onPress={A.exportBackup} />
        <ListRow icon="refresh" title="Restaurar de um backup" sub="Substitui os dados deste aparelho (dá para desfazer)" chevron onPress={A.importBackup} />
      </List>
      <Gap h={18} />
      <GroupLabel>Conta</GroupLabel>
      <List>
        <ListRow icon="logout" title={guest ? 'Sair do modo visitante' : 'Sair da conta'} onPress={A.logout} />
        {!guest ? <ListRow icon="trash" title="Excluir conta" color={c.errText} onPress={() => A.openSheet('delete', 'account')} /> : null}
      </List>
      <Gap h={18} />
      <GroupLabel>Sobre</GroupLabel>
      <List>
        <ListRow icon="shield" title="Política de privacidade" chevron onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
        <ListRow icon="doc" title="Termos de uso" chevron onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} />
        <ListRow icon="mail" title="Fale com a gente" sub={SUPPORT_EMAIL} chevron onPress={() => Linking.openURL('mailto:' + SUPPORT_EMAIL + '?subject=Destí').catch(() => {})} />
      </List>
      <Gap h={18} />
      </>} />
      <Gap h={18} />
      <T v="smallMuted" center>{'Destí 1.0 · ' + (guest ? 'modo visitante: nada é salvo' : u.id ? (s.syncState === 'offline' ? 'não foi possível falar com a nuvem: ' + (cloudLastError() || 'sem conexão') : 'viagens guardadas na sua conta') : 'viagens guardadas neste aparelho')}</T>
    </Screen>
  );
}
function Stat({ n, label }: { n: number; label: string }) {
  const { c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 12, padding: 10 }}><T v="h2">{String(n)}</T><T v="smallMuted">{label}</T></View>;
}

/* Site: roteiro compartilhado por link (só leitura, sem conta) e a tela de "não encontrado" */
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useApp, setState } from '../store/store';
import * as A from '../store/actions';
import { T, Row, Grow, Gap, Btn, Icon, Card, Note, Logo, Screen, Pill } from '../ui';
import { useTheme, useNarrow, usePad } from '../theme/useTheme';
import { PLACE_BY_ID, lookupDest } from '../data';
import { cloudPublicGet, cloudInviteInfo, cloud, type InviteInfo } from '../lib/backend';
import { validPublic, type PublicTrip as PT } from '../lib/publicCore';
import { periodLabel, sortItems, isMultiCity, legNameOfDay } from '../lib/trip';
import { tripClimate } from '../lib/climate';
import { parseD, addDays, SEM_LONGO, MES_LONGO, plural, countDays } from '../lib/format';
import { copyText, shareTextNative } from '../lib/device';
import { setPublicTitle, setInviteTitle } from '../lib/router';
import { SITE_URL } from '../config';
import { PlacesMap } from './maps/PlacesMap';
import type { MapItem } from './maps/types';
import type { Trip, ItineraryItem } from '../types';

/* ---------- Página não encontrada (endereço errado, viagem excluída ou de outro aparelho) ---------- */
export function NotFound() {
  const s = useApp();
  const { c } = useTheme();
  const kind = s.notFound || 'page';
  if (kind === 'checking') return <Screen><View accessibilityRole="progressbar" style={{ alignItems: 'center', paddingVertical: 80, gap: 10 }}><Icon name="compass" size={32} color={c.acc} /><T v="muted">Procurando a viagem…</T></View></Screen>;
  if (kind === 'private') {
    return (
      <Screen>
        <View accessibilityRole="alert" style={{ alignItems: 'center', paddingVertical: 48, gap: 12, maxWidth: 520, alignSelf: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accTint, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={32} color={c.acc} /></View>
          <T v="h1" center>Esta viagem é particular</T>
          <T v="muted" center>Só quem organiza consegue abrir este endereço. Se a viagem é sua, entre na conta para abrir. Se alguém te mandou este link, peça o link do roteiro público (Compartilhar roteiro público).</T>
          <Gap h={8} />
          <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Btn label="Entrar na minha conta" onPress={() => setState({ notFound: null, auth: 'login' })} />
            <Btn kind="secondary" label="Montar meu próprio roteiro" onPress={() => setState({ notFound: null, auth: 'signup' })} />
          </Row>
        </View>
      </Screen>
    );
  }
  const title = kind === 'trip' ? 'Viagem não encontrada' : kind === 'place' ? 'Lugar não encontrado' : 'Página não encontrada';
  const text = kind === 'trip'
    ? 'Esta viagem não está neste aparelho nem na sua conta. Ela pode ter sido excluída, ou estar salva em outro aparelho ou outra conta. Suas outras viagens continuam salvas.'
    : kind === 'place'
      ? 'Este lugar não existe mais no catálogo do Destí. Suas viagens e lugares salvos não foram alterados.'
      : 'O endereço que você abriu não existe no Destí. Pode ter sido digitado errado ou ser um link antigo. Nada foi apagado.';
  return (
    <Screen>
      <View accessibilityRole="alert" style={{ alignItems: 'center', paddingVertical: 48, gap: 12, maxWidth: 520, alignSelf: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accTint, alignItems: 'center', justifyContent: 'center' }}><Icon name="compass" size={34} color={c.acc} /></View>
        <T v="h1" center>{title}</T>
        <T v="muted" center>{text}</T>
        <Gap h={8} />
        {s.user ? (
          <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Btn icon="suitcase" label="Minhas viagens" onPress={() => A.tab('trips')} />
            <Btn kind="secondary" icon="home" label="Início" onPress={() => A.tab('home')} />
          </Row>
        ) : <Btn icon="home" label="Ir para a página inicial" onPress={() => setState({ notFound: null, auth: 'welcome' })} />}
      </View>
    </Screen>
  );
}

/* ---------- Roteiro compartilhado (só leitura) ---------- */
function PublicHeader() {
  const s = useApp();
  const { c } = useTheme();
  const narrow = useNarrow();
  const pad = usePad();
  const home = () => { setState({ publicView: null, notFound: null }); if (s.user) A.tab('home'); else setState({ auth: 'welcome' }); };
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bar }}>
      <View style={{ maxWidth: 1120, width: '100%', alignSelf: 'center', paddingHorizontal: pad, height: narrow ? 60 : 68, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Destí, página inicial" onPress={home}><Logo size={narrow ? 28 : 32} textSize={narrow ? 21 : 24} /></Pressable>
        <Grow />
        <Btn sm label={s.user ? 'Minhas viagens' : 'Criar meu roteiro'} onPress={() => { setState({ publicView: null }); if (s.user) A.tab('trips'); else setState({ auth: 'signup' }); }} />
      </View>
    </View>
  );
}

type Load = { st: 'loading' } | { st: 'ok'; d: PT } | { st: 'missing' } | { st: 'offline' } | { st: 'nocloud' };

export function PublicTripPage({ id }: { id: string }) {
  const { c } = useTheme();
  const [load, setLoad] = useState<Load>({ st: 'loading' });
  const [sel, setSel] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const fetchIt = () => {
    if (!cloud.enabled) { setLoad({ st: 'nocloud' }); return; }
    setLoad({ st: 'loading' });
    cloudPublicGet(id).then((r) => {
      if (r === undefined) setLoad({ st: 'offline' });
      else if (!r || !validPublic(r.data)) setLoad({ st: 'missing' });
      else setLoad({ st: 'ok', d: r.data });
    });
  };
  useEffect(fetchIt, [id]);
  const url = SITE_URL.replace(/\/+$/, '') + '/roteiro/?id=' + id;
  const s = useApp();
  /* sair do roteiro público: volta para a página anterior do navegador ou para o Destí */
  const goBack = () => { try { if (typeof window !== 'undefined' && window.history.length > 1) { window.history.back(); return; } } catch { /* ignora */ } setState({ publicView: null }); if (!s.user) setState({ auth: 'welcome' }); };
  const mine = () => { setState({ publicView: null }); if (s.user) A.tab('create'); else setState({ auth: 'signup' }); };
  const d = load.st === 'ok' ? load.d : null;
  useEffect(() => {
    if (d) { const a = parseD(d.start), b = parseD(d.end); setPublicTitle('Roteiro: ' + d.name + ' · ' + a.getDate() + '/' + (a.getMonth() + 1) + ' a ' + b.getDate() + '/' + (b.getMonth() + 1) + ' · Destí'); }
    else if (load.st === 'missing' || load.st === 'nocloud') setPublicTitle('Roteiro não encontrado · Destí');
    else setPublicTitle('Roteiro compartilhado · Destí');
  }, [load.st]);

  let body: React.ReactNode;
  if (load.st === 'loading') body = <View style={{ paddingVertical: 80, alignItems: 'center', gap: 10 }}><Icon name="compass" size={32} color={c.acc} /><T v="muted">Carregando o roteiro…</T></View>;
  else if (load.st === 'missing' || load.st === 'nocloud') body = (
    <View accessibilityRole="alert" style={{ paddingVertical: 56, alignItems: 'center', gap: 12, maxWidth: 520, alignSelf: 'center' }}>
      <Icon name="link" size={34} color={c.acc} />
      <T v="h1" center>Roteiro não encontrado</T>
      <T v="muted" center>{load.st === 'nocloud' ? 'Este site ainda não está ligado à nuvem, então não consegue abrir roteiros compartilhados.' : 'Este link não existe ou foi desativado por quem criou o roteiro. Peça um link novo para essa pessoa.'}</T>
      <Gap h={6} />
      <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Btn kind="secondary" icon="chevL" label="Voltar" onPress={goBack} />
        <Btn label="Montar meu próprio roteiro" onPress={mine} />
      </Row>
    </View>
  );
  else if (load.st === 'offline') body = (
    <View accessibilityRole="alert" style={{ paddingVertical: 56, alignItems: 'center', gap: 12, maxWidth: 520, alignSelf: 'center' }}>
      <Icon name="cloudRain" size={34} color={c.acc} />
      <T v="h1" center>Sem conexão</T>
      <T v="muted" center>Não deu para carregar o roteiro agora (a conexão caiu ou demorou demais). Confira a internet e tente de novo; o link continua valendo.</T>
      <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Btn icon="refresh" label="Tentar de novo" onPress={fetchIt} />
        <Btn kind="secondary" icon="chevL" label="Voltar" onPress={goBack} />
      </Row>
    </View>
  );
  else {
    const t = { ...d!, id: 'pub', budget: 0, plan: {}, days: d!.days.map((x, i) => x.map((it, j) => ({ ...it, id: i + '-' + j }) as ItineraryItem)) } as unknown as Trip;
    const n = countDays(d!.start, d!.end);
    const climate = tripClimate({ destId: d!.destId, start: d!.start, end: d!.end, styles: d!.styles as any });
    const dest = lookupDest(d!.destId);
    let k = 0;
    const items: MapItem[] = [];
    t.days.forEach((dd, di) => sortItems(dd).forEach((x) => { const p = x.placeId ? PLACE_BY_ID[x.placeId] : null; if (x.kind === 'place' && p && (day == null || day === di)) items.push({ p, di, time: x.time, key: di + '-' + x.id, n: ++k }); }));
    body = (
      <View style={{ gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Row gap={8} style={{ flexWrap: 'wrap' }}><Pill>Roteiro compartilhado pelo Destí</Pill><Pill>Só para ver</Pill></Row>
          <T v="h1">{d!.name + (d!.country && d!.country !== 'País' ? ', ' + d!.country : '')}</T>
          <T v="muted">{periodLabel(t) + ' · ' + plural(n, 'dia', 'dias') + ' · ' + plural(d!.travelers, 'viajante', 'viajantes') + (d!.styles.length ? ' · ' + d!.styles.join(', ') : '')}</T>
        </View>
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          <Btn sm kind="secondary" icon="copy" label="Copiar link" onPress={async () => A.showToast((await copyText(url)) ? 'Link copiado' : 'Não foi possível copiar. Selecione o endereço na barra do navegador.')} />
          <Btn sm kind="secondary" icon="share" label="Compartilhar" onPress={() => shareTextNative('Roteiro · ' + d!.name, 'Roteiro da viagem ' + d!.name + ' no Destí: ' + url)} />
        </Row>
        {climate ? (
          <Card flat style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Icon name={climate.icon} size={26} color={c.acc} />
            <View style={{ flex: 1 }}><T v="lt">{climate.hi + '° / ' + climate.lo + '° em ' + climate.monthsLabel + ' · ' + climate.feel}</T><T v="smallMuted">{'Clima típico da época · ' + climate.rainLabel}</T></View>
          </Card>
        ) : null}
        {items.length ? (
          <View style={{ gap: 8 }}>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <Btn sm kind={day == null ? 'primary' : 'secondary'} label="Todos os dias" onPress={() => { setDay(null); setSel(null); }} />
              {t.days.map((_, i) => <Btn key={i} sm kind={day === i ? 'primary' : 'secondary'} label={'Dia ' + (i + 1)} onPress={() => { setDay(i); setSel(null); }} />)}
            </Row>
            <PlacesMap items={items} sel={sel} onSelect={setSel} color={c.acc} />
          </View>
        ) : null}
        <View style={{ gap: 12 }}>
          {t.days.map((dd, i) => {
            if (day != null && day !== i) return null;
            const dt = addDays(parseD(d!.start), i);
            const list = sortItems(dd);
            return (
              <Card key={i} style={{ padding: 16, gap: 8 }}>
                <T v="title">{'Dia ' + (i + 1) + ' · ' + SEM_LONGO[dt.getDay()] + ', ' + dt.getDate() + ' de ' + MES_LONGO[dt.getMonth()] + (isMultiCity(t) ? ' · ' + legNameOfDay(t, i) : '')}</T>
                {!list.length ? <T v="smallMuted">Dia livre</T> : list.map((x) => {
                  const p = x.placeId ? PLACE_BY_ID[x.placeId] : null;
                  const key = i + '-' + x.id;
                  return (
                    <Pressable key={x.id} accessibilityRole={p ? 'button' : undefined} onPress={p ? () => setSel(key) : undefined} style={{ flexDirection: 'row', gap: 12, paddingVertical: 4 }}>
                      <T v="lt" style={{ width: 54 }} color={c.acc}>{x.time}</T>
                      <View style={{ flex: 1 }}>
                        <T v="body">{p ? p.name : x.text || ''}</T>
                        {p ? <T v="smallMuted">{p.area}</T> : <T v="smallMuted">Deslocamento</T>}
                      </View>
                    </Pressable>
                  );
                })}
              </Card>
            );
          })}
        </View>
        <Note kind="info">{'Este roteiro é só para ver. Quem criou pode mudar ou desativar o link a qualquer momento' + (dest ? '. Quer montar o seu para ' + dest.name + '? Crie uma conta no Destí.' : '.')}</Note>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <PublicHeader />
      <Screen>{body}</Screen>
    </View>
  );
}

/* ---------- Convite para editar junto (/convite/?c=…) ---------- */
type Inv = { st: 'loading' } | { st: 'ok'; info: InviteInfo | null } | { st: 'missing' } | { st: 'offline' };
export function InvitePage({ code }: { code: string }) {
  const s = useApp();
  const { c } = useTheme();
  const [inv, setInv] = useState<Inv>({ st: 'loading' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const account = !!(s.user && s.user.id);
  const load = () => {
    if (!account) return;
    setInv({ st: 'loading' });
    cloudInviteInfo(code).then((r) => {
      if (r === undefined) setInv({ st: 'offline' });
      else if (r === null) setInv({ st: 'missing' });
      else setInv({ st: 'ok', info: r === 'old' ? null : r });
    });
  };
  useEffect(load, [code, account]);
  useEffect(() => { setInviteTitle(inv.st === 'missing' ? 'Convite não encontrado · Destí' : 'Convite para viagem · Destí'); }, [inv.st]);
  const accept = async () => { if (busy) return; setBusy(true); setErr(''); const e = await A.joinByCode(code); setBusy(false); if (e) { if (/não encontrado|expirado/i.test(e)) setInv({ st: 'missing' }); else setErr(e); } };
  const box = (icon: string, title: string, text: string, actions: React.ReactNode) => (
    <View accessibilityRole="alert" style={{ alignItems: 'center', paddingVertical: 48, gap: 12, maxWidth: 560, alignSelf: 'center', width: '100%' }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={32} color={c.acc} /></View>
      <T v="h1" center>{title}</T>
      <T v="muted" center>{text}</T>
      <Gap h={6} />
      {actions}
    </View>
  );
  let body: React.ReactNode;
  if (!s.user) {
    body = box('users', 'Convite para viagem', 'Você foi convidado para montar uma viagem junto no Destí. Entre ou crie uma conta para participar: o convite fica guardado e aparece de novo logo depois.', (
      <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Btn label="Criar conta" onPress={() => setState({ inviteView: null, auth: 'signup' })} />
        <Btn kind="secondary" label="Já tenho conta" onPress={() => setState({ inviteView: null, auth: 'login' })} />
        <Btn kind="ghost" label="Agora não" onPress={A.declineInvite} />
      </Row>
    ));
  } else if (!account) {
    body = box('users', 'Convite para viagem', 'Para editar junto, cada pessoa usa a própria conta. No modo visitante as viagens ficam só neste aparelho. Crie uma conta (ou entre): suas viagens do modo visitante vão junto e o convite aparece de novo.', (
      <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Btn label="Criar conta" onPress={() => { setState({ inviteView: null }); A.guestToSignup(); }} />
        <Btn kind="secondary" label="Já tenho conta" onPress={() => { setState({ inviteView: null }); A.guestToLogin(); }} />
        <Btn kind="ghost" label="Agora não" onPress={A.declineInvite} />
      </Row>
    ));
  } else if (inv.st === 'loading') {
    body = <View accessibilityRole="progressbar" style={{ alignItems: 'center', paddingVertical: 80, gap: 10 }}><Icon name="compass" size={32} color={c.acc} /><T v="muted">Conferindo o convite…</T></View>;
  } else if (inv.st === 'missing') {
    body = box('link', 'Convite não encontrado ou expirado', 'Este código não existe mais: a viagem pode ter deixado de ser compartilhada, ou o código foi digitado errado. Nada mudou nas suas viagens. Peça um convite novo para quem organiza.', (
      <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        <Btn label="Minhas viagens" onPress={A.declineInvite} />
        <Btn kind="secondary" label="Digitar outro código" onPress={() => { setState({ inviteView: null }); A.tab('trips'); A.openSheet('join'); }} />
      </Row>
    ));
  } else if (inv.st === 'offline') {
    body = box('cloudRain', 'Sem conexão', 'Não deu para conferir o convite agora. Confira a internet e tente de novo; o convite continua guardado.', (
      <Row gap={10} style={{ flexWrap: 'wrap', justifyContent: 'center' }}><Btn icon="refresh" label="Tentar de novo" onPress={load} /><Btn kind="secondary" label="Agora não" onPress={A.declineInvite} /></Row>
    ));
  } else {
    const i = inv.info;
    const when = i && /^\d{4}-\d{2}-\d{2}$/.test(i.start || '') && /^\d{4}-\d{2}-\d{2}$/.test(i.end || '') ? periodLabel({ start: i.start, end: i.end } as Trip) : '';
    const local = i ? s.trips.find((t) => t.id === i.trip_id) : null;
    if (i && i.member && local) {
      body = box('check', 'Você já participa desta viagem', i.name + (when ? ' · ' + when : ''), <Btn label="Abrir a viagem" onPress={() => { G_take(); A.openTrip(local.id); }} />);
    } else {
      body = (
        <View style={{ paddingVertical: 32, maxWidth: 560, alignSelf: 'center', width: '100%', gap: 14 }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accTint, alignItems: 'center', justifyContent: 'center' }}><Icon name="users" size={32} color={c.acc} /></View>
            <T v="h1" center>Você foi convidado para editar esta viagem</T>
          </View>
          {i ? (
            <Card style={{ padding: 16, gap: 4 }}>
              <T v="title">{i.name + (i.country && i.country !== 'País' ? ', ' + i.country : '')}</T>
              {when ? <T v="muted">{when}</T> : null}
              <T v="smallMuted">{(i.by ? 'Convite de ' + i.by + ' · ' : '') + plural(Number(i.people) || 1, 'pessoa', 'pessoas') + ' no grupo'}</T>
            </Card>
          ) : null}
          <T v="smallMuted" center>Ao aceitar, a viagem aparece nas suas viagens e todo mundo do grupo edita o mesmo roteiro, gastos, reservas e checklist, cada um no seu celular.</T>
          {err ? <Note kind="err">{err}</Note> : null}
          <Row gap={10} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Btn icon="check" label={busy ? 'Entrando…' : 'Aceitar convite'} onPress={accept} />
            <Btn kind="secondary" label="Recusar" onPress={A.declineInvite} />
          </Row>
        </View>
      );
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <PublicHeader />
      <Screen>{body}</Screen>
    </View>
  );
}
function G_take() { setState({ inviteView: null }); }

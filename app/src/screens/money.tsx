/* Gastos (orçamento e divisão em grupo), Reservas e documentos, Assistente */
import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useApp, setState } from '../store/store';
import * as A from '../store/actions';
import {
  T, Row, Grow, Gap, Card, Btn, LinkBtn, IconBtn, Icon, Chip, Chips, Seg, Input, Check, Note, TileIcon, CatIcon,
  Section, ListRow, List, Empty, TopBar, Screen, Bar, Avatar, Divider, Cols
} from '../ui';
import { useTheme, useSiteWide as useSite } from '../theme/useTheme';
import { NoTrip } from './common';
import { BUDGET_CATS, CUR_SYMBOL, RES_TYPES } from '../data';
import type { AiKey } from '../lib/assistant';
import { freeDayOf } from '../lib/assistant';
import { tripMembers, groupBalances, settleUp, memberName } from '../lib/group';
import { iso, today0, addDays, parseD, diffDays, money, brl, fmtMoney, cap, plural, fmtShort, SEM, MES } from '../lib/format';

/* ====================== Gastos ====================== */
export function Expenses() {
  const s = useApp();
  const { c } = useTheme();
  const [catsOpen, setCatsOpen] = useState(false);
  const site = useSite();
  const t = A.currentTrip();
  if (!t) return <Screen><TopBar large title="Gastos" /><NoTrip text="Crie uma viagem para registrar gastos e acompanhar o orçamento." /></Screen>;
  const gToday = iso(today0()), gYest = iso(addDays(today0(), -1));
  const exps = s.expenses.filter((e) => e.tripId === t.id);
  const total = exps.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const todaySum = exps.filter((e) => e.date === gToday).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const dates = exps.map((e) => e.date || '').filter((d, i, a) => a.indexOf(d) === i).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a < b ? 1 : -1));
  const members = tripMembers(t), group = members.length > 1;
  const bal = groupBalances(t, s.expenses), debts = settleUp(bal), paid: Record<string, number> = {};
  exps.forEach((e) => { const p = e.paidBy || 'me'; paid[p] = (paid[p] || 0) + (Number(e.amount) || 0); });
  const label = (id: string) => (id === 'me' ? (s.user && s.user.name) || 'Você' : memberName(t, id));
  const left = t.budget - total;

  const scan = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const r = perm.granted
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (r.canceled || !r.assets || !r.assets.length) return;
      A.openSheet('expense', { mode: 'scan', receipt: r.assets[0].uri });
    } catch {
      A.openSheet('expense', { mode: 'scan', receipt: null });
    }
  };

  return (
    <Screen>
      <TopBar large title="Gastos" right={<IconBtn icon="plus" accent label="Novo gasto" onPress={() => A.openSheet('expense', { mode: 'manual' })} />} />
      {s.trips.length > 1 ? <><Chips scroll>{s.trips.map((x) => <Chip key={x.id} label={x.name} on={x.id === t.id} onPress={() => setState({ tripId: x.id, day: 0 })} />)}</Chips><Gap h={14} /></> : null}
      <Cols main={<>
      <Card style={{ padding: 16, gap: 8 }}>
        <Row between>
          <View><T v="smallMuted">Hoje</T><T v="h2">{money(todaySum)}</T></View>
          <View style={{ alignItems: 'flex-end' }}><T v="smallMuted">Total da viagem</T><T v="h2">{money(total)}</T></View>
        </Row>
        <Bar pct={t.budget ? (total / t.budget) * 100 : 0} over={total > t.budget} />
        <Row between>
          <T v="small" color={left >= 0 ? c.muted : c.warnText} style={{ fontWeight: left >= 0 ? '400' : '700' }}>{left >= 0 ? 'Restam ' + money(left) : 'Acima em ' + money(-left)}</T>
          <LinkBtn label={'Orçamento ' + brl(t.budget)} onPress={() => A.openSheet('editTrip')} />
        </Row>
        {s.prefs.notif.orcamento && t.budget && total / t.budget >= 0.9 && total <= t.budget ? <Note kind="note">Você já usou mais de 90% do orçamento.</Note> : null}
      </Card>
      <Row gap={10} style={{ marginTop: 12 }}>
        <Btn grow icon="camera" label="Escanear" onPress={scan} />
        <Btn grow kind="secondary" icon="plus" label="Digitar" onPress={() => A.openSheet('expense', { mode: 'manual' })} />
      </Row>

      <Section title="Lançamentos" />
      {!exps.length ? <Empty icon="receipt" title="Nenhum gasto ainda" text="Escaneie uma nota ou digite o valor. Gastos em euro ou dólar são convertidos." /> : null}
      {dates.map((d) => {
        const list = exps.filter((e) => (e.date || '') === d);
        let lab = 'Antes da viagem ou sem data';
        if (d) {
          const dt = parseD(d), dn = diffDays(parseD(t.start), dt);
          lab = (d === gToday ? 'Hoje' : d === gYest ? 'Ontem' : SEM[dt.getDay()] + ', ' + dt.getDate() + ' ' + MES[dt.getMonth()]) + (dn >= 0 && dn < t.days.length ? ' · Dia ' + (dn + 1) : '');
        }
        return (
          <View key={d || 'none'} style={{ marginBottom: 14 }}>
            <Row between style={{ marginBottom: 8 }}><T v="small" style={{ fontWeight: '700' }}>{lab}</T><T v="smallMuted">{money(list.reduce((a, e) => a + (Number(e.amount) || 0), 0))}</T></Row>
            <List>
              {list.map((e) => {
                const k = BUDGET_CATS.find((x) => x.id === e.cat) || BUDGET_CATS[4];
                const pay = group ? ' · ' + ((e.paidBy || 'me') === 'me' ? 'você pagou' : memberName(t, e.paidBy!) + ' pagou') + (e.split && e.split.length < members.length ? ' · dividido por ' + e.split.length : '') : '';
                return (
                  <ListRow key={e.id} icon={k.icon} title={e.title} sub={k.label + (e.method ? ' · ' + e.method : '') + (e.receipt ? ' · com nota' : '') + pay}
                    onPress={() => A.openSheet('expense', { mode: 'edit', exp: e })}
                    right={<View style={{ alignItems: 'flex-end' }}><T v="small" style={{ fontWeight: '700' }}>{money(e.amount)}</T>{e.orig ? <T v="smallMuted">{CUR_SYMBOL[e.orig.currency] + ' ' + fmtMoney(e.orig.value)}</T> : null}</View>} />
                );
              })}
            </List>
          </View>
        );
      })}
      </>} side={<View style={{ marginTop: site ? -28 : 0 }}>
      {group ? (
        <>
          <Section title="Divisão do grupo" action="Pessoas" onAction={() => A.openSheet('people')} />
          <Card style={{ overflow: 'hidden' }}>
            {debts.length ? debts.map((d, i) => (
              <View key={i}>
                {i ? <Divider /> : null}
                <ListRow iconEl={<Avatar size={36} letter={label(d.from === 'me' ? d.to : d.from).charAt(0).toUpperCase()} />}
                  title={d.from === 'me' ? 'Você deve ' + money(d.amount) + ' para ' + memberName(t, d.to) : d.to === 'me' ? cap(memberName(t, d.from)) + ' te deve ' + money(d.amount) : cap(memberName(t, d.from)) + ' deve ' + money(d.amount) + ' para ' + memberName(t, d.to)}
                  sub="Por Pix, dinheiro ou transferência" right={<Btn sm kind="secondary" label="Acertado" onPress={() => A.settleDebt(d)} />} />
              </View>
            )) : <ListRow iconEl={<TileIcon name="check" />} title="Contas em dia" sub="Ninguém deve nada a ninguém" />}
            <Divider />
            {members.map((m) => {
              const b = Math.round((bal[m.id] || 0) * 100) / 100;
              return (
                <ListRow key={m.id} iconEl={<Avatar size={36} letter={label(m.id).charAt(0).toUpperCase()} />} title={m.id === 'me' ? label('me') + ' (você)' : m.name}
                  sub={'Pagou ' + money(paid[m.id] || 0)}
                  right={<T v="small" style={{ fontWeight: '700' }} color={b > 0.009 ? c.acc : b < -0.009 ? c.warnText : c.muted}>{b > 0.009 ? 'recebe ' + money(b) : b < -0.009 ? 'deve ' + money(-b) : 'em dia'}</T>} />
              );
            })}
          </Card>
        </>
      ) : (
        <Card onPress={() => A.openSheet('people')} label="Dividir com o grupo" style={{ marginTop: 14 }}>
          <ListRow iconEl={<TileIcon name="users" />} title="Viajando em grupo?" sub="Convide quem vai junto e o Destí calcula quem deve para quem" chevron />
        </Card>
      )}

      <Section title="Por categoria" action={catsOpen ? 'Esconder' : 'Ver'} onAction={() => setCatsOpen(!catsOpen)} />
      {catsOpen ? (
        <Card style={{ padding: 14, gap: 14 }}>
          {BUDGET_CATS.map((k) => {
            const sp = exps.filter((e) => e.cat === k.id).reduce((a, e) => a + (Number(e.amount) || 0), 0);
            const plan = (t.plan && t.plan[k.id]) || 0, over = sp > plan;
            return (
              <View key={k.id} style={{ gap: 6 }}>
                <Row><CatIcon name={k.icon} /><Grow><T v="lt" style={{ fontSize: 15 }}>{k.label}</T><T v="smallMuted">{money(sp) + ' de ' + brl(plan)}</T></Grow><T v="small" color={over ? c.warnText : c.muted}>{over ? 'Acima em ' + brl(sp - plan) : 'Restam ' + brl(plan - sp)}</T></Row>
                <Bar pct={plan ? (sp / plan) * 100 : sp > 0 ? 100 : 0} over={over} height={6} />
              </View>
            );
          })}
          <T v="smallMuted">A divisão por categoria é uma sugestão a partir do orçamento total. Ajuste em Editar viagem.</T>
        </Card>
      ) : null}

      </View>} />
    </Screen>
  );
}

/* ====================== Reservas e documentos ====================== */
export function Docs() {
  const s = useApp();
  const { c } = useTheme();
  const [tabId, setTab] = useState<'reservas' | 'docs'>(s.sheetArg === 'docs' ? 'docs' : 'reservas');
  const [open, setOpen] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const site = useSite();
  const t = A.currentTrip();
  if (!t) return <Screen><NoTrip /></Screen>;
  const res = s.reservations.filter((r) => r.tripId === t.id).sort((a, b) => (a.date + (a.time || '') < b.date + (b.time || '') ? -1 : 1));
  const cl = s.checklist[t.id] || [], done = cl.filter((x) => x.done).length;

  const importFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/*', 'message/rfc822'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets || !r.assets.length) return;
      const f = r.assets[0];
      A.openSheet('resForm', { type: A.guessResType(f.name), title: f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '), date: t.start, time: '', code: '', file: { name: f.name, uri: f.uri }, imported: true });
      A.showToast('Confira os dados lidos do arquivo');
    } catch { A.showToast('Não foi possível abrir o arquivo'); }
  };

  return (
    <Screen>
      <TopBar title={'Reservas · ' + t.name} onBack={A.back} />
      {site ? null : <><Seg value={tabId} onChange={setTab} options={[{ id: 'reservas', label: 'Reservas (' + res.length + ')' }, { id: 'docs', label: 'Preparação (' + done + '/' + cl.length + ')' }]} />
      <Gap h={16} /></>}
      {site ? (
        <Cols ratio={1.3} main={<><T v="title" style={{ marginBottom: 12 }}>Reservas</T>
        <>
          <Row gap={10}>
            <Btn grow icon="plus" label="Adicionar" onPress={() => A.openSheet('resForm', null)} />
            <Btn grow kind="secondary" icon="clip" label="Importar" onPress={importFile} />
          </Row>
          <Gap h={8} />
          <Gap h={8} />
          {!res.length ? <Empty icon="ticket" title="Nenhuma reserva" text="Guarde voos, hotéis e ingressos para ver tudo no roteiro do dia." /> : null}
          {res.map((r) => {
            const ty = RES_TYPES.find((x) => x.id === r.type) || RES_TYPES[0];
            const isOpen = open === r.id;
            return (
              <Card key={r.id} style={{ marginBottom: 10, overflow: 'hidden' }}>
                <ListRow iconEl={<TileIcon name={ty.icon} />} title={r.title} sub={ty.label + ' · ' + fmtShort(r.date) + (r.time ? ' · ' + r.time : '')} onPress={() => setOpen(isOpen ? null : r.id)}
                  right={<View style={{ backgroundColor: r.status === 'Confirmada' ? c.accTint : c.warnBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}><T v="small" color={r.status === 'Confirmada' ? c.accText : c.warnText} style={{ fontWeight: '700' }}>{r.status}</T></View>} />
                {isOpen ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
                    {r.code ? <Row between><T v="smallMuted">Código</T><T v="lt" style={{ letterSpacing: 1 }}>{r.code}</T></Row> : <T v="smallMuted">Sem código de confirmação</T>}
                    {r.details.map((d, i) => <T key={i} v="small">{d}</T>)}
                    {r.file ? <Row gap={6}><Icon name="clip" size={15} color={c.muted} /><T v="smallMuted">{r.file.name}</T></Row> : null}
                    <Row gap={8} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                      <Btn sm kind="secondary" label="Editar" onPress={() => A.openSheet('resForm', r)} />
                      <Btn sm kind="secondary" label={r.status === 'Confirmada' ? 'Marcar pendente' : 'Marcar confirmada'} onPress={() => A.toggleResStatus(r.id)} />
                      <Btn sm kind="ghost" label="Remover" color={c.errText} onPress={() => A.removeRes(r.id)} />
                    </Row>
                  </View>
                ) : null}
              </Card>
            );
          })}
          <T v="smallMuted" center style={{ marginTop: 6 }}>Os códigos ficam só no seu aparelho e não aparecem no roteiro compartilhado.</T>
        </>
        </>} side={<><T v="title" style={{ marginBottom: 12 }}>Preparação</T>
        <>
          <Card style={{ padding: 14, gap: 8 }}>
            <Row between><T v="lt">{done + ' de ' + cl.length + ' prontos'}</T><T v="smallMuted">{cl.length ? Math.round((done / cl.length) * 100) + '%' : ''}</T></Row>
            <Bar pct={cl.length ? (done / cl.length) * 100 : 0} />
          </Card>
          <Gap h={12} />
          <Card style={{ overflow: 'hidden' }}>
            {cl.map((x, i) => (
              <View key={x.id}>
                {i ? <Divider /> : null}
                <Row gap={0}>
                  <Check on={x.done} onPress={() => A.toggleCheck(x.id)} label={x.label} hint={x.hint} />
                  <IconBtn icon="x" flat size={36} label={'Remover ' + x.label} onPress={() => A.removeCheck(x.id)} />
                  <View style={{ width: 8 }} />
                </Row>
              </View>
            ))}
            {!cl.length ? <View style={{ padding: 16 }}><T v="smallMuted">Lista vazia. Adicione o que precisa preparar.</T></View> : null}
          </Card>
          <Gap h={12} />
          <Row gap={8}>
            <Grow><Input value={newItem} onChangeText={setNewItem} placeholder="Novo item (ex.: vacina, visto)" onSubmit={() => { A.addCheck(newItem); setNewItem(''); }} /></Grow>
            <IconBtn icon="plus" accent label="Adicionar item" onPress={() => { A.addCheck(newItem); setNewItem(''); }} />
          </Row>
        </>
        </>} />
      ) : tabId === 'reservas' ? (
        <>
          <Row gap={10}>
            <Btn grow icon="plus" label="Adicionar" onPress={() => A.openSheet('resForm', null)} />
            <Btn grow kind="secondary" icon="clip" label="Importar" onPress={importFile} />
          </Row>
          <Gap h={8} />
          <Gap h={8} />
          {!res.length ? <Empty icon="ticket" title="Nenhuma reserva" text="Guarde voos, hotéis e ingressos para ver tudo no roteiro do dia." /> : null}
          {res.map((r) => {
            const ty = RES_TYPES.find((x) => x.id === r.type) || RES_TYPES[0];
            const isOpen = open === r.id;
            return (
              <Card key={r.id} style={{ marginBottom: 10, overflow: 'hidden' }}>
                <ListRow iconEl={<TileIcon name={ty.icon} />} title={r.title} sub={ty.label + ' · ' + fmtShort(r.date) + (r.time ? ' · ' + r.time : '')} onPress={() => setOpen(isOpen ? null : r.id)}
                  right={<View style={{ backgroundColor: r.status === 'Confirmada' ? c.accTint : c.warnBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}><T v="small" color={r.status === 'Confirmada' ? c.accText : c.warnText} style={{ fontWeight: '700' }}>{r.status}</T></View>} />
                {isOpen ? (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
                    {r.code ? <Row between><T v="smallMuted">Código</T><T v="lt" style={{ letterSpacing: 1 }}>{r.code}</T></Row> : <T v="smallMuted">Sem código de confirmação</T>}
                    {r.details.map((d, i) => <T key={i} v="small">{d}</T>)}
                    {r.file ? <Row gap={6}><Icon name="clip" size={15} color={c.muted} /><T v="smallMuted">{r.file.name}</T></Row> : null}
                    <Row gap={8} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                      <Btn sm kind="secondary" label="Editar" onPress={() => A.openSheet('resForm', r)} />
                      <Btn sm kind="secondary" label={r.status === 'Confirmada' ? 'Marcar pendente' : 'Marcar confirmada'} onPress={() => A.toggleResStatus(r.id)} />
                      <Btn sm kind="ghost" label="Remover" color={c.errText} onPress={() => A.removeRes(r.id)} />
                    </Row>
                  </View>
                ) : null}
              </Card>
            );
          })}
          <T v="smallMuted" center style={{ marginTop: 6 }}>Os códigos ficam só no seu aparelho e não aparecem no roteiro compartilhado.</T>
        </>
      ) : (
        <>
          <Card style={{ padding: 14, gap: 8 }}>
            <Row between><T v="lt">{done + ' de ' + cl.length + ' prontos'}</T><T v="smallMuted">{cl.length ? Math.round((done / cl.length) * 100) + '%' : ''}</T></Row>
            <Bar pct={cl.length ? (done / cl.length) * 100 : 0} />
          </Card>
          <Gap h={12} />
          <Card style={{ overflow: 'hidden' }}>
            {cl.map((x, i) => (
              <View key={x.id}>
                {i ? <Divider /> : null}
                <Row gap={0}>
                  <Check on={x.done} onPress={() => A.toggleCheck(x.id)} label={x.label} hint={x.hint} />
                  <IconBtn icon="x" flat size={36} label={'Remover ' + x.label} onPress={() => A.removeCheck(x.id)} />
                  <View style={{ width: 8 }} />
                </Row>
              </View>
            ))}
            {!cl.length ? <View style={{ padding: 16 }}><T v="smallMuted">Lista vazia. Adicione o que precisa preparar.</T></View> : null}
          </Card>
          <Gap h={12} />
          <Row gap={8}>
            <Grow><Input value={newItem} onChangeText={setNewItem} placeholder="Novo item (ex.: vacina, visto)" onSubmit={() => { A.addCheck(newItem); setNewItem(''); }} /></Grow>
            <IconBtn icon="plus" accent label="Adicionar item" onPress={() => { A.addCheck(newItem); setNewItem(''); }} />
          </Row>
        </>
      )}
    </Screen>
  );
}

/* ====================== Assistente ====================== */
export function Assistant() {
  const s = useApp();
  const chatWide = useSite();
  const { c } = useTheme();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const scrollRef = useRef<any>(null);
  const t = A.currentTrip();
  const lis = !!t && t.id === 't1';
  const free = t ? freeDayOf(t) : -1;
  const chips: { k: AiKey; label: string }[] = lis ? [
    { k: 'roteiro', label: 'Sugerir roteiro para o Dia 6' }, { k: 'reorganizar', label: 'Reorganizar o Dia 2' },
    { k: 'chuva', label: 'Opções para dia de chuva' }, { k: 'comer', label: 'Onde comer perto de Belém' }, { k: 'orcamento', label: 'Como economizar?' }
  ] : [
    { k: 'roteiro', label: free >= 0 ? 'Sugerir roteiro para o Dia ' + (free + 1) : 'Sugerir um dia de roteiro' }, { k: 'reorganizar', label: 'Reorganizar um dia' },
    { k: 'chuva', label: 'Opções para dia de chuva' }, { k: 'comer', label: 'Onde comer bem' }, { k: 'orcamento', label: 'Como economizar?' }
  ];
  const send = (msg: string, key: AiKey) => {
    if (!msg.trim()) return;
    A.sendToAI(msg.trim(), key, setTyping);
    setText('');
    setTimeout(() => scrollRef.current && scrollRef.current.scrollToEnd && scrollRef.current.scrollToEnd({ animated: true }), 700);
  };
  const guessKey = (m: string): AiKey => {
    const n = m.toLowerCase();
    return /chuv/.test(n) ? 'chuva' : /comer|restaur|almo|jant/.test(n) ? 'comer' : /econom|gast|orçam|barat/.test(n) ? 'orcamento' : /reorgan|ordem|otimiz/.test(n) ? 'reorganizar' : /roteiro|dia|sugest|montar/.test(n) ? 'roteiro' : 'livre';
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen tabs={false} scrollRef={scrollRef}>
        <TopBar title="Assistente" onBack={A.back} />
        {t ? <T v="smallMuted" center style={{ marginTop: -10, marginBottom: 14 }}>{'Sobre a viagem para ' + t.name}</T> : null}
        {s.chat.map((m) => {
          const me = m.from === 'me', cd = m.card;
          const canApply = !!(cd && cd.action && !cd.applied && !cd.dismissed && t && cd.tripId === t.id && (cd.dayIdx || 0) < t.days.length);
          return (
            <View key={m.id} style={{ alignItems: me ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <View style={{ maxWidth: chatWide ? 760 : '86%', backgroundColor: me ? c.accBg : c.card, borderRadius: 18, borderBottomRightRadius: me ? 6 : 18, borderBottomLeftRadius: me ? 18 : 6, padding: 12, gap: 4 }}>
                {m.lines.map((l, i) => <T key={i} v="body" color={me ? '#FFFFFF' : c.ink}>{l}</T>)}
                {cd ? (
                  <View style={{ marginTop: 6, backgroundColor: c.soft, borderRadius: 12, padding: 10, gap: 4 }}>
                    <T v="small" style={{ fontWeight: '700' }}>{cd.title}</T>
                    {cd.items.map((it, i) => <Row key={i} gap={8} top><T v="small" style={{ fontWeight: '700', width: 44 }}>{it.time}</T><Grow><T v="small">{it.text}</T></Grow></Row>)}
                    {canApply ? (
                      <Row gap={8} style={{ marginTop: 6 }}>
                        <Btn sm label={'Aplicar no Dia ' + ((cd.dayIdx || 0) + 1)} onPress={() => A.applyCard(m.id)} />
                        <Btn sm kind="ghost" label="Agora não" onPress={() => A.dismissCard(m.id)} />
                      </Row>
                    ) : cd.applied ? <T v="small" color={c.accText} style={{ fontWeight: '700', marginTop: 4 }}>Aplicado ao roteiro</T> : null}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
        {typing ? <View style={{ alignSelf: 'flex-start', backgroundColor: c.card, borderRadius: 18, padding: 12, marginBottom: 10 }}><T v="smallMuted">Pensando…</T></View> : null}
        <Gap h={8} />
        <Chips>{chips.map((x) => <Chip key={x.k} label={x.label} onPress={() => send(x.label, x.k)} />)}</Chips>
        <Gap h={14} />
        <Row gap={8}>
          <Grow><Input value={text} onChangeText={setText} placeholder="Pergunte sobre a viagem" onSubmit={() => send(text, guessKey(text))} /></Grow>
          <IconBtn icon="send" accent label="Enviar" onPress={() => send(text, guessKey(text))} />
        </Row>
        <Gap h={10} />
        <T v="smallMuted" center>Sugestões montadas com o catálogo do Destí. Confira horários antes de ir.</T>
      </Screen>
    </View>
  );
}

/* Folhas que sobem de baixo: gasto, editar viagem, pessoas, compartilhar, e-mail, senha, excluir, login social, reserva */
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, KeyboardAvoidingView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../store/store';
import * as A from '../store/actions';
import { T, Row, Grow, Gap, Btn, LinkBtn, IconBtn, Icon, Chip, Chips, Seg, Input, Field, DateField, DateRange, TimeStepper, Note, Avatar, Card, Divider, ListRow, Picklist } from '../ui';
import { useTheme, useWide } from '../theme/useTheme';
import { radius, isIOS } from '../theme/theme';
import { BUDGET_CATS, CUR_SYMBOL, DEMO_RATES, STYLES, STYLE_INFO, PACES, RES_TYPES, DESTINATIONS, searchDest, continentOf, countryOf } from '../data';
import type { Expense, Reservation, Style, PaceId } from '../types';
import { tripCurrency, tripLegs, legName } from '../lib/trip';
import { tripMembers, memberName, travelersOf } from '../lib/group';
import { shareText, shareHtml } from '../lib/share';
import { passRules } from '../lib/auth';
import { copyText, shareTextNative, sharePdf } from '../lib/device';
import { SITE_URL, CLOUD_ENABLED } from '../config';
import { useFx } from '../lib/fx';
import * as P from '../store/publicLinks';
import { toBRL, parseDecimalBR, type Cur } from '../lib/expenseCore';
import { fmtMoney, money, maskToValue, plural, countDays, iso, addDays, parseD, norm, today0 } from '../lib/format';

const TITLES: Record<string, string> = {
  editTrip: 'Editar viagem', people: 'Pessoas da viagem', share: 'Compartilhar roteiro',
  password: 'Alterar senha', delete: 'Excluir conta', resForm: 'Reserva', join: 'Entrar numa viagem', restore: 'Restaurar backup'
};

export function SheetHost() {
  const s = useApp();
  const { c } = useTheme();
  const ins = useSafeAreaInsets();
  const wide = useWide();
  if (!s.sheet) return null;
  const arg = s.sheetArg;
  const title = s.sheet === 'expense' ? (arg && arg.mode === 'edit' ? 'Editar gasto' : arg && arg.mode === 'scan' ? 'Gasto com nota' : 'Novo gasto')
    : s.sheet === 'resForm' ? (arg && arg.id ? 'Editar reserva' : 'Nova reserva') : TITLES[s.sheet] || '';
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50 }}>
      <Pressable accessibilityLabel="Fechar" onPress={A.closeSheet} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.scrim }} />
      <KeyboardAvoidingView behavior={isIOS ? 'padding' : undefined} style={wide ? { position: 'absolute', left: 0, right: 0, bottom: '6%', top: '6%', justifyContent: 'center' } : { position: 'absolute', left: 0, right: 0, bottom: 0, top: '8%', justifyContent: 'flex-end' }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderBottomLeftRadius: wide ? radius.sheet : 0, borderBottomRightRadius: wide ? radius.sheet : 0, paddingBottom: ins.bottom + 12, maxWidth: 640, width: '100%', alignSelf: 'center', maxHeight: '100%', flexShrink: 1 }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line3 }} /></View>
          <Row between style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}>
            <T v="h2">{title}</T>
            <IconBtn icon="x" flat size={40} label="Fechar" onPress={A.closeSheet} />
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            {s.sheet === 'expense' ? <ExpenseSheet key={JSON.stringify(arg && arg.exp ? arg.exp.id : arg)} arg={arg || {}} /> : null}
            {s.sheet === 'editTrip' ? <EditTripSheet /> : null}
            {s.sheet === 'people' ? <PeopleSheet /> : null}
            {s.sheet === 'share' ? <ShareSheet /> : null}
            {s.sheet === 'password' ? <PasswordSheet /> : null}
            {s.sheet === 'delete' ? <DeleteSheet /> : null}
            {s.sheet === 'resForm' ? <ResSheet arg={arg} /> : null}
            {s.sheet === 'join' ? <JoinSheet arg={arg} /> : null}
            {s.sheet === 'restore' ? <RestoreSheet arg={arg} /> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ---------- Gasto ---------- */
function ExpenseSheet({ arg }: { arg: { mode?: 'manual' | 'scan' | 'edit'; exp?: Expense; receipt?: string | null } }) {
  const s = useApp();
  const { c } = useTheme();
  const t = A.currentTrip()!;
  const e = arg.exp;
  const members = tripMembers(t), group = members.length > 1;
  /* gasto novo começa sempre em reais (o orçamento é em reais); € e US$ só quando a pessoa escolher */
  const cur0 = e && e.orig ? e.orig.currency : 'BRL';
  const localCur = tripCurrency(t, s.day);
  const [amount, setAmount] = useState(e ? String(e.orig ? e.orig.value : e.amount) : '');
  const [currency, setCurrency] = useState<string>(cur0);
  /* cotação do dia (a mesma do topo do site); sem internet, a última guardada; sem nenhuma, um valor de referência */
  const fx = useFx(true);
  const liveRate = (code: string) => { const x = fx && fx.rates.find((q) => q.code === code); return x ? x.brl : null; };
  const fmtRateBr = (v: number) => v.toFixed(2).replace('.', ',');
  const rateFor = (code: string) => fmtRateBr(liveRate(code) || DEMO_RATES[code] || 0);
  const [rate, setRate] = useState(e && e.orig ? String(e.orig.rate).replace('.', ',') : cur0 !== 'BRL' ? rateFor(cur0) : '');
  /* a pessoa digitou a cotação (ou é um gasto já salvo): não troca sozinha */
  const [rateTouched, setRateTouched] = useState(!!(e && e.orig));
  useEffect(() => { if (!rateTouched && currency !== 'BRL' && liveRate(currency)) setRate(rateFor(currency)); }, [fx, currency]);
  const [title, setTitle] = useState(e ? e.title : '');
  const [cat, setCat] = useState(e ? e.cat : 'alimentacao');
  const today = iso(today0());
  const [date, setDate] = useState(e ? e.date || '' : today >= t.start && today <= t.end ? today : '');
  const [method, setMethod] = useState(e ? e.method || 'Cartão' : 'Cartão');
  const [receipt, setReceipt] = useState<string | null>(e ? e.receipt || null : arg.receipt || null);
  const [paidBy, setPaidBy] = useState(e ? e.paidBy || 'me' : 'me');
  const [split, setSplit] = useState<string[]>(e && e.split ? e.split : members.map((m) => m.id));
  const [err, setErr] = useState<Record<string, string>>({});
  const val = Number(amount), r = parseDecimalBR(rate);
  const conv = toBRL(amount, currency as Cur, rate);
  const brlV = conv.ok ? conv.brl : 0;
  const pickReceipt = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
      if (!res.canceled && res.assets && res.assets.length) setReceipt(res.assets[0].uri);
    } catch { A.showToast('Não foi possível abrir as fotos'); }
  };
  const save = () => setErr(A.saveExpense({ id: e ? e.id : null, amount, currency, rate, title, cat, date, method, receipt, paidBy, split }));
  return (
    <View>
      {arg.mode === 'scan' ? (
        <Card flat style={{ padding: 12, marginBottom: 16, gap: 8 }}>
          {receipt ? <Image source={{ uri: receipt }} style={{ width: '100%', height: 160, borderRadius: 10 }} resizeMode="cover" accessibilityLabel="Foto da nota" /> : null}
          <T v="smallMuted">Confira a nota e digite o valor e a descrição abaixo. A foto fica guardada junto com o gasto.</T>
        </Card>
      ) : null}
      <Field label="Valor" error={err.amount}>
        <Seg value={currency} onChange={(v) => { setCurrency(v); if (v !== 'BRL' && (!rateTouched || !rate)) { setRate(rateFor(v)); setRateTouched(false); } }} options={['BRL', 'EUR', 'USD'].map((k) => ({ id: k, label: CUR_SYMBOL[k] }))} />
        <Gap h={8} />
        <Input prefix={CUR_SYMBOL[currency]} value={amount ? fmtMoney(val) : ''} onChangeText={(v) => setAmount(maskToValue(v, 10))} keyboard="number-pad" placeholder="0,00" error={!!err.amount} label={'Valor em ' + (currency === 'BRL' ? 'reais' : currency === 'EUR' ? 'euros' : 'dólares')} />
        {currency === 'BRL' && localCur !== 'BRL' && !e ? <T v="smallMuted" style={{ marginTop: 6 }}>{'Pagou em ' + (localCur === 'EUR' ? 'euro' : 'dólar') + '? Toque em ' + CUR_SYMBOL[localCur] + ' acima para converter pela cotação.'}</T> : null}
      </Field>
      {currency !== 'BRL' ? (
        <Field label={'Cotação: R$ por 1 ' + CUR_SYMBOL[currency]} error={err.rate}>
          <Input value={rate} onChangeText={(v) => { setRateTouched(true); setRate(v.replace(/[^0-9.,]/g, '')); }} keyboard="decimal-pad" placeholder="6,20" error={!!err.rate} />

          {(() => {
            const lv = liveRate(currency);
            if (!lv) return <T v="smallMuted" style={{ marginTop: 4 }}>Não deu para buscar a cotação de hoje. Confira o valor (o banco ou o cartão mostram a cotação usada).</T>;
            const same = Math.abs(lv - r) < 0.005;
            return (
              <Row gap={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
                <T v="smallMuted">{'Cotação agora: R$ ' + fmtRateBr(lv)}</T>
                {!same ? <LinkBtn label="Usar a cotação agora" onPress={() => { setRate(fmtRateBr(lv)); setRateTouched(false); }} /> : null}
              </Row>
            );
          })()}
        </Field>
      ) : null}
      <Field label="Descrição" error={err.title}><Input value={title} onChangeText={setTitle} placeholder="Ex.: almoço, táxi, museu" error={!!err.title} /></Field>
      <Field label="Categoria"><Chips>{BUDGET_CATS.map((k) => <Chip key={k.id} label={k.label} icon={k.icon} on={cat === k.id} onPress={() => setCat(k.id)} />)}</Chips></Field>
      <Field label="Pagamento"><Seg value={method} onChange={setMethod} options={['Cartão', 'Dinheiro', 'Pix'].map((m) => ({ id: m, label: m }))} /></Field>
      <DateField label="Data (opcional)" value={date} min={iso(addDays(parseD(t.start), -120))} max={t.end} onChange={setDate} />
      {group ? (
        <>
          <Field label="Quem pagou"><Chips>{members.map((m) => <Chip key={m.id} label={m.id === 'me' ? 'Você' : m.name} on={paidBy === m.id} onPress={() => setPaidBy(m.id)} />)}</Chips></Field>
          <Field label="Dividir entre" error={err.split}>
            <Chips>{members.map((m) => <Chip key={m.id} label={m.id === 'me' ? 'Você' : m.name} on={split.indexOf(m.id) >= 0} onPress={() => setSplit(split.indexOf(m.id) >= 0 ? split.filter((x) => x !== m.id) : split.concat([m.id]))} />)}</Chips>
            {split.length ? <T v="smallMuted" style={{ marginTop: 6 }}>{brlV > 0 ? money(brlV / split.length) + ' para cada ' + (split.length === 1 ? 'pessoa' : 'uma das ' + split.length + ' pessoas') : 'Dividido em partes iguais entre ' + plural(split.length, 'pessoa', 'pessoas')}</T> : null}
          </Field>
        </>
      ) : null}
      <Field label="Nota fiscal">
        {receipt ? (
          <Row>
            <Image source={{ uri: receipt }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: c.soft }} accessibilityLabel="Nota anexada" />
            <Grow><T v="small">Nota anexada</T></Grow>
            <Btn sm kind="ghost" label="Remover" onPress={() => setReceipt(null)} />
          </Row>
        ) : <Btn sm kind="secondary" icon="camera" label="Anexar foto da nota" onPress={pickReceipt} />}
      </Field>
      {/* resumo antes de registrar: valor original e quanto entra no orçamento */}
      {conv.ok ? (
        <Card flat label="Resumo do gasto" style={{ padding: 12, marginBottom: 12, gap: 2 }}>
          <T v="smallMuted">Vai entrar no orçamento</T>
          <T v="h2">{money(conv.brl)}</T>
          {conv.orig ? <T v="smallMuted">{CUR_SYMBOL[conv.orig.currency] + ' ' + fmtMoney(conv.orig.value) + ' × R$ ' + fmtRateBr(conv.orig.rate) + ' (cotação usada)'}</T> : <T v="smallMuted">Valor em reais, sem conversão</T>}
        </Card>
      ) : null}
      <Btn label={(e ? 'Salvar ' : 'Registrar ') + (conv.ok ? money(conv.brl) : 'gasto')} block onPress={save} />
      {e ? <><Gap h={8} /><Btn kind="ghost" label="Excluir gasto" color={c.errText} block onPress={() => A.removeExpense(e.id)} /></> : null}
    </View>
  );
}

/* ---------- Editar viagem ---------- */
function EditTripSheet() {
  const { c } = useTheme();
  const t = A.currentTrip()!;
  const [start, setStart] = useState(t.start);
  const [end, setEnd] = useState(t.end);
  const [travelers, setTrav] = useState(travelersOf(t));
  const [budget, setBudget] = useState(t.budget ? String(t.budget) : '');
  const [styles, setStyles] = useState<Style[]>(t.styles.slice());
  const [pace, setPace] = useState<PaceId>(t.pace || 'equilibrado');
  const [err, setErr] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [stops, setStops] = useState(tripLegs(t).map((L) => ({ destId: L.destId, name: legName(L), days: L.days })));
  const [pick, setPick] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const n = start && end && end >= start ? countDays(start, end) : null;
  const firstDays = n === null ? null : n - stops.slice(1).reduce((a, x) => a + x.days, 0);
  const stopCountries = stops.map((x) => countryOf(x.destId)).filter((x, i, a) => x && a.indexOf(x) === i);
  const moveStop = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= stops.length) return; const all = stops.slice(); const tmp = all[i]; all[i] = all[j]; all[j] = tmp; setStops(all); setPick(null); };
  const suggest = () => {
    const used = stops.map((x) => x.destId), cont = continentOf(stops[stops.length - 1].destId);
    const near = DESTINATIONS.filter((d) => used.indexOf(d.id) < 0 && cont && continentOf(d.id) === cont);
    return near.concat(DESTINATIONS.filter((d) => used.indexOf(d.id) < 0 && near.indexOf(d) < 0)).slice(0, 6);
  };
  const addStop = () => { const sg = suggest()[0] || DESTINATIONS[0]; setStops(stops.concat([{ destId: sg.id, name: sg.name, days: 2 }])); setPick(stops.length); setQ(''); };
  const cut = n && n < t.days.length && t.days.slice(n).some((d) => d.length);
  const toggle = (st: Style) => setStyles(styles.indexOf(st) >= 0 ? styles.filter((x) => x !== st) : styles.length >= 2 ? [styles[1], st] : styles.concat([st]));
  return (
    <View>
      <T v="muted" style={{ marginBottom: 14 }}>{t.name + (t.country ? ', ' + t.country : '')}</T>
      <DateRange start={start} end={end} onStart={setStart} onEnd={setEnd} errStart={err.start} errEnd={err.end} />
      {n ? <T v="smallMuted" style={{ marginBottom: 6 }}>{plural(n, 'dia', 'dias') + ' de viagem'}</T> : null}
      {cut ? <Note kind="note" style={{ marginBottom: 10 }}>{'Com as novas datas, ' + (n! + 1 === t.days.length ? 'o Dia ' + t.days.length + ' sairá' : 'os dias ' + (n! + 1) + ' a ' + t.days.length + ' sairão') + ' do roteiro.'}</Note> : null}
      <Field label={'Paradas' + (stopCountries.length > 1 ? ' · ' + plural(stopCountries.length, 'país', 'países') : '')} error={err.legs}>
        <Card flat style={{ overflow: 'hidden' }}>
          {stops.map((st, i) => (
            <View key={i + st.destId} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line, padding: 10, gap: 6 }}>
              <Row gap={10}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}><T v="small" color={c.onInk} style={{ fontWeight: '700' }}>{String(i + 1)}</T></View>
                <Grow>
                  <Pressable accessibilityRole="button" accessibilityLabel={'Trocar ' + st.name} onPress={() => { setPick(pick === i ? null : i); setQ(''); }}>
                    <Row gap={6}><T v="lt" lines={1}>{st.name}</T><Icon name="edit" size={14} color={c.muted} /></Row>
                  </Pressable>
                  <T v="smallMuted" lines={1}>{(countryOf(st.destId) || 'Destino') + ' · ' + (i === 0 ? (firstDays === null ? 'dias que sobram' : firstDays >= 1 ? plural(firstDays, 'dia', 'dias') + (stops.length > 1 ? ' (os que sobram)' : '') : 'sem dias sobrando') : plural(st.days, 'dia', 'dias'))}</T>
                </Grow>
                {stops.length > 1 ? <IconBtn icon="x" flat size={32} label={'Tirar ' + st.name} onPress={() => { setStops(stops.filter((_, k) => k !== i)); setPick(null); }} /> : null}
              </Row>
              {stops.length > 1 ? (
                <Row gap={6} style={{ paddingLeft: 36 }}>
                  {i > 0 ? <><IconBtn icon="minus" flat size={32} label={'Menos um dia em ' + st.name} onPress={() => setStops(stops.map((x, k) => (k === i ? { ...x, days: Math.max(1, x.days - 1) } : x)))} />
                  <IconBtn icon="plus" flat size={32} label={'Mais um dia em ' + st.name} onPress={() => setStops(stops.map((x, k) => (k === i ? { ...x, days: Math.min(60, x.days + 1) } : x)))} /></> : null}
                  <Grow />
                  <IconBtn icon="chevU" flat size={32} label={'Subir ' + st.name} onPress={() => moveStop(i, -1)} />
                  <IconBtn icon="chevD" flat size={32} label={'Descer ' + st.name} onPress={() => moveStop(i, 1)} />
                </Row>
              ) : null}
              {pick === i ? (
                <View style={{ gap: 6 }}>
                  <Input value={q} onChangeText={setQ} icon="search" placeholder="Buscar cidade ou país" caps="words" />
                  {(q ? searchDest(q) : suggest()).map((o) => (
                    <ListRow key={o.id} title={o.name} sub={(o.kind === 'country' ? 'País inteiro · ' + o.country : o.country) + (o.kind === 'catalog' ? ' · roteiro automático' : '')}
                      onPress={() => { setStops(stops.map((x, k) => (k === i ? { ...x, destId: o.id, name: o.name } : x))); setPick(null); }} />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </Card>
        {stops.length < 10 ? <View style={{ alignItems: 'flex-start', marginTop: 6 }}><LinkBtn label="+ Adicionar parada (cidade ou país)" onPress={addStop} /></View> : null}
        <T v="smallMuted">Os dias que você já montou continuam na mesma cidade. Dias novos são montados automaticamente.</T>
      </Field>
      <Field label="Viajantes" error={err.travelers}>
        <Row gap={14}>
          <IconBtn icon="minus" label="Menos um viajante" onPress={() => setTrav(Math.max(1, travelers - 1))} />
          <T v="lt">{plural(travelers, 'viajante', 'viajantes')}</T>
          <IconBtn icon="plus" label="Mais um viajante" onPress={() => setTrav(Math.min(20, travelers + 1))} />
        </Row>
        <T v="smallMuted" style={{ marginTop: 4 }}>É a mesma lista de Pessoas da viagem: quem ainda não tem nome aparece como "Viajante 2", "Viajante 3"…</T>
      </Field>
      <Field label="Orçamento total (opcional)" error={err.budget}><Input prefix="R$" placeholder="Sem orçamento" value={Number(budget) ? fmtMoney(Number(budget)) : ''} onChangeText={(v) => setBudget(maskToValue(v))} keyboard="number-pad" error={!!err.budget} /></Field>
      <Field label="Estilo" error={err.styles}><Picklist label="Estilo" placeholder="Escolha até 2 estilos" error={!!err.styles} options={STYLES.map((st) => ({ id: st, label: st, icon: STYLE_INFO[st].icon, hint: STYLE_INFO[st].short }))} value={styles} onToggle={(id) => toggle(id as any)} /></Field>
      <Field label="Ritmo"><Seg value={pace} onChange={setPace} options={PACES.map((p) => ({ id: p.id, label: p.label }))} /></Field>
      <Btn label="Salvar" block onPress={() => setErr(A.saveTripEdit({ start, end, travelers, budget, styles, pace, stops }))} />
      <Gap h={18} />
      {confirm ? (
        <Card flat style={{ padding: 14, gap: 10 }}>
          <T v="lt">{'Excluir ' + t.name + '?'}</T>
          <T v="smallMuted">Roteiro, gastos e reservas desta viagem serão apagados. Dá para desfazer logo depois.</T>
          <Row gap={10}><Btn grow kind="secondary" label="Cancelar" onPress={() => setConfirm(false)} /><Btn grow kind="danger" label="Excluir" onPress={A.deleteTrip} /></Row>
        </Card>
      ) : <Btn kind="ghost" label="Excluir viagem" color={c.errText} block onPress={() => setConfirm(true)} />}
    </View>
  );
}

/* ---------- Pessoas da viagem ---------- */
function PeopleSheet() {
  const s = useApp();
  const { c } = useTheme();
  const t = A.currentTrip()!;
  const [name, setName] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editErr, setEditErr] = useState('');
  const ms = tripMembers(t);
  const slots = ms.filter((m) => m.placeholder).length;
  const label = (id: string) => (id === 'me' ? (s.user && s.user.name) || 'Você' : memberName(t, id));
  const add = () => { const e = A.invite(name); setErr(e); if (!Object.keys(e).length) setName(''); };
  const saveName = (id: string) => { const e = A.renameMember(id, draft); setEditErr(e || ''); if (!e) setEditing(null); };
  return (
    <View>
      <GroupBox />
      <T v="title" style={{ marginTop: 20, marginBottom: 6 }}>Quem vai</T>
      <T v="smallMuted" style={{ marginBottom: 12 }}>{t.name + ' · ' + plural(ms.length, 'pessoa', 'pessoas') + ' na divisão dos gastos. Gastos sem divisão definida são divididos entre todos.' + (slots ? ' Toque no lápis para pôr o nome de quem ainda aparece como "Viajante".' : '')}</T>
      <Card style={{ overflow: 'hidden' }}>
        {ms.map((m, i) => {
          const canRename = m.id !== 'me' && !/^u:/.test(m.id);
          const canRemove = m.id !== 'me' && (!/^u:/.test(m.id) || !!(t.shared && s.user && t.shared.owner === s.user.id));
          if (editing === m.id) {
            return (
              <View key={m.id} style={{ padding: 12, gap: 8 }}>
                {i ? <Divider /> : null}
                <Field label={'Nome de ' + m.name} error={editErr}><Input value={draft} onChangeText={setDraft} placeholder="Nome" caps="words" error={!!editErr} onSubmit={() => saveName(m.id)} /></Field>
                <Row gap={10}><Btn grow kind="secondary" label="Cancelar" onPress={() => { setEditing(null); setEditErr(''); }} /><Btn grow label="Salvar nome" onPress={() => saveName(m.id)} /></Row>
              </View>
            );
          }
          return (
            <View key={m.id}>
              {i ? <Divider /> : null}
              <ListRow iconEl={<Avatar size={38} letter={label(m.id).charAt(0).toUpperCase()} />} title={m.id === 'me' ? label('me') + ' (você)' : m.name}
                sub={m.placeholder ? 'Sem nome ainda · participa da divisão' : m.status === 'owner' ? (t.shared ? 'Criou a viagem · edita pelo próprio celular' : 'Organizador') : m.id === 'me' || /^u:/.test(m.id) ? 'Edita a viagem pelo próprio celular' : 'Participa da divisão dos gastos'}
                right={<Row gap={2}>
                  {canRename ? <IconBtn icon="edit" flat size={36} label={'Mudar o nome de ' + m.name} onPress={() => { setEditing(m.id); setDraft(m.placeholder ? '' : m.name); setEditErr(''); }} /> : null}
                  {canRemove ? <IconBtn icon="x" flat size={36} label={'Remover ' + m.name} onPress={() => A.removeMember(m.id)} /> : null}
                </Row>} />
            </View>
          );
        })}
      </Card>
      <T v="title" style={{ marginTop: 20, marginBottom: 6 }}>Adicionar pessoa pelo nome</T>
      <T v="smallMuted" style={{ marginBottom: 10 }}>{(slots ? 'O nome ocupa o lugar do primeiro "Viajante" sem nome. ' : '') + 'Para quem não vai usar o app: entra na divisão dos gastos, mas não edita a viagem.'}</T>
      <Field label="Nome" error={err.name}><Input value={name} onChangeText={setName} placeholder="Nome de quem vai junto" caps="words" error={!!err.name} onSubmit={add} /></Field>
      <Btn label="Adicionar" icon="plus" block onPress={add} />
      <Gap h={8} />
      <Btn kind="ghost" icon="share" label="Mandar o roteiro para o grupo" block onPress={() => shareTextNative('Roteiro · ' + t.name, shareText(t, s.reservations))} />
    </View>
  );
}

/* ---------- Editar junto: cada pessoa no seu celular ---------- */
function inviteLink(code: string) { return SITE_URL.replace(/\/+$/, '') + '/convite/?c=' + code; }
function inviteText(name: string, code: string) {
  return 'Vamos montar juntos a viagem ' + name + ' no Destí! Abra o link e entre com a sua conta: ' + inviteLink(code) + '\nOu, no app, toque em Viagens › Entrar com código e digite ' + code + '.';
}
function GroupBox() {
  const s = useApp();
  const { c } = useTheme();
  const t = A.currentTrip()!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sure, setSure] = useState(false);
  const run = async (f: () => Promise<string | null>) => { setBusy(true); setErr(''); const e = await f(); setBusy(false); if (e) setErr(e); };
  const owner = !!(t.shared && s.user && t.shared.owner === s.user.id);
  if (!CLOUD_ENABLED || !A.canEditTogether()) {
    return (
      <Card flat style={{ padding: 14, gap: 6 }}>
        <Row gap={8}><Icon name="users" size={18} color={c.acc} /><T v="lt">Editar junto, cada um no seu celular</T></Row>
        <T v="smallMuted">{CLOUD_ENABLED ? 'Entre com uma conta para convidar outras pessoas: todo mundo vê e edita o mesmo roteiro, gastos e reservas.' : 'Disponível quando o app estiver ligado à nuvem.'}</T>
      </Card>
    );
  }
  if (!t.shared) {
    return (
      <Card flat style={{ padding: 14, gap: 8 }}>
        <Row gap={8}><Icon name="users" size={18} color={c.acc} /><T v="lt">Editar junto, cada um no seu celular</T></Row>
        <T v="smallMuted">Convide quem vai com você. Cada pessoa entra com a própria conta e todo mundo vê e edita o mesmo roteiro, gastos, reservas e checklist. As mudanças aparecem para todos em segundos.</T>
        {err ? <Note kind="err">{err}</Note> : null}
        <Btn icon="users" label={busy ? 'Criando convite…' : 'Convidar para editar junto'} block onPress={() => !busy && run(A.shareTripLive)} />
      </Card>
    );
  }
  const code = t.shared.code;
  return (
    <Card flat style={{ padding: 14, gap: 8 }}>
      <Row gap={8}><Icon name="users" size={18} color={c.acc} /><T v="lt">Viagem em grupo</T><Grow /><T v="smallMuted" color={c.acc}>{s.syncState === 'offline' ? 'sem conexão' : 'sincronizada'}</T></Row>
      <T v="smallMuted">Todo mundo do grupo edita esta viagem pelo próprio celular. As mudanças aparecem para todos em segundos.</T>
      {code ? (
        <>
          <T v="smallMuted" style={{ marginTop: 4 }}>Código do convite</T>
          <T v="h2" style={{ letterSpacing: 4 }}>{code}</T>
          <Btn icon="share" label="Enviar convite" block onPress={() => shareTextNative('Convite · ' + t.name, inviteText(t.name, code))} />
          <Btn kind="secondary" icon="copy" label="Copiar link do convite" block onPress={async () => A.showToast((await copyText(inviteLink(code))) ? 'Link copiado' : 'Não foi possível copiar')} />
        </>
      ) : <Btn icon="share" label={busy ? 'Criando convite…' : 'Criar código de convite'} block onPress={() => !busy && run(A.newInviteCode)} />}
      {err ? <Note kind="err">{err}</Note> : null}
      <Btn kind="ghost" icon="refresh" label="Atualizar agora" block onPress={A.syncGroupNow} />
      {sure ? (
        <Card style={{ padding: 12, gap: 8 }}>
          <T v="smallMuted">{owner ? 'Ninguém mais vai conseguir editar. Quem participava fica com uma cópia da viagem como está agora.' : 'A viagem sai deste aparelho e você deixa de ver as mudanças do grupo. Dá para voltar com um novo convite.'}</T>
          <Row gap={10}><Btn grow kind="secondary" label="Cancelar" onPress={() => setSure(false)} /><Btn grow kind="danger" label={owner ? 'Encerrar grupo' : 'Sair'} onPress={() => run(A.leaveGroup)} /></Row>
        </Card>
      ) : <Btn kind="ghost" label={owner ? 'Encerrar o grupo' : 'Sair desta viagem em grupo'} color={c.errText} block onPress={() => setSure(true)} />}
    </Card>
  );
}
function JoinSheet({ arg }: { arg: any }) {
  const [code, setCode] = useState(typeof arg === 'string' ? arg : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => { if (busy) return; setBusy(true); const e = await A.joinByCode(code); setBusy(false); setErr(e || ''); };
  return (
    <View>
      <T v="smallMuted" style={{ marginBottom: 12 }}>Recebeu um convite? Digite o código (ou cole o link) para entrar na viagem e editar junto com o grupo.</T>
      <Field label="Código do convite" error={err}><Input value={code} onChangeText={setCode} placeholder="Ex.: K7M2QX9P" caps="characters" error={!!err} onSubmit={go} /></Field>
      <Btn label={busy ? 'Entrando…' : 'Entrar na viagem'} block onPress={go} />
    </View>
  );
}

/* ---------- Compartilhar ---------- */
function ShareSheet() {
  const s = useApp();
  const { c } = useTheme();
  const t = A.currentTrip()!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sure, setSure] = useState(false);
  const url = t.publicId ? P.linkOf(t.publicId) : '';
  const text = shareText(t, s.reservations) + (url ? '\n\nVeja o roteiro completo: ' + url : '');
  const make = async () => { if (busy) return; setBusy(true); setErr(''); const r = await P.createPublicLink(t.id); setBusy(false); if (r.error) setErr(r.error); else A.showToast('Link público pronto. Copie ou envie quando quiser.'); };
  const off = async () => { setBusy(true); const e = await P.disablePublicLink(t.id); setBusy(false); setSure(false); if (e) setErr(e); else A.showToast('Link desativado. Quem abrir o link verá que ele não existe mais.'); };
  return (
    <View>
      {/* link público: abre em qualquer aparelho, sem conta, só para ver */}
      <Card flat style={{ padding: 14, gap: 8, marginBottom: 16 }}>
        <Row gap={8}><Icon name="link" size={18} color={c.acc} /><T v="lt">Compartilhar roteiro público (só para ver)</T></Row>
        {!url ? (
          <>
            <T v="smallMuted">Gera um link que qualquer pessoa abre sem conta, em qualquer navegador, para ver destino, datas e o que fazer em cada dia. Gastos, reservas, códigos e nomes não aparecem.</T>
            {P.canPublish() ? <Btn icon="link" label={busy ? 'Gerando o link…' : 'Compartilhar roteiro público'} block onPress={make} /> : (
              <>
                <Note kind="info">Para gerar um link público, crie uma conta ou sincronize esta viagem. Enquanto isso, use Copiar texto ou Gerar PDF abaixo.</Note>
                {s.user && s.user.method === 'guest' ? <Btn kind="secondary" label="Criar conta (a viagem vai junto)" block onPress={A.guestToSignup} /> : null}
              </>
            )}
          </>
        ) : (
          <>
            <T v="smallMuted">O link mostra sempre a versão mais nova do roteiro. Só leitura: ninguém consegue editar por ele.</T>
            <View accessibilityLabel={'Link público: ' + url} style={{ backgroundColor: c.soft, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 }}><T v="small" selectable color={c.ink2}>{url}</T></View>
            <Row gap={10}>
              <Btn grow kind="secondary" icon="copy" label="Copiar link" onPress={async () => A.showToast((await copyText(url)) ? 'Link copiado' : 'Não foi possível copiar. Selecione o link e copie à mão.')} />
              <Btn grow kind="secondary" icon="share" label="Enviar link" onPress={() => shareTextNative('Roteiro · ' + t.name, 'Roteiro da viagem ' + t.name + ' no Destí: ' + url)} />
            </Row>
            {sure ? (
              <Card style={{ padding: 12, gap: 8 }}>
                <T v="smallMuted">Quem já tem o link deixa de ver o roteiro. Dá para criar outro link depois.</T>
                <Row gap={10}><Btn grow kind="secondary" label="Cancelar" onPress={() => setSure(false)} /><Btn grow kind="danger" label="Desativar" onPress={off} /></Row>
              </Card>
            ) : <Btn kind="ghost" label="Desativar link" color={c.errText} block onPress={() => setSure(true)} />}
          </>
        )}
        {err ? <Note kind="err">{err}</Note> : null}
      </Card>
      {/* outro fluxo: editar junto (cada pessoa com a própria conta) */}
      <Card flat style={{ padding: 14, gap: 8, marginBottom: 16 }}>
        <Row gap={8}><Icon name="users" size={18} color={c.acc} /><T v="lt">Convidar para editar junto</T></Row>
        <T v="smallMuted">Para quem vai com você: a pessoa entra com a própria conta e edita o roteiro, os gastos e as reservas. Não é o mesmo que o link público.</T>
        <Btn kind="secondary" icon="users" label="Convidar para editar junto" block onPress={() => A.openSheet('people')} />
      </Card>
      <T v="lt" style={{ marginBottom: 8 }}>Texto do roteiro</T>
      <Card flat style={{ overflow: 'hidden' }}>
        <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} contentContainerStyle={{ padding: 12 }}><T v="small" color={c.ink2}>{text}</T></ScrollView>
      </Card>
      <T v="smallMuted" style={{ marginTop: 8, marginBottom: 14 }}>Códigos de reserva e valores não entram no roteiro compartilhado.</T>
      <Btn icon="share" label="Enviar texto (WhatsApp, e-mail…)" block onPress={() => shareTextNative('Roteiro · ' + t.name, text)} />
      <Gap h={10} />
      <Btn kind="secondary" icon="copy" label="Copiar texto" block onPress={async () => A.showToast((await copyText(text)) ? 'Roteiro copiado. Cole no WhatsApp, e-mail ou notas.' : 'Não foi possível copiar')} />
      <Gap h={10} />
      <Btn kind="secondary" icon="doc" label="Gerar PDF" block onPress={async () => { if (!(await sharePdf(shareHtml(t), 'Roteiro ' + t.name))) A.showToast('Este navegador não deixou abrir o PDF. Libere janelas pop-up para este site ou use Copiar texto.'); }} />
    </View>
  );
}

/* ---------- Restaurar backup: juntar (não apaga nada) ou substituir ---------- */
function RestoreSheet({ arg }: { arg: { data: any } }) {
  const s = useApp();
  const d = arg && arg.data;
  if (!d) return <Note kind="err">Não deu para ler o backup. Nada foi alterado.</Note>;
  const nT = d.trips.length, nE = (d.expenses || []).length, nR = (d.reservations || []).length;
  return (
    <View style={{ gap: 12 }}>
      <T v="muted">{'O arquivo tem ' + plural(nT, 'viagem', 'viagens') + ', ' + plural(nE, 'gasto', 'gastos') + ' e ' + plural(nR, 'reserva', 'reservas') + '. Neste aparelho há ' + plural(s.trips.length, 'viagem', 'viagens') + '.'}</T>
      <Card flat style={{ padding: 14, gap: 6 }}>
        <T v="lt">Juntar (recomendado)</T>
        <T v="smallMuted">Adiciona as viagens do backup às de agora. Nada é apagado; viagens que já estão aqui ficam como estão.</T>
        <Btn label="Juntar com as minhas viagens" block onPress={() => A.applyBackup(d, 'merge')} />
      </Card>
      <Card flat style={{ padding: 14, gap: 6 }}>
        <T v="lt">Substituir tudo</T>
        <T v="smallMuted">Troca todas as viagens, gastos e reservas deste aparelho pelas do backup. Logo depois aparece "Desfazer" para voltar atrás.</T>
        <Btn kind="secondary" label="Substituir pelas do backup" block onPress={() => A.applyBackup(d, 'replace')} />
      </Card>
    </View>
  );
}

/* ---------- Senha ---------- */
function PasswordSheet() {
  const { c } = useTheme();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [nw2, setNw2] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});
  return (
    <View>
      <Field label="Senha atual" error={err.cur}><Input value={cur} onChangeText={setCur} secure caps="none" autoComplete="password" error={!!err.cur} /></Field>
      <Field label="Nova senha" error={err.nw}>
        <Input value={nw} onChangeText={setNw} secure caps="none" autoComplete="new-password" error={!!err.nw} />
        {nw ? <View style={{ marginTop: 8, gap: 3 }}>{passRules(nw).map((r) => <Row key={r.label} gap={6}><Icon name={r.ok ? 'check' : 'dot'} size={14} color={r.ok ? c.acc : c.muted2} /><T v="smallMuted">{r.label}</T></Row>)}</View> : null}
      </Field>
      <Field label="Confirme a nova senha" error={err.nw2}><Input value={nw2} onChangeText={setNw2} secure caps="none" autoComplete="new-password" error={!!err.nw2} /></Field>
      {err.form ? <Note kind="err" style={{ marginBottom: 12 }}>{err.form}</Note> : null}
      <Btn label="Alterar senha" block onPress={async () => setErr(await A.changePassword(cur, nw, nw2))} />
    </View>
  );
}

/* ---------- Excluir conta ---------- */
function DeleteSheet() {
  const s = useApp();
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locked = txt.trim().toUpperCase() !== 'EXCLUIR' || busy;
  const cloud = !!(s.user && s.user.id);
  return (
    <View>
      <T v="muted">{cloud
        ? 'Sua conta, suas viagens, gastos, reservas e preferências serão apagados da nuvem e deste aparelho. Isso não pode ser desfeito.'
        : 'Suas viagens, gastos, reservas e preferências serão apagados deste aparelho. Isso não pode ser desfeito.'}</T>
      <Gap h={14} />
      {err ? <Note kind="err" style={{ marginBottom: 12 }}>{err}</Note> : null}
      <Field label="Digite EXCLUIR para confirmar"><Input value={txt} onChangeText={setTxt} caps="characters" placeholder="EXCLUIR" /></Field>
      <Btn kind="danger" label={busy ? 'Excluindo…' : 'Excluir minha conta'} block disabled={locked} onPress={async () => { setBusy(true); const e = await A.deleteAccount(); setBusy(false); setErr(e); }} />
    </View>
  );
}

/* ---------- Reserva ---------- */
function ResSheet({ arg }: { arg: Partial<Reservation> & { imported?: boolean } | null }) {
  const t = A.currentTrip()!;
  const a = arg || {};
  const [type, setType] = useState(a.type || 'hospedagem');
  const [title, setTitle] = useState(a.title || '');
  const [date, setDate] = useState(a.date || t.start);
  const [time, setTime] = useState(a.time || '');
  const [code, setCode] = useState(a.code || '');
  const [err, setErr] = useState<Record<string, string>>({});
  const legs = tripLegs(t);
  return (
    <View>
      {a.imported && a.file ? <Note kind="info" style={{ marginBottom: 14 }}>{'Lido de ' + a.file.name + '. Confira os dados antes de salvar.'}</Note> : null}
      <Field label="Tipo"><Chips>{RES_TYPES.map((r) => <Chip key={r.id} label={r.label} icon={r.icon} on={type === r.id} onPress={() => setType(r.id)} />)}</Chips></Field>
      <Field label="Nome" error={err.title}><Input value={title} onChangeText={setTitle} placeholder={type === 'voo' ? 'Ex.: Voo GRU → LIS' : 'Ex.: Hotel em ' + legName(legs[0])} error={!!err.title} /></Field>
      <DateField label="Data" value={date} min={iso(addDays(parseD(t.start), -1))} max={t.end} onChange={setDate} error={err.date} />
      <Field label="Horário">
        {time ? <Row gap={10}><TimeStepper label="Horário da reserva" value={time} onChange={setTime} /><LinkBtn label="Sem horário (dia todo)" onPress={() => setTime('')} /></Row>
          : <View style={{ alignSelf: 'flex-start' }}><Btn sm kind="secondary" icon="plus" label="Definir horário" onPress={() => setTime('12:00')} /></View>}
      </Field>
      <Field label="Código de confirmação"><Input value={code} onChangeText={setCode} caps="characters" placeholder="Opcional" /></Field>
      <T v="smallMuted" style={{ marginTop: -12, marginBottom: 16 }}>Com código, a reserva fica como confirmada.</T>
      <Btn label="Salvar reserva" block onPress={() => setErr(A.saveRes({ id: a.id || null, type, title, date, time, code, file: a.file || null, imported: a.imported }))} />
    </View>
  );
}

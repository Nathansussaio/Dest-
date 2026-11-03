/* Layout de site (navegador em tela larga): menu no topo, página inicial de apresentação e cabeçalho das telas de entrada */
import React, { useState } from 'react';
import { View, Pressable, Text, ScrollView, useWindowDimensions } from 'react-native';
import { useApp, pickData, setState, type Screen } from '../store/store';
import * as A from '../store/actions';
import { Logo, T, Row, Grow, Gap, Btn, LinkBtn, IconBtn, Avatar, Cover, Card, TileIcon, SiteFooter, Grid } from '../ui';
import { useTheme, useSiteWide, useNarrow, usePad, SITE_MAX } from '../theme/useTheme';
import { alertsFor } from '../lib/alerts';
import { iso, today0, plural } from '../lib/format';
import { DEST_BY_ID, FEATURED, destName } from '../data';
import { useFx, FX_SYMBOL, FX_NAME, fmtRate, fmtPct, type FxQuote } from '../lib/fx';

const NAV: { id: Screen; label: string }[] = [
  { id: 'home', label: 'Início' }, { id: 'trips', label: 'Viagens' }, { id: 'explore', label: 'Explorar' },
  { id: 'expenses', label: 'Gastos' }, { id: 'profile', label: 'Perfil' }
];

/* Cotação do dólar, do euro e da libra em reais, no cabeçalho.
   Tela larga: na mesma linha do menu. Telas menores: faixa fina logo abaixo. */
const FX_INLINE = 1240;
function FxItems({ q, compact, noPct }: { q: FxQuote; compact?: boolean; noPct?: boolean }) {
  const { c } = useTheme();
  const when = new Date(q.at);
  const hora = String(when.getHours()).padStart(2, '0') + ':' + String(when.getMinutes()).padStart(2, '0');
  const label = 'Cotação em reais: ' + q.rates.map((r) => FX_NAME[r.code] + ' ' + fmtRate(r.brl)).join(', ') + (q.source === 'awesomeapi' ? ', atualizada às ' + hora : ', cotação do dia');
  return (
    <View accessibilityRole="text" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 12 : 16 }}>
      {q.rates.map((r) => (
        <View key={r.code} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>{FX_SYMBOL[r.code]}</Text>
          <Text style={{ fontSize: compact ? 13 : 14, fontWeight: '700', color: c.ink }}>{fmtRate(r.brl)}</Text>
          {r.pct != null && !noPct ? <Text style={{ fontSize: 11, fontWeight: '600', color: r.pct > 0 ? c.accText : r.pct < 0 ? c.errText : c.muted }}>{(r.pct > 0 ? '▲ ' : r.pct < 0 ? '▼ ' : '') + fmtPct(r.pct)}</Text> : null}
        </View>
      ))}
    </View>
  );
}
export function FxInline() {
  const q = useFx();
  const { c } = useTheme();
  const W = useWindowDimensions().width;
  if (!q || W < FX_INLINE) return null;
  return <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: c.soft }}><FxItems q={q} /></View>;
}
export function FxStrip() {
  const q = useFx();
  const { c } = useTheme();
  const W = useWindowDimensions().width;
  const pad = usePad();
  if (!q || W >= FX_INLINE) return null;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', paddingHorizontal: pad, paddingVertical: 7 }}>
        <FxItems q={q} compact noPct={W < 520} />
      </View>
    </View>
  );
}

/* Barra do topo com a marca, o menu e as ações rápidas.
   Tela larga: menu completo. Tablet e celular: botão de menu que abre a lista de páginas. */
export function TopNav({ active }: { active: Screen }) {
  const s = useApp();
  const { c } = useTheme();
  const full = useSiteWide();
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  const pad = usePad();
  const todayIso = iso(today0());
  const unread = alertsFor(pickData(s)).filter((a) => a.date <= todayIso && s.alertsRead.indexOf(a.id) < 0).length;
  const first = (s.user && s.user.name) || '?';
  const goTab = (id: Screen) => { setOpen(false); A.tab(id); };
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bar, zIndex: 30 }}>
      <View accessibilityRole="tablist" style={{ maxWidth: SITE_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: pad, height: narrow ? 60 : 68, flexDirection: 'row', alignItems: 'center', gap: full ? 28 : 8 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Destí, início" onPress={() => goTab('home')}><Logo size={narrow ? 28 : 32} textSize={narrow ? 21 : 24} /></Pressable>
        {full ? (
          <Row gap={4}>
            {NAV.map((n) => {
              const on = n.id === active;
              return (
                <Pressable key={n.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => goTab(n.id)}
                  style={{ height: 68, paddingHorizontal: 12, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: on ? c.acc : 'transparent' }}>
                  <Text style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? c.acc : c.ink2 }}>{n.label}</Text>
                </Pressable>
              );
            })}
          </Row>
        ) : null}
        <Grow />
        <FxInline />
        <IconBtn icon="bell" flat size={40} label={unread ? plural(unread, 'aviso novo', 'avisos novos') : 'Avisos'} badge={unread} onPress={() => { setOpen(false); A.go('alerts'); }} />
        {narrow ? <IconBtn icon="plus" accent size={40} label="Nova viagem" onPress={() => { setOpen(false); A.go('create'); }} /> : <Btn sm icon="plus" label="Nova viagem" onPress={() => { setOpen(false); A.go('create'); }} />}
        {full ? <Avatar size={38} letter={first.charAt(0).toUpperCase()} label="Perfil" onPress={() => goTab('profile')} />
          : <IconBtn icon={open ? 'x' : 'menu'} flat size={40} label={open ? 'Fechar menu' : 'Abrir menu'} onPress={() => setOpen(!open)} />}
      </View>
      <FxStrip />
      {open && !full ? (
        <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: c.card, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, borderBottomWidth: 1, borderBottomColor: c.line, paddingVertical: 8, zIndex: 40 }}>
          {NAV.map((n) => {
            const on = n.id === active;
            return (
              <Pressable key={n.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => goTab(n.id)}
                style={{ minHeight: 50, paddingHorizontal: pad, justifyContent: 'center', backgroundColor: on ? c.accTint : 'transparent' }}>
                <Text style={{ fontSize: 16, fontWeight: on ? '700' : '500', color: on ? c.acc : c.ink }}>{n.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/* Cabeçalho das páginas públicas (apresentação, entrar, criar conta) */
export function SiteHeader() {
  const s = useApp();
  const { c } = useTheme();
  const narrow = useNarrow();
  const pad = usePad();
  const auth = (a: 'welcome' | 'login' | 'signup') => setState({ auth: a });
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bar, zIndex: 20 }}>
      <View style={{ maxWidth: SITE_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: pad, height: narrow ? 60 : 68, flexDirection: 'row', alignItems: 'center', gap: narrow ? 8 : 16 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Destí, página inicial" onPress={() => auth('welcome')}><Logo size={narrow ? 28 : 32} textSize={narrow ? 21 : 24} /></Pressable>
        <Grow />
        <FxInline />
        {s.auth !== 'login' ? <LinkBtn label="Entrar" onPress={() => auth('login')} /> : null}
        {s.auth !== 'signup' ? <Btn sm label={narrow ? 'Criar conta' : 'Criar conta grátis'} onPress={() => auth('signup')} /> : null}
      </View>
      <FxStrip />
    </View>
  );
}

const FEATURES = [
  { icon: 'calendar', title: 'Roteiro no seu estilo', text: 'Escolha destino, datas e estilo. O Destí monta os dias com lugares que combinam entre si e avisa quando algo fecha.' },
  { icon: 'route', title: 'Como ir de um lugar ao outro', text: 'Metrô, ônibus, a pé ou carro entre os pontos do dia, com o tempo estimado e a rota no mapa.' },
  { icon: 'wallet', title: 'Orçamento e divisão', text: 'Gastos em real, euro ou dólar. Para viagens em grupo, o app calcula quem deve para quem.' },
  { icon: 'ticket', title: 'Reservas organizadas', text: 'Voos, hotéis e ingressos por data, junto do roteiro de cada dia, com lembretes antes da viagem.' },
  { icon: 'cloudSun', title: 'Clima e o que levar', text: 'Previsão nos dias da viagem, clima típico do mês e uma lista de preparação pronta.' },
  { icon: 'share', title: 'Compartilhe com quem vai', text: 'Mande o roteiro pelo WhatsApp ou em PDF, sem mostrar códigos de reserva.' }
];
const STEPS = [
  { title: 'Escolha o destino', text: 'Mais de 60 cidades com roteiro automático, ou qualquer lugar do mundo para montar do seu jeito.' },
  { title: 'Defina datas, estilo e orçamento', text: 'Cultural, gastronômico, natureza, relax, vida noturna ou esportivo, no ritmo que preferir.' },
  { title: 'Ajuste e viaje', text: 'Troque lugares, mova atividades entre os dias e acompanhe os gastos durante a viagem.' }
];

/* Página inicial pública do site */
export function Landing() {
  const { c, isDark } = useTheme();
  const narrow = useNarrow();
  const k = narrow ? 0.62 : 1; /* escala das capas no celular */
  const pad = usePad();
  const fan = ['lisboa', 'kyoto', 'rio'];
  const dests = FEATURED.map((id) => DEST_BY_ID[id]).filter(Boolean);
  const Band = ({ children, bg }: { children: React.ReactNode; bg?: string }) => (
    <View style={{ backgroundColor: bg || 'transparent' }}>
      <View style={{ maxWidth: SITE_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingVertical: narrow ? 40 : 64 }}>{children}</View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SiteHeader />
      <ScrollView style={{ flex: 1 }}>
        {/* abertura: a promessa e a ação principal, com as capas dos destinos ao lado */}
        <Band>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: narrow ? 28 : 48, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: narrow ? 0 : 340, flexBasis: narrow ? '100%' : 340, gap: narrow ? 14 : 18 }}>
              <T v="kind">App de viagem grátis · iPhone, Android e navegador</T>
              <Text style={{ fontSize: narrow ? 36 : 52, lineHeight: narrow ? 41 : 58, fontWeight: '800', letterSpacing: narrow ? -1 : -1.5, color: c.ink }}>Planeje viagens sem planilha.</Text>
              <T v="muted" style={{ fontSize: narrow ? 17 : 19, lineHeight: narrow ? 25 : 28 }}>Roteiro dia a dia no seu estilo, orçamento, divisão de gastos, reservas e o clima do destino. Tudo num só lugar.</T>
              <Row gap={12} style={{ flexWrap: 'wrap', marginTop: 8 }}>
                <Btn label="Criar conta grátis" onPress={() => setState({ auth: 'signup' })} />
                <Btn kind="secondary" label="Experimentar sem conta" onPress={A.tryAsGuest} />
              </Row>
              <T v="smallMuted">Já tem conta? <Text style={{ color: c.acc, fontWeight: '700' }} onPress={() => setState({ auth: 'login' })}>Entrar</Text></T>
            </View>
            <View style={{ flex: 1, minWidth: narrow ? 0 : 340, flexBasis: narrow ? '100%' : 340, height: 380 * k, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {fan.map((id, i) => (
                <View key={id} style={{ position: 'absolute', transform: [{ rotate: (i - 1) * 9 + 'deg' }, { translateX: (i - 1) * 110 * k }, { translateY: (i === 1 ? -14 : 18) * k }], zIndex: i === 1 ? 2 : 1 }}>
                  <Cover destId={id} height={300 * k} artW={190 * k} artTop={90 * k} artRight={-10} radius={26 * k}>
                    <View style={{ width: 210 * k }} />
                    <View style={{ position: 'absolute', left: 18 * k, bottom: 18 * k }}><T v={narrow ? 'lt' : 'h2'} color="#FFFFFF">{destName(id)}</T></View>
                  </Cover>
                </View>
              ))}
            </View>
          </View>
        </Band>

        <Band bg={isDark ? c.card : '#FFFFFF'}>
          <T v="h1" style={{ maxWidth: 640 }}>Tudo o que a viagem precisa, do planejamento à volta</T>
          <Gap h={28} />
          <Grid items={FEATURES} min={narrow ? 260 : 300} gap={20} render={(f) => (
            <View style={{ gap: 10, paddingVertical: 4 }}>
              <TileIcon name={f.icon} size={48} />
              <T v="title">{f.title}</T>
              <T v="muted">{f.text}</T>
            </View>
          )} />
        </Band>

        <Band>
          <T v="h1">Como funciona</T>
          <Gap h={28} />
          <Grid items={STEPS} min={narrow ? 260 : 300} gap={20} render={(st, _w, i) => (
            <Card style={{ padding: 22, gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>{String(i + 1)}</Text></View>
              <T v="title">{st.title}</T>
              <T v="muted">{st.text}</T>
            </Card>
          )} />
        </Band>

        <Band bg={isDark ? c.card : '#FFFFFF'}>
          <Row between style={{ flexWrap: 'wrap', gap: 12 }}>
            <T v="h1">Destinos com roteiro pronto</T>
            <LinkBtn label="Começar agora" onPress={() => setState({ auth: 'signup' })} />
          </Row>
          <Gap h={24} />
          <Grid fullRows items={dests} min={narrow ? 140 : 200} gap={narrow ? 12 : 16} render={(d, w) => (
            <Pressable accessibilityRole="button" accessibilityLabel={'Planejar ' + d.name} onPress={() => setState({ auth: 'signup' })}>
              <Cover destId={d.id} height={Math.round(w * 0.75)} artW={w * 0.7} artTop={w * 0.12} artRight={-4} radius={18}>
                <View style={{ position: 'absolute', left: 14, bottom: 12, right: 14 }}>
                  <T v="lt" color="#FFFFFF">{d.name}</T>
                  <T v="small" color="rgba(255,255,255,0.85)" lines={1}>{d.tag || d.country}</T>
                </View>
              </Cover>
            </Pressable>
          )} />
        </Band>

        <Band>
          <Card style={{ padding: narrow ? 24 : 36, alignItems: 'center', gap: 14, backgroundColor: c.accBg }}>
            <Text style={{ fontSize: narrow ? 26 : 34, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.8 }}>Sua próxima viagem começa aqui.</Text>
            <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.88)', textAlign: 'center' }}>Grátis, sem anúncios. Suas viagens ficam salvas na sua conta.</Text>
            <Btn kind="sso" label="Criar conta grátis" onPress={() => setState({ auth: 'signup' })} />
          </Card>
        </Band>
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

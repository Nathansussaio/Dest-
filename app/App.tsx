/* Raiz do app: carrega os dados do aparelho, escolhe entre entrada e app, abas, folhas e avisos */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, BackHandler, AppState, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, loadFromDevice, getState, pickData, subscribe, flushCloud, pullCloud, type Screen } from './src/store/store';
import * as A from './src/store/actions';
import { useTheme, useWide, useSite } from './src/theme/useTheme';
import { isAndroid } from './src/theme/theme';
import { Icon, T, Btn, Logo } from './src/ui';
import { initMonitor, withMonitor } from './src/lib/monitor';
import { alertsFor } from './src/lib/alerts';
import { scheduleAlerts, unlockWithBiometrics } from './src/lib/device';
import { AuthRouter } from './src/screens/auth';
import { Home, Trips, Explore, Saved, StyleScreen, Alerts, Onboard, Profile } from './src/screens/main';
import { Create, Created, TripScreen, Itinerary, AddPlace, MapScreen, PlaceScreen } from './src/screens/trip';
import { Expenses, Docs, Assistant } from './src/screens/money';
import { SheetHost } from './src/screens/sheets';
import { TopNav, SiteHeader, Landing } from './src/screens/site';

const SCREENS: Record<Screen, React.ComponentType> = {
  home: Home, trips: Trips, explore: Explore, expenses: Expenses, profile: Profile,
  create: Create, created: Created, trip: TripScreen, itinerary: Itinerary, addPlace: AddPlace, map: MapScreen,
  saved: Saved, assistant: Assistant, place: PlaceScreen, docs: Docs, style: StyleScreen, onboard: Onboard, alerts: Alerts
};
const TAB_OF: Partial<Record<Screen, Screen>> = {
  home: 'home', create: 'home', alerts: 'home',
  trips: 'trips', trip: 'trips', itinerary: 'trips', map: 'trips', addPlace: 'trips', created: 'trips', assistant: 'trips', docs: 'trips',
  explore: 'explore', style: 'explore', saved: 'explore', place: 'explore',
  expenses: 'expenses', profile: 'profile'
};
const WITH_TABS: Screen[] = ['home', 'trips', 'explore', 'profile', 'trip', 'itinerary', 'addPlace', 'map', 'saved', 'docs', 'style', 'expenses', 'alerts', 'place'];
const TABS: { id: Screen; label: string; icon: string }[] = [
  { id: 'home', label: 'Início', icon: 'home' }, { id: 'trips', label: 'Viagens', icon: 'suitcase' }, { id: 'explore', label: 'Explorar', icon: 'compass' },
  { id: 'expenses', label: 'Gastos', icon: 'receipt' }, { id: 'profile', label: 'Perfil', icon: 'user' }
];

initMonitor();

function App() {
  return <SafeAreaProvider><Root /></SafeAreaProvider>;
}
export default withMonitor(App);

function Root() {
  const s = useApp();
  const { c, isDark } = useTheme();
  const [locked, setLocked] = useState(false);
  const wide = useWide();
  const site = useSite();

  /* 1. carrega contas e viagens salvas no aparelho */
  useEffect(() => {
    loadFromDevice().then(() => {
      const st = getState();
      if (st.user && st.user.method !== 'guest' && st.sec.faceId) setLocked(true);
    });
  }, []);

  /* 2. botão voltar do Android segue o histórico do app */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => A.back());
    return () => sub.remove();
  }, []);

  /* 3. reagenda os avisos como notificações quando os dados mudam e quando o app vai para segundo plano */
  useEffect(() => {
    let last = '';
    const resched = () => {
      const st = getState();
      if (!st.ready || !st.user || st.user.method === 'guest') return;
      const list = alertsFor(pickData(st));
      const key = list.map((a) => a.id + a.date).join('|');
      if (key !== last) { last = key; scheduleAlerts(list); }
    };
    let t: ReturnType<typeof setTimeout> | null = null;
    const unsub = subscribe(() => { if (t) clearTimeout(t); t = setTimeout(resched, 1500); });
    const app = AppState.addEventListener('change', (v) => {
      if (v === 'background') { resched(); flushCloud(); const st = getState(); if (st.user && st.user.method !== 'guest' && st.sec.faceId) setLocked(true); }
      if (v === 'active') { flushCloud(); pullCloud(); }
    });
    return () => { unsub(); app.remove(); };
  }, []);

  if (!s.ready) return <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.acc} /></View>;

  if (locked && s.user) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Icon name="faceid" size={48} color={c.acc} />
        <T v="h2" center>Destí bloqueado</T>
        <T v="muted" center>Desbloqueie para ver suas viagens e reservas.</T>
        <Btn label="Desbloquear" onPress={async () => { if (await unlockWithBiometrics()) setLocked(false); }} />
        <Btn kind="ghost" label="Sair da conta" onPress={() => { setLocked(false); A.logout(); }} />
      </View>
    );
  }

  const Body = s.user ? SCREENS[s.screen] || Home : AuthRouter;
  const showTabs = !!s.user && WITH_TABS.indexOf(s.screen) >= 0;
  if (site) {
    /* navegador (qualquer largura): layout de site com menu no topo e rodapé; sem conta, a página de apresentação */
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {s.user ? <TopNav active={TAB_OF[s.screen] || 'home'} /> : s.auth !== 'welcome' ? <SiteHeader /> : null}
        <View style={{ flex: 1 }}>{s.user ? <Body /> : s.auth === 'welcome' ? <Landing /> : <AuthRouter />}</View>
        <Toast />
        <SheetHost />
      </View>
    );
  }
  if (wide && s.user) {
    /* computador e tablet: menu lateral fixo e o conteúdo ao lado */
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, flexDirection: 'row' }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SideNav active={TAB_OF[s.screen] || 'home'} />
        <View style={{ flex: 1 }}><Body /></View>
        <Toast />
        <SheetHost />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Body />
      {showTabs ? <TabBar active={TAB_OF[s.screen] || 'home'} /> : null}
      <Toast />
      <SheetHost />
    </View>
  );
}

/* Barra de abas: no iPhone, ícone + rótulo; no Android, com a "pílula" do Material 3 no item ativo */
function TabBar({ active }: { active: Screen }) {
  const { c } = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.bar, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: Math.max(ins.bottom, 8), paddingTop: 6, flexDirection: 'row' }}>
      {TABS.map((tb) => {
        const on = tb.id === active;
        return (
          <Pressable key={tb.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tb.label} onPress={() => A.tab(tb.id)}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }}>
            <View style={isAndroid ? { width: 60, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accTint : 'transparent' } : undefined}>
              <Icon name={tb.icon} size={23} color={on ? c.acc : c.muted2} strokeWidth={on ? 2.1 : 1.8} />
            </View>
            <Text style={{ fontSize: 11, fontWeight: on ? '700' : '500', color: on ? c.acc : c.muted2 }}>{tb.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* Menu lateral (telas largas) */
function SideNav({ active }: { active: Screen }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{ width: 248, borderRightWidth: 1, borderRightColor: c.line, backgroundColor: c.bar, paddingTop: 28, paddingHorizontal: 16, gap: 4 }}>
      <View style={{ paddingHorizontal: 8, marginBottom: 24 }}><Logo size={36} textSize={28} /></View>
      {TABS.map((tb) => {
        const on = tb.id === active;
        return (
          <Pressable key={tb.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={tb.label} onPress={() => A.tab(tb.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 46, borderRadius: 12, backgroundColor: on ? c.accTint : 'transparent' }}>
            <Icon name={tb.icon} size={21} color={on ? c.acc : c.muted2} strokeWidth={on ? 2.1 : 1.8} />
            <Text style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? c.acc : c.ink2 }}>{tb.label}</Text>
          </Pressable>
        );
      })}
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" onPress={() => A.go('create')} style={{ marginBottom: 24, minHeight: 46, borderRadius: 14, backgroundColor: c.accBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Icon name="plus" size={18} color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>Nova viagem</Text>
      </Pressable>
    </View>
  );
}

/* Aviso rápido no rodapé, com "Desfazer" quando a ação pode ser revertida */
function Toast() {
  const s = useApp();
  const { c, isDark } = useTheme();
  const ins = useSafeAreaInsets();
  const wide = useWide();
  const site = useSite();
  if (!s.toast) return null;
  const tabs = !!s.user && WITH_TABS.indexOf(s.screen) >= 0 && !wide && !site;
  return (
    <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, bottom: (tabs ? 76 : 20) + ins.bottom, zIndex: 60, alignItems: 'center' }} pointerEvents="box-none">
      <View style={{ backgroundColor: c.ink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 560, width: '100%' }}>
        <Text style={{ color: c.onInk, flex: 1, fontSize: 14, fontWeight: '500' }}>{s.toast.msg}</Text>
        {s.toast.undo ? <Pressable accessibilityRole="button" onPress={A.undo} hitSlop={8}><Text style={{ color: isDark ? '#0B5A63' : '#8FD3DA', fontWeight: '700', fontSize: 14 }}>Desfazer</Text></Pressable> : null}
      </View>
    </View>
  );
}

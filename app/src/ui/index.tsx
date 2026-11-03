/* Componentes visuais do Destí (equivalentes aos do protótipo) */
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Linking, StyleSheet, type ViewStyle, type TextStyle, type StyleProp } from 'react-native';
import Svg, { Path, Rect, G, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICON, coverOf, placeLook, CAT_INFO } from '../data';
import { PRIVACY_URL, TERMS_URL, SUPPORT_EMAIL } from '../config';
import type { Place } from '../types';
import { useTheme, useWide, useSite, useSiteWide, useNarrow, useColumns, usePad, SITE_MAX } from '../theme/useTheme';
import { radius, isAndroid } from '../theme/theme';
import { MES_LONGO, SEM, parseD, iso, addDays, fmtShort } from '../lib/format';
import { LOGO_BG, LOGO_STAR_FULL, LOGO_STAR_SIMPLE, LOGO_LETTERS } from './logoMark';

type Children = React.ReactNode;

/* ---------- Ícones e traços ---------- */
export function Icon({ name, size = 22, color, strokeWidth = 1.8, fill }: { name: string; size?: number; color?: string; strokeWidth?: number; fill?: boolean }) {
  const { c } = useTheme();
  const col = color || c.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={ICON[name] || name} stroke={fill ? 'none' : col} fill={fill ? col : 'none'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function LineArt({ art, width, height, opacity = 0.5, strokeWidth = 1.6 }: { art: string; width: number; height: number; opacity?: number; strokeWidth?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 140">
      <Path d={art} stroke={'rgba(255,255,255,' + opacity + ')'} fill="none" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* Marca do Destí: o "í" com um pino de mapa no lugar do acento */
export function Logo({ size = 44, word = true, color, textSize }: { size?: number; word?: boolean; color?: string; textSize?: number }) {
  const { c, fs } = useTheme();
  const full = size >= 56; /* as letras N, S, L e O só aparecem no logo grande */
  return (
    <View accessibilityRole="image" accessibilityLabel="Destí" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Rect width={100} height={100} rx={22.4} fill={LOGO_BG} />
        {(full ? LOGO_STAR_FULL : LOGO_STAR_SIMPLE).map(([d, f], i) => <Path key={i} d={d} fill={f} />)}
        <Circle cx={50} cy={50} r={full ? 2.73 : 3.5} fill={LOGO_BG} />
        {full ? LOGO_LETTERS.map(([d, col], i) => <Path key={'l' + i} d={d} fill="none" stroke={col} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />) : null}
      </Svg>
      {word ? <Text style={{ fontSize: fs(textSize || size * 0.62), fontWeight: '800', letterSpacing: -1, color: color || c.acc }}>Destí</Text> : null}
    </View>
  );
}

/* ---------- Texto ---------- */
type Variant = 'h1' | 'h2' | 'title' | 'lt' | 'body' | 'muted' | 'small' | 'smallMuted' | 'kind' | 'label' | 'big';
export function T({ v = 'body', color, style, children, lines, center }: { v?: Variant; color?: string; style?: StyleProp<TextStyle>; children: Children; lines?: number; center?: boolean }) {
  const { c, fs } = useTheme();
  const base: Record<Variant, TextStyle> = {
    h1: { fontSize: fs(30), lineHeight: fs(35), fontWeight: '700', letterSpacing: -0.5, color: c.ink },
    big: { fontSize: fs(36), lineHeight: fs(40), fontWeight: '700', letterSpacing: -0.6, color: c.ink },
    h2: { fontSize: fs(20), lineHeight: fs(25), fontWeight: '700', color: c.ink },
    title: { fontSize: fs(17), fontWeight: '700', color: c.ink },
    lt: { fontSize: fs(16), lineHeight: fs(21), fontWeight: '600', color: c.ink },
    body: { fontSize: fs(15), lineHeight: fs(21), color: c.ink },
    muted: { fontSize: fs(15), lineHeight: fs(21), color: c.muted },
    small: { fontSize: fs(13), lineHeight: fs(18), color: c.ink },
    smallMuted: { fontSize: fs(13), lineHeight: fs(18), color: c.muted },
    kind: { fontSize: fs(12), fontWeight: '700', color: c.accText, letterSpacing: 0.5, textTransform: 'uppercase' },
    label: { fontSize: fs(14), fontWeight: '600', color: c.ink, marginBottom: 8 }
  };
  return <Text numberOfLines={lines} style={[base[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}>{children}</Text>;
}

/* ---------- Estrutura ---------- */
export function Row({ children, gap = 12, style, between, top }: { children: Children; gap?: number; style?: StyleProp<ViewStyle>; between?: boolean; top?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: top ? 'flex-start' : 'center', gap }, between ? { justifyContent: 'space-between' } : null, style]}>{children}</View>;
}
export function Grow({ children, style }: { children?: Children; style?: StyleProp<ViewStyle> }) { return <View style={[{ flex: 1, minWidth: 0 }, style]}>{children}</View>; }
export function Gap({ h = 12 }: { h?: number }) { return <View style={{ height: h }} />; }

export function Card({ children, style, onPress, flat, label }: { children: Children; style?: StyleProp<ViewStyle>; onPress?: () => void; flat?: boolean; label?: string }) {
  const { c, isDark } = useTheme();
  const st: ViewStyle = { backgroundColor: c.card, borderRadius: radius.card, ...(flat ? { borderWidth: 1, borderColor: c.line } : shadow(isDark)) };
  if (onPress) return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }: { pressed: boolean }) => [st, { opacity: pressed ? 0.85 : 1 }, style]}>{children}</Pressable>;
  return <View style={[st, style]}>{children}</View>;
}
export function shadow(isDark: boolean): ViewStyle {
  return isDark ? { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 }
    : { shadowColor: '#141414', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 };
}

/* ---------- Botões ---------- */
type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'sso' | 'ssoDark' | 'added';
export function Btn({ label, onPress, kind = 'primary', sm, icon, block, disabled, href, grow, color }: { label: string; onPress?: () => void; kind?: BtnKind; sm?: boolean; icon?: string; block?: boolean; disabled?: boolean; href?: string; grow?: boolean; color?: string }) {
  const { c, fs } = useTheme();
  const bg: Record<BtnKind, string> = { primary: c.accBg, secondary: c.soft, ghost: 'transparent', danger: c.danger, sso: c.card, ssoDark: c.ink, added: c.accTint };
  const fg: Record<BtnKind, string> = { primary: '#FFFFFF', secondary: c.ink, ghost: c.acc, danger: '#FFFFFF', sso: c.ink, ssoDark: c.onInk, added: c.accText };
  const press = () => { if (disabled) return; if (href) Linking.openURL(href).catch(() => {}); else if (onPress) onPress(); };
  const fcol = color || fg[kind];
  return (
    <Pressable accessibilityRole={href ? 'link' : 'button'} accessibilityState={{ disabled: !!disabled }} onPress={press}
      style={({ pressed }: { pressed: boolean }) => [{
        minHeight: sm ? 40 : 50, paddingHorizontal: sm ? 14 : 20, borderRadius: sm ? (isAndroid ? 18 : 12) : radius.btn,
        backgroundColor: bg[kind], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: kind === 'sso' ? 1 : 0, borderColor: c.line2, opacity: disabled ? 0.45 : pressed ? 0.85 : 1
      }, block ? { alignSelf: 'stretch' } : null, grow ? { flex: 1 } : null]}>
      {icon ? <Icon name={icon} size={sm ? 15 : 18} color={fcol} /> : null}
      <Text style={{ color: fcol, fontWeight: '600', fontSize: fs(sm ? 14 : 16) }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
export function LinkBtn({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const { c, fs } = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ color: color || c.acc, fontWeight: '600', fontSize: fs(15) }}>{label}</Text></Pressable>;
}
export function IconBtn({ icon, onPress, label, glass, accent, flat, size = 44, on, badge }: { icon: string; onPress: () => void; label: string; glass?: boolean; accent?: boolean; flat?: boolean; size?: number; on?: boolean; badge?: number }) {
  const { c, isDark } = useTheme();
  const bg = accent ? c.accBg : glass ? (isDark ? 'rgba(24,25,28,0.72)' : 'rgba(255,255,255,0.88)') : flat ? c.soft : c.card;
  const fg = accent ? '#FFFFFF' : glass && isDark ? '#FFFFFF' : c.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }: { pressed: boolean }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 }, !glass && !flat && !accent ? shadow(isDark) : null]}>
      <Icon name={icon} size={20} color={on ? c.over : fg} fill={on} />
      {badge ? <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.over, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{badge > 9 ? '9+' : badge}</Text></View> : null}
    </Pressable>
  );
}

/* ---------- Escolhas ---------- */
export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress: () => void; icon?: string }) {
  const { c, fs } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress}
      style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1, borderColor: on ? c.ink : c.line2, backgroundColor: on ? c.ink : c.card, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {icon ? <Icon name={icon} size={15} color={on ? c.onInk : c.ink} /> : null}
      <Text style={{ fontSize: fs(14), fontWeight: '500', color: on ? c.onInk : c.ink }}>{label}</Text>
    </Pressable>
  );
}
export function Chips({ children, scroll }: { children: Children; scroll?: boolean }) {
  const pad = usePad();
  if (scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8, paddingVertical: 2 }}>{children}</ScrollView>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}
/* Lista de seleção (picklist): campo que abre a lista de opções; aceita várias até "max". */
export function Picklist({ options, value, onToggle, placeholder, max, label, error }: { options: { id: string; label: string; icon?: string; hint?: string }[]; value: string[]; onToggle: (id: string) => void; placeholder?: string; max?: number; label?: string; error?: boolean }) {
  const { c, fs, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const chosen = options.filter((o) => value.indexOf(o.id) >= 0);
  const full = !!max && value.length >= max;
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={(label || 'Escolher') + ': ' + (chosen.length ? chosen.map((o) => o.label).join(', ') : 'nada escolhido')} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
        style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: error ? c.errText : open ? c.ink : c.line2, backgroundColor: error ? c.errBg : c.card, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chosen.length ? chosen.map((o) => (
            <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.soft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              {o.icon ? <Icon name={o.icon} size={14} /> : null}
              <Text style={{ fontSize: fs(14), fontWeight: '600', color: c.ink }}>{o.label}</Text>
            </View>
          )) : <Text style={{ fontSize: fs(16), color: c.faint }}>{placeholder || 'Escolher'}</Text>}
        </View>
        <Icon name={open ? 'chevU' : 'chevD'} size={18} color={c.muted} />
      </Pressable>
      {open ? (
        <View accessibilityRole="list" style={[{ marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: c.line2, backgroundColor: c.card, overflow: 'hidden' }, shadow(isDark)]}>
          {options.map((o, i) => {
            const on = value.indexOf(o.id) >= 0;
            const off = !on && full;
            return (
              <Pressable key={o.id} accessibilityRole="checkbox" accessibilityLabel={o.label} accessibilityState={{ checked: on, disabled: off }} onPress={() => onToggle(o.id)}
                style={({ pressed }: { pressed: boolean }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, backgroundColor: pressed ? c.soft : 'transparent', opacity: off ? 0.45 : 1 })}>
                {o.icon ? <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={o.icon} size={17} /></View> : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs(15), fontWeight: '600', color: c.ink }}>{o.label}</Text>
                  {o.hint ? <Text style={{ fontSize: fs(13), color: c.muted, marginTop: 1 }}>{o.hint}</Text> : null}
                </View>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: on ? 0 : 1.5, borderColor: c.line2, backgroundColor: on ? c.accBg : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={2.6} /> : null}
                </View>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: fs(14), fontWeight: '700', color: c.acc }}>Pronto</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
export function Seg<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c, fs, isDark } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.soft, borderRadius: 12, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(o.id)}
            style={{ flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (isDark ? c.line2 : c.card) : 'transparent' }}>
            <Text style={{ fontSize: fs(14), fontWeight: '600', color: on ? c.ink : c.ink2 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export function Toggle({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={onChange}
      style={{ width: 52, height: 32, borderRadius: 16, backgroundColor: value ? c.accBg : c.line3, padding: 3, justifyContent: 'center' }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignSelf: value ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}
export function Check({ on, onPress, label, hint }: { on: boolean; onPress: () => void; label: string; hint?: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 8, flex: 1 }}>
      <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: on ? c.accBg : c.line3, backgroundColor: on ? c.accBg : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Icon name="check" size={15} color="#FFFFFF" strokeWidth={3} /> : null}
      </View>
      <Grow>
        <T v="body" style={[{ fontWeight: '600' }, on ? { textDecorationLine: 'line-through', color: c.muted2 } : null]}>{label}</T>
        {hint ? <T v="smallMuted">{hint}</T> : null}
      </Grow>
    </Pressable>
  );
}

/* ---------- Campos ---------- */
export function Field({ label, error, children, style }: { label?: string; error?: string | null; children: Children; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ marginBottom: 20 }, style]}>
      {label ? <T v="label">{label}</T> : null}
      {children}
      {error ? <T v="small" color={c.errText} style={{ marginTop: 6, fontWeight: '500' }}>{error}</T> : null}
    </View>
  );
}
export function Input(p: { value: string; onChangeText: (v: string) => void; placeholder?: string; prefix?: string; error?: boolean; secure?: boolean; keyboard?: 'default' | 'email-address' | 'numeric' | 'decimal-pad' | 'number-pad'; caps?: 'none' | 'sentences' | 'words' | 'characters'; onSubmit?: () => void; label?: string; icon?: string; right?: Children; autoComplete?: any; maxLength?: number }) {
  const { c, fs } = useTheme();
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      {p.icon ? <View style={{ position: 'absolute', left: 14, zIndex: 1 }}><Icon name={p.icon} size={18} color={c.muted2} /></View> : null}
      {p.prefix ? <Text style={{ position: 'absolute', left: 14, zIndex: 1, fontWeight: '600', color: c.muted, fontSize: fs(16) }}>{p.prefix}</Text> : null}
      <TextInput
        value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} placeholderTextColor={c.faint}
        secureTextEntry={p.secure} keyboardType={p.keyboard || 'default'} autoCapitalize={p.caps || 'sentences'} autoComplete={p.autoComplete}
        onSubmitEditing={p.onSubmit} accessibilityLabel={p.label || p.placeholder} maxLength={p.maxLength}
        style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: p.error ? c.errText : c.line2, backgroundColor: p.error ? c.errBg : c.card, paddingLeft: p.prefix ? 46 : p.icon ? 44 : 14, paddingRight: p.right ? 52 : 14, fontSize: fs(16), color: c.ink }} />
      {p.right ? <View style={{ position: 'absolute', right: 3 }}>{p.right}</View> : null}
    </View>
  );
}

/* Calendário mensal próprio (funciona igual no iPhone, Android e web) */
export function Calendar({ value, onPick, min, max, label }: { value: string; onPick: (v: string) => void; min?: string; max?: string; label: string }) {
  const { c, fs } = useTheme();
  const base = value ? parseD(value) : min ? parseD(min) : new Date();
  const [month, setMonth] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const first = month.getDay(), daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  return (
    <Card flat style={{ marginTop: 8, padding: 10 }}>
      <Row between>
        <IconBtn icon="chevL" label="Mês anterior" flat size={36} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <T v="lt" style={{ textTransform: 'capitalize' }}>{label + ' · ' + MES_LONGO[month.getMonth()] + ' ' + month.getFullYear()}</T>
        <IconBtn icon="chevR" label="Próximo mês" flat size={36} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        {SEM.map((d) => <View key={d} style={{ width: '14.28%', alignItems: 'center', paddingVertical: 4 }}><T v="smallMuted">{d.charAt(0).toUpperCase()}</T></View>)}
        {cells.map((d, i) => {
          if (!d) return <View key={'e' + i} style={{ width: '14.28%', height: 40 }} />;
          const v = iso(new Date(month.getFullYear(), month.getMonth(), d));
          const off = (min && v < min) || (max && v > max);
          const on = v === value;
          return (
            <Pressable key={v} disabled={!!off} accessibilityLabel={d + ' de ' + MES_LONGO[month.getMonth()]} onPress={() => onPick(v)}
              style={{ width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accBg : 'transparent' }}>
                <Text style={{ color: on ? '#FFFFFF' : off ? c.line3 : c.ink, fontWeight: on ? '700' : '500', fontSize: fs(15) }}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
/* Calendário de período (ida e volta no mesmo calendário), com 1 ou 2 meses lado a lado */
export function RangeCalendar({ start, end, onChange, min, months = 2, width }: { start: string; end: string; onChange: (s: string, e: string) => void; min?: string; months?: 1 | 2; width: number }) {
  const { c, fs } = useTheme();
  const base = start ? parseD(start) : min ? parseD(min) : new Date();
  const [month, setMonth] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const gap = 28;
  const mw = Math.floor((width - (months - 1) * gap) / months);
  const cell = Math.floor(mw / 7);
  const pick = (v: string) => {
    if (!start || end || v < start) onChange(v, '');
    else onChange(start, v);
  };
  const one = (m: Date) => {
    const first = m.getDay(), daysIn = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= daysIn; d++) cells.push(d);
    return (
      <View key={m.getMonth()} style={{ width: cell * 7 }}>
        <T v="lt" style={{ textTransform: 'capitalize', textAlign: 'center', marginBottom: 8 }}>{MES_LONGO[m.getMonth()] + ' ' + m.getFullYear()}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SEM.map((d) => <View key={d} style={{ width: cell, alignItems: 'center', paddingVertical: 4 }}><T v="smallMuted">{d.charAt(0).toUpperCase()}</T></View>)}
          {cells.map((d, i) => {
            if (!d) return <View key={'e' + i} style={{ width: cell, height: 42 }} />;
            const v = iso(new Date(m.getFullYear(), m.getMonth(), d));
            const off = !!min && v < min;
            const edge = v === start || v === end;
            const inside = !!start && !!end && v > start && v < end;
            const band = (inside || (edge && start && end && start !== end));
            return (
              <Pressable key={v} disabled={off} accessibilityRole="button" accessibilityLabel={d + ' de ' + MES_LONGO[m.getMonth()]} accessibilityState={{ selected: edge }} onPress={() => pick(v)}
                style={{ width: cell, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                {band ? <View style={{ position: 'absolute', top: 3, bottom: 3, left: v === start ? cell / 2 : 0, right: v === end ? cell / 2 : 0, backgroundColor: c.accTint }} /> : null}
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: edge ? c.accBg : 'transparent' }}>
                  <Text style={{ color: edge ? '#FFFFFF' : off ? c.line3 : c.ink, fontWeight: edge ? '700' : '500', fontSize: fs(15) }}>{d}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };
  const list = [month];
  if (months === 2) list.push(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <IconBtn icon="chevL" label="Mês anterior" flat size={34} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <IconBtn icon="chevR" label="Próximo mês" flat size={34} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: -30, justifyContent: 'center' }}>{list.map(one)}</View>
    </View>
  );
}
function DateBox({ label, value, error, onPress, open }: { label: string; value: string; error?: string | null; onPress: () => void; open: boolean }) {
  const { c, fs } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <T v="label">{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={label + ': ' + (value ? fmtShort(value) : 'escolher')} onPress={onPress}
        style={{ minHeight: 50, borderRadius: 14, borderWidth: open ? 2 : 1, borderColor: error ? c.errText : open ? c.accBg : c.line2, backgroundColor: c.card, paddingHorizontal: 14, justifyContent: 'center' }}>
        <Text style={{ fontSize: fs(16), color: value ? c.ink : c.faint }}>{value ? fmtShort(value) + ' ' + value.slice(0, 4) : 'Escolher'}</Text>
      </Pressable>
    </View>
  );
}
/* Uma data (largura total) */
export function DateField({ label, value, onChange, min, max, error }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string; error?: string | null }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginBottom: 20 }}>
      <DateBox label={label} value={value} error={error} open={open} onPress={() => setOpen(!open)} />
      {open ? <Calendar label={label} value={value} min={min} max={max} onPick={(v) => { onChange(v); setOpen(false); }} /> : null}
      {error ? <T v="small" color={c.errText} style={{ marginTop: 6 }}>{error}</T> : null}
    </View>
  );
}
/* Ida e volta lado a lado, com o calendário em largura total embaixo; depois da ida, abre a volta */
export function DateRange({ start, end, onStart, onEnd, min, errStart, errEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void; min?: string; errStart?: string | null; errEnd?: string | null }) {
  const { c } = useTheme();
  const [open, setOpen] = useState<'start' | 'end' | null>(null);
  return (
    <View style={{ marginBottom: 8 }}>
      <Row top gap={12}>
        <DateBox label="Ida" value={start} error={errStart} open={open === 'start'} onPress={() => setOpen(open === 'start' ? null : 'start')} />
        <DateBox label="Volta" value={end} error={errEnd} open={open === 'end'} onPress={() => setOpen(open === 'end' ? null : 'end')} />
      </Row>
      {open === 'start' ? <Calendar key="s" label="Ida" value={start} min={min} onPick={(v) => { onStart(v); if (end && end < v) onEnd(''); setOpen('end'); }} /> : null}
      {open === 'end' ? <Calendar key="e" label="Volta" value={end} min={start || min} onPick={(v) => { onEnd(v); setOpen(null); }} /> : null}
      {errStart ? <T v="small" color={c.errText} style={{ marginTop: 6 }}>{errStart}</T> : null}
      {errEnd ? <T v="small" color={c.errText} style={{ marginTop: 6 }}>{errEnd}</T> : null}
    </View>
  );
}
export { addDays };

/* Seletor simples de horário (passos de 15 minutos) */
export function TimeStepper({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { c, fs } = useTheme();
  const step = (d: number) => {
    const [h, m] = value.split(':').map(Number);
    let t = h * 60 + m + d;
    t = Math.max(0, Math.min(23 * 60 + 45, t));
    onChange(String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'));
  };
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.line2, borderRadius: 10, backgroundColor: c.card }}>
      <Pressable accessibilityLabel={'Mais cedo: ' + label} onPress={() => step(-15)} style={{ width: 28, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={14} color={c.acc} /></Pressable>
      <Text style={{ fontWeight: '700', fontSize: fs(15), color: c.ink, minWidth: 46, textAlign: 'center' }}>{value}</Text>
      <Pressable accessibilityLabel={'Mais tarde: ' + label} onPress={() => step(15)} style={{ width: 28, height: 40, alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={14} color={c.acc} /></Pressable>
    </View>
  );
}

/* ---------- Pequenas peças ---------- */
export function Bar({ pct, over, height = 8 }: { pct: number; over?: boolean; height?: number }) {
  const { c } = useTheme();
  return <View style={{ height, borderRadius: height / 2, backgroundColor: c.soft, overflow: 'hidden' }}><View style={{ height: '100%', width: Math.max(0, Math.min(100, pct)) + '%', borderRadius: height / 2, backgroundColor: over ? c.over : c.accBg }} /></View>;
}
export function Note({ children, kind = 'demo', style }: { children: Children; kind?: 'demo' | 'info' | 'err' | 'note'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = { demo: c.warnBg, info: c.accTint, err: c.errBg, note: c.noteBg }[kind];
  const fg = { demo: c.warnText, info: c.accText, err: c.errText, note: c.noteText }[kind];
  return <View style={[{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, style]}><T v="small" color={fg} style={{ fontWeight: '600' }}>{children}</T></View>;
}
export function Pill({ children, style }: { children: Children; style?: StyleProp<ViewStyle> }) {
  const { fs } = useTheme();
  return <View style={[{ backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' }, style]}><Text style={{ fontSize: fs(12), fontWeight: '700', color: '#1B1C1E' }}>{children}</Text></View>;
}
export function Avatar({ letter, size = 44, onPress, label }: { letter: string; size?: number; onPress?: () => void; label?: string }) {
  const { c } = useTheme();
  const v = <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.onInk, fontWeight: '700', fontSize: size * 0.38 }}>{letter}</Text></View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>{v}</Pressable> : v;
}
export function TileIcon({ name, size = 38, bg, color }: { name: string; size?: number; bg?: string; color?: string }) {
  const { c } = useTheme();
  return <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg || c.accTint, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={size * 0.48} color={color || c.acc} /></View>;
}
export function CatIcon({ name }: { name: string }) {
  const { c } = useTheme();
  return <TileIcon name={name} size={36} bg={c.soft} color={c.ink2} />;
}
export function PlaceThumb({ place, size = 52 }: { place: Place; size?: number }) {
  const look = placeLook(place);
  return <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: look.tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={CAT_INFO[place.cat].icon} size={size * 0.46} color={look.color} /></View>;
}
export function Section({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return <Row between style={[{ marginTop: 28, marginBottom: 12 }, style]}><T v="h2">{title}</T>{action && onAction ? <LinkBtn label={action} onPress={onAction} /> : null}</Row>;
}
export function GroupLabel({ children }: { children: Children }) {
  const { c, fs } = useTheme();
  return <Text style={{ fontSize: fs(12.5), fontWeight: '700', color: c.muted, marginTop: 18, marginBottom: 8, marginHorizontal: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</Text>;
}
export function ListRow({ icon, iconEl, title, sub, right, onPress, chevron, color }: { icon?: string; iconEl?: Children; title: string; sub?: string; right?: Children; onPress?: () => void; chevron?: boolean; color?: string }) {
  const { c } = useTheme();
  const body = (
    <>
      {iconEl || (icon ? <CatIcon name={icon} /> : null)}
      <Grow><T v="lt" color={color} style={{ fontSize: 15 }}>{title}</T>{sub ? <T v="smallMuted">{sub}</T> : null}</Grow>
      {right}
      {chevron ? <Icon name="chevR" size={18} color={c.faint} /> : null}
    </>
  );
  const st: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 60 };
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }: { pressed: boolean }) => [st, { opacity: pressed ? 0.7 : 1 }]}>{body}</Pressable> : <View style={st}>{body}</View>;
}
export function Divider() { const { c } = useTheme(); return <View style={{ height: 1, backgroundColor: c.line }} />; }
export function List({ children, style }: { children: Children; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return <Card style={[{ overflow: 'hidden' }, style]}>{items.map((ch, i) => <View key={i}>{i > 0 ? <Divider /> : null}{ch}</View>)}</Card>;
}
export function Empty({ icon, title, text, action, onAction }: { icon?: string; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <Card style={{ alignItems: 'center', padding: 28, gap: 10 }}>
      {icon ? <TileIcon name={icon} size={64} /> : null}
      <T v="lt" center>{title}</T>
      {text ? <T v="smallMuted" center>{text}</T> : null}
      {action && onAction ? <Btn sm label={action} onPress={onAction} /> : null}
    </Card>
  );
}
export function TopBar({ title, onBack, right, large }: { title: string; onBack?: () => void; right?: Children; large?: boolean }) {
  if (large) return <Row between style={{ marginBottom: 18, minHeight: 44 }}><T v="h1">{title}</T>{right}</Row>;
  return (
    <Row between style={{ marginBottom: 18, minHeight: 44 }}>
      {onBack ? <IconBtn icon="chevL" label="Voltar" onPress={onBack} /> : <View style={{ width: 44 }} />}
      <Grow><T v="title" lines={1} style={{ textAlign: isAndroid ? 'left' : 'center', paddingLeft: isAndroid ? 4 : 0 }}>{title}</T></Grow>
      {right || <View style={{ width: 44 }} />}
    </Row>
  );
}

/* Tela com rolagem: respeita a área segura (notch) e a barra de abas */
export function Screen({ children, tabs = true, flush, scrollRef }: { children: Children; tabs?: boolean; flush?: boolean; scrollRef?: any }) {
  const { c } = useTheme();
  const wide = useWide();
  const site = useSite();
  const narrow = useNarrow();
  const pad = usePad();
  const ins = useSafeAreaInsets();
  return (
    <ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ paddingTop: flush ? 0 : ins.top + (site ? (narrow ? 20 : 32) : 12), paddingHorizontal: flush ? 0 : pad, paddingBottom: (site ? 48 : tabs && !wide ? 100 : 40) + ins.bottom, maxWidth: flush ? undefined : site ? SITE_MAX : tabs ? 800 : 560, width: '100%', alignSelf: 'center', flexGrow: 1 }}>
        {children}
      </View>
      {site ? <SiteFooter /> : null}
    </ScrollView>
  );
}

/* Rodapé do site */
export function SiteFooter() {
  const { c } = useTheme();
  const pad = usePad();
  const open = (u: string) => Linking.openURL(u).catch(() => {});
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bar }}>
      <View style={{ maxWidth: SITE_MAX, width: '100%', alignSelf: 'center', paddingHorizontal: pad, paddingVertical: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Row gap={14}><Logo size={28} textSize={20} /><T v="smallMuted">Planeje viagens sem planilha.</T></Row>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <LinkBtn label="Política de privacidade" color={c.muted} onPress={() => open(PRIVACY_URL)} />
          <T v="smallMuted">·</T>
          <LinkBtn label="Termos de uso" color={c.muted} onPress={() => open(TERMS_URL)} />
          <T v="smallMuted">·</T>
          <LinkBtn label={SUPPORT_EMAIL} color={c.muted} onPress={() => open('mailto:' + SUPPORT_EMAIL)} />
        </Row>
      </View>
    </View>
  );
}

/* Duas colunas no site (principal e lateral); no celular, uma embaixo da outra */
export function Cols({ main, side, ratio = 1.7 }: { main: Children; side: Children; ratio?: number }) {
  const site = useSiteWide();
  if (!site) return <View>{main}{side}</View>;
  return (
    <View style={{ flexDirection: 'row', gap: 32, alignItems: 'flex-start' }}>
      <View style={{ flex: ratio, minWidth: 0 }}>{main}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{side}</View>
    </View>
  );
}

/* Grade que se ajusta à largura: cada item recebe a largura da coluna */
export function Grid<T>({ items, min, gap = 16, render, fullRows }: { items: T[]; min: number; gap?: number; render: (item: T, w: number, i: number) => React.ReactNode; fullRows?: boolean }) {
  const { w, cols } = useColumns(min, gap);
  /* fullRows: mostra só linhas completas (sem um cartão sozinho na última linha) */
  const list = fullRows && items.length > cols ? items.slice(0, Math.floor(items.length / cols) * cols) : items;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{list.map((it, i) => <View key={i} style={{ width: w }}>{render(it, w, i)}</View>)}</View>;
}
export function Pad({ children }: { children: Children }) { return <View style={{ paddingHorizontal: 20, maxWidth: 800, width: '100%', alignSelf: 'center' }}>{children}</View>; }

/* Capa de destino: cor própria + traço do marco */
export function Cover({ destId, height, children, artW = 220, artTop = 58, artRight = 12, radius: r = 0 }: { destId: string; height: number; children?: Children; artW?: number; artTop?: number; artRight?: number; radius?: number }) {
  const cv = coverOf(destId);
  return (
    <View style={{ height, backgroundColor: cv.color, overflow: 'hidden', borderRadius: r }}>
      <View style={{ position: 'absolute', right: -60, top: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)' }} />
      <View style={{ position: 'absolute', right: artRight, top: artTop }}><LineArt art={cv.art} width={artW} height={artW * 0.7} /></View>
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({ fill: { flex: 1 } });

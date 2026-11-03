/* Cores, tipografia e plataforma.
   As cores vêm em pares claro/escuro; a escolha segue o Perfil (automático, claro ou escuro). */
import { Platform } from 'react-native';

export interface Colors {
  bg: string; card: string; ink: string; onInk: string; ink2: string; muted: string; muted2: string; faint: string;
  line: string; line2: string; line3: string; soft: string; soft2: string;
  acc: string; accBg: string; accTint: string; accText: string;
  warnBg: string; warnText: string; noteBg: string; noteText: string; errBg: string; errText: string;
  danger: string; over: string; bar: string; scrim: string; white: string;
}

export const light: Colors = {
  bg: '#F4F4F1', card: '#FFFFFF', ink: '#1B1C1E', onInk: '#FFFFFF', ink2: '#3A3C40', muted: '#5F6166', muted2: '#6A6C70', faint: '#A0A2A6',
  line: '#EEEEEA', line2: '#D9DAD5', line3: '#C9CBC5', soft: '#EFF0EC', soft2: '#E7E2DA',
  acc: '#0B6670', accBg: '#0B6670', accTint: '#E7F0F0', accText: '#0B5A63',
  warnBg: '#F6EAD8', warnText: '#734410', noteBg: '#FBF4EC', noteText: '#A3521A', errBg: '#FBEFE8', errText: '#A3421A',
  danger: '#B4401E', over: '#C1601F', bar: 'rgba(250,250,248,0.96)', scrim: 'rgba(20,20,20,0.38)', white: '#FFFFFF'
};

export const dark: Colors = {
  bg: '#111214', card: '#1C1D20', ink: '#ECECE9', onInk: '#141517', ink2: '#C9CACD', muted: '#A2A4A8', muted2: '#8E9095', faint: '#6E7075',
  line: '#2A2C30', line2: '#3A3C41', line3: '#4A4C52', soft: '#26282B', soft2: '#2C2E32',
  acc: '#62C3CC', accBg: '#0B6670', accTint: '#143A3F', accText: '#8FD3DA',
  warnBg: '#3A2B17', warnText: '#F0C88E', noteBg: '#2F2418', noteText: '#F0B27A', errBg: '#3A2019', errText: '#F4A68A',
  danger: '#B4401E', over: '#C1601F', bar: 'rgba(24,25,28,0.96)', scrim: 'rgba(0,0,0,0.55)', white: '#FFFFFF'
};

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isWeb = Platform.OS === 'web';

export const radius = { card: isAndroid ? 16 : 18, btn: isAndroid ? 20 : 14, chip: 19, sheet: isAndroid ? 28 : 24 };
export const fontFamily = undefined; /* fonte do sistema: SF no iPhone, Roboto no Android */

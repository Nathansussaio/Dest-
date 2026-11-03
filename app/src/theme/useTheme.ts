import { useColorScheme, useWindowDimensions } from 'react-native';
import { useApp } from '../store/store';
import { light, dark, isWeb, type Colors } from './theme';

/* Tela larga (computador ou tablet deitado): menu lateral em vez das abas embaixo */
export function useWide(): boolean { return useWindowDimensions().width >= 900; }
/* Layout de site: no navegador, em qualquer largura (menu no topo, rodapé). A partir de 900 px, as páginas usam duas colunas. */
export const SITE_MAX = 100000; /* sem limite: o site ocupa toda a largura da janela, em qualquer tela */
/* Margem lateral do site: cresce com a tela para o conteúdo ocupar a largura sem encostar nas bordas */
export function sitePad(W: number): number { return W < 640 ? 16 : W < 1024 ? 24 : W < 1440 ? 32 : 48; }
export function usePad(): number { const W = useWindowDimensions().width; return isWeb ? sitePad(W) : 20; }
export function useSite(): boolean { return isWeb; }
export function useSiteWide(): boolean { const w = useWindowDimensions().width; return isWeb && w >= 900; }
/* Celular (até 639 px): grades com colunas menores, títulos menores */
export function useNarrow(): boolean { return useWindowDimensions().width < 640; }
/* Quantas colunas cabem e a largura de cada uma (conteúdo do site ou da tela) */
export function useColumns(min: number, gap = 16): { cols: number; w: number } {
  const W = useWindowDimensions().width;
  const site = isWeb;
  const avail = W >= 900 && !isWeb ? W - 248 : W; /* tablet: desconta o menu lateral */
  const pad = site ? sitePad(W) * 2 : 40;
  const content = Math.min(avail, site ? SITE_MAX : 800) - pad;
  const cols = Math.max(1, Math.floor((content + gap) / (min + gap)));
  return { cols, w: Math.floor((content - gap * (cols - 1)) / cols) };
}

/* Cores do tema atual + escala de texto (opção "Texto maior" do Perfil) */
export function useTheme(): { c: Colors; isDark: boolean; fs: (n: number) => number } {
  const sys = useColorScheme();
  const prefs = useApp().prefs;
  const mode = prefs ? prefs.theme : 'auto';
  const isDark = mode === 'dark' || (mode === 'auto' && sys === 'dark');
  const scale = prefs && prefs.textLg ? 1.12 : 1;
  return { c: isDark ? dark : light, isDark, fs: (n: number) => Math.round(n * scale * 10) / 10 };
}

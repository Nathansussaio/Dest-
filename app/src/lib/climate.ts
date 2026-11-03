/* Clima típico do período da viagem (média ponderada pelos dias de cada mês) + o que levar */
import type { Trip } from '../types';
import { CLIMATE, BEACH_CITIES } from '../data';
import { parseD, addDays, MES_LONGO } from './format';

export interface ClimateSummary {
  hi: number; lo: number; src: string; monthsLabel: string;
  rainy: 'alta' | 'media' | 'baixa' | 'desconhecida'; rainLabel: string;
  feel: string; icon: string; tips: { icon: string; text: string }[];
}

export function tripClimate(t: Pick<Trip, 'destId' | 'start' | 'end' | 'styles'>): ClimateSummary | null {
  const C = CLIMATE[t.destId];
  if (!C || !t.start || !t.end || t.end < t.start) return null;
  const a = parseD(t.start), b = parseD(t.end), count: Record<number, number> = {}, order: number[] = [];
  let n = 0, hi = 0, lo = 0;
  for (let d = new Date(a); d <= b; d = addDays(d, 1)) {
    const m = d.getMonth();
    if (!count[m]) { count[m] = 0; order.push(m); }
    count[m]++; hi += C.hi[m]; lo += C.lo[m]; n++;
  }
  const main = order.slice().sort((x, y) => count[y] - count[x])[0];
  const c: ClimateSummary = {
    hi: Math.round(hi / n), lo: Math.round(lo / n), src: C.src,
    monthsLabel: order.map((m) => MES_LONGO[m]).join(' e '),
    rainy: 'desconhecida', rainLabel: 'sem dados de chuva', feel: '', icon: '', tips: []
  };
  if (C.rain) {
    const v = C.rain.v[main];
    if (C.rain.kind === 'days') {
      c.rainy = v >= 9 ? 'alta' : v >= 4 ? 'media' : 'baixa';
      c.rainLabel = v < 1 ? 'chuva rara' : '≈ ' + Math.round(v) + ' dias com chuva no mês';
    } else {
      c.rainy = v >= 50 ? 'alta' : v >= 10 ? 'media' : 'baixa';
      c.rainLabel = v < 5 ? 'chuva rara' : '≈ ' + Math.round(v) + ' mm de chuva no mês';
    }
  }
  const avg = (c.hi + c.lo) / 2;
  c.feel = avg < 6 ? 'Frio' : avg < 12 ? 'Fresco' : avg < 18 ? 'Ameno' : avg < 24 ? 'Agradável' : avg < 28 ? 'Quente' : 'Muito quente';
  c.icon = c.lo < 3 ? 'snow' : c.rainy === 'alta' ? 'cloudRain' : c.hi >= 25 ? 'sun' : 'cloudSun';
  const st = t.styles || [];
  const add = (icon: string, text: string) => c.tips.push({ icon, text });
  if (c.lo < 3) add('snow', 'Casaco de inverno, gorro, luvas e cachecol');
  else if (c.lo < 9) add('jacket', 'Casaco quente para manhãs e noites');
  else if (c.lo < 15) add('jacket', 'Jaqueta ou blusa leve para a noite');
  if (c.hi >= 28) add('sun', 'Roupas leves e respiráveis, chapéu e protetor solar');
  else if (c.hi >= 22) add('shirt', 'Roupas leves durante o dia');
  else if (c.hi < 14) add('shirt', 'Calça, manga longa e roupas em camadas');
  else add('shirt', 'Roupas em camadas para tirar e pôr ao longo do dia');
  if (c.hi - c.lo >= 14) add('info', 'Grande diferença entre dia e noite: vista-se em camadas');
  if (c.rainy === 'alta') add('umbrella', 'Guarda-chuva compacto ou capa de chuva');
  if (c.hi >= 25 && (BEACH_CITIES.indexOf(t.destId) >= 0 || st.indexOf('Relax') >= 0)) add('sun', 'Roupa de banho e chinelo');
  if (t.destId === 'atacama') add('sun', 'Clima seco e de altitude: protetor solar alto, hidratante labial e óculos escuros');
  if (t.destId === 'cusco') add('info', 'Altitude acima de 3.000 m: chegue com calma, beba bastante água e evite esforço no primeiro dia');
  if (t.destId === 'dubai' && c.hi >= 35) add('sun', 'Calor extremo: deixe passeios ao ar livre para o começo da manhã e o fim da tarde');
  if (st.indexOf('Natureza') >= 0 || st.indexOf('Esportiva') >= 0) add('shoe', 'Tênis ou bota confortável para trilhas');
  else add('shoe', 'Sapato confortável para caminhar bastante');
  if (st.indexOf('Vida noturna') >= 0) add('shirt', 'Uma roupa para sair à noite');
  return c;
}

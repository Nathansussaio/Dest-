/* Catálogo e dados de referência (somente leitura).
   Gerados a partir do protótipo; na versão com servidor, viriam de uma API. */
import type { Destination, Place, Style, PaceId, Slot } from '../types';
import destinationsJson from './destinations.json';
import worldJson from './world.json';
import placesJson from './places.json';
import climateJson from './climate.json';
import dishesJson from './dishes.json';
import transitJson from './transit.json';
import stylesJson from './styles.json';
import catalogJson from './catalog.json';
import iconsJson from './icons.json';
import citiesJson from './cities.json';
import { norm } from '../lib/format';

export const DESTINATIONS: Destination[] = (destinationsJson as any[]).map((d) => ({ ...d, kind: 'catalog' as const }));
export const WORLD: Destination[] = (worldJson as any[]).map((w) => ({ ...w, ...coverOf(w.id) }));
export const PLACES: Place[] = placesJson as any;
export const PLACE_BY_ID: Record<string, Place> = {};
PLACES.forEach((p) => { PLACE_BY_ID[p.id] = p; });

export interface ClimateRow { hi: number[]; lo: number[]; rain: { kind: 'days' | 'mm'; v: number[] } | null; src: string }
export const CLIMATE: Record<string, ClimateRow> = climateJson as any;
export const DISHES: Record<string, [string, string][]> = dishesJson as any;

export interface TransitInfo { modes: string; card: string; tip: string; walkMax?: number; carOnly?: boolean; farCar?: boolean }
export const TRANSIT: Record<string, TransitInfo> = (transitJson as any).cities;
export const TRANSIT_DEFAULT: TransitInfo = (transitJson as any).fallback;

export interface StyleInfo { icon: string; adj: string; short: string; desc: string; molde: Record<Slot, string> }
export const STYLE_INFO: Record<Style, StyleInfo> = (stylesJson as any).info;
export const STYLES = Object.keys(STYLE_INFO) as Style[];
export interface Pace { id: PaceId; label: string; hint: string; slots: Slot[] }
export const PACES: Pace[] = (stylesJson as any).paces;
export const PACE_BY_ID: Record<string, Pace> = {};
PACES.forEach((p) => { PACE_BY_ID[p.id] = p; });
export const SLOT_TIME: Record<Slot, string> = (stylesJson as any).slotTime;
export const SLOT_LABEL: Record<Slot, string> = (stylesJson as any).slotLabel;
export const SLOT_FALLBACK: Record<Slot, Slot[]> = (stylesJson as any).slotFallback;
export const REPEATABLE: string[] = (stylesJson as any).repeatable;

const C = catalogJson as any;
export const CATEGORIES: { id: string; label: string }[] = C.categories;
export const CAT_INFO: Record<string, { label: string; icon: string }> = C.catInfo;
export const BUDGET_CATS: { id: string; label: string; icon: string; share: number }[] = C.budgetCats;
export const RES_TYPES: { id: string; label: string; icon: string }[] = C.resTypes;
export const FEATURED: string[] = C.featured;
export const CUR_SYMBOL: Record<string, string> = C.curSymbol;
export const DEMO_RATES: Record<string, number> = C.demoRates;
export const EURO_COUNTRIES: string[] = C.euroCountries;
export const USD_COUNTRIES: string[] = C.usdCountries;
export const BEACH_CITIES: string[] = C.beachCities;
export const DOW_PLURAL: string[] = C.dowPlural;
export const COMMON_PASSWORDS: string[] = C.commonPasswords;
export const ICON: Record<string, string> = iconsJson as any;

export const DEST_BY_ID: Record<string, Destination> = {};
export const CITY_NAME: Record<string, string> = {};
DESTINATIONS.forEach((d) => { DEST_BY_ID[d.id] = d; CITY_NAME[d.id] = d.name; });
const WORLD_BY_ID: Record<string, Destination> = {};
WORLD.forEach((w) => { WORLD_BY_ID[w.id] = w; });

/* Capa de um destino: cor própria + traço do marco; destinos fora do catálogo ganham cor estável pelo nome */
export function coverOf(id: string): { color: string; art: string } {
  const d = (destinationsJson as any[]).find((x) => x.id === id);
  if (d) return { color: d.color, art: d.art };
  let h = 0;
  for (let i = 0; i < (id || '').length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return { color: (catalogJson as any).coverPalette[h % (catalogJson as any).coverPalette.length], art: (catalogJson as any).genericArt };
}

export function lookupDest(id: string): Destination | null { return DEST_BY_ID[id] || WORLD_BY_ID[id] || null; }
export function destName(id: string): string { const d = lookupDest(id); return d ? d.name : (CITY_NAME[id] || id); }
export function placesForCity(cityId: string): Place[] { return PLACES.filter((p) => p.city === cityId); }
export function hasCatalog(cityId: string): boolean { return PLACES.some((p) => p.city === cityId && p.styles.length > 0); }

/* Autocompletar: destinos completos primeiro, depois países e cidades do mundo (ignora acentos) */
export function searchDest(q: string): Destination[] {
  const n = norm(q);
  if (!n) return [];
  const scored: { d: Destination; r: number }[] = [];
  DESTINATIONS.concat(WORLD).forEach((d) => {
    const nm = norm(d.name), al = (d.aliases || []).map(norm), ct = norm(d.country || '');
    let r = 0;
    if (nm.indexOf(n) === 0 || al.some((a) => a.indexOf(n) === 0)) r = d.kind === 'catalog' ? 6 : d.kind === 'country' ? 5 : 4;
    else if (d.kind !== 'country' && ct.indexOf(n) === 0) r = d.kind === 'catalog' ? 3 : 2;
    else if (nm.indexOf(n) > 0) r = 1;
    if (r) scored.push({ d, r });
  });
  return scored.sort((a, b) => b.r - a.r).slice(0, 8).map((x) => x.d);
}
export function findDestExact(q: string): Destination | null {
  const n = norm(q);
  const all = DESTINATIONS.concat(WORLD.filter((w) => w.kind === 'city'), WORLD.filter((w) => w.kind === 'country'));
  return all.find((d) => norm(d.name) === n || (d.aliases || []).some((a) => norm(a) === n)) || null;
}

/* Tom claro de uma cor (fundo dos ícones de lugar) */
export function tint(hex: string, w: number): string {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (c: number) => Math.round(c + (255 - c) * w);
  return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
}
export function placeLook(p: Place) { const c = coverOf(p.city).color; return { color: c, tint: tint(c, 0.86), icon: CAT_INFO[p.cat].icon }; }

/* Centro de cada cidade do catálogo (latitude, longitude): usado na previsão do tempo e no mapa */
export const CITY_COORDS: Record<string, [number, number]> = citiesJson as any;

/* ---------- Viagens por vários países ---------- */
/* Continente de cada país (vem da lista de países do mundo) */
export const CONTINENT_OF: Record<string, string> = {};
WORLD.forEach((w) => { if (w.kind === 'country') CONTINENT_OF[w.name] = w.country; });
export function continentOf(destId: string): string {
  const d = lookupDest(destId);
  if (!d) return '';
  return d.kind === 'country' ? d.country : CONTINENT_OF[d.country] || '';
}
export function countryOf(destId: string): string {
  const d = lookupDest(destId);
  return d ? (d.kind === 'country' ? d.name : d.country) : '';
}
/* Regiões que a pessoa pode digitar no destino ("Europa", "Ásia"...) */
export const REGIONS: { name: string; aliases: string[] }[] = [
  { name: 'Europa', aliases: ['europa', 'euro'] },
  { name: 'Ásia', aliases: ['asia', 'oriente'] },
  { name: 'América do Sul', aliases: ['america do sul', 'sul america', 'sudamerica'] },
  { name: 'América do Norte e Central', aliases: ['america do norte', 'america central', 'eua e mexico', 'estados unidos e mexico'] },
  { name: 'África', aliases: ['africa'] },
  { name: 'Oriente Médio', aliases: ['oriente medio'] },
  { name: 'Oceania', aliases: ['oceania'] },
  { name: 'Caribe', aliases: ['caribe'] }
];
export function findRegion(q: string): string | null {
  const n = norm(q);
  if (n.length < 3) return null;
  const r = REGIONS.find((x) => norm(x.name).indexOf(n) === 0 || x.aliases.some((a) => a.indexOf(n) === 0));
  return r ? r.name : null;
}
/* Cidades com roteiro automático de uma região */
export function catalogInRegion(region: string): Destination[] { return DESTINATIONS.filter((d) => continentOf(d.id) === region); }

/* Roteiros prontos com várias cidades e países (dias sugeridos por cidade) */
export interface MultiTrip { id: string; title: string; region: string; stops: { id: string; days: number }[] }
export const MULTI_TRIPS: MultiTrip[] = [
  { id: 'eu-classica', title: 'Europa clássica', region: 'Europa', stops: [{ id: 'lisboa', days: 3 }, { id: 'madri', days: 3 }, { id: 'paris', days: 4 }, { id: 'roma', days: 4 }] },
  { id: 'eu-central', title: 'Europa Central', region: 'Europa', stops: [{ id: 'berlim', days: 3 }, { id: 'praga', days: 3 }, { id: 'viena', days: 3 }, { id: 'budapeste', days: 3 }] },
  { id: 'eu-franca-italia', title: 'França e Itália', region: 'Europa', stops: [{ id: 'paris', days: 4 }, { id: 'milao', days: 2 }, { id: 'veneza', days: 2 }, { id: 'florenca', days: 3 }, { id: 'roma', days: 4 }] },
  { id: 'eu-iberica', title: 'Portugal e Espanha', region: 'Europa', stops: [{ id: 'lisboa', days: 3 }, { id: 'porto', days: 2 }, { id: 'madri', days: 3 }, { id: 'sevilha', days: 2 }, { id: 'barcelona', days: 3 }] },
  { id: 'eu-ilhas', title: 'Londres, Escócia e Irlanda', region: 'Europa', stops: [{ id: 'londres', days: 4 }, { id: 'edimburgo', days: 3 }, { id: 'dublin', days: 3 }] },
  { id: 'eu-norte', title: 'Amsterdã, Berlim e Munique', region: 'Europa', stops: [{ id: 'amsterda', days: 3 }, { id: 'berlim', days: 3 }, { id: 'munique', days: 3 }] },
  { id: 'as-japao-coreia', title: 'Japão e Coreia', region: 'Ásia', stops: [{ id: 'toquio', days: 4 }, { id: 'kyoto', days: 3 }, { id: 'seul', days: 4 }] },
  { id: 'as-sudeste', title: 'Sudeste Asiático', region: 'Ásia', stops: [{ id: 'bangkok', days: 4 }, { id: 'singapura', days: 3 }, { id: 'bali', days: 5 }] },
  { id: 'sa-andes', title: 'Chile e Peru', region: 'América do Sul', stops: [{ id: 'santiago', days: 3 }, { id: 'atacama', days: 3 }, { id: 'lima', days: 2 }, { id: 'cusco', days: 4 }] },
  { id: 'sa-prata', title: 'Argentina e Uruguai', region: 'América do Sul', stops: [{ id: 'buenosaires', days: 4 }, { id: 'montevideu', days: 2 }, { id: 'bariloche', days: 4 }] },
  { id: 'an-eua-mexico', title: 'Estados Unidos e México', region: 'América do Norte e Central', stops: [{ id: 'novayork', days: 4 }, { id: 'miami', days: 3 }, { id: 'cancun', days: 4 }] },
  { id: 'om-dubai-istambul', title: 'Istambul, Cairo e Dubai', region: 'Oriente Médio', stops: [{ id: 'istambul', days: 4 }, { id: 'cairo', days: 3 }, { id: 'dubai', days: 3 }] }
];
export function multiTripCountries(m: MultiTrip): string[] { return m.stops.map((s) => countryOf(s.id)).filter((x, i, a) => x && a.indexOf(x) === i); }

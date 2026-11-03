/* Como ir de uma cidade da viagem para a próxima: avião, trem, ônibus, barco ou carro.
   1) Rotas conhecidas entre as cidades do catálogo (tempos aproximados, porta a porta não incluso).
   2) Sem rota conhecida: estimativa pela distância e pela região.
   3) Sempre: links para comparar horários e preços (Rome2rio e Google Maps). */
import { CITY_COORDS, lookupDest, destName, continentOf, countryOf } from '../data';

export type TravelMode = 'aviao' | 'trem' | 'trem-noturno' | 'onibus' | 'barco' | 'carro';
export interface TravelOption { mode: TravelMode; label: string; time: string; note?: string }
export interface Intercity { from: string; to: string; km: number | null; options: TravelOption[]; known: boolean; compareUrl: string; mapsUrl: string }

export const MODE_ICON: Record<TravelMode, string> = { aviao: 'plane', trem: 'train', 'trem-noturno': 'train', onibus: 'bus', barco: 'boat', carro: 'car' };
export const MODE_NAME: Record<TravelMode, string> = { aviao: 'Avião', trem: 'Trem', 'trem-noturno': 'Trem noturno', onibus: 'Ônibus', barco: 'Barco', carro: 'Carro' };

type R = [TravelMode, string, string, string?];
const ROUTES: Record<string, R[]> = {};
function route(a: string, b: string, opts: R[]) { ROUTES[a + '|' + b] = opts; ROUTES[b + '|' + a] = opts; }

/* ---------- Europa ---------- */
route('lisboa', 'porto', [['trem', 'Trem Alfa Pendular', '≈ 3 h', 'Do centro ao centro, sem check-in'], ['onibus', 'Ônibus', '≈ 3 h 30'], ['carro', 'Carro', '≈ 3 h', 'Pela A1, com pedágios'], ['aviao', 'Voo', '≈ 55 min']]);
route('lisboa', 'madri', [['aviao', 'Voo', '≈ 1 h 20'], ['onibus', 'Ônibus', '≈ 8 h'], ['carro', 'Carro', '≈ 6 h'], ['trem', 'Trem com conexão', '≈ 9 h ou mais', 'Não há trem direto; confira as conexões']]);
route('porto', 'madri', [['aviao', 'Voo', '≈ 1 h 15'], ['onibus', 'Ônibus', '≈ 8 h 30'], ['carro', 'Carro', '≈ 6 h']]);
route('lisboa', 'sevilha', [['onibus', 'Ônibus', '≈ 6 h 30'], ['carro', 'Carro', '≈ 4 h 30'], ['aviao', 'Voo', '≈ 1 h']]);
route('madri', 'barcelona', [['trem', 'Trem de alta velocidade (AVE e outros)', '≈ 2 h 30', 'Do centro ao centro'], ['aviao', 'Voo', '≈ 1 h 20'], ['onibus', 'Ônibus', '≈ 7 h 30'], ['carro', 'Carro', '≈ 6 h']]);
route('madri', 'sevilha', [['trem', 'Trem de alta velocidade (AVE)', '≈ 2 h 30'], ['onibus', 'Ônibus', '≈ 6 h'], ['carro', 'Carro', '≈ 5 h']]);
route('sevilha', 'barcelona', [['trem', 'Trem de alta velocidade', '≈ 5 h 30'], ['aviao', 'Voo', '≈ 1 h 35']]);
route('barcelona', 'paris', [['trem', 'Trem de alta velocidade direto', '≈ 6 h 30'], ['aviao', 'Voo', '≈ 1 h 50'], ['onibus', 'Ônibus', '≈ 14 h']]);
route('madri', 'paris', [['aviao', 'Voo', '≈ 2 h'], ['trem', 'Trem com conexão em Barcelona', '≈ 10 h']]);
route('lisboa', 'paris', [['aviao', 'Voo', '≈ 2 h 30']]);
route('paris', 'londres', [['trem', 'Trem Eurostar, pelo túnel do Canal', '≈ 2 h 20', 'Chegue 1 h antes: há controle de passaporte'], ['aviao', 'Voo', '≈ 1 h 15'], ['onibus', 'Ônibus', '≈ 8 h'], ['barco', 'Trem ou ônibus + balsa (Calais–Dover)', '≈ 7 h']]);
route('paris', 'amsterda', [['trem', 'Trem de alta velocidade (Eurostar)', '≈ 3 h 20'], ['aviao', 'Voo', '≈ 1 h 20'], ['onibus', 'Ônibus', '≈ 7 h']]);
route('londres', 'amsterda', [['trem', 'Trem Eurostar direto', '≈ 4 h'], ['aviao', 'Voo', '≈ 1 h 15'], ['barco', 'Trem + balsa noturna (Harwich–Hoek van Holland)', 'noite a bordo']]);
route('paris', 'roma', [['aviao', 'Voo', '≈ 2 h'], ['trem', 'Trem com conexão em Milão', '≈ 11 h']]);
route('paris', 'milao', [['trem', 'Trem de alta velocidade', '≈ 7 h', 'Passa pelos Alpes'], ['aviao', 'Voo', '≈ 1 h 30']]);
route('paris', 'munique', [['trem', 'Trem de alta velocidade', '≈ 5 h 40'], ['aviao', 'Voo', '≈ 1 h 30']]);
route('paris', 'berlim', [['trem', 'Trem de alta velocidade', '≈ 8 h'], ['aviao', 'Voo', '≈ 1 h 45'], ['trem-noturno', 'Trem noturno', 'noite a bordo']]);
route('milao', 'veneza', [['trem', 'Trem Frecciarossa ou Italo', '≈ 2 h 25'], ['carro', 'Carro', '≈ 3 h'], ['onibus', 'Ônibus', '≈ 3 h 30']]);
route('milao', 'florenca', [['trem', 'Trem de alta velocidade', '≈ 1 h 55'], ['carro', 'Carro', '≈ 3 h 30']]);
route('milao', 'roma', [['trem', 'Trem de alta velocidade', '≈ 3 h'], ['aviao', 'Voo', '≈ 1 h 10']]);
route('veneza', 'florenca', [['trem', 'Trem de alta velocidade', '≈ 2 h 05'], ['carro', 'Carro', '≈ 3 h']]);
route('veneza', 'roma', [['trem', 'Trem de alta velocidade', '≈ 3 h 45'], ['aviao', 'Voo', '≈ 1 h 05']]);
route('florenca', 'roma', [['trem', 'Trem de alta velocidade', '≈ 1 h 30'], ['carro', 'Carro', '≈ 3 h'], ['onibus', 'Ônibus', '≈ 3 h 30']]);
route('roma', 'atenas', [['aviao', 'Voo', '≈ 2 h'], ['barco', 'Trem até Bari + balsa até Patras', '≈ 1 dia', 'Balsa noturna no mar Adriático']]);
route('roma', 'barcelona', [['aviao', 'Voo', '≈ 1 h 50'], ['barco', 'Balsa Civitavecchia–Barcelona', '≈ 20 h']]);
route('roma', 'madri', [['aviao', 'Voo', '≈ 2 h 30']]);
route('londres', 'edimburgo', [['trem', 'Trem (LNER)', '≈ 4 h 30', 'Paisagem bonita pela costa'], ['aviao', 'Voo', '≈ 1 h 20'], ['trem-noturno', 'Trem noturno Caledonian Sleeper', 'noite a bordo'], ['onibus', 'Ônibus', '≈ 9 h']]);
route('edimburgo', 'dublin', [['aviao', 'Voo', '≈ 1 h'], ['barco', 'Ônibus + balsa via Belfast', '≈ 8 h']]);
route('londres', 'dublin', [['aviao', 'Voo', '≈ 1 h 15'], ['barco', 'Trem + balsa (Holyhead–Dublin)', '≈ 8 h']]);
route('amsterda', 'berlim', [['trem', 'Trem direto', '≈ 6 h 20'], ['aviao', 'Voo', '≈ 1 h 20'], ['onibus', 'Ônibus', '≈ 9 h']]);
route('amsterda', 'munique', [['aviao', 'Voo', '≈ 1 h 20'], ['trem', 'Trem com conexão', '≈ 8 h']]);
route('berlim', 'munique', [['trem', 'Trem de alta velocidade (ICE)', '≈ 4 h'], ['aviao', 'Voo', '≈ 1 h 10'], ['onibus', 'Ônibus', '≈ 7 h']]);
route('berlim', 'praga', [['trem', 'Trem direto', '≈ 4 h 15', 'Margem do rio Elba no caminho'], ['onibus', 'Ônibus', '≈ 4 h 30'], ['carro', 'Carro', '≈ 3 h 45']]);
route('munique', 'praga', [['onibus', 'Ônibus', '≈ 5 h'], ['trem', 'Trem', '≈ 5 h 30'], ['carro', 'Carro', '≈ 4 h']]);
route('munique', 'viena', [['trem', 'Trem Railjet', '≈ 4 h'], ['carro', 'Carro', '≈ 4 h 30'], ['onibus', 'Ônibus', '≈ 5 h']]);
route('praga', 'viena', [['trem', 'Trem direto', '≈ 4 h'], ['onibus', 'Ônibus', '≈ 4 h 30'], ['carro', 'Carro', '≈ 3 h 45']]);
route('praga', 'budapeste', [['trem', 'Trem direto', '≈ 6 h 30'], ['trem-noturno', 'Trem noturno', 'noite a bordo'], ['onibus', 'Ônibus', '≈ 7 h']]);
route('viena', 'budapeste', [['trem', 'Trem Railjet', '≈ 2 h 40'], ['onibus', 'Ônibus', '≈ 3 h'], ['barco', 'Barco pelo rio Danúbio (abril a outubro)', '≈ 6 h 30'], ['carro', 'Carro', '≈ 2 h 45']]);
route('atenas', 'istambul', [['aviao', 'Voo', '≈ 1 h 25'], ['onibus', 'Ônibus', '≈ 12 h']]);
route('istambul', 'cairo', [['aviao', 'Voo', '≈ 2 h 10']]);
route('cairo', 'dubai', [['aviao', 'Voo', '≈ 3 h 40']]);
route('istambul', 'dubai', [['aviao', 'Voo', '≈ 4 h 30']]);
route('sevilha', 'marrakech', [['aviao', 'Voo', '≈ 1 h 15'], ['barco', 'Ônibus + balsa de Tarifa a Tânger + trem', '≈ 1 dia']]);
/* ---------- Ásia e Oceania ---------- */
route('toquio', 'kyoto', [['trem', 'Trem-bala Shinkansen', '≈ 2 h 15', 'O JR Pass cobre a maior parte das linhas'], ['onibus', 'Ônibus noturno', '≈ 8 h'], ['aviao', 'Voo até Osaka + trem', '≈ 3 h 30']]);
route('kyoto', 'seul', [['aviao', 'Voo saindo de Osaka (Kansai)', '≈ 1 h 45', 'Mais ≈ 1 h 15 de Kyoto até o aeroporto'], ['barco', 'Balsa de Osaka ou Fukuoka até Busan + trem KTX', '≈ 1 dia']]);
route('toquio', 'seul', [['aviao', 'Voo', '≈ 2 h 20']]);
route('seul', 'pequim', [['aviao', 'Voo', '≈ 2 h']]);
route('hongkong', 'pequim', [['trem', 'Trem-bala', '≈ 9 h'], ['aviao', 'Voo', '≈ 3 h 30']]);
route('bangkok', 'singapura', [['aviao', 'Voo', '≈ 2 h 25'], ['trem', 'Trem pela Malásia, com conexões', '≈ 2 dias']]);
route('singapura', 'bali', [['aviao', 'Voo', '≈ 2 h 40']]);
route('bangkok', 'bali', [['aviao', 'Voo', '≈ 4 h 20']]);
route('bangkok', 'hongkong', [['aviao', 'Voo', '≈ 2 h 50']]);
route('singapura', 'sydney', [['aviao', 'Voo', '≈ 8 h']]);
/* ---------- Américas ---------- */
route('santiago', 'atacama', [['aviao', 'Voo até Calama + transfer até San Pedro', '≈ 2 h + 1 h 30'], ['onibus', 'Ônibus', '≈ 23 h']]);
route('atacama', 'lima', [['aviao', 'Voo saindo de Calama, com conexão', '≈ 6 h ou mais']]);
route('santiago', 'lima', [['aviao', 'Voo', '≈ 3 h 30']]);
route('lima', 'cusco', [['aviao', 'Voo', '≈ 1 h 20', 'Cusco fica a 3.400 m: vá com calma no primeiro dia'], ['onibus', 'Ônibus', '≈ 21 h']]);
route('buenosaires', 'montevideu', [['barco', 'Barco direto (Buquebus)', '≈ 2 h 15', 'Ou barco até Colônia do Sacramento (≈ 1 h 15) + ônibus (≈ 2 h 30)'], ['aviao', 'Voo', '≈ 45 min']]);
route('buenosaires', 'bariloche', [['aviao', 'Voo', '≈ 2 h 20'], ['onibus', 'Ônibus', '≈ 20 h']]);
route('montevideu', 'bariloche', [['aviao', 'Voo com conexão em Buenos Aires', '≈ 5 h ou mais']]);
route('santiago', 'buenosaires', [['aviao', 'Voo', '≈ 2 h'], ['onibus', 'Ônibus pela Cordilheira dos Andes', '≈ 20 h']]);
route('santiago', 'bariloche', [['onibus', 'Ônibus pela travessia dos Andes (via Osorno)', '≈ 18 h'], ['aviao', 'Voo com conexão', '≈ 5 h ou mais']]);
route('rio', 'saopaulo', [['aviao', 'Voo (ponte aérea)', '≈ 1 h'], ['onibus', 'Ônibus', '≈ 6 h'], ['carro', 'Carro pela Via Dutra', '≈ 6 h']]);
route('saopaulo', 'foz', [['aviao', 'Voo', '≈ 1 h 40'], ['onibus', 'Ônibus', '≈ 16 h']]);
route('foz', 'buenosaires', [['aviao', 'Voo saindo de Puerto Iguazú (Argentina)', '≈ 1 h 50'], ['onibus', 'Ônibus', '≈ 18 h']]);
route('novayork', 'washington', [['trem', 'Trem Amtrak (Acela ou Northeast Regional)', '≈ 3 h'], ['onibus', 'Ônibus', '≈ 4 h 30'], ['carro', 'Carro', '≈ 4 h']]);
route('novayork', 'chicago', [['aviao', 'Voo', '≈ 2 h 20'], ['trem', 'Trem Amtrak', '≈ 20 h']]);
route('novayork', 'miami', [['aviao', 'Voo', '≈ 3 h']]);
route('novayork', 'orlando', [['aviao', 'Voo', '≈ 2 h 45']]);
route('miami', 'orlando', [['carro', 'Carro', '≈ 3 h 30'], ['trem', 'Trem Brightline', '≈ 3 h 30'], ['onibus', 'Ônibus', '≈ 4 h'], ['aviao', 'Voo', '≈ 1 h']]);
route('miami', 'cancun', [['aviao', 'Voo', '≈ 2 h']]);
route('orlando', 'cancun', [['aviao', 'Voo', '≈ 2 h']]);
route('cancun', 'cdmx', [['aviao', 'Voo', '≈ 2 h 20'], ['onibus', 'Ônibus', '≈ 24 h']]);
route('losangeles', 'sanfrancisco', [['aviao', 'Voo', '≈ 1 h 20'], ['carro', 'Carro pela costa (Highway 1)', '≈ 9 h', 'Pelo interior (I-5): ≈ 6 h'], ['trem', 'Trem Amtrak', '≈ 12 h'], ['onibus', 'Ônibus', '≈ 8 h']]);
route('losangeles', 'lasvegas', [['carro', 'Carro', '≈ 4 h 30'], ['aviao', 'Voo', '≈ 1 h 10'], ['onibus', 'Ônibus', '≈ 5 h']]);
route('lasvegas', 'sanfrancisco', [['aviao', 'Voo', '≈ 1 h 40'], ['carro', 'Carro', '≈ 8 h 30']]);
route('washington', 'chicago', [['aviao', 'Voo', '≈ 2 h']]);

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function hrs(h: number): string {
  if (h < 1) return '≈ ' + Math.max(30, Math.round(h * 60 / 10) * 10) + ' min';
  const H = Math.floor(h), m = Math.round((h - H) * 60 / 15) * 15;
  return '≈ ' + (m === 60 ? H + 1 + ' h' : H + ' h' + (m ? ' ' + m : ''));
}
const RAIL = ['Europa'];
const RAIL_COUNTRIES = ['Japão', 'Coreia do Sul', 'China'];

/* Estimativa quando não há rota conhecida (cidades do catálogo com coordenadas) */
function estimate(a: string, b: string, km: number): TravelOption[] {
  const ca = continentOf(a), cb = continentOf(b), sameCont = ca && ca === cb;
  const pa = countryOf(a), pb = countryOf(b);
  const rail = sameCont && (RAIL.indexOf(ca) >= 0 || (pa === pb && RAIL_COUNTRIES.indexOf(pa) >= 0));
  const road = km * 1.25;
  const opts: TravelOption[] = [];
  if (!sameCont || km > 1100) return [{ mode: 'aviao', label: 'Voo', time: hrs(km / 750 + 0.6), note: km > 3000 ? 'Pode ter conexão' : undefined }];
  if (rail && km <= 900) opts.push({ mode: 'trem', label: 'Trem', time: hrs(road / (km > 300 ? 170 : 90) + 0.3) });
  if (km >= 400) opts.push({ mode: 'aviao', label: 'Voo', time: hrs(km / 750 + 0.6) });
  opts.push({ mode: 'onibus', label: 'Ônibus', time: hrs(road / 70) });
  if (km <= 900) opts.push({ mode: 'carro', label: 'Carro', time: hrs(road / 85) });
  return opts;
}

export function intercity(fromId: string, toId: string): Intercity {
  const from = destName(fromId), to = destName(toId);
  const ca = CITY_COORDS[fromId], cb = CITY_COORDS[toId];
  const km = ca && cb ? Math.round(haversine(ca, cb)) : null;
  const known = ROUTES[fromId + '|' + toId];
  const label = (id: string) => { const d = lookupDest(id); return d && d.kind !== 'country' && d.country ? d.name + ', ' + d.country : destName(id); };
  const options: TravelOption[] = known ? known.map(([mode, l, time, note]) => ({ mode, label: l, time, note }))
    : km !== null ? estimate(fromId, toId, km)
    : [];
  return {
    from, to, km, options, known: !!known,
    compareUrl: 'https://www.rome2rio.com/s/' + encodeURIComponent(label(fromId)) + '/' + encodeURIComponent(label(toId)),
    mapsUrl: 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(label(fromId)) + '&destination=' + encodeURIComponent(label(toId)) + '&travelmode=transit'
  };
}
/* Resumo curto para a faixa de paradas: "Trem · ≈ 2 h 30" */
export function intercityShort(fromId: string, toId: string): { icon: string; text: string } | null {
  const ic = intercity(fromId, toId);
  const o = ic.options[0];
  return o ? { icon: MODE_ICON[o.mode], text: MODE_NAME[o.mode] + ' · ' + o.time.replace('≈ ', '') } : null;
}

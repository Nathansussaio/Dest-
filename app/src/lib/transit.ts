/* Como ir de um lugar ao próximo: a pé, transporte público, carro ou bate-volta.
   Tempos estimados pela distância; linhas e horários reais ficam com o app de mapas. */
import type { Place } from '../types';
import { TRANSIT, TRANSIT_DEFAULT, CITY_NAME, type TransitInfo } from '../data';
import { kmBetween } from './generator';

export interface TransitLeg {
  mode: 'walk' | 'transit' | 'car' | 'far'; icon: string; label: string; time: string; minutes: number;
  km: number; kmLabel: string; steps: string[]; info: TransitInfo; mapsUrl: string;
}

export function transitLeg(cityId: string, a: Place, b: Place): TransitLeg {
  const T = TRANSIT[cityId] || TRANSIT_DEFAULT, km = kmBetween(a, b), walkKm = (T.walkMax || 9) * 0.15;
  const kmLabel = km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km';
  const q = (p: Place) => encodeURIComponent(p.name + ', ' + (CITY_NAME[cityId] || ''));
  const url = (mode: string) => 'https://www.google.com/maps/dir/?api=1&origin=' + q(a) + '&destination=' + q(b) + '&travelmode=' + mode;
  const base = { km, kmLabel, info: T };
  if (b.fullDay || km > 35) return { ...base, mode: 'far', icon: 'plane', label: 'Bate-volta: trem, ônibus ou excursão', time: '1 h ou mais', minutes: 60, steps: ['Confirme horários e reserve com antecedência', 'Saia cedo para aproveitar o dia'], mapsUrl: url('transit') };
  if (km <= walkKm) {
    const w = Math.max(3, Math.round(km * 13));
    return { ...base, mode: 'walk', icon: 'shoe', label: 'A pé', time: '≈ ' + w + ' min', minutes: w, steps: ['Caminhe de ' + a.area + ' até ' + b.name], mapsUrl: url('walking') };
  }
  if (T.carOnly || (T.farCar && km > 5)) {
    const c = Math.round(6 + km * 2);
    return { ...base, mode: 'car', icon: 'route', label: T.carOnly ? T.modes : 'Carro, táxi ou app', time: '≈ ' + c + ' min', minutes: c, steps: ['Combine a ida e a volta antes', 'Até ' + b.name + ', em ' + b.area], mapsUrl: url('driving') };
  }
  const m = Math.round(12 + km * 2.6);
  return {
    ...base, mode: 'transit', icon: 'route', label: T.modes, time: '≈ ' + m + ' min', minutes: m,
    steps: ['A pé até a estação ou ponto mais perto de ' + a.area, T.modes.split(/,| ou /)[0].trim() + ' até a região de ' + b.area, 'Curta caminhada até ' + b.name],
    mapsUrl: url('transit')
  };
}

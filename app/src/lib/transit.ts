/* Como ir de um lugar ao próximo: a pé, transporte público, carro ou bate-volta.
   Tempos estimados pela distância; linhas e horários reais ficam com o app de mapas. */
import type { Place } from '../types';
import { TRANSIT, TRANSIT_DEFAULT, CITY_NAME, type TransitInfo } from '../data';
import { kmBetween } from './generator';

export interface TransitLeg {
  mode: 'walk' | 'transit' | 'car' | 'far'; icon: string; label: string; time: string; minutes: number;
  km: number; kmLabel: string; steps: string[]; info: TransitInfo; mapsUrl: string;
}

export type TravelMode = 'walk' | 'car' | 'transit';
export const TRAVEL_MODES: { id: TravelMode; label: string; icon: string }[] = [
  { id: 'walk', label: 'A pé', icon: 'shoe' },
  { id: 'car', label: 'Carro', icon: 'car' },
  { id: 'transit', label: 'Transporte público', icon: 'bus' }
];

/* force: o meio escolhido pela pessoa (sem ele, o app sugere pelo tamanho do trecho) */
export function transitLeg(cityId: string, a: Place, b: Place, force?: TravelMode | null): TransitLeg {
  const T = TRANSIT[cityId] || TRANSIT_DEFAULT, km = kmBetween(a, b), walkKm = (T.walkMax || 9) * 0.15;
  const kmLabel = km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km';
  const q = (p: Place) => encodeURIComponent(p.name + ', ' + (CITY_NAME[cityId] || ''));
  const url = (mode: string) => 'https://www.google.com/maps/dir/?api=1&origin=' + q(a) + '&destination=' + q(b) + '&travelmode=' + mode;
  const base = { km, kmLabel, info: T };
  if (force === 'walk') {
    const w = Math.max(3, Math.round(km * 13));
    const steps = ['Caminhe de ' + a.area + ' até ' + b.name];
    if (w > 45) steps.push('Caminhada longa: leve água e calçado confortável');
    return { ...base, mode: 'walk', icon: 'shoe', label: 'A pé', time: '≈ ' + (w >= 60 ? Math.floor(w / 60) + ' h' + (w % 60 ? ' ' + (w % 60) + ' min' : '') : w + ' min'), minutes: w, steps, mapsUrl: url('walking') };
  }
  if (force === 'car') {
    const c = Math.round(6 + km * (km > 35 ? 1.2 : 2));
    return { ...base, mode: 'car', icon: 'car', label: 'Carro, táxi ou app', time: '≈ ' + (c >= 60 ? Math.floor(c / 60) + ' h' + (c % 60 ? ' ' + (c % 60) + ' min' : '') : c + ' min'), minutes: c, steps: ['De carro, táxi ou app até ' + b.name + ', em ' + b.area, km > 5 ? 'Veja onde estacionar antes de sair' : 'Trecho curto: dá para ir a pé também'], mapsUrl: url('driving') };
  }
  if (force === 'transit' && !b.fullDay && km <= 35) {
    const m = Math.round(12 + km * 2.6);
    const modes = T.carOnly ? 'Ônibus ou transporte local' : T.modes;
    return {
      ...base, mode: 'transit', icon: 'bus', label: T.carOnly ? 'Transporte público (pouca oferta)' : T.modes, time: '≈ ' + m + ' min', minutes: m,
      steps: ['A pé até a estação ou ponto mais perto de ' + a.area, modes.split(/,| ou /)[0].trim() + ' até a região de ' + b.area, 'Curta caminhada até ' + b.name].concat(T.carOnly ? ['Aqui o transporte público é limitado: confira horários antes'] : []),
      mapsUrl: url('transit')
    };
  }
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

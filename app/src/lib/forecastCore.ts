/* Previsão do tempo (Open-Meteo): regras puras, sem acesso à rede (testadas em tests/) */
import { iso, today0, addDays } from './format';

export interface DayForecast { date: string; hi: number; lo: number; rain: number | null; code: number; icon: string; label: string }

/* Códigos de tempo da Organização Meteorológica Mundial (WMO) */
export function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: 'sun', label: 'Céu limpo' };
  if (code <= 2) return { icon: 'cloudSun', label: 'Poucas nuvens' };
  if (code === 3) return { icon: 'cloudSun', label: 'Nublado' };
  if (code === 45 || code === 48) return { icon: 'cloudSun', label: 'Neblina' };
  if (code >= 51 && code <= 57) return { icon: 'cloudRain', label: 'Garoa' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: 'cloudRain', label: 'Chuva' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: 'snow', label: 'Neve' };
  if (code >= 95) return { icon: 'cloudRain', label: 'Tempestade' };
  return { icon: 'cloudSun', label: 'Tempo variável' };
}

/* Janela que a previsão cobre: de hoje até 15 dias à frente */
export function forecastWindow(start: string, end: string, now = today0()): { from: string; to: string } | null {
  const first = iso(now), last = iso(addDays(now, 15));
  const from = start > first ? start : first, to = end < last ? end : last;
  return from <= to ? { from, to } : null;
}
export function forecastUrl(lat: number, lng: number, from: string, to: string): string {
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=' + from + '&end_date=' + to;
}
export function parseForecast(j: any): DayForecast[] {
  const d = j && j.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((date: string, i: number) => {
    const code = Number(d.weather_code ? d.weather_code[i] : 3), w = wmo(code);
    const rain = d.precipitation_probability_max ? d.precipitation_probability_max[i] : null;
    return { date, hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), rain: rain == null ? null : Math.round(rain), code, icon: w.icon, label: w.label };
  });
}


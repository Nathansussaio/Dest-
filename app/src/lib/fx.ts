/* Cotação do dia (dólar, euro e libra em reais) para o cabeçalho do site.
   Busca ao abrir e a cada 30 minutos; guarda a última no aparelho para mostrar sem internet. */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AWESOME_URL, FRANKFURTER_URL, parseAwesome, parseFrankfurter, type FxQuote } from './fxCore';
export * from './fxCore';

const KEY = 'desti:fx';
const FRESH = 30 * 60 * 1000;
let mem: { t: number; q: FxQuote } | null = null;
let inflight: Promise<FxQuote | null> | null = null;

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}
async function fetchQuote(): Promise<FxQuote | null> {
  try { const q = parseAwesome(await getJson(AWESOME_URL)); if (q) return q; } catch { /* tenta a reserva */ }
  try { return parseFrankfurter(await getJson(FRANKFURTER_URL)); } catch { return null; }
}
async function load(force?: boolean): Promise<FxQuote | null> {
  if (!force && mem && Date.now() - mem.t < FRESH) return mem.q;
  if (!mem) {
    try { const raw = await AsyncStorage.getItem(KEY); if (raw) mem = JSON.parse(raw); } catch { /* sem cache */ }
    if (mem && Date.now() - mem.t < FRESH) return mem.q;
  }
  if (!inflight) inflight = fetchQuote().finally(() => { inflight = null; });
  const q = await inflight;
  if (q) { mem = { t: Date.now(), q }; AsyncStorage.setItem(KEY, JSON.stringify(mem)).catch(() => {}); return q; }
  return mem ? mem.q : null; /* sem internet: última cotação guardada */
}

export function useFx(): FxQuote | null {
  const [q, setQ] = useState<FxQuote | null>(mem ? mem.q : null);
  useEffect(() => {
    let alive = true;
    const run = (force?: boolean) => load(force).then((v) => { if (alive && v) setQ(v); });
    run();
    const id = setInterval(() => run(true), FRESH);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return q;
}

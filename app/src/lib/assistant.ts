/* Assistente de viagem: respostas montadas com o catálogo e as regras do app.
   Na versão com IA, um modelo de linguagem usa estas mesmas funções como ferramentas. */
import type { Trip, ChatCard } from '../types';
import { PLACES, DISHES, CAT_INFO, hasCatalog } from '../data';
import { tripLegs, legsTitle, legDayArgs, legNameOfDay, styleLabel, itemName } from './trip';
import { buildDay, reorderDay, type Used } from './generator';
import { addDays, parseD, brl } from './format';

export type AiKey = 'roteiro' | 'reorganizar' | 'chuva' | 'comer' | 'orcamento' | 'livre';
export interface AiReply { lines: string[]; card?: ChatCard | null }

const SHORT: Record<string, string> = { museu: 'Museu', cafe: 'Café', restaurante: 'Comer', atracao: 'Visita', mirante: 'Vista', natureza: 'Ar livre', noite: 'Noite', esporte: 'Esporte', experiencia: 'Vivência' };

export function freeDayOf(trip: Trip): number { return trip.days.findIndex((d) => !d.some((x) => x.kind === 'place')); }

export function aiReply(key: AiKey, trip: Trip | null, currentDay: number, spent: number): AiReply {
  if (!trip) return { lines: ['Crie uma viagem primeiro. Depois eu sugiro roteiros e ajudo a reorganizar os dias.'] };
  const cities = tripLegs(trip).map((l) => l.destId).filter((c, i, a) => hasCatalog(c) && a.indexOf(c) === i);
  const hasCat = cities.length > 0;
  const where = legsTitle(tripLegs(trip));
  const toCard = (items: { time: string; kind: string; placeId?: string; text?: string }[]) => items.map((x: any) => ({ time: x.time, text: itemName(x) }));

  if (key === 'roteiro') {
    if (!hasCat) return { lines: ['Este destino ainda não tem catálogo de lugares, então não consigo montar dias automaticamente. Use Adicionar lugar no roteiro.'] };
    let di = freeDayOf(trip);
    const full = di < 0;
    if (full) di = Math.min(currentDay, trip.days.length - 1);
    const la = legDayArgs(trip, di);
    if (!hasCatalog(la.city)) return { lines: ['O Dia ' + (di + 1) + ' é em ' + legNameOfDay(trip, di) + ', que ainda não tem catálogo de lugares.'] };
    const used: Used = {};
    trip.days.forEach((d, i) => { if (i !== di) d.forEach((x) => { if (x.placeId) used[x.placeId] = 1; }); });
    const plan = buildDay(la.city, trip.styles && trip.styles.length ? trip.styles : ['Cultural'], trip.pace || 'equilibrado', la.i, la.n, used, addDays(parseD(trip.start), di).getDay());
    if (!plan.some((x) => x.kind === 'place')) return { lines: ['Já usei todos os lugares do catálogo de ' + legNameOfDay(trip, di) + ' nos outros dias.'] };
    return {
      lines: [full
        ? 'Todos os dias já têm planos. Uma alternativa para o Dia ' + (di + 1) + ' em ' + legNameOfDay(trip, di) + ', no estilo ' + styleLabel(trip) + ':'
        : 'O Dia ' + (di + 1) + ' está livre. Uma sugestão em ' + legNameOfDay(trip, di) + ', no estilo ' + styleLabel(trip) + ', com lugares próximos entre si:']
        .concat(full ? ['Aplicar substitui o que está no Dia ' + (di + 1) + '. Dá para desfazer.'] : []),
      card: { title: 'Dia ' + (di + 1) + ' · sugestão', action: 'setDay', tripId: trip.id, dayIdx: di, plan, items: toCard(plan) }
    };
  }
  if (key === 'reorganizar') {
    let best = -1, bestN = 0;
    trip.days.forEach((d, i) => { const r0 = reorderDay(d); if (r0.n > bestN) { bestN = r0.n; best = i; } });
    if (bestN < 3) return { lines: ['Seu roteiro ainda tem poucas visitas por dia para reorganizar. Adicione alguns lugares e tente de novo.'] };
    const reo = reorderDay(trip.days[best]);
    if (!reo.changed) return { lines: ['O Dia ' + (best + 1) + ' já está numa boa ordem: cada visita fica perto da anterior.'] };
    return {
      lines: ['Proposta para o Dia ' + (best + 1) + ': visitar os lugares na ordem de quem está mais perto, com menos idas e vindas. Refeições e programas da noite ficam nos mesmos horários.', 'Calculado pela distância entre os lugares, sem dados de horários ou trânsito.'],
      card: { title: 'Dia ' + (best + 1) + ' · nova ordem proposta', action: 'setDay', tripId: trip.id, dayIdx: best, plan: reo.items, items: toCard(reo.items) }
    };
  }
  if (key === 'chuva') {
    const indoor = PLACES.filter((p) => cities.indexOf(p.city) >= 0 && p.styles.length && (p.cat === 'museu' || p.cat === 'cafe' || (p.cat === 'restaurante' && !p.demo)))
      .sort((a, b) => (a.cat === 'museu' ? 0 : 1) - (b.cat === 'museu' ? 0 : 1)).slice(0, 5);
    if (!indoor.length) return { lines: ['Em dias de chuva, priorize museus, mercados cobertos e cafés.'] };
    return {
      lines: ['Se chover em ' + where + ', estas opções do catálogo são em lugares fechados:', 'Para trocar um item do roteiro, abra o dia, toque em Trocar no lugar e escolha.'],
      card: { title: 'Opções cobertas', items: indoor.map((p) => ({ time: SHORT[p.cat], text: p.name })) }
    };
  }
  if (key === 'comer') {
    const food = PLACES.filter((p) => cities.indexOf(p.city) >= 0 && p.styles.length && (p.cat === 'restaurante' || p.cat === 'cafe') && !p.demo).slice(0, 4);
    const dishes = cities.map((c) => (DISHES[c] || []).slice(0, 2).map((d) => d[0])).reduce((a, b) => a.concat(b), [] as string[]).slice(0, 3);
    return {
      lines: [food.length ? 'Do catálogo de ' + where + ', estes lugares são boas paradas para comer:' : 'Procure restaurantes perto das atrações de cada dia, assim você economiza tempo de deslocamento.']
        .concat(dishes.length ? ['Pratos para provar: ' + dishes.join(', ') + '.'] : []),
      card: food.length ? { title: 'Onde comer', items: food.map((p) => ({ time: SHORT[p.cat] || CAT_INFO[p.cat].label, text: p.name + ' · ' + p.area })) } : null
    };
  }
  if (key === 'orcamento') {
    const pct = trip.budget ? Math.round(spent / trip.budget * 100) : 0;
    return {
      lines: ['Com base nos gastos registrados, já foram ' + brl(spent) + ' de ' + brl(trip.budget) + ' (' + pct + '%).'],
      card: { title: 'Ideias para economizar', items: [
        { time: '1', text: 'Agrupe atrações por bairro para gastar menos com transporte' },
        { time: '2', text: 'Prefira menus executivos no almoço e deixe o jantar especial para um dia' },
        { time: '3', text: 'Compare passes de transporte com bilhetes avulsos antes de comprar' }
      ] }
    };
  }
  return { lines: ['Por enquanto eu respondo às sugestões prontas abaixo. Perguntas livres chegam com o assistente de IA.'] };
}

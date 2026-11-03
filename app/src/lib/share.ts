/* Texto e página para compartilhar o roteiro (sem códigos de reserva) */
import type { Trip, Reservation } from '../types';
import { PLACE_BY_ID } from '../data';
import { parseD, addDays, SEM, SEM_LONGO, MES, MES_LONGO, plural, fmtShort } from './format';
import { periodLabel, isMultiCity, legNameOfDay, sortItems, itemName } from './trip';

export function shareText(t: Trip, reservations: Reservation[]): string {
  const lines = ['Destí · ' + t.name + (t.country ? ', ' + t.country : ''), periodLabel(t) + ' · ' + plural(t.days.length, 'dia', 'dias') + ' · ' + plural(t.travelers, 'viajante', 'viajantes'), ''];
  t.days.forEach((d, i) => {
    const dt = addDays(parseD(t.start), i);
    lines.push('Dia ' + (i + 1) + ' · ' + SEM[dt.getDay()] + ', ' + dt.getDate() + ' ' + MES[dt.getMonth()] + (isMultiCity(t) ? ' · ' + legNameOfDay(t, i) : ''));
    const items = sortItems(d);
    if (!items.length) lines.push('  Dia livre');
    items.forEach((x) => {
      const p = x.kind === 'place' && x.placeId ? PLACE_BY_ID[x.placeId] : null;
      lines.push('  ' + x.time + '  ' + itemName(x) + (p ? ' (' + p.area + ')' : ''));
    });
    lines.push('');
  });
  const res = reservations.filter((r) => r.tripId === t.id).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (res.length) {
    lines.push('Reservas');
    res.forEach((r) => lines.push('  ' + fmtShort(r.date) + (r.time ? ' ' + r.time : '') + '  ' + r.title + ' · ' + r.status.toLowerCase()));
    lines.push('');
  }
  lines.push('Feito com o Destí.');
  return lines.join('\n');
}

export function shareHtml(t: Trip): string {
  const esc = (x: string) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]);
  const h = ['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc('Roteiro · ' + t.name) + '</title>',
    '<style>body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;max-width:720px;margin:32px auto;padding:0 20px;color:#1B1C1E;line-height:1.45}h1{margin:0 0 4px;font-size:30px}h2{font-size:16px;margin:22px 0 6px;padding-bottom:4px;border-bottom:1px solid #DDD}ul{list-style:none;padding:0;margin:0}li{padding:3px 0}b{display:inline-block;width:58px}.m{color:#5F6166}@media print{body{margin:0}}</style></head><body>',
    '<h1>' + esc(t.name + (t.country ? ', ' + t.country : '')) + '</h1>',
    '<p class="m">' + esc(periodLabel(t) + ' · ' + plural(t.days.length, 'dia', 'dias') + ' · ' + plural(t.travelers, 'viajante', 'viajantes')) + '</p>'];
  t.days.forEach((d, i) => {
    const dt = addDays(parseD(t.start), i);
    h.push('<h2>' + esc('Dia ' + (i + 1) + ' · ' + SEM_LONGO[dt.getDay()] + ', ' + dt.getDate() + ' de ' + MES_LONGO[dt.getMonth()] + (isMultiCity(t) ? ' · ' + legNameOfDay(t, i) : '')) + '</h2><ul>');
    const items = sortItems(d);
    if (!items.length) h.push('<li class="m">Dia livre</li>');
    items.forEach((x) => {
      const p = x.kind === 'place' && x.placeId ? PLACE_BY_ID[x.placeId] : null;
      h.push('<li><b>' + esc(x.time) + '</b>' + esc(itemName(x)) + (p ? ' <span class="m">· ' + esc(p.area) + '</span>' : '') + '</li>');
    });
    h.push('</ul>');
  });
  h.push('<p class="m" style="margin-top:28px">Para salvar em PDF, use Imprimir e escolha "Salvar como PDF". Feito com o Destí.</p></body></html>');
  return h.join('');
}

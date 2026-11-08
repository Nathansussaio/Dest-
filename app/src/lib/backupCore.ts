/* Backup em arquivo: regras puras (sem React Native), testadas em tests/multi.test.ts */
import type { AccountData } from '../types';

export interface BackupFile { app: 'desti'; version: 1; exportedAt: string; data: AccountData }

export function makeBackup(data: AccountData): string {
  const b: BackupFile = { app: 'desti', version: 1, exportedAt: new Date().toISOString(), data };
  return JSON.stringify(b);
}
/* Confere o arquivo; devolve os dados ou o motivo do erro */
export function parseBackup(text: string): { data: AccountData } | { error: string } {
  let j: any;
  const keep = ' Nada foi alterado nas suas viagens.';
  try { j = JSON.parse(text); } catch { return { error: 'Este arquivo não é um backup do Destí ou está corrompido.' + keep + ' Escolha o arquivo .json baixado em Perfil › Baixar backup.' }; }
  if (!j || j.app !== 'desti' || !j.data || typeof j.data !== 'object') return { error: 'Este arquivo não é um backup do Destí.' + keep + ' Escolha o arquivo .json baixado em Perfil › Baixar backup.' };
  if (!Array.isArray(j.data.trips)) return { error: 'O backup está incompleto: não tem a lista de viagens.' + keep };
  const bad = j.data.trips.some((t: any) => !t || typeof t.id !== 'string' || typeof t.start !== 'string' || !Array.isArray(t.days));
  if (bad) return { error: 'O backup tem viagens com dados estragados e não pode ser usado.' + keep };
  return { data: j.data as AccountData };
}
export function backupName(): string {
  const d = new Date();
  return 'desti-backup-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
}

/* Junta viagens de outro conjunto (backup ou modo visitante) às atuais, sem apagar nada.
   Viagem que já existe aqui (mesmo id) fica como está; a do arquivo é pulada. */
export function mergeAccountData(base: AccountData, add: AccountData): { data: AccountData; added: number; skipped: number } {
  const have: Record<string, boolean> = {};
  base.trips.forEach((t) => { have[t.id] = true; });
  const trips = (add.trips || []).filter((t) => !have[t.id]);
  const ids: Record<string, boolean> = {};
  trips.forEach((t) => { ids[t.id] = true; });
  const checklist = { ...base.checklist };
  trips.forEach((t) => { if (add.checklist && add.checklist[t.id]) checklist[t.id] = add.checklist[t.id]; });
  const uniq = (a: string[]) => a.filter((x, i) => a.indexOf(x) === i);
  return {
    data: {
      ...base,
      trips: base.trips.concat(trips), checklist,
      expenses: base.expenses.concat((add.expenses || []).filter((e) => ids[e.tripId])),
      reservations: base.reservations.concat((add.reservations || []).filter((r) => ids[r.tripId])),
      saved: uniq(base.saved.concat(add.saved || [])), savedDest: uniq(base.savedDest.concat(add.savedDest || []))
    },
    added: trips.length, skipped: (add.trips || []).length - trips.length
  };
}

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
  try { j = JSON.parse(text); } catch { return { error: 'Este arquivo não é um backup do Destí.' }; }
  if (!j || j.app !== 'desti' || !j.data || typeof j.data !== 'object') return { error: 'Este arquivo não é um backup do Destí.' };
  if (!Array.isArray(j.data.trips)) return { error: 'O backup está incompleto: não tem a lista de viagens.' };
  return { data: j.data as AccountData };
}
export function backupName(): string {
  const d = new Date();
  return 'desti-backup-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
}

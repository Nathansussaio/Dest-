/* Backup em arquivo: todas as viagens, gastos, reservas e preferências num arquivo .json.
   Serve para guardar uma cópia ou levar os dados para outro aparelho, mesmo sem a nuvem. */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { shareTextNative } from './device';

import { makeBackup, parseBackup, backupName, type BackupFile } from './backupCore';
export { makeBackup, parseBackup, backupName, type BackupFile };

/* Salva o arquivo: no navegador, baixa; no celular, abre o compartilhar (salvar em Arquivos, mandar por e-mail…) */
export async function saveBackup(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const doc: any = (globalThis as any).document;
      const blob = new (globalThis as any).Blob([text], { type: 'application/json' });
      const url = (globalThis as any).URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url; a.download = backupName(); doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => (globalThis as any).URL.revokeObjectURL(url), 2000);
      return true;
    } catch { return false; }
  }
  return shareTextNative('Backup do Destí', text);
}
/* Abre um arquivo de backup e devolve o texto (ou null se a pessoa desistir) */
export async function pickBackup(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const doc: any = (globalThis as any).document;
      const input = doc.createElement('input');
      input.type = 'file'; input.accept = 'application/json,.json';
      input.onchange = () => {
        const f = input.files && input.files[0];
        if (!f) { resolve(null); return; }
        f.text().then((t: string) => resolve(t)).catch(() => resolve(null));
      };
      input.click();
    });
  }
  const r: any = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (!r || r.canceled || !r.assets || !r.assets[0]) return null;
  try { const res = await fetch(r.assets[0].uri); return await res.text(); } catch { return null; }
}

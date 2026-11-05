/* Recursos do aparelho no site: sem notificações agendadas nem biometria (só existem no app de celular).
   Versão própria para o site, para não carregar as bibliotecas do celular. */
import { Share } from 'react-native';
import type { Alert } from './alerts';

export async function copyText(text: string): Promise<boolean> {
  try { await (globalThis as any).navigator.clipboard.writeText(text); return true; } catch { return false; }
}
export async function shareTextNative(title: string, text: string): Promise<boolean> {
  try {
    const nav: any = (globalThis as any).navigator;
    if (nav && nav.share) { await nav.share({ title, text }); return true; }
    const r = await Share.share({ title, message: text }); return r.action !== Share.dismissedAction;
  } catch { return false; }
}
/* PDF no site: abre a impressão do navegador, onde dá para "Salvar como PDF" */
export async function sharePdf(html: string, _name: string): Promise<boolean> {
  try {
    const w = (globalThis as any).open('', '_blank');
    if (!w) return false;
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignora */ } }, 300);
    return true;
  } catch { return false; }
}
export async function ensureNotifPermission(): Promise<boolean> { return true; }
export async function scheduleAlerts(_alerts: Alert[]): Promise<void> { /* só no app de celular */ }
export async function unlockWithBiometrics(): Promise<boolean> { return true; }

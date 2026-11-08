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
  /* abre o roteiro numa aba e chama Imprimir (lá dá para escolher "Salvar como PDF").
     Se o navegador bloquear a aba nova, imprime por um quadro escondido nesta mesma página. */
  try {
    const w = (globalThis as any).open('', '_blank');
    if (w && w.document) {
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignora */ } }, 300);
      return true;
    }
  } catch { /* tenta o quadro */ }
  try {
    const d: any = (globalThis as any).document;
    if (!d) return false;
    const f = d.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
    d.body.appendChild(f);
    const fd = f.contentWindow && f.contentWindow.document;
    if (!fd) { f.remove(); return false; }
    fd.open(); fd.write(html); fd.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { /* ignora */ } setTimeout(() => f.remove(), 60000); }, 300);
    return true;
  } catch { return false; }
}
export async function ensureNotifPermission(): Promise<boolean> { return true; }
export async function scheduleAlerts(_alerts: Alert[]): Promise<void> { /* só no app de celular */ }
export async function unlockWithBiometrics(): Promise<boolean> { return true; }

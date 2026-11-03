/* Recursos do aparelho: copiar, compartilhar, PDF, notificações locais e biometria.
   Cada função falha de forma silenciosa e devolve se deu certo, para o app nunca travar por falta de permissão. */
import { Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import type { Alert } from './alerts';

/* mostra os avisos mesmo com o app aberto */
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false })
  });
} catch { /* web */ }

export async function copyText(text: string): Promise<boolean> {
  try { await Clipboard.setStringAsync(text); return true; } catch { return false; }
}

export async function shareTextNative(title: string, text: string): Promise<boolean> {
  try { const r = await Share.share({ title, message: text }); return r.action !== Share.dismissedAction; } catch { return false; }
}

/* Gera um PDF a partir do HTML do roteiro e abre a folha de compartilhar do sistema */
export async function sharePdf(html: string, name: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') { await Print.printAsync({ html }); return true; }
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: name, UTI: 'com.adobe.pdf' });
    return true;
  } catch { return false; }
}

/* ---------- Notificações locais (sem servidor) ---------- */
export async function ensureNotifPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return !!asked.granted;
  } catch { return false; }
}

/* Reagenda os avisos futuros como notificações às 9h do dia de cada aviso */
export async function scheduleAlerts(alerts: Alert[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const a of alerts.slice(0, 40)) {
      const p = a.date.split('-').map(Number);
      const when = new Date(p[0], p[1] - 1, p[2], 9, 0, 0);
      if (when.getTime() <= now + 60000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: a.title, body: a.sub, data: { alertId: a.id, tripId: a.tripId } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when } as any
      });
    }
  } catch { /* sem permissão ou aparelho sem suporte */ }
}

/* ---------- Biometria para abrir o app ---------- */
export async function unlockWithBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = has && (await LocalAuthentication.isEnrolledAsync());
    if (!enrolled) return true; /* aparelho sem biometria: não bloqueia */
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Desbloquear o Destí', cancelLabel: 'Cancelar', fallbackLabel: 'Usar senha do aparelho' });
    return r.success;
  } catch { return true; }
}

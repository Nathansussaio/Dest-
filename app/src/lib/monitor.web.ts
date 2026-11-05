/* Aviso de erros no site: o Sentry só é baixado se EXPO_PUBLIC_SENTRY_DSN estiver configurado (não pesa para ninguém sem ele). */
import { SENTRY_DSN } from '../config';

let S: any = null;
export function initMonitor() {
  if (!SENTRY_DSN || S) return;
  import('@sentry/react-native').then((m) => {
    try { m.init({ dsn: SENTRY_DSN, sendDefaultPii: false, tracesSampleRate: 0 }); S = m; } catch { /* segue sem */ }
  }).catch(() => {});
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (e) => reportError(e.error || e.message));
    window.addEventListener('unhandledrejection', (e: any) => reportError(e.reason));
  }
}
export function withMonitor<T>(C: T): T { return C; }
export function reportError(e: unknown) { if (S) try { S.captureException(e); } catch { /* ignora */ } }

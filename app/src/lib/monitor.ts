/* Aviso de erros (Sentry): quando o app trava no celular de alguém, o erro chega para vocês.
   Só liga se EXPO_PUBLIC_SENTRY_DSN estiver no .env. Não envia dados pessoais (sendDefaultPii: false). */
import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '../config';

let on = false;
export function initMonitor() {
  if (!SENTRY_DSN || on) return;
  try {
    Sentry.init({ dsn: SENTRY_DSN, sendDefaultPii: false, tracesSampleRate: 0 });
    on = true;
  } catch { /* sem Sentry o app segue normal */ }
}
export function withMonitor<T>(C: T): T { return on ? (Sentry.wrap(C as any) as any) : C; }
export function reportError(e: unknown) { if (on) try { Sentry.captureException(e); } catch { /* ignora */ } }

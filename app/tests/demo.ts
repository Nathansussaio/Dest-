/* Dados de exemplo usados só nos testes automáticos (não entram no app) */
import type { AccountData } from '../src/types';
import { welcomeMsg, defaultPrefs } from '../src/lib/accounts';
import DEMO from './demo.json';

export function demoData(): AccountData {
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  const D = DEMO as any;
  return {
    trips: clone(D.trips), expenses: clone(D.expenses), reservations: clone(D.reservations), checklist: clone(D.checklist),
    saved: ['p3', 'p4', 'p6', 'p11', 'k1'], savedDest: ['kyoto', 'cartagena'], chat: [welcomeMsg()],
    prefs: defaultPrefs(['Cultural', 'Gastronômica']), sec: { faceId: false }, dishDone: {}, alertsRead: []
  };
}

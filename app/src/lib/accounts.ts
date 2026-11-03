/* Dados iniciais de uma conta nova (vazia) */
import type { AccountData, CheckItem, ChatMsg, Prefs } from '../types';
import { uid } from './format';

export function welcomeMsg(): ChatMsg {
  return { id: 'w', from: 'ai', lines: ['Olá! Sou o assistente do Destí.', 'Posso sugerir um dia de roteiro, reorganizar visitas, achar opções para dia de chuva e lugares para comer, sempre com os lugares do nosso catálogo.'] };
}

export function defaultPrefs(styles: Prefs['styles'] = []): Prefs {
  return { currency: 'BRL', notif: { roteiro: true, orcamento: true, ia: false }, styles, theme: 'auto', textLg: false, offlineSave: true, pro: false };
}

export function defaultChecklist(): CheckItem[] {
  return [
    { label: 'Documento de viagem válido', hint: 'Passaporte ou RG, conforme o destino' },
    { label: 'Seguro viagem', hint: 'Guarde a apólice e o telefone de assistência' },
    { label: 'Cópias digitais dos documentos', hint: 'No celular e na nuvem' },
    { label: 'Cartão ou dinheiro para o destino', hint: 'Avise o banco sobre a viagem' },
    { label: 'Internet no celular', hint: 'Chip local, eSIM ou roaming' },
    { label: 'Adaptador de tomada', hint: 'Confira o padrão de tomada do destino' }
  ].map((c) => ({ id: uid('c'), label: c.label, hint: c.hint, done: false }));
}

export function freshData(): AccountData {
  return {
    trips: [], expenses: [], reservations: [], checklist: {}, saved: [], savedDest: [], chat: [welcomeMsg()],
    prefs: defaultPrefs(), sec: { faceId: false }, dishDone: {}, alertsRead: []
  };
}

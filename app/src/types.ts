/* Tipos do domínio do Destí */

export type Slot = 'manha' | 'almoco' | 'tarde' | 'fimtarde' | 'noite';
export type Style = 'Cultural' | 'Gastronômica' | 'Esportiva' | 'Natureza' | 'Relax' | 'Vida noturna';
export type PaceId = 'tranquilo' | 'equilibrado' | 'intenso';
export type CatId = 'atracao' | 'restaurante' | 'cafe' | 'mirante' | 'museu' | 'esporte' | 'experiencia' | 'natureza' | 'noite';

export interface Place {
  id: string; city: string; name: string; cat: CatId; area: string;
  x: number; y: number; slots: Slot[]; styles: Style[];
  desc: string; dur: string; cost: string; best?: string;
  lat?: number; lng?: number; closed?: number[]; book?: boolean; demo?: boolean; fullDay?: boolean;
}

export interface Destination {
  id: string; name: string; country: string; tag?: string; aliases: string[];
  color: string; art: string; kind: 'catalog' | 'country' | 'city';
}

export interface ItineraryItem {
  id: string; time: string; kind: 'place' | 'move' | 'note';
  placeId?: string; text?: string;
}

export interface Leg { destId: string; name?: string; days: number }

export interface Member {
  id: string; name: string; email?: string;
  status: 'owner' | 'ativo' | 'pendente'; role?: 'editar' | 'ver';
}

export interface Settlement { id: string; from: string; to: string; amount: number; date: string }
export interface Activity { who: string; text: string; when: string }

export interface Trip {
  id: string; destId: string; name: string; country: string;
  start: string; end: string; travelers: number; budget: number;
  styles: Style[]; pace: PaceId; plan: Record<string, number>;
  days: ItineraryItem[][];
  legs?: Leg[]; members?: Member[]; settlements?: Settlement[]; activity?: Activity[];
}

export interface Expense {
  id: string; tripId: string; title: string; cat: string; amount: number;
  date?: string; method?: string; receipt?: string | null;
  orig?: { value: number; currency: string; rate: number } | null;
  paidBy?: string; split?: string[] | null;
}

export interface Reservation {
  id: string; tripId: string; type: string; title: string; date: string; time: string;
  code: string; status: 'Confirmada' | 'Pendente'; details: string[];
  file?: { name: string; uri: string | null } | null;
}

export interface CheckItem { id: string; label: string; hint: string; done: boolean }

export interface ChatCard {
  title: string; items: { time: string; text: string }[];
  action?: 'setDay'; tripId?: string; dayIdx?: number; plan?: ItineraryItem[];
  applied?: boolean; dismissed?: boolean;
}
export interface ChatMsg { id: string; from: 'me' | 'ai'; lines: string[]; card?: ChatCard | null }

export interface Prefs {
  currency: 'BRL' | 'EUR' | 'USD';
  notif: { roteiro: boolean; orcamento: boolean; ia: boolean };
  styles: Style[];
  theme: 'auto' | 'light' | 'dark';
  textLg: boolean;
  offlineSave: boolean;
  pro: boolean;
  proPlan?: 'anual' | 'mensal';
}

/* Dados de uma conta (o que é salvo no aparelho) */
export interface AccountData {
  trips: Trip[]; expenses: Expense[]; reservations: Reservation[];
  checklist: Record<string, CheckItem[]>;
  saved: string[]; savedDest: string[]; chat: ChatMsg[];
  prefs: Prefs; sec: { faceId: boolean; twoFA?: boolean };
  dishDone: Record<string, string[]>; alertsRead: string[];
}

/* Regras de senha (a validação de verdade fica no serviço de autenticação) */
import { COMMON_PASSWORDS } from '../data';

export function passRules(p: string) {
  p = p || '';
  return [
    { label: 'Pelo menos 8 caracteres', ok: p.length >= 8, required: true },
    { label: 'Uma letra maiúscula', ok: /[A-Z]/.test(p), required: true },
    { label: 'Um número', ok: /\d/.test(p), required: true },
    { label: 'Um símbolo (recomendado)', ok: /[^A-Za-z0-9]/.test(p), required: false }
  ];
}
export function passProblem(p: string): string | null {
  if (!passRules(p).every((r) => r.ok || !r.required)) return 'A senha precisa cumprir os três primeiros requisitos.';
  if (COMMON_PASSWORDS.indexOf(String(p).toLowerCase()) >= 0) return 'Essa senha é muito comum. Escolha outra.';
  return null;
}
export function passStrength(p: string): 0 | 1 | 2 | 3 {
  if (!p) return 0;
  const score = passRules(p).filter((r) => r.ok).length;
  return score <= 1 ? 1 : score <= 3 ? 2 : 3;
}

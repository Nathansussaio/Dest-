/* Configurações do Destí.
   As chaves ficam no arquivo .env (veja .env.exemplo) e entram no app na hora do build.
   Sem as chaves do Supabase, o app funciona só no aparelho (sem login na nuvem). */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

/* Páginas públicas (publique a pasta docs/site no Cloudflare Pages ou Netlify e troque o endereço) */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || 'https://destiapp.com.br';
export const PRIVACY_URL = SITE_URL + '/privacidade.html';
export const TERMS_URL = SITE_URL + '/termos.html';
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'contato@destiapp.com.br';

/* Programas de afiliados: troque pelos seus IDs quando se cadastrar (deixe vazio para links sem afiliado) */
export const BOOKING_AFFILIATE_ID = process.env.EXPO_PUBLIC_BOOKING_AID || '';
export const GETYOURGUIDE_PARTNER_ID = process.env.EXPO_PUBLIC_GYG_PARTNER_ID || '';

export const CLOUD_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

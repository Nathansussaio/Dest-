/* GitHub Pages devolve "404" para endereços que não são arquivos. Para cada tela fixa do site
   (ex.: /viagens/, /roteiro/), grava uma cópia do index.html na pasta da tela, com título próprio.
   Assim o link abre com "200 OK" (WhatsApp, buscadores, testes) e o app lê o resto do endereço.
   Uso (depois do expo export): npx tsx tools/static-routes.ts dist https://endereco-do-site */
import fs from 'fs';
import path from 'path';
import { STATIC_DIRS, legacyTarget } from '../src/lib/routes';

const dist = process.argv[2] || 'dist';
const site = (process.argv[3] || '%SITE_URL%').replace(/\/+$/, '');
const src = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const DESC: Record<string, string> = {
  roteiro: 'Roteiro de viagem dia a dia, compartilhado pelo Destí. Abra para ver destino, datas e o que fazer em cada dia.',
  convite: 'Você foi convidado para montar uma viagem junto no Destí. Abra para entrar com a sua conta.'
};
let n = 0;
for (const r of STATIC_DIRS) {
  const title = r.title + ' · Destí';
  const url = site + '/' + r.dir + '/';
  let h = src
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<link rel="canonical" href="[^"]*"/, '<link rel="canonical" href="' + url + '"')
    .replace(/<meta property="og:url" content="[^"]*"/, '<meta property="og:url" content="' + url + '"')
    .replace(/<meta property="og:title" content="[^"]*"/, '<meta property="og:title" content="' + esc(title) + '"')
    .replace(/<meta name="twitter:title" content="[^"]*"/, '<meta name="twitter:title" content="' + esc(title) + '"');
  if (DESC[r.dir]) {
    h = h.replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content="' + esc(DESC[r.dir]) + '"')
      .replace(/<meta property="og:description" content="[^"]*"/, '<meta property="og:description" content="' + esc(DESC[r.dir]) + '"')
      .replace(/<meta name="twitter:description" content="[^"]*"/, '<meta name="twitter:description" content="' + esc(DESC[r.dir]) + '"');
  }
  /* páginas de conta e de link: não entram na busca do Google (só a página inicial entra) */
  h = h.replace(/<meta name="robots" content="[^"]*"/, '<meta name="robots" content="noindex, follow"');
  /* o texto de apresentação pré-carregado é só da página inicial: nas outras, um "carregando" simples */
  h = h.replace(/<main class="pre">[\s\S]*?<\/main>/, '<main class="pre" aria-busy="true"><p style="font:15px -apple-system,Segoe UI,Roboto,sans-serif;color:#5F6166;text-align:center;margin-top:30vh">Carregando o Destí…</p></main>');
  fs.mkdirSync(path.join(dist, r.dir), { recursive: true });
  fs.writeFileSync(path.join(dist, r.dir, 'index.html'), h);
  n++;
}
/* 404.html (endereço que não existe no GitHub Pages):
   1) endereço antigo (/viagem/<id>, /convite/<código>…): troca na hora pelo novo, antes de carregar o app;
   2) qualquer outro: o app abre e mostra "Página não encontrada". Não entra na busca do Google. */
let base = '';
try { base = new URL(site).pathname.replace(/\/+$/, ''); } catch { base = ''; }
const redirect = '<script>(function(){var b=' + JSON.stringify(base) + ',p=location.pathname;if(p.indexOf(b+"/")!==0)return;' +
  'var t=(' + legacyTarget.toString() + ')(p.slice(b.length),location.search);' +
  'if(t)location.replace(b+"/"+t+location.hash);})();</script>';
const nf = src
  .replace(/<meta name="robots" content="[^"]*"/, '<meta name="robots" content="noindex"')
  .replace(/<main class="pre">[\s\S]*?<\/main>/, '<main class="pre" aria-busy="true"><p style="font:15px -apple-system,Segoe UI,Roboto,sans-serif;color:#5F6166;text-align:center;margin-top:30vh">Carregando o Destí…</p></main>')
  .replace(/<head>/, '<head>' + redirect);
fs.writeFileSync(path.join(dist, '404.html'), nf);
/* _redirects: regras de redirecionamento (301) para hospedagens que aceitam regras, como Cloudflare Pages e Netlify.
   O GitHub Pages ignora este arquivo; nele o 404.html faz a troca no navegador. Com o domínio próprio
   atrás do Cloudflare (ou o site no Cloudflare Pages), os endereços antigos passam a responder 301, não 404. */
const R = (from: string, to: string) => base + from + '  ' + base + to + '  301';
fs.writeFileSync(path.join(dist, '_redirects'), [
  '# Endereços antigos (id no caminho) para o formato novo (id na consulta). Gerado por tools/static-routes.ts.',
  R('/viagem/:id/roteiro/:dia', '/viagem/?id=:id&tela=roteiro&dia=:dia'),
  R('/viagem/:id/:tela', '/viagem/?id=:id&tela=:tela'),
  R('/viagem/:id', '/viagem/?id=:id'),
  R('/convite/:codigo', '/convite/?c=:codigo'),
  R('/roteiro/:id', '/roteiro/?id=:id'),
  R('/lugar/:id', '/lugar/?id=:id'),
  ''
].join('\n'));
console.log('páginas por tela:', n, '+ 404.html');

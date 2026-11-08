/* Link público de verdade, no site publicado e no Supabase de verdade:
   1. visitante cria uma viagem (Lisboa) e vê que o link pede conta;
   2. cria uma conta de teste temporária (a viagem vai junto) e gera o link pelo botão "Compartilhar roteiro público";
   3. abre o link em janela anônima no Chromium, Firefox e Safari (WebKit), recarrega e confere o que aparece;
   4. exclui a conta de teste pelo app (o link deixa de existir) e confere a mensagem de link removido.
   Uso: node public-link.mjs https://endereco-do-site/  [manter]  ("manter" não exclui a conta, para deixar um link de exemplo) */
import { chromium, firefox, webkit } from 'playwright';
const base = (process.argv[2] || '').replace(/\/?$/, '/');
const keep = process.argv[3] === 'manter';
const run = process.env.GITHUB_RUN_ID || String(Date.now());
const email = 'teste-link-' + run + '@example.com', senha = 'Roteira-' + run + '!a';
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nx = (new Date().getMonth() + 1) % 12;
let falhas = 0;
const passo = async (t, fn) => { console.log('… ' + t); try { await fn(); console.log('ok  ' + t); } catch (e) { falhas++; console.log('FALHOU ' + t + ': ' + String(e.message).split('\n')[0]); throw e; } };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);
let url = '';
try {
  await passo('visitante cria viagem para Lisboa', async () => {
    await p.goto(base);
    await p.getByText('Experimentar sem conta').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Pular', { exact: true }).first().click({ timeout: 3000 }).catch(() => {});
    await p.getByLabel('Nova viagem').first().click({ timeout: 5000 }).catch(async () => { await p.getByText('Nova viagem').first().click(); });
    await p.getByLabel('Lisboa', { exact: true }).first().click();
    await p.getByLabel('3 de ' + MES[nx], { exact: true }).first().click();
    await p.getByLabel('7 de ' + MES[nx], { exact: true }).first().click();
    await p.getByText('Criar viagem', { exact: true }).last().click();
    await p.getByText('Usar este roteiro').first().click();
    await p.waitForURL(/\/viagem\/\?id=/);
  });
  await passo('visitante: link público pede conta (texto e PDF continuam)', async () => {
    await p.getByText('Dia 1').first().waitFor();
    await p.goBack(); await p.waitForTimeout(800);
    await p.getByLabel('Compartilhar roteiro').first().click();
    await p.getByText('Para gerar um link público, crie uma conta ou sincronize esta viagem').first().waitFor();
    await p.getByText('Copiar texto').first().waitFor();
    await p.getByText('Gerar PDF').first().waitFor();
  });
  await passo('cria conta de teste (a viagem do visitante vai junto)', async () => {
    await p.getByText('Criar conta (a viagem vai junto)').first().click();
    await p.getByPlaceholder('Como quer ser chamado').fill('Teste Automático');
    await p.getByPlaceholder('voce@email.com').fill(email);
    await p.getByPlaceholder('Crie uma senha').fill(senha);
    await p.getByPlaceholder('Repita a senha').fill(senha);
    await p.getByText('Aceito os Termos de uso').first().click();
    await p.getByText('Continuar', { exact: true }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Pular', { exact: true }).first().click({ timeout: 4000 }).catch(() => {});
    await p.goto(base + 'viagens/');
    await p.getByText('Lisboa').first().click();
    await p.waitForURL(/\/viagem\/\?id=/);
  });
  await passo('gera o link pelo botão "Compartilhar roteiro público"', async () => {
    await p.getByLabel('Compartilhar roteiro').first().click();
    await p.getByText('Convidar para editar junto').first().waitFor();
    await p.getByText('Compartilhar roteiro público', { exact: true }).click();
    await p.getByText('Copiar link').first().waitFor({ timeout: 20000 });
    const txt = await p.evaluate(() => document.body.innerText);
    const m = txt.match(/https?:\/\/\S+\/roteiro\/\?id=[a-z0-9]+/);
    if (!m) throw new Error('link não apareceu');
    url = m[0];
    console.log('LINK PÚBLICO: ' + url);
    await p.waitForTimeout(1500);
  });
  for (const [nome, tipo] of [['Chromium', chromium], ['Firefox', firefox], ['WebKit (Safari)', webkit]]) {
    await passo('abre em janela anônima no ' + nome + ' (sem login) e recarrega', async () => {
      const bb = nome === 'Chromium' ? b : await tipo.launch();
      const c = await bb.newContext({ viewport: { width: 390, height: 844 } }); /* contexto novo = janela anônima: nada salvo, sem conta */
      const g = await c.newPage();
      const r = await g.goto(url);
      if (!r || r.status() !== 200) throw new Error('status ' + (r && r.status()));
      await g.getByText('Roteiro compartilhado pelo Destí').first().waitFor({ timeout: 25000 });
      for (const t of ['Lisboa', 'Dia 1', 'viajante']) await g.getByText(t).first().waitFor();
      const txt = await g.evaluate(() => document.body.innerText);
      if (/Teste Automático|example\.com|Entrar na minha conta/.test(txt)) throw new Error('mostrou dado privado ou pediu login');
      if (!/^Roteiro: Lisboa/.test(await g.title())) throw new Error('título: ' + (await g.title()));
      await g.reload();
      await g.getByText('Roteiro compartilhado pelo Destí').first().waitFor({ timeout: 25000 });
      await c.close();
      if (bb !== b) await bb.close();
    });
  }
  if (!keep) {
    await passo('exclui a conta de teste (o link deixa de existir)', async () => {
      await p.goto(base + 'perfil/');
      await p.getByText('Excluir conta').first().click();
      await p.getByPlaceholder('EXCLUIR').fill('EXCLUIR');
      await p.getByText('Excluir minha conta').last().click();
      await p.waitForTimeout(3000);
      const c = await b.newContext();
      const g = await c.newPage();
      await g.goto(url);
      await g.getByText('Roteiro não encontrado').first().waitFor({ timeout: 25000 });
      await c.close();
    });
  } else console.log('conta de teste mantida (' + email + '): o link continua no ar');
} catch { /* já contado */ }
await b.close();
if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('Link público conferido de ponta a ponta.');

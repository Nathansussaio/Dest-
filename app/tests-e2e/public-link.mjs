/* Link público de verdade, no site publicado e no Supabase de verdade (modo visitante):
   1. visitante cria uma viagem (Lisboa) e clica em "Compartilhar roteiro público";
   2a. se o banco já tem a parte do visitante: o link sai na hora, sem conta;
   2b. se não tem: "Criar conta e publicar roteiro" (conta de teste temporária); a viagem vai para a conta,
       o painel volta e o link sai sozinho;
   3. abre o link em janela anônima no Chromium, Firefox e Safari (WebKit), recarrega e confere o que aparece;
   4. limpa: desativa o link (2a) ou exclui a conta de teste (2b) e confere "Roteiro não encontrado".
   Uso: node public-link.mjs https://endereco-do-site/  [manter]  ("manter" deixa o link no ar como exemplo) */
import { chromium, firefox, webkit } from 'playwright';
const base = (process.argv[2] || '').replace(/\/?$/, '/');
const keep = process.argv[3] === 'manter';
const run = process.env.GITHUB_RUN_ID || String(Date.now());
const email = 'teste-link-' + run + '@example.com', senha = 'Roteira-' + run + '!a';
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nx = (new Date().getMonth() + 1) % 12;
let falhas = 0, modo = '';
const passo = async (t, fn) => { console.log('… ' + t); try { await fn(); console.log('ok  ' + t); } catch (e) { falhas++; console.log('FALHOU ' + t + ': ' + String(e.message).split('\n')[0]); throw e; } };
const linkIn = async (p) => { const m = (await p.evaluate(() => document.body.innerText)).match(/https?:\/\/\S+\/roteiro\/\?id=[a-z0-9]+/); return m ? m[0] : ''; };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);
let url = '';
try {
  await passo('visitante cria viagem para Lisboa e registra um gasto', async () => {
    await p.goto(base);
    await p.getByText('Experimentar sem conta').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Pular', { exact: true }).first().click({ timeout: 3000 }).catch(() => {});
    await p.getByText('apenas neste aparelho e neste navegador').first().waitFor();
    await p.getByLabel('Nova viagem').first().click({ timeout: 5000 }).catch(async () => { await p.getByText('Nova viagem').first().click(); });
    await p.getByLabel('Lisboa', { exact: true }).first().click();
    await p.getByLabel('3 de ' + MES[nx], { exact: true }).first().click();
    await p.getByLabel('7 de ' + MES[nx], { exact: true }).first().click();
    await p.getByText('Criar viagem', { exact: true }).last().click();
    await p.getByText('Esta viagem está salva apenas neste aparelho').first().waitFor();
    await p.getByText('Usar este roteiro').first().click();
    await p.waitForURL(/\/viagem\/\?id=/);
    await p.reload();
    await p.getByText('Dia 1').first().waitFor({ timeout: 25000 });
  });
  await passo('Compartilhar: público, sem conta e editar junto separados', async () => {
    await p.goto(p.url().replace(/&tela=.*$/, ''));
    await p.getByLabel('Compartilhar roteiro').first().click();
    for (const t of ['Compartilhar sem conta', 'não publicam sua viagem na internet', 'Convidar para editar junto', 'Copiar texto', 'Gerar PDF']) await p.getByText(t).first().waitFor();
    await p.getByText('Compartilhar roteiro público', { exact: true }).last().click();
    await p.waitForFunction(() => /Copiar link|Criar conta e publicar roteiro/.test(document.body.innerText), null, { timeout: 25000 });
  });
  if (await p.getByText('Copiar link').count()) {
    modo = 'visitante';
    await passo('link público gerado no modo visitante (sem conta)', async () => { url = await linkIn(p); if (!url) throw new Error('link não apareceu'); console.log('LINK PÚBLICO (visitante): ' + url); });
  } else {
    modo = 'conta';
    await passo('plano B: "Criar conta e publicar roteiro" (conta de teste temporária)', async () => {
      await p.getByText('Criar conta e publicar roteiro').first().click();
      await p.getByPlaceholder('Como quer ser chamado').fill('Teste Automático');
      await p.getByPlaceholder('voce@email.com').fill(email);
      await p.getByPlaceholder('Crie uma senha').fill(senha);
      await p.getByPlaceholder('Repita a senha').fill(senha);
      await p.getByText('Aceito os Termos de uso').first().click();
      await p.getByText('Continuar', { exact: true }).last().click();
      await p.getByText('Copiar link').first().waitFor({ timeout: 30000 });
      url = await linkIn(p);
      if (!url) throw new Error('link não apareceu depois do cadastro');
      if (!/\/viagem\/\?id=/.test(p.url())) throw new Error('não voltou para a viagem: ' + p.url());
      console.log('LINK PÚBLICO (depois do cadastro): ' + url);
    });
  }
  await p.waitForTimeout(1500);
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
      if (/Teste Automático|example\.com|Visitante|Entrar na minha conta/.test(txt)) throw new Error('mostrou dado privado ou pediu login');
      if (!/^Roteiro: Lisboa/.test(await g.title())) throw new Error('título: ' + (await g.title()));
      await g.reload();
      await g.getByText('Roteiro compartilhado pelo Destí').first().waitFor({ timeout: 25000 });
      await c.close();
      if (bb !== b) await bb.close();
    });
  }
  if (!keep) {
    await passo(modo === 'visitante' ? 'desativa o link do visitante' : 'exclui a conta de teste (o link deixa de existir)', async () => {
      if (modo === 'visitante') {
        await p.getByText('Desativar link').first().click();
        await p.getByText('Desativar', { exact: true }).last().click();
      } else {
        await p.goto(base + 'perfil/');
        await p.getByText('Excluir conta').first().click();
        await p.getByPlaceholder('EXCLUIR').fill('EXCLUIR');
        await p.getByText('Excluir minha conta').last().click();
      }
      await p.waitForTimeout(3000);
      const c = await b.newContext();
      const g = await c.newPage();
      await g.goto(url);
      await g.getByText('Roteiro não encontrado').first().waitFor({ timeout: 25000 });
      await g.getByText('Este link não existe ou foi desativado').first().waitFor();
      await c.close();
    });
  } else console.log('link mantido no ar como exemplo: ' + url);
} catch { /* já contado */ }
await b.close();
if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('Link público conferido de ponta a ponta (' + modo + ').');

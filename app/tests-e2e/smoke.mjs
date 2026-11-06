/* limite geral: se travar, encerra com erro em 8 minutos */
setTimeout(() => { console.log('FALHOU: os testes de tela passaram de 8 minutos.'); process.exit(1); }, 8 * 60 * 1000).unref();
/* Teste de tela no site oficial, antes de publicar (roda no GitHub em Chromium, Firefox e Safari/WebKit).
   Uso: node tests-e2e/smoke.mjs http://127.0.0.1:4173/Dest-/   — sai com erro se algo falhar. */
import { chromium, firefox, webkit } from 'playwright';
const base = process.argv[2];
const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nx = (new Date().getMonth() + 1) % 12;
/* falhas de serviços de fora (cotação, clima, mapa) não são erro do site: o app usa a reserva ou segue sem eles */
const externo = (m) => /access control checks|Failed to fetch|NetworkError|Load failed|awesomeapi|frankfurter|open-meteo|cartocdn|openstreetmap/i.test(m);
let falhas = 0;
for (const [nome, tipo] of [['Chromium', chromium], ['Firefox', firefox], ['WebKit (Safari)', webkit]]) {
  for (const [w, h] of [[1366, 900], [390, 844]]) {
    const b = await tipo.launch();
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.setDefaultTimeout(15000); p.setDefaultNavigationTimeout(30000);
    const erros = [];
    p.on('pageerror', (e) => { if (!externo(e.message)) erros.push(e.message); });
    const passo = async (t, fn) => {
      console.log('… [' + nome + ' ' + w + 'px] ' + t);
      try { await fn(); } catch (e) { falhas++; console.log('FALHOU [' + nome + ' ' + w + 'px] ' + t + ': ' + String(e.message).split('\n')[0]); throw e; }
    };
    try {
      await passo('abrir a página', async () => { await p.goto(base); await p.getByText('Planeje viagens sem planilha.').first().waitFor({ timeout: 20000 }); });
      await passo('entrar sem conta', async () => { await p.getByText('Experimentar sem conta').first().click(); await p.waitForTimeout(800); await p.getByText('Pular', { exact: true }).first().click({ timeout: 3000 }).catch(() => {}); });
      await passo('criar viagem', async () => {
        await p.getByLabel('Nova viagem').first().click({ timeout: 5000 }).catch(async () => { await p.getByText('Nova viagem').first().click(); });
        await p.getByLabel('Lisboa', { exact: true }).first().click();
        if (w > 900) { await p.getByLabel('3 de ' + MES[nx], { exact: true }).first().click(); await p.getByLabel('7 de ' + MES[nx], { exact: true }).first().click(); }
        else { await p.getByLabel('Ida: escolher').click(); await p.getByLabel('Próximo mês').click(); await p.getByLabel('3 de ' + MES[nx], { exact: true }).click(); await p.getByLabel('7 de ' + MES[nx], { exact: true }).click(); }
        await p.getByText('Criar viagem', { exact: true }).last().click();
        await p.getByText('Usar este roteiro').first().waitFor({ timeout: 8000 });
      });
      await passo('abrir o roteiro', async () => { await p.getByText('Usar este roteiro').first().click(); await p.waitForURL(/\/roteiro\/1$/, { timeout: 8000 }); });
      await passo('botão Voltar do navegador', async () => { await p.goBack(); await p.waitForTimeout(800); if (!/\/viagem\//.test(p.url())) throw new Error('Voltar saiu da viagem: ' + p.url()); });
      /* link direto aberto numa aba nova (como quem recebe o link): a página tem que abrir sem erro.
         No modo visitante nada é salvo, então a viagem não existe na aba nova e o app volta para o começo. */
      await passo('abrir link direto numa aba nova', async () => {
        const u = p.url();
        const p2 = await b.newPage({ viewport: { width: w, height: h } });
        const e2 = []; p2.on('pageerror', (e) => { if (!externo(e.message)) e2.push(e.message); });
        await p2.goto(u);
        await p2.getByText('Planeje viagens sem planilha.').first().waitFor({ timeout: 20000 });
        if (e2.length) throw new Error('erros: ' + e2.slice(0, 2).join(' | '));
        await p2.close();
      });
      if (erros.length) { falhas++; console.log('FALHOU [' + nome + ' ' + w + 'px] erros na página: ' + erros.slice(0, 3).join(' | ')); }
      else console.log('ok [' + nome + ' ' + w + 'px]');
    } catch { /* já contado */ }
    await Promise.race([b.close(), new Promise((r) => setTimeout(r, 10000))]);
  }
}
if (falhas) { console.log(falhas + ' falha(s): o site NÃO foi publicado.'); process.exit(1); }
console.log('Todos os testes de tela passaram.');

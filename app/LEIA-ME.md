# Destí: código do app (Expo + React Native + TypeScript)

Um único código gera o app de **iPhone**, o de **Android** e a versão **web**. Esta é a versão 1 para lançamento: grátis e sem nenhum recurso simulado.

## 1. O que instalar (uma vez)

- **Node.js 20 ou mais novo:** baixe em nodejs.org e escolha a versão LTS.
- **Expo Go no celular:** está na App Store e no Google Play. Serve para testar sem publicar.
- **VS Code** (opcional), para editar o código.

## 2. Rodar no seu computador

Abra o Terminal na pasta `desti` e rode:

```bash
npm install
npx expo install --fix      # alinha as versões dos pacotes com o SDK atual do Expo
cp .env.exemplo .env        # depois preencha o .env (veja a seção 3)
npm test                    # 19 testes das regras (roteiro, vários países, deslocamento entre cidades, backup, clima, previsão, cotação, divisão de gastos…)
npm run typecheck           # confere os tipos com os pacotes oficiais
npx expo start              # mostra um QR code
```

Para abrir o app:

- **iPhone:** aponte a câmera para o QR code.
- **Android:** leia o QR code pelo Expo Go.
- **Navegador:** aperte `w` no terminal.

Sem o `.env` preenchido, o app funciona normalmente, mas guarda as contas e as viagens **só no aparelho**. Para lançar, configure o Supabase.

## 3. Serviços (todos têm plano grátis para começar)

| Serviço | Para quê | Onde configurar |
|---|---|---|
| **Supabase** | Login com código por e-mail, recuperar senha, excluir conta e backup das viagens | `supabase/LEIA-ME.md` (passo a passo) → `.env` |
| **Google Maps (Android)** | Mapa real no Android (no iPhone, o Apple Maps não precisa de chave) | Google Cloud › Maps SDK for Android → `GOOGLE_MAPS_ANDROID_KEY` no `.env` |
| **Sentry** (opcional) | Aviso quando o app trava no celular de alguém | sentry.io → `EXPO_PUBLIC_SENTRY_DSN` no `.env` |
| **Open-Meteo** | Previsão do tempo dos 16 dias antes da viagem | Não precisa de conta nem de chave |
| **AwesomeAPI** (reserva: **Frankfurter**) | Cotação do dólar, do euro e da libra em reais, no cabeçalho do site | Não precisa de conta nem de chave |
| **Booking.com e GetYourGuide** (opcional) | Comissão nos links de hotel e ingressos | Programas de afiliados → IDs no `.env` |

O arquivo `.env` nunca vai para o GitHub nem para as lojas: ele já está no `.gitignore`. Para os builds na nuvem (EAS), cadastre as mesmas variáveis em expo.dev › seu projeto › Environment variables.

## 4. O que mudou para o lançamento

**Tirado:**
- plano Pro e todos os bloqueios: tudo fica liberado e grátis;
- login com Google e Apple simulado;
- conta e viagens de demonstração;
- código fixo de e-mail;
- convites por link;
- importação de reserva por e-mail;
- todas as faixas de "modo de teste".

**Feito de verdade:**
- **Login:**
  - cadastro com código de 6 números enviado por e-mail;
  - entrar, recuperar senha por código e trocar senha;
  - excluir conta pelo app, que apaga também os dados na nuvem.
- **Backup na nuvem:**
  - as viagens ficam na conta e aparecem em qualquer celular;
  - o app funciona sem internet e envia as mudanças quando a conexão volta;
  - uma cópia velha ou vazia num celular nunca apaga a versão mais nova da nuvem.
- **Mapa real:**
  - Apple Maps no iPhone e Google Maps no Android, com os lugares numerados;
  - os lugares do catálogo sem coordenada são localizados pelo próprio celular, pelo endereço;
  - quando não há coordenadas, aparece o mapa aproximado.
- **Viagem por vários países:**
  - na Nova viagem, a opção **Vários países** mostra 12 roteiros prontos, como Europa clássica, Europa Central, França e Itália, Japão e Coreia, Chile e Peru e Estados Unidos e México, com filtro por região;
  - também dá para montar o próprio roteiro: cada parada pode ser uma cidade ou um país inteiro, de qualquer lugar do mundo, com os dias de cada parada, e as paradas podem ser reordenadas ou retiradas;
  - ao digitar uma região, como "Europa" ou "Ásia", o app sugere os roteiros prontos e as cidades daquela região;
  - **deslocamento entre as cidades:** para cada troca de cidade, o app sugere como ir (avião, trem, trem noturno, ônibus, barco ou carro), com o tempo aproximado e observações. São cerca de 80 trechos conhecidos entre as cidades do catálogo (por exemplo Paris–Londres pelo Eurostar, Buenos Aires–Montevidéu de barco, Viena–Budapeste pelo Danúbio). Nos outros trechos, a sugestão é uma estimativa pela distância. Em todos, há links para comparar horários e preços (Rome2rio) e para ver o trajeto no Google Maps. A sugestão aparece no dia da troca de cidade no roteiro, entre as paradas na página da viagem e na lista de paradas da Nova viagem; dentro de cada cidade, o app continua indicando metrô, ônibus, a pé ou carro entre os lugares;
  - **editar as paradas** de uma viagem já criada, em Editar viagem: trocar, incluir, tirar e reordenar cidades e mudar os dias. Os dias já montados continuam na mesma cidade, e os dias novos são montados automaticamente;
  - na página da viagem, **clima e hotéis de cada parada**, com as datas de cada cidade;
  - o roteiro automático inclui o dia de deslocamento entre as cidades, e a página da viagem mostra as paradas com as datas de cada uma.
- **Orçamento opcional:** ao criar ou editar uma viagem, o orçamento pode ficar em branco. Sem ele, a tela de gastos mostra só o total gasto, com a opção "Definir orçamento".
- **Arrastar atividades entre dias:** no roteiro, segure no ⠿ de uma atividade e solte em cima de outro dia, na faixa de dias do topo. Em Editar dia, continua existindo o botão de mover para outro dia.
- **Backup em arquivo:** em Perfil › Backup, dá para baixar um arquivo com todas as viagens, gastos e reservas e restaurar depois, neste ou em outro aparelho. Isso funciona mesmo sem a nuvem.
- **Previsão do tempo real:** nos 16 dias antes da viagem, aparece a previsão de cada dia na página da viagem e no topo de cada dia do roteiro. Antes disso, aparece o clima típico do mês.
- **Pessoas da viagem:** quem vai junto entra pelo nome, para dividir os gastos neste celular. Mandar o roteiro para o grupo continua funcionando.
- **Páginas e documentos:**
  - Política de privacidade e Termos de uso, com links no app;
  - "Fale com a gente";
  - textos para as lojas;
  - lista para revisar os lugares.

**Fica para depois:**
- assistente com IA;
- leitura automática da nota fiscal;
- grupo sincronizado entre celulares;
- entrar com Google e Apple.

O "Assistente" atual monta as sugestões com o catálogo de lugares, sem IA, e o app diz isso para a pessoa.

## 5. Antes de enviar para as lojas

1. **Supabase:** siga `supabase/LEIA-ME.md`. Inclua o envio de e-mails próprio (SMTP); o envio padrão é limitado e só serve para testar.
2. **Site:**
   - publique o site (seção 7), que já leva a privacidade e os termos;
   - preencha os campos `[ENTRE COLCHETES]` em `public/privacidade.html` e `public/termos.html`;
   - coloque o endereço do site em `EXPO_PUBLIC_SITE_URL`.
3. **E-mail de contato:** crie um e-mail próprio (por exemplo, contato@ o seu domínio) e coloque em `EXPO_PUBLIC_SUPPORT_EMAIL`.
4. **Revisar os lugares:** abra `docs/revisar-lugares.csv` no Excel ou no Google Planilhas. Ele lista os 184 lugares das 10 cidades mais procuradas. Confiram principalmente os dias de fechamento e os lugares com "Tem coordenada = NÃO".
5. **Identificador do app:** se tiverem domínio próprio, troquem `app.desti` no `app.json` por algo como `br.com.seudominio.desti`. Depois do primeiro envio às lojas, isso não muda mais.
6. **Conta de desenvolvedor:**
   - Apple: US$ 99 por ano.
   - Google Play: US$ 25 uma vez.
   - Para aparecer "Destí" como desenvolvedor, em vez do nome de vocês, é preciso ter CNPJ (MEI serve) e um número D-U-N-S, que é gratuito.
7. **Textos da loja:** estão em `docs/loja.md`: nome, subtítulo, descrição, palavras-chave, respostas de privacidade e a lista de capturas de tela.
8. **Teste fechado:** 10 a 20 pessoas por duas semanas, pelo TestFlight (Apple) e pelo teste interno do Google Play.

## 6. Publicar

```bash
npm install -g eas-cli
eas login
eas build -p ios --profile production      # o build é feito nos servidores do Expo, não precisa de Mac
eas submit -p ios
eas build -p android --profile production
eas submit -p android
npm run build:web                           # versão web na pasta dist/
```

## 7. O site (versão web)

O mesmo código gera o site. Ninguém precisa instalar nada: basta abrir o endereço no navegador.

- **Responsivo:** o layout de site vale em qualquer largura do navegador.
  - **Celular (até 639 px):** menu no topo com botão ☰, uma coluna, grades de 2 colunas e títulos menores.
  - **Tablet (640 a 899 px):** menu ☰, uma coluna e grades de 2 a 3 colunas.
  - **Computador (900 px ou mais):** menu completo no topo e páginas em duas colunas.
  - **Largura:** o conteúdo ocupa toda a largura da janela, em qualquer tamanho de tela, com margem lateral que cresce com a tela (16 a 48 px). As grades mostram só linhas completas.
  - Em nenhuma largura a página rola para o lado: isso foi testado em 360, 390, 768, 1024, 1366, 1920 e 2560 px.
- **No computador (layout de site):**
  - quem ainda não entrou vê uma página de apresentação, com chamada principal, recursos, "como funciona", destinos e rodapé;
  - depois de entrar, o menu fica no topo e o conteúdo ocupa a largura da tela;
  - as páginas usam colunas: roteiro com a lateral de ajustes, gastos com a divisão do grupo ao lado, reservas e preparação lado a lado;
  - o cabeçalho mostra a cotação do dólar, do euro e da libra em reais, com a variação do dia. Ela é atualizada a cada 30 minutos, e sem internet aparece a última cotação guardada. Em telas largas, a cotação fica na mesma linha do menu; nas menores, numa faixa fina logo abaixo;
  - há rodapé com privacidade, termos e contato;
  - as janelas de gasto, reserva e edição abrem no centro da tela;
  - a página **Nova viagem** é dividida em 4 blocos numerados (destino e cidades, datas, quem vai e orçamento, estilo e ritmo), que ganham um ✓ quando ficam prontos. Em telas grandes, os blocos ficam em grade de 2 colunas. As datas são escolhidas num calendário de dois meses, e o resumo "Sua viagem" acompanha a rolagem. No celular, os blocos ficam um embaixo do outro e o botão "Criar viagem" fica fixo no rodapé.
- **No tablet (app):** menu lateral.
- **Como app (PWA):** dá para "instalar" o site como app pelo navegador, com nome, ícone e cor do Destí.
- **Páginas legais:** a Política de privacidade e os Termos de uso já fazem parte do site, em `/privacidade.html` e `/termos.html`.

Para gerar e publicar:

```bash
npm run build:web          # gera a pasta dist/ com o site completo
```

**Como o site está publicado hoje (GitHub Pages, automático):**

- O código do app fica na pasta `app/` do repositório `Nathansussaio/Dest-`.
- A cada mudança, o GitHub gera o site oficial com `expo export` (veja `.github/workflows/site.yml` no repositório) e publica em https://nathansussaio.github.io/Dest-/. Leva de 3 a 5 minutos.
- Configurações, em Settings › Secrets and variables › Actions:
  - **Secrets:** `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (login e backup na nuvem) e `EXPO_PUBLIC_SENTRY_DSN` (avisos de erro);
  - **Variables:** `SITE_URL` (quando o domínio estiver pronto: `https://destiapp.com.br`), `EXPO_PUBLIC_BOOKING_AFFILIATE_ID`, `EXPO_PUBLIC_GETYOURGUIDE_PARTNER_ID` e `EXPO_PUBLIC_SUPPORT_EMAIL`.
  - Depois de mudar uma configuração, rode de novo em Actions › Publicar o site › Run workflow.
- **No site:**
  - o mapa é real, do OpenStreetMap com desenho da CARTO, grátis e com os créditos na tela;
  - o site já leva a imagem para compartilhar no WhatsApp e nas redes (`public/og-image.png`), além de `robots.txt` e `sitemap.xml` para o Google.

**Outra opção, no Cloudflare Pages (grátis):**

1. Crie um projeto e ligue ao repositório do GitHub, ou envie a pasta `dist/`.
2. Configure assim:
   - Build command: `npx expo export --platform web`
   - Output directory: `dist`
3. Em **Environment variables**, cadastre as mesmas variáveis do `.env`.
4. Em **Custom domains**, aponte o seu domínio (por exemplo destiapp.com.br) e coloque o endereço em `EXPO_PUBLIC_SITE_URL`.

**No GitHub Pages, com o domínio destiapp.com.br (é como o site está publicado agora):**

O site fica no repositório `Nathansussaio/Dest-` (só os arquivos do site, sem chaves).

1. Compre o domínio **destiapp.com.br** no registro.br.
2. No registro.br, abra o domínio › **DNS** › **Configurar zona DNS** (use o DNS do próprio registro.br) e crie:
   - 4 registros **A** para o próprio domínio (nome em branco): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`;
   - 1 registro **CNAME** com nome `www` apontando para `nathansussaio.github.io`.
3. No GitHub, abra o repositório › **Settings › Pages** › **Custom domain**, digite `destiapp.com.br` e salve. Quando o certificado ficar pronto (de alguns minutos a algumas horas), marque **Enforce HTTPS**.
4. O site passa a abrir em https://destiapp.com.br. Enquanto o domínio não estiver configurado, ele abre em https://nathansussaio.github.io/dest-.

No site, o mapa é real (OpenStreetMap); se não carregar, aparece a versão aproximada. A previsão do tempo, o login e o backup funcionam igual ao app. As notificações e a biometria existem só no app de celular.

## 8. Onde fica cada coisa

| Pasta ou arquivo | O que tem |
|---|---|
| `App.tsx` | Raiz: carrega os dados, sincroniza com a nuvem, abas, folhas, avisos, bloqueio por biometria |
| `src/config.ts` | Lê as chaves do `.env` (Supabase, site, contato, Sentry, afiliados) |
| `src/lib/backend.ts` | Conta e backup no Supabase |
| `src/store/` | Estado do app, cópia no aparelho, sincronização (`store.ts`) e todas as ações (`actions.ts`) |
| `src/screens/` | Telas: entrada, início, viagem, roteiro, mapa (`maps/`), gastos, reservas, perfil, folhas, e o layout de site (`site.tsx`: menu do topo e página de apresentação) |
| `src/lib/` | Regras: roteiro, transporte, clima, previsão, avisos, divisão de gastos, mapa, assistente |
| `src/data/` | Catálogo: 60 destinos com coordenadas, cerca de 800 lugares, clima, pratos, transporte |
| `supabase/` | Banco de dados (`schema.sql`) e o passo a passo |
| `public/` | Arquivos do site: página base, ícones do PWA, Política de privacidade e Termos de uso |
| `docs/site/` | Versão avulsa da página inicial e das páginas legais (se quiserem um site só de apresentação) |
| `docs/loja.md`, `docs/revisar-lugares.csv` | Textos das lojas e a planilha de revisão |
| `tests/` | Testes automáticos (`npm test`) |
| `dev/` | Ferramentas de conferência usadas na criação; não vão para o app |

## 9. Como o código foi conferido

- **Testes das regras:** os 19 passaram.
- **Tipos (TypeScript):** sem erros, usando tipos simplificados dos pacotes. Rode `npm run typecheck` depois do `npm install` para conferir com os tipos oficiais.
- **Telas:** desenhadas num navegador por um adaptador simples, para iPhone, Android e computador.
- **Teste no aparelho:** um teste clicou o caminho completo sem nuvem e passou: criar conta, criar viagem, roteiro, gastos, adicionar pessoa, sair, errar a senha, entrar de novo e reabrir o app.
- **Teste da nuvem:** outro teste rodou com um Supabase falso e passou:
  - cadastro com código certo e errado;
  - backup e entrada em "outro celular";
  - cópia velha que não apaga a nuvem;
  - recuperar senha, trocar senha e excluir conta.
- **O que ainda não foi testado:** o mapa real, a localização dos lugares, as notificações, a biometria e a ligação com o Supabase verdadeiro só funcionam num celular de verdade. Façam o primeiro teste com `npx expo start`.

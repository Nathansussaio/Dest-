# Configurar o Supabase (login e backup das viagens)

O plano grátis do Supabase atende bem o começo do app.

1. **Criar o projeto.** Crie uma conta em supabase.com e clique em **New project**. Escolha a região **South America (São Paulo)**.
2. **Criar o banco.** Em **SQL Editor**, cole o conteúdo de `schema.sql` e clique em **Run**.
3. **Ligar o código por e-mail.** Em **Authentication › Sign In / Providers › Email**:
   - deixe **Confirm email** ligado;
   - em **Email OTP Length**, use **6**.
4. **Ajustar os e-mails.** Em **Authentication › Emails**, troque os modelos para mandarem o código, em vez de um link:
   - **Confirm signup**
     - Assunto: `Seu código do Destí`
     - Texto: `Seu código para confirmar o e-mail é {{ .Token }}. Ele vale por 1 hora.`
   - **Reset password**
     - Assunto: `Código para criar uma senha nova no Destí`
     - Texto: `Use o código {{ .Token }} no app para criar sua senha nova. Se não foi você, ignore este e-mail.`
5. **Configurar o envio de e-mails.** O envio padrão do Supabase é limitado a poucos e-mails por hora e serve só para testar. Antes de lançar, configure o envio próprio em **Authentication › Emails › SMTP Settings**. O Resend e o Brevo têm plano grátis.
6. **Endereço do site.** Em **Authentication › URL Configuration**, coloque em **Site URL** o endereço do site (hoje `https://nathansussaio.github.io/Dest-/`; depois, `https://destiapp.com.br`).
7. **Pegar as chaves.** Clique em **Connect** no topo do projeto, ou abra **Project Settings › API Keys**, e copie:
   - a **Project URL** (algo como `https://abcdefgh.supabase.co`);
   - a chave **publishable** (começa com `sb_publishable_`). Projetos antigos podem mostrar a chave **anon**, que também serve.
8. **Ligar o site.** No GitHub, abra o repositório `Dest-` › **Settings › Secrets and variables › Actions › New repository secret** e crie dois segredos:
   - `EXPO_PUBLIC_SUPABASE_URL` com a Project URL;
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` com a chave publishable (ou anon).

   Depois, em **Actions › Publicar o site › Run workflow**, gere o site de novo.
9. **Ligar o app de celular.** Cole as mesmas duas chaves no arquivo `.env` do app (para testar no computador) e em expo.dev › seu projeto › Environment variables (para os builds das lojas).

A chave publishable (ou `anon`) pode ficar no app, porque quem protege os dados são as regras do `schema.sql`. Já as chaves **secret** e `service_role` **nunca** devem ir para o app nem para o GitHub.

## Viagem em grupo (editar junto, cada um no seu celular)

Para ligar, rode uma vez o arquivo `schema-grupo.sql` em **SQL Editor › New query › Run** (quem já rodou o `schema.sql` antigo só precisa deste). Ele cria:

- `shared_trips`: uma linha por viagem compartilhada, com roteiro, gastos, reservas e checklist;
- `trip_members`: quem participa de cada viagem;
- `trip_invites`: os códigos de convite;
- a função `join_trip`, que coloca a pessoa no grupo a partir do código;
- o aviso em tempo real (Realtime) para a tabela `shared_trips`.

Como funciona no app: em **Pessoas da viagem › Convidar para editar junto**, o app cria um código de 8 letras e um link (`…/convite/CÓDIGO`). Quem recebe abre o link (ou toca em **Viagens › Entrar com código de convite**) e entra com a própria conta. As mudanças aparecem para todos em segundos. Se duas pessoas mexerem ao mesmo tempo sem internet, o app junta as duas versões: gastos, reservas e itens do checklist adicionados por qualquer uma ficam.

Só quem participa da viagem consegue ler ou mudar a linha dela (regras de segurança no próprio banco). Quem criou pode tirar pessoas ou encerrar o grupo; quem participa fica com uma cópia.

## Onde ficam as viagens

Cada pessoa tem uma linha na tabela `vaults`, com todas as viagens dela num único campo.

O app também guarda uma cópia no celular. Assim ele funciona sem internet e envia as mudanças quando a conexão volta. Se a mesma conta for usada em dois celulares ao mesmo tempo, fica a última versão salva.

As fotos das notas fiscais ficam só no celular onde foram tiradas. Elas não vão para a nuvem nesta versão.

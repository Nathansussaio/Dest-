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
6. **Ligar o app ao projeto.** Em **Project Settings › API**, copie a **Project URL** e a chave **anon public**. Cole as duas no arquivo `.env` do app:
   - a URL em `EXPO_PUBLIC_SUPABASE_URL`;
   - a chave em `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

A chave `anon` pode ficar no app, porque quem protege os dados são as regras do `schema.sql`. Já a chave `service_role` **nunca** deve ir para o app.

## Onde ficam as viagens

Cada pessoa tem uma linha na tabela `vaults`, com todas as viagens dela num único campo.

O app também guarda uma cópia no celular. Assim ele funciona sem internet e envia as mudanças quando a conexão volta. Se a mesma conta for usada em dois celulares ao mesmo tempo, fica a última versão salva.

As fotos das notas fiscais ficam só no celular onde foram tiradas. Elas não vão para a nuvem nesta versão.

# Painel de Tarefas — Condomais PE

Controle de tarefas recorrentes e avulsas para a equipe, com prazos, metas de
conclusão no prazo, controle de usuários por setor, dashboard gerencial e
notificações. Construído com **Next.js 14 (App Router) + TypeScript +
Tailwind + Supabase** (Postgres, Auth e Row Level Security).

Este projeto já sai com:

- Schema completo do banco (`supabase/migrations`) com Row Level Security
  **testada**: administradores veem todas as tarefas; usuários comuns veem só
  as tarefas demandadas para eles ou para o setor deles, e só podem criar
  tarefas para si mesmos (tudo aplicado no banco, não só na tela).
- Login por e-mail/senha (Supabase Auth), convite de novos usuários por
  e-mail, recuperação de senha.
- Dashboard com KPIs e gráficos (status e por setor).
- CRUD de tarefas avulsas, setores, usuários e tarefas recorrentes.
- Edge Function (`supabase/functions/daily-tasks`) que gera as tarefas do dia
  a partir das recorrências e dispara webhook de notificação (ex: WhatsApp
  via n8n).

Consulte **`CLAUDE_PROMPT.md`** para o que falta implementar — é o prompt
pronto para colar no Claude Code (VS Code) e continuar o desenvolvimento.

## 1. Pré-requisitos

- Node.js 20+
- Uma conta no [Supabase](https://supabase.com) (plano gratuito serve)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase`)

## 2. Criar o projeto no Supabase

1. Crie um novo projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → API**, copie a `Project URL`, a `anon public key`
   e a `service_role key`.
3. Na raiz do projeto, copie `.env.example` para `.env.local` e preencha com
   esses valores.

## 3. Aplicar as migrations e os dados de exemplo

```bash
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase db push          # aplica supabase/migrations/*.sql
```

Os dados de exemplo (`supabase/seed.sql`) rodam automaticamente com
`supabase db reset` (ambiente local) ou podem ser colados manualmente no SQL
Editor do painel do Supabase caso queira populá-los em produção só para
demonstração — todos são marcados `exemplo = true` e podem ser apagados
depois com `delete from tarefas where exemplo; delete from recorrentes where
exemplo; delete from usuarios where exemplo; delete from setores where
exemplo;`.

## 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## 5. Criar o primeiro administrador

Como o cadastro de usuários é feito *dentro* do painel (só por
administradores), o primeiro admin precisa ser criado manualmente:

1. No SQL Editor do Supabase, rode:
   ```sql
   insert into public.setores (nome) values ('Administração');

   insert into public.usuarios (nome, email, role, setor_id)
   values ('Seu Nome', 'voce@empresa.com', 'admin',
     (select id from public.setores where nome = 'Administração'));
   ```
2. Em **Authentication → Users** no painel do Supabase, clique em
   **Invite user** e convide o mesmo e-mail. Ao aceitar o convite e definir a
   senha, a trigger `link_usuario_on_signup` vincula automaticamente essa
   conta ao cadastro acima.
3. Faça login em `/login` com esse e-mail e a senha definida.

A partir daí, use a tela **Usuários** para cadastrar o resto da equipe e
enviar convites pelo botão "Convidar" (usa a mesma trigger).

## 6. Agendar a geração diária de tarefas recorrentes

```bash
supabase functions deploy daily-tasks
```

Depois, agende a execução diária. Duas opções:

**Opção A — Supabase Scheduled Functions (mais simples):**
No painel do Supabase, em **Edge Functions → daily-tasks → Schedules**,
crie um schedule cron (ex: `0 9 * * *` para rodar 9h UTC).

**Opção B — pg_cron + pg_net (SQL Editor):**
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-tasks',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/daily-tasks',
    headers := jsonb_build_object('Authorization', 'Bearer SUA-SERVICE-ROLE-KEY')
  );
  $$
);
```

## 7. Notificações via WhatsApp (opcional)

Em **Configurações** (menu do admin), cadastre a URL de um webhook (ex: um
workflow n8n) e ative "Enviar notificações via WhatsApp". A cada execução
diária da Edge Function, um POST é enviado para essa URL com as tarefas
atrasadas e as que vencem dentro da antecedência configurada:

```json
{
  "atrasadas": [{ "id": "...", "titulo": "...", "prazo": "...", "...": "..." }],
  "vencemHoje": [ /* mesmo formato */ ],
  "geradoEm": "2026-09-18T09:00:00.000Z"
}
```
O fluxo n8n é responsável por resolver o contato de WhatsApp de cada
responsável e enviar a mensagem.

## 8. Estrutura do projeto

```
src/app/
  login/                    login, recuperação de senha
  auth/confirm/             callback de convite/recuperação (Supabase Auth)
  auth/atualizar-senha/     tela para definir senha após convite
  (app)/                    área autenticada (layout com navegação por papel)
    dashboard/
    tarefas/                lista + nova tarefa
    setores/                admin
    usuarios/                admin (inclui botão de convite)
    recorrentes/             admin
    config/                  admin (webhook)
src/lib/
  supabase/                 clients (browser, server, admin) + middleware
  types.ts                  tipos alinhados ao schema SQL
  data.ts                   getUsuarioLogado()
  utils.ts                  formatação, cores, isAtrasada()
supabase/
  migrations/                schema + RLS
  seed.sql                   dados de exemplo
  functions/daily-tasks/     geração diária + webhook
```

## 9. Segurança

Toda a regra de visibilidade (admin vê tudo; usuário comum vê só o que é
dele ou do setor dele; usuário comum só cria tarefa para si mesmo) é
aplicada via **Row Level Security no Postgres** — não apenas filtrada na
tela. Isso foi testado localmente antes da entrega (ver `CLAUDE_PROMPT.md`
para o histórico dos testes). Mesmo que alguém chame a API do Supabase
diretamente, as políticas do banco continuam valendo.

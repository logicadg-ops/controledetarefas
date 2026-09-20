# Prompt para o Claude Code — Painel de Tarefas (Condomais PE)

> Copie tudo abaixo (a partir de "## Contexto") e cole na primeira mensagem
> do Claude Code, dentro do VS Code, com este projeto aberto como pasta de
> trabalho. Ele foi escrito para ser autossuficiente — não depende desta
> conversa.

---

## Contexto

Este é um sistema de controle de tarefas para a **Condomais PE**, uma
administradora de condomínios. A equipe é dividida em setores (ex: Portaria,
Financeiro, Administração). Cada tarefa — avulsa ou gerada automaticamente
por uma recorrência — tem um prazo e é demandada para uma pessoa específica
ou para um setor inteiro. O objetivo é medir quanto é concluído dentro do
prazo, dar visibilidade gerencial (dashboards) e notificar a equipe.

**Stack:** Next.js 14 (App Router, TypeScript, Server Components + Server
Actions), Tailwind CSS, Supabase (Postgres + Auth + Row Level Security +
Edge Functions em Deno).

**Regra de negócio central (já implementada e testada no banco via RLS —
não reimplemente isso na aplicação, apenas construa a UI sobre ela):**

- Administrador (`usuarios.role = 'admin'`) vê e gerencia **todas** as
  tarefas.
- Usuário comum (`role = 'comum'`) vê **apenas** tarefas cujo
  `responsavel_tipo = 'usuario'` e `responsavel_id` seja ele mesmo, OU
  `responsavel_tipo = 'setor'` e `setor_id` seja o setor dele.
- Usuário comum só pode **criar** tarefas avulsas para si mesmo (dentro do
  próprio setor). Essas tarefas continuam visíveis e gerenciáveis pelos
  administradores.
- Usuário comum não pode excluir tarefas nem gerenciar setores, usuários,
  recorrências ou configurações.

Essas regras estão em `supabase/migrations/20250101000000_init_schema.sql`,
nas policies `tarefas_select`, `tarefas_insert`, `tarefas_update`,
`tarefas_delete` (e equivalentes nas outras tabelas). Foram validadas
localmente contra um Postgres real com um schema `auth` simulado, incluindo
os cenários: admin vê tudo, usuário comum vê só o seu, usuário sem conta
vinculada não vê nada, usuário comum não consegue inserir tarefa para
outra pessoa, usuário comum não consegue excluir. **Leia essa migration
inteira antes de mexer em qualquer coisa relacionada a permissões** — é a
fonte da verdade do modelo de dados.

## O que já está pronto

- Schema completo + RLS testada (`supabase/migrations/`).
- Dados de exemplo (`supabase/seed.sql`), todos marcados `exemplo = true`.
- Clientes Supabase para browser/server/admin (`src/lib/supabase/`).
- Middleware de sessão + redirecionamento para `/login` (`middleware.ts`).
- Login por e-mail/senha, recuperação de senha, fluxo de convite (admin
  cadastra o e-mail em Usuários → clica em "Convidar" → Supabase Auth manda
  o e-mail → trigger `link_usuario_on_signup` vincula a conta automaticamente
  pelo e-mail).
- Layout autenticado com navegação condicionada ao papel do usuário
  (`src/app/(app)/layout.tsx`).
- Dashboard com KPIs (total, pendentes, atrasadas, % concluídas no prazo) e
  dois gráficos simples em CSS (donut por status, barras por setor) —
  `src/app/(app)/dashboard/page.tsx`.
- CRUD funcional de: tarefas avulsas (`tarefas/`), setores (`setores/`),
  usuários (`usuarios/`), recorrências (`recorrentes/`), configurações
  (`config/`).
- Edge Function `supabase/functions/daily-tasks/index.ts`: gera as
  instâncias do dia a partir das recorrências ativas e dispara um webhook
  com tarefas atrasadas/vencendo, se configurado.
- `npm run build` passa limpo (sem erros de tipo ou lint).

Este é um esqueleto funcional, não o produto final. As seções abaixo são o
que falta — organizadas por prioridade.

## Prioridade 1 — Robustez do que já existe

1. **Estados de carregamento e erro.** As páginas atuais não tratam bem
   falhas de rede/consulta (ex: se `supabase.from(...)` retornar `error`,
   várias páginas ignoram isso silenciosamente). Adicione tratamento
   consistente — pelo menos um `error.tsx` por rota principal e mensagens
   claras quando uma query falha.
2. **Validação de formulários.** As Server Actions atuais fazem validação
   mínima (campos obrigatórios do HTML). Adicione validação server-side de
   verdade (ex: `zod`) para todos os `formData` recebidos, com mensagens de
   erro específicas por campo.
3. **Paginação/limite na lista de tarefas.** `tarefas/page.tsx` hoje busca
   todas as linhas sem paginação. Com uso real isso vai crescer — adicione
   paginação (cursor ou offset) e um filtro por período.
4. **Editar tarefa avulsa.** Hoje só existe criar e mudar status. Adicione
   edição (título, descrição, prazo, prioridade, responsável — respeitando
   as mesmas regras de RLS) e exclusão (só admin, já coberto pela policy
   `tarefas_delete`).
5. **Editar recorrência e setor.** Idem — hoje só dá para criar e
   ativar/desativar.

## Prioridade 2 — Funcionalidades do escopo original ainda não construídas

Estas foram validadas com o cliente em um protótipo anterior (mesma lógica
de negócio, front-end diferente) e devem ser portadas:

1. **Exportação CSV.** Botão em `/tarefas` para exportar a lista filtrada
   atual como CSV (colunas: título, setor, responsável, prioridade, status,
   prazo, data de conclusão, se foi no prazo). Gerar no client a partir dos
   dados já carregados, ou via Route Handler que reconsulta com os mesmos
   filtros.
2. **Notificação em painel (sino).** Um indicador no header (`(app)/layout.tsx`)
   mostrando quantas tarefas do usuário logado estão atrasadas ou vencem nas
   próximas 24h, com um dropdown listando-as. Pode ser Server Component com
   `revalidate` curto, ou Client Component com Supabase Realtime
   (`supabase.channel(...).on('postgres_changes', ...)`) assinando mudanças
   em `tarefas` filtradas pelas mesmas regras de visibilidade do usuário —
   cuidado: RLS também vale para Realtime, então o filtro client-side pode
   ser simplificado (o servidor já não entrega o que ele não pode ver).
3. **Gráfico de linha do tempo (concluídas no prazo vs. fora do prazo, por
   semana/mês).** Complementa os dois gráficos já existentes no dashboard.
   Pode ser feito com barras empilhadas em CSS (mesmo estilo dos gráficos
   atuais, sem dependências externas) ou com uma lib leve como `recharts` se
   preferir — se adicionar uma lib nova, mantenha o bundle enxuto.
4. **Filtro do dashboard por período e por setor** (hoje mostra sempre "tudo
   que o usuário pode ver", sem filtro de data).
5. **Página de relatório imprimível** (visão gerencial mensal, para
   apresentar em reunião de síndicos — título, período, KPIs, tabela
   resumo). Pode ser uma rota `/relatorios` com um layout otimizado para
   impressão (`@media print`) ou exportação em PDF.

## Prioridade 3 — Operação e polimento

1. **Confirmar o agendamento da Edge Function** `daily-tasks` em produção
   (ver README.md seção 6) e testar de ponta a ponta com um workflow n8n
   real, incluindo tratamento de erro se o webhook estiver fora do ar.
2. **Fuso horário.** A Edge Function e os cálculos de prazo usam UTC
   diretamente. Se a operação for toda em um fuso fixo (ex: América/Recife,
   UTC-3), considere converter explicitamente em vez de assumir UTC — hoje
   `prazo_hora` é interpretado como UTC, o que pode confundir o usuário que
   digitou "18:00" pensando em horário local.
3. **Responsividade mobile.** As telas foram feitas mobile-first no
   essencial (menu vira lista horizontal, tabelas fazem scroll horizontal),
   mas não foram testadas em dispositivos reais — revise especialmente a
   tabela de `/tarefas` e os formulários longos de `/recorrentes`.
4. **Dark mode.** Removido propositalmente do CSS inicial (ver comentário em
   `src/app/globals.css`) para não conflitar com as classes Tailwind
   explícitas usadas nas páginas. Se for retomar, defina tokens de cor no
   `tailwind.config.ts` em vez de depender de `prefers-color-scheme` direto
   no CSS.
5. **Testes automatizados.** Não há nenhum ainda. Pelo menos: testes de
   integração das Server Actions críticas (`criarTarefa`, `atualizarStatus`)
   contra um Supabase local (`supabase start`), e um teste que repita os
   cenários de RLS já validados manualmente (admin vê tudo / comum vê só o
   seu / comum não insere para outro / comum não exclui) para virarem
   regressão automatizada.
6. **`supabase gen types typescript`** — depois que o projeto estiver
   linkado a uma instância Supabase real, gere os tipos oficiais e substitua
   `src/lib/types.ts` por eles (ou faça esse arquivo derivar dos tipos
   gerados), para não haver deriva entre schema e tipos TS.

## Convenções a seguir

- Server Components por padrão; `'use client'` só quando precisar de
  interatividade que Server Actions não resolvem.
- Mutações via Server Actions em `actions.ts` ao lado de cada rota (padrão
  já usado em `tarefas/actions.ts`, `usuarios/actions.ts`, etc.) — não crie
  API Routes para CRUD que pode ser Server Action.
- Nunca filtre por papel/setor no client "por segurança" — a RLS já faz
  isso no banco. Filtros no client são só para UX (abas, busca), nunca a
  única barreira.
- `createAdminClient()` (service role key) só em Server Actions
  claramente administrativas, nunca em código que roda no browser.
- Textos da interface em português (pt-BR), formatação de data/hora com
  `Intl`/`toLocaleString('pt-BR', ...)` como já feito em `src/lib/utils.ts`.
- Não adicione dependências pesadas sem necessidade — o projeto propositalmente
  não usa nenhuma biblioteca de UI ou de gráficos ainda.

## Por onde começar

1. Rode `npm install && npm run build` para confirmar que está tudo
   funcionando antes de qualquer mudança.
2. Leia `supabase/migrations/20250101000000_init_schema.sql` inteira.
3. Suba um Supabase local (`supabase start`) ou conecte a um projeto real
   (ver `README.md`), aplique as migrations e o seed, crie o primeiro admin.
4. Comece pela Prioridade 1 (robustez) antes de partir para funcionalidades
   novas — o esqueleto atual tem propositalmente pouco tratamento de erro
   para não gastar tempo em UX antes da regra de negócio estar validada.

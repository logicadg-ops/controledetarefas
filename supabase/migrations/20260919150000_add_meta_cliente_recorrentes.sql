-- ============================================================================
-- Migration 0005: campos "meta_hora" e "cliente_id" nas recorrências
-- Permite que as tarefas geradas automaticamente pela Edge Function
-- "daily-tasks" já saiam com meta e cliente vinculado, iguais às avulsas.
-- ============================================================================

alter table public.recorrentes
  add column if not exists meta_hora time,
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null;

create index if not exists recorrentes_cliente_id_idx on public.recorrentes (cliente_id);

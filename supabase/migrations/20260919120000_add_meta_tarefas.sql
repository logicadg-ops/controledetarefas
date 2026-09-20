-- ============================================================================
-- Migration 0002: campo "meta" nas tarefas
-- Meta é um prazo interno, anterior ao prazo oficial, para incentivar a
-- conclusão antecipada. "no_meta" registra se a conclusão ocorreu até a meta
-- (calculado no momento da conclusão, igual a "no_prazo").
-- ============================================================================

alter table public.tarefas
  add column if not exists meta timestamptz,
  add column if not exists no_meta boolean;

alter table public.tarefas
  drop constraint if exists tarefas_meta_check;

alter table public.tarefas
  add constraint tarefas_meta_check check (meta is null or meta <= prazo);

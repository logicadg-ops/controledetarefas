-- ============================================================================
-- Migration 0003: campo "data_inicio" nas tarefas
-- Registrado quando a tarefa passa para "andamento" (botão Iniciar).
-- Usado para medir o tempo real de execução do fluxo (início -> conclusão),
-- independente do prazo/meta (que continuam sendo horários-limite fixos).
-- ============================================================================

alter table public.tarefas
  add column if not exists data_inicio timestamptz;

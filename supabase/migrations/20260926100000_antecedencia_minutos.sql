-- ============================================================================
-- Migration 0015: antecedência com minutos, não só horas
-- Permite avisos mais finos (ex.: "vence em 30 minutos"), em vez de só
-- múltiplos de 1 hora. "antecedencia_horas" continua existindo; o total
-- usado no aviso é horas*60 + minutos.
-- ============================================================================

alter table public.config_geral
  add column if not exists antecedencia_minutos int not null default 0;

alter table public.config_geral
  drop constraint if exists config_geral_antecedencia_minutos_check;
alter table public.config_geral
  add constraint config_geral_antecedencia_minutos_check check (antecedencia_minutos between 0 and 59);

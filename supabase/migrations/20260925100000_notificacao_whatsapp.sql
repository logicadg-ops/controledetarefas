-- ============================================================================
-- Migration 0014: notificação via WhatsApp (Z-API ou serviço equivalente)
-- Complementa o webhook existente: além de continuar postando o payload no
-- webhook (se configurado), a rotina diária passa a poder mandar mensagem
-- direto no WhatsApp de cada responsável pela tarefa (usuarios.whatsapp).
--
-- "zapi_instance_url": a URL da instância copiada do painel do provedor,
--   ex.: https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN
-- "zapi_client_token": o "Client-Token" de segurança da conta (opcional,
--   depende do provedor).
--
-- Sem RLS nova: config_geral já é restrita a admin da própria empresa
-- (policies config_select/config_update da migration 0008).
-- ============================================================================

alter table public.config_geral
  add column if not exists zapi_instance_url text,
  add column if not exists zapi_client_token text;

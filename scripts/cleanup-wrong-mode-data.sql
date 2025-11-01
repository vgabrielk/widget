-- Script SQL para limpar customers e subscriptions criados no modo errado
-- Execute no Supabase SQL Editor

-- IMPORTANTE: Isso vai deletar TODOS os customers e subscriptions do Stripe
-- Use apenas se você mudou de live para test mode (ou vice-versa)

-- Deletar subscriptions primeiro (devido a foreign keys)
DELETE FROM public.stripe_subscriptions;

-- Deletar customers
DELETE FROM public.stripe_customers;

-- Verificar resultado
SELECT 
  (SELECT COUNT(*) FROM public.stripe_customers) as customers_remaining,
  (SELECT COUNT(*) FROM public.stripe_subscriptions) as subscriptions_remaining;


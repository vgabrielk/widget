-- =============================================
-- STRIPE INTEGRATION SETUP
-- =============================================
-- This migration sets up Stripe integration using Supabase Wrappers
-- to access Stripe data directly from Postgres.
--
-- IMPORTANT: Before running this migration:
-- 1. Replace '<YOUR_STRIPE_SECRET_KEY>' with your actual Stripe key
-- 2. Use test keys (sk_test_*) for development
-- 3. Never commit actual keys to version control
-- =============================================

-- Enable the wrappers extension
CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;

-- Enable the Stripe wrapper (check if exists first)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_foreign_data_wrapper WHERE fdwname = 'stripe_wrapper'
    ) THEN
        CREATE FOREIGN DATA WRAPPER stripe_wrapper
          HANDLER stripe_fdw_handler
          VALIDATOR stripe_fdw_validator;
    END IF;
END $$;

-- Store Stripe API key in Vault (SECURE METHOD)
-- NOTE: You need to run this manually with your actual key:
-- 
-- SELECT vault.create_secret(
--   'sk_test_YOUR_ACTUAL_STRIPE_KEY',  -- Replace with your key
--   'stripe_secret_key',                -- Secret name
--   'Stripe API key for chat widget'   -- Description
-- );
--
-- This will return a key_id UUID that you'll use below

-- Create the Stripe foreign server
-- AFTER running the vault.create_secret() above, replace <KEY_ID> with the returned UUID
--
-- CREATE SERVER stripe_server
--   FOREIGN DATA WRAPPER stripe_wrapper
--   OPTIONS (
--     api_key_id '<KEY_ID>',  -- Replace with UUID from vault.create_secret()
--     api_url 'https://api.stripe.com/v1/',
--     api_version '2024-06-20'
--   );

-- Create schema for Stripe foreign tables
CREATE SCHEMA IF NOT EXISTS stripe;

-- Once the server is created, import the foreign tables you need:
--
-- Basic tables for payment processing:
-- IMPORT FOREIGN SCHEMA stripe
--   LIMIT TO (
--     "customers",
--     "subscriptions", 
--     "products",
--     "prices",
--     "payment_intents",
--     "checkout_sessions",
--     "invoices"
--   )
--   FROM SERVER stripe_server 
--   INTO stripe;

-- =============================================
-- STRIPE CUSTOMER MANAGEMENT TABLES (Optional)
-- =============================================
-- Link Supabase users/widgets to Stripe customers

-- Table to track Stripe customers
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_customers_widget_id 
  ON public.stripe_customers(widget_id);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id 
  ON public.stripe_customers(stripe_customer_id);

-- Table to track subscriptions
CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id UUID NOT NULL REFERENCES public.widgets(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL, -- active, canceled, past_due, etc.
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_widget_id 
  ON public.stripe_subscriptions(widget_id);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_stripe_id 
  ON public.stripe_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer_id 
  ON public.stripe_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status 
  ON public.stripe_subscriptions(status);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admins) can access Stripe data
CREATE POLICY "Only authenticated users can read stripe customers"
  ON public.stripe_customers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only authenticated users can manage stripe customers"
  ON public.stripe_customers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Only authenticated users can read stripe subscriptions"
  ON public.stripe_subscriptions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only authenticated users can manage stripe subscriptions"
  ON public.stripe_subscriptions
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to sync Stripe customer data
CREATE OR REPLACE FUNCTION sync_stripe_customer(
  p_widget_id UUID,
  p_stripe_customer_id TEXT,
  p_email TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  -- Upsert customer record
  INSERT INTO public.stripe_customers (
    widget_id,
    stripe_customer_id,
    email,
    name,
    metadata,
    updated_at
  )
  VALUES (
    p_widget_id,
    p_stripe_customer_id,
    p_email,
    p_name,
    p_metadata,
    NOW()
  )
  ON CONFLICT (stripe_customer_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_customer_id;
  
  RETURN v_customer_id;
END;
$$;

-- Function to sync Stripe subscription data
CREATE OR REPLACE FUNCTION sync_stripe_subscription(
  p_widget_id UUID,
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_status TEXT,
  p_current_period_start TIMESTAMPTZ DEFAULT NULL,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_cancel_at TIMESTAMPTZ DEFAULT NULL,
  p_canceled_at TIMESTAMPTZ DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Upsert subscription record
  INSERT INTO public.stripe_subscriptions (
    widget_id,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    current_period_start,
    current_period_end,
    cancel_at,
    canceled_at,
    metadata,
    updated_at
  )
  VALUES (
    p_widget_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_status,
    p_current_period_start,
    p_current_period_end,
    p_cancel_at,
    p_canceled_at,
    p_metadata,
    NOW()
  )
  ON CONFLICT (stripe_subscription_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    cancel_at = EXCLUDED.cancel_at,
    canceled_at = EXCLUDED.canceled_at,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE public.stripe_customers IS 'Tracks Stripe customers associated with widgets';
COMMENT ON TABLE public.stripe_subscriptions IS 'Tracks Stripe subscriptions for widgets';
COMMENT ON FUNCTION sync_stripe_customer IS 'Syncs Stripe customer data from webhooks or API calls';
COMMENT ON FUNCTION sync_stripe_subscription IS 'Syncs Stripe subscription data from webhooks or API calls';


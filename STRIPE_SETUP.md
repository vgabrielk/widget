# Stripe Integration Setup Guide

## ⚠️ Security First

**CRITICAL**: The API keys you shared in chat appear to be live production keys. You should:

1. **Immediately rotate your Stripe keys** in the [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Never share live keys or commit them to version control
3. Use test keys (`sk_test_*`) for development
4. Use environment variables for all sensitive data

---

## Step-by-Step Setup

### 1. Enable Wrappers Extension in Supabase

Run the migration file that was created:

```bash
# If using local Supabase
supabase migration up

# Or apply manually in Supabase SQL Editor
```

### 2. Store Your Stripe API Key Securely

In your Supabase SQL Editor, run:

```sql
-- Use TEST key for development
SELECT vault.create_secret(
  'sk_test_YOUR_ACTUAL_KEY_HERE',  -- Replace with your test key
  'stripe_secret_key',
  'Stripe API key for chat widget'
);
```

This will return a UUID `key_id`. **Save this UUID** - you'll need it in the next step.

Example output:
```
key_id: 550e8400-e29b-41d4-a716-446655440000
```

### 3. Create the Stripe Server

Using the `key_id` from step 2:

```sql
CREATE SERVER stripe_server
  FOREIGN DATA WRAPPER stripe_wrapper
  OPTIONS (
    api_key_id '550e8400-e29b-41d4-a716-446655440000',  -- Your key_id from step 2
    api_url 'https://api.stripe.com/v1/',
    api_version '2024-06-20'
  );
```

### 4. Import Stripe Foreign Tables

Choose which Stripe objects you need access to:

```sql
-- Import essential tables for subscription management
IMPORT FOREIGN SCHEMA stripe
  LIMIT TO (
    "customers",
    "subscriptions", 
    "products",
    "prices",
    "payment_intents",
    "checkout_sessions",
    "invoices"
  )
  FROM SERVER stripe_server 
  INTO stripe;
```

Or import all available tables:

```sql
IMPORT FOREIGN SCHEMA stripe 
  FROM SERVER stripe_server 
  INTO stripe;
```

### 5. Test the Connection

```sql
-- Query Stripe customers (limit to avoid large API calls)
SELECT id, email, name, created 
FROM stripe.customers 
LIMIT 5;

-- Check products
SELECT id, name, active, description
FROM stripe.products
WHERE active = true
LIMIT 10;

-- View subscriptions
SELECT id, customer, status, current_period_start, current_period_end
FROM stripe.subscriptions
LIMIT 10;
```

---

## Environment Variables

Update your `.env.local` file with **test keys only**:

```env
# Stripe Configuration (USE TEST KEYS FOR DEVELOPMENT)
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# For production, use different env file or CI/CD secrets
# STRIPE_SECRET_KEY=sk_live_YOUR_KEY
# STRIPE_PUBLIC_KEY=pk_live_YOUR_KEY
```

---

## Setting Up Webhooks

### 1. Create Webhook Endpoint in Stripe Dashboard

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your URL: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen to:
   - `customer.created`
   - `customer.updated`
   - `customer.deleted`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`

5. Copy the **webhook signing secret** (starts with `whsec_`)

### 2. Add Webhook Secret to Environment

```env
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
```

---

## Usage Examples

### Query Stripe Data

```typescript
// In your API routes or server components
import { createClient } from '@/lib/supabase/server'

// Get customers with subscriptions
const supabase = createClient()
const { data: customers } = await supabase
  .from('stripe.customers')
  .select('*')
  .limit(10)
```

### Sync Customer Data

```sql
-- Sync a customer from Stripe webhook
SELECT sync_stripe_customer(
  'widget_uuid_here',
  'cus_stripe_customer_id',
  'customer@example.com',
  'Customer Name',
  '{"plan": "pro"}'::jsonb
);
```

### Sync Subscription Data

```sql
-- Sync subscription from webhook
SELECT sync_stripe_subscription(
  'widget_uuid_here',
  'sub_stripe_subscription_id',
  'cus_stripe_customer_id',
  'active',
  '2024-01-01 00:00:00+00',
  '2024-02-01 00:00:00+00',
  NULL,
  NULL,
  '{"plan": "pro"}'::jsonb
);
```

---

## Common Queries

### Check Widget's Subscription Status

```sql
SELECT 
  w.id as widget_id,
  w.name as widget_name,
  sc.email as customer_email,
  ss.status as subscription_status,
  ss.current_period_end,
  CASE 
    WHEN ss.status = 'active' AND ss.current_period_end > NOW() 
    THEN true 
    ELSE false 
  END as is_subscribed
FROM widgets w
LEFT JOIN stripe_customers sc ON w.id = sc.widget_id
LEFT JOIN stripe_subscriptions ss ON sc.stripe_customer_id = ss.stripe_customer_id
WHERE w.id = 'your_widget_uuid';
```

### List Active Subscriptions

```sql
SELECT 
  ss.stripe_subscription_id,
  sc.email,
  w.name as widget_name,
  ss.current_period_end
FROM stripe_subscriptions ss
JOIN stripe_customers sc ON ss.stripe_customer_id = sc.stripe_customer_id
JOIN widgets w ON ss.widget_id = w.id
WHERE ss.status = 'active'
ORDER BY ss.current_period_end DESC;
```

---

## Production Checklist

Before deploying to production:

- [ ] Rotate all Stripe API keys that were shared
- [ ] Use live keys (`sk_live_*`, `pk_live_*`) in production environment
- [ ] Store keys in environment variables or secrets manager
- [ ] Test webhook endpoint with Stripe CLI
- [ ] Set up proper error logging for webhook events
- [ ] Configure Stripe webhook signature verification
- [ ] Review and test RLS policies
- [ ] Set up monitoring for failed payments
- [ ] Document subscription lifecycle

---

## Troubleshooting

### Connection Issues

```sql
-- Check if wrappers extension is enabled
SELECT * FROM pg_extension WHERE extname = 'wrappers';

-- Check if foreign server exists
SELECT * FROM pg_foreign_server WHERE srvname = 'stripe_server';

-- Check if foreign tables are created
SELECT * FROM information_schema.foreign_tables 
WHERE foreign_table_schema = 'stripe';
```

### API Rate Limits

Stripe has rate limits. Always use `LIMIT` in queries:

```sql
-- Good: Limited query
SELECT * FROM stripe.customers LIMIT 10;

-- Bad: Can hit rate limits
SELECT * FROM stripe.customers;
```

---

## Additional Resources

- [Supabase Wrappers Documentation](https://supabase.com/docs/guides/database/wrappers)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Supabase Vault Documentation](https://supabase.com/docs/guides/database/vault)




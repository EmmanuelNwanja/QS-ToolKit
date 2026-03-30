-- Migration: 024_unique_billing_transaction_references.sql
-- Purpose: Prevent duplicate Paystack billing records per reference
-- Created: 2026-03-30

BEGIN;

WITH ranked_transactions AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY paystack_reference ORDER BY created_at ASC, id ASC) AS duplicate_rank
  FROM billing_transactions
  WHERE paystack_reference IS NOT NULL
)
DELETE FROM billing_transactions
WHERE id IN (
  SELECT id
  FROM ranked_transactions
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_transactions_paystack_reference
  ON billing_transactions(paystack_reference)
  WHERE paystack_reference IS NOT NULL;

COMMIT;

-- Migration: Stateless Invoices
-- Removes the physical credit_card_invoices table, triggers, and the invoice_id column from transactions.

-- 1. Drop Triggers that reference credit_card_invoices
DROP TRIGGER IF EXISTS trg_update_invoice_amount_on_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trg_update_invoice_amount ON public.transactions;
DROP TRIGGER IF EXISTS trg_create_invoice_for_credit_card_transaction ON public.transactions;

-- 2. Drop Functions used by those triggers
DROP FUNCTION IF EXISTS public.fn_update_invoice_amount_on_transaction();
DROP FUNCTION IF EXISTS public.fn_update_invoice_amount();
DROP FUNCTION IF EXISTS public.fn_create_invoice_for_credit_card_transaction();

-- 3. Drop the column invoice_id from transactions
ALTER TABLE public.transactions DROP COLUMN IF EXISTS invoice_id;

-- 4. Drop the credit_card_invoices table
DROP TABLE IF EXISTS public.credit_card_invoices CASCADE;

-- 5. Drop any remaining enums if not used elsewhere (optional, but good practice if only used here)
DROP TYPE IF EXISTS invoice_status;

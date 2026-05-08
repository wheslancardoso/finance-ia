-- SQL de Migração Inicial para Liquid Glass Finance

-- 1. Grupos Familiares
CREATE TABLE IF NOT EXISTS family_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Perfis de Usuários (Extensão do Auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Membros do Grupo
CREATE TABLE IF NOT EXISTS family_members (
    family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin',
    PRIMARY KEY (family_group_id, user_id)
);

-- 4. Contas
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'CHECKING', 'SAVINGS', 'CREDIT_CARD', 'CASH'
    currency_code VARCHAR(3) DEFAULT 'BRL',
    balance_cents BIGINT DEFAULT 0,
    color_hex VARCHAR(7) DEFAULT '#7C3AED',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Categorias
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'INCOME', 'EXPENSE', 'TRANSFER'
    icon_name VARCHAR(50),
    color_hex VARCHAR(7),
    is_system_default BOOLEAN DEFAULT FALSE
);

-- 6. Transações (Refatorada)
-- Nota: A tabela transactions já pode existir da PoC, vamos garantir que ela tenha os campos novos.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
        CREATE TABLE transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
            category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
            amount_cents BIGINT NOT NULL,
            transaction_type VARCHAR(20) NOT NULL,
            date TIMESTAMP WITH TIME ZONE NOT NULL,
            description VARCHAR(255) NOT NULL,
            merchant_name VARCHAR(150),
            installment_current INT DEFAULT 1,
            installment_total INT DEFAULT 1,
            linked_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
            is_pending BOOLEAN DEFAULT FALSE,
            source VARCHAR(50) DEFAULT 'MANUAL',
            source_metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- 7. Orçamentos
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    limit_cents BIGINT NOT NULL,
    period VARCHAR(20) DEFAULT 'MONTHLY',
    start_date DATE NOT NULL,
    end_date DATE,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

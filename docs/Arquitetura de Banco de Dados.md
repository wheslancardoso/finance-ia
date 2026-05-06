# **Documentação de Arquitetura de Banco de Dados**

**Motor:** PostgreSQL

**Fase:** MVP (Produto Mínimo Viável)

## **1\. Princípios Arquiteturais e Decisões de Design**

* **Chaves Primárias em UUID (Local-First):** Todas as tabelas utilizam UUID em vez de inteiros autoincrementais (SERIAL). Isso é obrigatório para o requisito de **Modo Offline**, permitindo que o aplicativo móvel gere o ID localmente e sincronize com a nuvem posteriormente sem risco de colisão.  
* **Valores Monetários em Cêntimos (Integer):** O tipo DECIMAL ou FLOAT está expressamente proibido para armazenar dinheiro. Todos os valores monetários (balance, amount) são armazenados como BIGINT representando a menor fração da moeda (ex: R$ 10,50 é armazenado como 1050).  
* **Suporte a Multimoedas:** As contas possuem um campo de código ISO de moeda (ex: BRL, USD, EUR).  
* **Isolamento de Transferências (Dupla Entrada):** Transferências internas não utilizam categorias de "Despesa" ou "Receita", mas sim uma chave de autorreferência (linked\_transaction\_id) que une as duas pontas da movimentação.

## **2\. Diagrama de Entidades (Esquema DDL)**

Abaixo estão as instruções SQL para a criação das tabelas fundamentais que sustentam as regras de negócio do MVP.

### **2.1. Usuários e Perfis Compartilhados (Famílias)**

Para resolver a "dor" de casais não conseguirem unir contas, o sistema não liga contas diretamente a um usuário individual, mas sim a um "Grupo" ou "Workspace" familiar.

\-- Tabela de Usuários  
CREATE TABLE users (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    email VARCHAR(255) UNIQUE NOT NULL,  
    password\_hash VARCHAR(255) NOT NULL,  
    full\_name VARCHAR(100) NOT NULL,  
    biometric\_enabled BOOLEAN DEFAULT FALSE,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Tabela de Grupos Familiares (Permite contas conjuntas)  
CREATE TABLE family\_groups (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    name VARCHAR(100) NOT NULL, \-- Ex: "Finanças do Casal" ou "Pessoal"  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Tabela de Junção (Muitos-para-Muitos)  
CREATE TABLE user\_family\_members (  
    user\_id UUID REFERENCES users(id) ON DELETE CASCADE,  
    family\_group\_id UUID REFERENCES family\_groups(id) ON DELETE CASCADE,  
    role VARCHAR(20) DEFAULT 'admin', \-- 'admin', 'viewer'  
    PRIMARY KEY (user\_id, family\_group\_id)  
);

### **2.2. Contas e Categorias**

Contas e categorias pertencem ao family\_group, o que significa que o casal vê os mesmos "potes" de dinheiro e regras de categorização.

\-- Tabela de Contas (Bancos, Cartões, Carteira)  
CREATE TABLE accounts (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    family\_group\_id UUID REFERENCES family\_groups(id) ON DELETE CASCADE,  
    name VARCHAR(100) NOT NULL,  
    type VARCHAR(50) NOT NULL, \-- 'CHECKING', 'SAVINGS', 'CREDIT\_CARD', 'CASH'  
    currency\_code VARCHAR(3) DEFAULT 'BRL', \-- Suporte a múltiplas moedas  
    balance\_cents BIGINT DEFAULT 0, \-- Saldo atual (ou limite, no caso de cartão)  
    color\_hex VARCHAR(7) DEFAULT '\#000000',  
    is\_active BOOLEAN DEFAULT TRUE,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Tabela de Categorias e Taxonomia  
CREATE TABLE categories (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    family\_group\_id UUID REFERENCES family\_groups(id) ON DELETE CASCADE,  
    parent\_category\_id UUID REFERENCES categories(id) ON DELETE SET NULL, \-- Subcategorias  
    name VARCHAR(100) NOT NULL,  
    type VARCHAR(20) NOT NULL, \-- 'INCOME', 'EXPENSE', 'TRANSFER'  
    icon\_name VARCHAR(50),  
    color\_hex VARCHAR(7),  
    is\_system\_default BOOLEAN DEFAULT FALSE \-- Para categorias padrão do app  
);

### **2.3. O Motor Transacional (Livro-Razão)**

A tabela mais importante do sistema. Otimizada para receber injeções via n8n e aplicativo offline.

\-- Tabela de Transações  
CREATE TABLE transactions (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    account\_id UUID REFERENCES accounts(id) ON DELETE CASCADE,  
    category\_id UUID REFERENCES categories(id) ON DELETE RESTRICT,  
      
    amount\_cents BIGINT NOT NULL, \-- Sempre positivo. O tipo (INCOME/EXPENSE) define a operação.  
    transaction\_type VARCHAR(20) NOT NULL, \-- 'INCOME', 'EXPENSE', 'TRANSFER'  
      
    date TIMESTAMP WITH TIME ZONE NOT NULL,  
    description VARCHAR(255) NOT NULL,  
    merchant\_name VARCHAR(150), \-- Nome limpo extraído pela IA (GPT-4o) do n8n  
      
    \-- Gestão de Cartão de Crédito e Parcelas  
    installment\_current INT DEFAULT 1,  
    installment\_total INT DEFAULT 1,  
    credit\_card\_invoice\_date DATE, \-- Para agrupar na fatura certa do cartão  
      
    \-- Dupla Entrada (Transferências)  
    linked\_transaction\_id UUID REFERENCES transactions(id) ON DELETE SET NULL,   
      
    \-- Metadados de Automação  
    is\_pending BOOLEAN DEFAULT FALSE,  
    source VARCHAR(50) DEFAULT 'MANUAL', \-- 'MANUAL', 'WHATSAPP\_AUDIO', 'WHATSAPP\_RECEIPT', 'N8N'  
    source\_metadata JSONB, \-- Para guardar o JSON original da IA para debug se necessário  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

### **2.4. Orçamentos (Engenharia Comportamental)**

Mecanismo que sustenta a "Regra dos 3 segundos" e os limites de dopamina positiva.

\-- Tabela de Orçamentos (Budgets)  
CREATE TABLE budgets (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    family\_group\_id UUID REFERENCES family\_groups(id) ON DELETE CASCADE,  
    category\_id UUID REFERENCES categories(id) ON DELETE CASCADE,  
      
    limit\_cents BIGINT NOT NULL,  
    period VARCHAR(20) DEFAULT 'MONTHLY', \-- 'WEEKLY', 'MONTHLY'  
    start\_date DATE NOT NULL,  
    end\_date DATE, \-- NULL significa que o orçamento se repete indefinidamente  
      
    is\_auto\_generated BOOLEAN DEFAULT FALSE, \-- Viés de Padrão (Default Bias)  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

## **3\. Fluxo de Transferência (Exemplo Prático)**

Quando o usuário transfere R$ 100,00 do "Nubank" para o "Itaú":

1. O sistema cria uma transação do tipo TRANSFER (Saída) no Nubank (amount\_cents \= 10000).  
2. O sistema cria uma transação do tipo TRANSFER (Entrada) no Itaú (amount\_cents \= 10000).  
3. O linked\_transaction\_id de uma aponta para a outra.  
   *Resultado:* Ao gerar o gráfico de despesas do mês, o sistema filtra e ignora transações do tipo TRANSFER, garantindo que o dinheiro do usuário não desapareça matematicamente.
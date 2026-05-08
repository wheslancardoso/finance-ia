# 🛡️ Vesper Debug & Audit Toolkit

Guia de ferramentas para auditoria e resolução de problemas financeiros no Vesper.

## 🚀 Scripts Principais

| Script | Função | Quando usar? |
| :--- | :--- | :--- |
| `full_audit.js` | Simula o cálculo completo do Dashboard (Sobra Livre). | Quando o saldo do Dashboard não bater com sua conta. |
| `check_survival_math.js` | Audita o Teto de Sobrevivência (Modo Crise). | Para validar o teto diário/mensal do HUD. |
| `detailed_tx_audit.js` | Lista transações suspeitas ou não pagas por categoria. | Para encontrar "fantasmas" ou gastos esquecidos. |
| `vesper_diagnose.js` | **[NOVO]** Diagnóstico completo de saúde do banco de dados. | Auditoria geral de integridade e lógica. |

## 🛠️ Como executar
Certifique-se de estar na raiz do projeto e use `node`:

```bash
node scratch/full_audit.js
```

## 📝 Utilitários de Banco de Dados
- `list_accounts.js`: Resumo rápido de todas as contas e faturas.
- `check_balances.js`: Verifica se o saldo das contas bate com a soma das transações.
- `migration_*.sql`: Scripts SQL para ajustes manuais via Dashboard do Supabase.

---
> [!TIP]
> Use o `full_audit.js` sempre que tiver dúvida sobre o valor de **Gastos Previstos**. Ele detalha exatamente o que é Cartão, o que é Agendado e o que é Recorrente.

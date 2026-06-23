export interface ParsedBankTransaction {
  id: string; // Generated ID for internal matching
  date: Date;
  description: string;
  amount_cents: number;
  type: "INCOME" | "EXPENSE";
}

export interface VesperTransaction {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  transaction_type: "INCOME" | "EXPENSE";
}

export interface MatchResult {
  exactMatches: Array<{ vesper: VesperTransaction, bank: ParsedBankTransaction }>;
  missingInVesper: ParsedBankTransaction[];
  missingInBank: VesperTransaction[];
}

/**
 * Tenta fazer um parse genérico de textos copiados de extratos bancários (Nubank, Itaú, etc)
 * Suporta formatos como:
 * "12/06/2026 Pix enviado João - R$ 150,00"
 * "12/06 Compra no débito Mercado 50,00"
 * "-200,50 15/06 Pagamento Boleto"
 */
export function parseBankStatement(text: string): ParsedBankTransaction[] {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const parsed: ParsedBankTransaction[] = [];
  
  // Regex para achar data (DD/MM/YYYY ou DD/MM ou DD-MM)
  const dateRegex = /\b(\d{2})[\/\-](\d{2})(?:[\/\-](\d{2,4}))?\b/;
  // Regex genérica para achar dinheiro: R$ 1.500,00 ou -1500,00 ou 50,00 ou - 20.50
  const moneyRegex = /(?:R\$\s*)?(-?\s*\d+(?:\.\d{3})*(?:,\d{2}))|(?:R\$\s*)?(-?\s*\d+(?:,\d{3})*(?:\.\d{2}))/g;

  let currentYear = new Date().getFullYear();

  lines.forEach((line, index) => {
    // Tenta extrair data
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) return; // Se não tem data, ignoramos a linha como não-transacional

    let [_, dayStr, monthStr, yearStr] = dateMatch;
    let year = yearStr ? (yearStr.length === 2 ? `20${yearStr}` : yearStr) : currentYear.toString();
    const parsedDate = new Date(`${year}-${monthStr}-${dayStr}T12:00:00Z`);

    // Encontra todos os valores monetários na linha
    const matches = Array.from(line.matchAll(moneyRegex));
    if (matches.length === 0) return;

    // Pegamos o último match de dinheiro da linha, pois costuma ser o valor real (às vezes o primeiro é saldo)
    const moneyStrRaw = matches[matches.length - 1][0];
    
    // Identifica se a string ou a linha inteira tem indicativo de negativo
    let isNegative = moneyStrRaw.includes('-') || line.toLowerCase().includes('enviado') || line.toLowerCase().includes('compra') || line.toLowerCase().includes('pagamento');
    
    // Limpa a string de dinheiro
    const cleanMoney = moneyStrRaw.replace(/[^\d,\.-]/g, '').replace(/\./g, '').replace(',', '.');
    const amountFloat = Math.abs(parseFloat(cleanMoney));
    
    if (isNaN(amountFloat)) return;

    const amount_cents = Math.round(amountFloat * 100);
    const type = isNegative ? "EXPENSE" : "INCOME";

    // A descrição é a linha toda sem a data e o valor
    let description = line
      .replace(dateMatch[0], '')
      .replace(moneyStrRaw, '')
      .replace(/^[\s\-]+|[\s\-]+$/g, '') // remove hifens/espaços soltos nas bordas
      .trim();

    if (!description) description = "Transação Importada";

    parsed.push({
      id: `bank-${index}-${Date.now()}`,
      date: parsedDate,
      description,
      amount_cents,
      type
    });
  });

  return parsed;
}

/**
 * Relaciona as transações do Vesper com as do extrato.
 * Usa valor exato e tolerância de ±3 dias na data.
 */
export function smartMatch(vesperTxs: VesperTransaction[], bankTxs: ParsedBankTransaction[]): MatchResult {
  const exactMatches: Array<{ vesper: VesperTransaction, bank: ParsedBankTransaction }> = [];
  const unmatchedVesper = [...vesperTxs];
  const unmatchedBank = [...bankTxs];

  // Ordena por data
  unmatchedVesper.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  unmatchedBank.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Fase 1: Correspondência Exata (Valor igual, Data +- 3 dias, Tipo igual)
  for (let i = unmatchedBank.length - 1; i >= 0; i--) {
    const bTx = unmatchedBank[i];
    
    // Procura no Vesper
    const matchIndex = unmatchedVesper.findIndex(vTx => {
      const vDate = new Date(vTx.date);
      const dayDiff = Math.abs((vDate.getTime() - bTx.date.getTime()) / (1000 * 60 * 60 * 24));
      
      return Math.abs(vTx.amount_cents - bTx.amount_cents) < 5 
          && vTx.transaction_type === bTx.type 
          && dayDiff <= 3;
    });

    if (matchIndex !== -1) {
      exactMatches.push({
        vesper: unmatchedVesper[matchIndex],
        bank: bTx
      });
      // Remove ambos das listas de não-pareados
      unmatchedVesper.splice(matchIndex, 1);
      unmatchedBank.splice(i, 1);
    }
  }

  return {
    exactMatches,
    missingInVesper: unmatchedBank, // Estão no banco mas o Vesper não tem
    missingInBank: unmatchedVesper  // Estão no Vesper mas o banco não tem
  };
}

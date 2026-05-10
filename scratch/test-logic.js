
const { formatCurrency } = require('./src/lib/utils');
const { calculateNetLiquidity, calculateTotalConsolidatedDebt } = require('./src/lib/financial-logic');

console.log('--- TEST: formatCurrency ---');
console.log('123.45 ->', formatCurrency(123.45));
console.log('NaN ->', formatCurrency(NaN));
console.log('null ->', formatCurrency(null));
console.log('undefined ->', formatCurrency(undefined));

console.log('\n--- TEST: calculateTotalConsolidatedDebt ---');
const accounts = [
    { type: 'CHECKING', balance_cents: 1000 },
    { type: 'CREDIT_CARD', closed_invoice_cents: 500, open_invoice_cents: 300 },
    { type: 'CREDIT_CARD', closed_invoice_cents: null, open_invoice_cents: undefined }
];
console.log('Accounts Debt ->', calculateTotalConsolidatedDebt(accounts));

console.log('\n--- TEST: calculateNetLiquidity ---');
console.log('Net Liquidity ->', calculateNetLiquidity(accounts));

console.log('\n--- TEST: NaN propagation ---');
const badAccounts = [
    { type: 'CHECKING', balance_cents: 'abc' },
    { type: 'CREDIT_CARD', closed_invoice_cents: NaN, open_invoice_cents: 100 }
];
console.log('Bad Accounts Debt ->', calculateTotalConsolidatedDebt(badAccounts));
console.log('Bad Accounts Liquidity ->', calculateNetLiquidity(badAccounts));

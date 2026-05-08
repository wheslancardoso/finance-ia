
const fs = require('fs');
const content = fs.readFileSync('/home/lan/finance-ia/scratch/sum_may.js', 'utf8');
const sqlMatch = content.match(/const sql = `([\s\S]*?)`;/);
if (!sqlMatch) {
    console.log("SQL not found");
    process.exit(1);
}
const sql = sqlMatch[1];
const transactions = eval('[' + sql.replace(/\(/g, '[').replace(/\)/g, ']') + ']');

const now = new Date('2026-05-08T19:10:46-03:00');
const startOfMonth = new Date('2026-05-01T00:00:00');
const endOfMonth = new Date('2026-05-31T23:59:59');

let total = 0;
console.log("Transactions in May 2026:");
transactions.forEach(t => {
    const id = t[0];
    const amount = parseInt(t[3]);
    const type = t[4];
    const date = new Date(t[5]);
    const desc = t[6];
    
    if (type === 'EXPENSE' && date >= startOfMonth && date <= endOfMonth) {
        total += amount;
        console.log(`${date.toISOString().split('T')[0]} | ${desc.padEnd(30)} | ${amount / 100}`);
    }
});
console.log("--------------------------------------------------");
console.log("Total:", total / 100);

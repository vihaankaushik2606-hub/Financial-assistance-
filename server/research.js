// Bound context by selecting useful fields and periods, never by cutting JSON.
const statementFields = {
  incomeStatement: ['revenue', 'costOfRevenue', 'grossProfit', 'operatingExpenses', 'operatingIncome', 'netIncome', 'interestExpense'],
  balanceSheet: ['totalAssets', 'totalLiabilities', 'totalStockholdersEquity', 'totalDebt', 'cashAndCashEquivalents', 'netDebt'],
  cashFlow: ['netIncome', 'operatingCashFlow', 'capitalExpenditure', 'freeCashFlow', 'netCashProvidedByOperatingActivities']
};

function summarizeStatements(statements = {}) {
  return Object.fromEntries(Object.entries(statementFields).map(([name, fields]) => {
    const item = statements[name];
    if (!item?.available) return [name, { available: false, message: String(item?.message || 'No statement records returned.').slice(0, 300) }];
    const select = rows => (Array.isArray(rows) ? rows : [])
      .filter(row => row && typeof row === 'object')
      .slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 2)
      .map(row => Object.fromEntries([
        ...['symbol', 'date', 'period', 'fiscalYear', 'reportedCurrency'].map(key => [key, row[key] == null ? null : String(row[key]).slice(0, 40)]),
        ...fields.map(key => [key, typeof row[key] === 'number' && Number.isFinite(row[key]) ? row[key] : null])
      ]));
    return [name, { available: true, source: 'Financial Modeling Prep', annualReports: select(item.annualReports), quarterlyReports: select(item.quarterlyReports) }];
  }));
}

// A shared per-process upstream budget also limits requests spread across IPs.
function createBudget(limit, windowMs, now = Date.now) {
  let start = now(), count = 0;
  return () => {
    const time = now();
    if (time - start >= windowMs) { start = time; count = 0; }
    if (count >= limit) return false;
    count += 1;
    return true;
  };
}

module.exports = { summarizeStatements, createBudget };

const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../public/statement-analysis');
const row = extra => ({ symbol: 'TEST', date: '2025-12-31', reportedCurrency: 'INR', ...extra });
const stmt = rows => ({ available: true, annualReports: rows });
const report = (income = [], balance = [], cash = [], extra = {}) => analyze({ symbol: 'TEST', statements: { incomeStatement: stmt(income), balanceSheet: stmt(balance), cashFlow: stmt(cash) }, ...extra });
const value = (r, label) => r.metrics.find(m => m.label === label)?.value;

test('analyzes all three matching statements and explains annual trends', () => {
  const r = report([row({ revenue: 200, netIncome: 20, operatingIncome: 40 }), row({ date: '2024-12-31', revenue: 100, netIncome: 5 })], [row({ totalDebt: 50, cashAndCashEquivalents: 10, totalCurrentAssets: 60, totalCurrentLiabilities: 30 })], [row({ operatingCashFlow: 30, freeCashFlow: 22 })]);
  assert.equal(r.currency, 'INR');
  assert.equal(value(r, 'Revenue change'), 100);
  assert.equal(value(r, 'Net profit margin'), 10);
  assert.equal(value(r, 'Operating margin'), 20);
  assert.equal(value(r, 'Net debt'), 40);
  assert.equal(value(r, 'Current ratio'), 2);
  assert.equal(value(r, 'Cash conversion'), 1.5);
  assert.equal(value(r, 'Free cash flow'), 22);
  assert.match(r.findings.find(f => f.title === 'Margin trend').text, /5.0 percentage points/);
});

test('does not mix dates, currencies, companies or quarterly reports', () => {
  const r = report([row({ revenue: 100, netIncome: 20 }), row({ symbol: 'OTHER', date: '2026-12-31', revenue: 999 })], [row({ reportedCurrency: 'USD', totalDebt: 100, cashAndCashEquivalents: 5 })], [row({ date: '2024-12-31', operatingCashFlow: 5 })]);
  assert.equal(value(r, 'Revenue'), 100);
  assert.equal(value(r, 'Net debt'), undefined);
  assert.equal(value(r, 'Cash conversion'), undefined);
  assert.equal(r.gaps.length, 3);
  assert.equal(analyze({ symbol: 'TEST', statements: { incomeStatement: { available: true, quarterlyReports: [row({ revenue: 100 })] } } }).metrics.length, 0);
});

test('missing values stay missing, zero values survive and zero denominators are omitted', () => {
  const r = report([row({ revenue: 0, netIncome: 0, operatingIncome: null })], [row({ totalDebt: 0, cashAndCashEquivalents: 0, totalCurrentAssets: 0, totalCurrentLiabilities: 0 })], [row({ operatingCashFlow: 0, freeCashFlow: null })]);
  assert.equal(value(r, 'Revenue'), 0);
  assert.equal(value(r, 'Net debt'), 0);
  assert.equal(value(r, 'Operating cash flow'), 0);
  for (const key of ['Net profit margin', 'Current ratio', 'Cash conversion', 'Free cash flow']) assert.equal(value(r, key), undefined);
  assert.ok(r.metrics.every(m => Number.isFinite(m.value)));
});

test('loss-to-profit transitions avoid misleading profit-growth percentages', () => {
  const r = report([row({ revenue: 100, netIncome: 10 }), row({ date: '2024-12-31', revenue: 100, netIncome: -20 })]);
  assert.equal(value(r, 'Net income change'), 30);
  assert.match(r.findings.find(f => f.title === 'Profit trend').text, /moved from a loss to a profit/);
});

test('capex sign conventions produce the same derived FCF; reported FCF takes precedence', () => {
  for (const capitalExpenditure of [10, -10]) {
    assert.equal(value(report([], [], [row({ operatingCashFlow: 30, capitalExpenditure })]), 'Free cash flow'), 20);
  }
  assert.equal(value(report([], [], [row({ operatingCashFlow: 30, capitalExpenditure: -10, freeCashFlow: 0 })]), 'Free cash flow'), 0);
});

test('sorts annual rows, accepts 52-week years, rejects duplicate and distant periods', () => {
  const r = report([row({ date: '2024-12-28', revenue: 100 }), row({ date: '2025-12-27', revenue: 120 }), row({ date: '2025-12-26', revenue: 999 })]);
  assert.equal(r.date, '2025-12-27');
  assert.ok(Math.abs(value(r, 'Revenue change') - 20) < 0.00001);
  const far = report([row({ revenue: 120 }), row({ date: '2023-12-31', revenue: 100 })]);
  assert.equal(value(far, 'Revenue change'), undefined);
});

test('labels demo data and handles no usable statements without invented values', () => {
  assert.equal(report([row({ revenue: 10 })], [], [], { isDemo: true }).isDemo, true);
  const empty = report([row({ reportedCurrency: null, revenue: 100 })]);
  assert.equal(empty.metrics.length, 0);
  assert.equal(empty.findings.length, 0);
  assert.match(empty.gaps[0], /No dated annual statements/);
});

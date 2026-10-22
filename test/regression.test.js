const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { summarizeStatements, createBudget } = require('../server/research');

const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const response = (data, ok = true) => ({ ok, json: async () => data });
function frontend(fetchRequest = async () => response({})) {
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, { value: '', dataset: {}, style: {}, innerHTML: '', textContent: '', hidden: false, listeners: {}, querySelectorAll() { return []; }, addEventListener(event, fn) { this.listeners[event] = fn; } });
    return nodes.get(id);
  }
  const context = vm.createContext({ document: { getElementById: node, querySelector: node }, window: { StatementAnalysis: require('../public/statement-analysis') },
    fetch: url => url === '/api/config' ? Promise.resolve(response({ authConfigured: false })) : url === '/api/health' ? Promise.resolve(response({})) : fetchRequest(url),
    setTimeout, clearTimeout, console });
  vm.runInContext(source('public/app.js').replace(/\n\}\)\(\);\s*$/, '\n;globalThis.testApp = { calcRatios };\n})();'), context);
  return { node, context };
}

test('AI context keeps all statement types, periods, currencies and missing values', () => {
  const row = { date: '2025-12-31', period: 'FY', reportedCurrency: 'INR', revenue: 100, totalDebt: 30, operatingCashFlow: 20, unused: 'x'.repeat(20000) };
  const statements = Object.fromEntries(['incomeStatement', 'balanceSheet', 'cashFlow'].map(name => [name, { available: true, annualReports: [row], quarterlyReports: [{ ...row, period: 'Q1' }] }]));
  const summary = JSON.parse(JSON.stringify(summarizeStatements(statements)));
  assert.equal(summary.incomeStatement.annualReports[0].revenue, 100);
  assert.equal(summary.balanceSheet.annualReports[0].totalDebt, 30);
  assert.equal(summary.cashFlow.annualReports[0].operatingCashFlow, 20);
  assert.equal(summary.cashFlow.annualReports[0].freeCashFlow, null);
  assert.equal(summary.cashFlow.quarterlyReports[0].reportedCurrency, 'INR');
  assert.equal(summary.cashFlow.quarterlyReports[0].period, 'Q1');
  assert.ok(JSON.stringify(summary).length < 12000);
  assert.equal(summarizeStatements({}).cashFlow.available, false);
});

test('AI context selects latest reports even when provider rows are unordered', () => {
  const summary = summarizeStatements({ incomeStatement: { available: true, annualReports: [2023, 2025, 2024].map(year => ({ date: `${year}-12-31` })) } });
  assert.deepEqual(summary.incomeStatement.annualReports.map(row => row.date), ['2025-12-31', '2024-12-31']);
});

test('budget blocks excess calls and renews at the window boundary', () => {
  let now = 0;
  const take = createBudget(2, 1000, () => now);
  assert.equal(take(), true);
  assert.equal(take(), true);
  assert.equal(take(), false);
  now = 1000;
  assert.equal(take(), true);
});

test('quote preserves zero change and volume when linked statements fail', async () => {
  const { node } = frontend(async url => url.startsWith('/api/quote') ? response({ symbol: 'IBM', quote: { raw: { symbol: 'IBM', price: 123, change: 0, volume: 0 } } }) : response({ error: 'Statements not included in plan' }, false));
  node('symbol').value = 'IBM';
  await node('loadBtn').listeners.click();
  assert.match(node('marketCards').innerHTML, /123/);
  assert.match(node('marketCards').innerHTML, /Today&#39;s Change<\/div>\s*<div class="value">0/);
  assert.match(node('marketCards').innerHTML, /Volume<\/div>\s*<div class="value">0/);
  assert.match(node('manualSource').textContent, /Statements not included/);
  assert.equal(node('loadBtn').disabled, false);
});

test('financial statements still populate ratios when quote fails', async () => {
  const { node } = frontend(async url => url.startsWith('/api/quote') ? response({ error: 'No quote' }, false) : response({ statements: { incomeStatement: { available: true, annualReports: [{ symbol: 'IBM', date: '2025-12-31', reportedCurrency: 'USD', revenue: 100, netIncome: 10 }] } } }));
  node('symbol').value = 'IBM';
  await node('loadBtn').listeners.click();
  assert.equal(node('revenue').value, '100');
  assert.match(node('ratioCards').innerHTML, /10%/);
  assert.match(node('message').textContent, /Could not load quote/);
});

test('profit changes describe improvement or deterioration for loss-making companies', () => {
  const { node, context } = frontend();
  for (const [prior, current, expected] of [[-100, -50, '50%'], [-100, -150, '-50%'], [-100, 50, '150%'], [100, 150, '50%']]) {
    node('priorProfit').value = String(prior);
    node('profit').value = String(current);
    context.testApp.calcRatios();
    assert.ok(node('ratioCards').innerHTML.includes(`class="value">${expected}</div>`));
  }
  node('priorProfit').value = '0';
  context.testApp.calcRatios();
  assert.doesNotMatch(node('ratioCards').innerHTML, /Profit change/);
});

test('analysis ignores concurrent Enter/click submissions and permits retry after failure', async () => {
  let finish, calls = 0;
  const { node, context } = frontend(async () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  vm.runInContext('getAccessToken = async () => "test-token"', context);
  node('autoCompany').value = 'IBM';
  const first = node('autoAnalyzeBtn').listeners.click();
  node('autoCompany').listeners.keydown({ key: 'Enter', preventDefault() {} });
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(node('autoCompany').listeners.change, undefined);
  finish(response({ error: 'Temporary failure' }, false));
  await first;
  assert.equal(node('autoAnalyzeBtn').disabled, false);
  const retry = node('autoAnalyzeBtn').listeners.click();
  await Promise.resolve();
  assert.equal(calls, 2);
  finish(response({ answer: 'Analysis complete' }));
  await retry;
  assert.match(node('autoAnalysisOutput').innerHTML, /Analysis complete/);
});

test('clearing scanner figures also clears attached AI context and old scenarios', () => {
  const { node } = frontend();
  node('aiQuestion').dataset.context = 'Old company data';
  node('scenarioCards').innerHTML = 'Old scenarios';
  node('clearBtn').listeners.click();
  assert.equal(node('aiQuestion').dataset.context, undefined);
  assert.equal(node('scenarioCards').innerHTML, '');
});

test('upstream budget is enforced while cached and concurrent requests share one call', async () => {
  // Exercise the server's actual provider function without network or credentials.
  const app = { use() {}, get() {}, post() {} };
  const express = Object.assign(() => app, { json() {}, static() {} });
  let calls = 0;
  const context = vm.createContext({
    require: name => name === 'express' ? express : name === 'dotenv' ? { config() {} } : name.startsWith('./') ? require('../server/' + name.slice(2)) : require(name),
    module: { exports: {} }, __dirname: path.join(__dirname, '../server'),
    process: { env: { FMP_API_KEY: 'test-only', FMP_DAILY_REQUEST_LIMIT: '1' } }, URL, console,
    fetch: async () => { calls++; return response([{ symbol: 'IBM', price: 100 }]); }
  });
  vm.runInContext(source('server/index.js'), context);
  const request = () => vm.runInContext('fmpRequest("quote", { symbol: "IBM" })', context);
  await Promise.all([request(), request()]);
  await request();
  assert.equal(calls, 1);
  await assert.rejects(vm.runInContext('fmpRequest("quote", { symbol: "MSFT" })', context), error => error.status === 429);
  assert.equal(calls, 1);
});

test('stock lookup renders statement analysis and a subsequent failure clears stale results', async () => {
  const { node } = frontend(async url => url.startsWith('/api/quote') ? response({ quote: { raw: { price: 100 } } }) : url.includes('IBM') ? response({ symbol: 'IBM', statements: { incomeStatement: { available: true, annualReports: [{ date: '2025-12-31', reportedCurrency: 'USD', revenue: 100, netIncome: 20 }] } } }) : response({ error: 'Unavailable' }, false));
  node('symbol').value = 'IBM';
  await node('loadBtn').listeners.click();
  assert.match(node('statementAnalysisMetrics').innerHTML, /20.0%/);
  assert.match(node('statementAnalysisFindings').innerHTML, /Profitability/);
  assert.match(node('statementAnalysisStatus').textContent, /IBM.*2025-12-31.*USD/);
  node('symbol').value = 'MSFT';
  await node('loadBtn').listeners.click();
  assert.equal(node('statementAnalysisMetrics').innerHTML, '');
  assert.equal(node('statementAnalysisFindings').innerHTML, '');
  assert.match(node('statementAnalysisStatus').textContent, /unavailable/i);
});

test('View financial statements also generates analysis and clearly labels demos', async () => {
  const { node } = frontend(async () => response({ symbol: 'IBM', isDemo: true, statements: { incomeStatement: { available: true, annualReports: [{ date: '2025-12-31', reportedCurrency: 'USD', revenue: 100, netIncome: 20 }] } } }));
  node('symbol').value = 'IBM';
  await node('fundamentalsBtn').listeners.click();
  assert.match(node('statementAnalysisStatus').textContent, /Illustrative sample data/);
  assert.match(node('statementAnalysisMetrics').innerHTML, /20.0%/);
});

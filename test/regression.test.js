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
    if (!nodes.has(id)) nodes.set(id, { value: '', dataset: {}, style: {}, innerHTML: '', textContent: '', hidden: false, listeners: {}, addEventListener(event, fn) { this.listeners[event] = fn; } });
    return nodes.get(id);
  }
  const context = vm.createContext({ document: { getElementById: node, querySelector: node }, window: {},
    fetch: url => url === '/api/config' ? Promise.resolve(response({ authConfigured: false })) : url === '/api/health' ? Promise.resolve(response({})) : fetchRequest(url),
    setTimeout, clearTimeout, console });
  vm.runInContext(source('public/app.js'), context);
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

test('a quote remains visible if daily history fails; zero change and volume survive', async () => {
  const { node } = frontend(async url => url.startsWith('/api/quote') ? response({ symbol: 'IBM', fetchedAt: '2026-01-01', quote: { '05. price': 123, '09. change': 0, '06. volume': 0 } }) : response({ error: 'History not included in plan' }, false));
  node('symbol').value = 'IBM';
  await node('loadBtn').listeners.click();
  assert.match(node('marketCards').innerHTML, /123/);
  assert.match(node('marketCards').innerHTML, /Change<\/div><div class="value">0/);
  assert.match(node('marketCards').innerHTML, /Volume<\/div><div class="value">0/);
  assert.match(node('message').textContent, /History not included/);
  assert.equal(node('historySection').hidden, true);
  assert.equal(node('loadBtn').disabled, false);
});

test('daily history remains visible if quote fails', async () => {
  const { node } = frontend(async url => url.startsWith('/api/quote') ? response({ error: 'No quote' }, false) : response({ rows: [{ date: '2026-01-01', close: 12 }] }));
  node('symbol').value = 'IBM';
  await node('loadBtn').listeners.click();
  assert.equal(node('historySection').hidden, false);
  assert.match(node('historyRows').innerHTML, /2026-01-01/);
  assert.match(node('message').textContent, /Quote unavailable/);
});

test('profit changes describe improvement or deterioration for loss-making companies', () => {
  const { node, context } = frontend();
  for (const [prior, current, expected] of [[-100, -50, '50%'], [-100, -150, '-50%'], [-100, 50, '150%'], [100, 150, '50%']]) {
    node('priorProfit').value = String(prior);
    node('profit').value = String(current);
    vm.runInContext('calcRatios()', context);
    assert.ok(node('ratioCards').innerHTML.includes(`class="value">${expected}</div>`));
  }
  node('priorProfit').value = '0';
  vm.runInContext('calcRatios()', context);
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
  assert.equal(node('autoAnalysisOutput').textContent, 'Analysis complete');
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
    require: name => name === 'express' ? express : name === 'dotenv' ? { config() {} } : name === './research' ? require('../server/research') : require(name),
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

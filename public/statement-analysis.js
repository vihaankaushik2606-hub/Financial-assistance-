(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StatementAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const number = value => !['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const pct = value => `${value.toFixed(1)}%`;
  function analyze(data) {
    const symbol = String(data.symbol || '').toUpperCase();
    const statements = data.statements || {};
    const rows = key => (statements[key]?.available ? statements[key].annualReports || [] : [])
      .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') && Number.isFinite(Date.parse(r.date)) && (!r.period || r.period === 'FY') && r.reportedCurrency && (!r.symbol || String(r.symbol).toUpperCase() === symbol))
      .slice().sort((a, b) => b.date.localeCompare(a.date));
    const income = rows('incomeStatement'), balances = rows('balanceSheet'), flows = rows('cashFlow');
    const anchor = income[0] || balances[0] || flows[0];
    const result = { symbol, isDemo: Boolean(data.isDemo), date: anchor?.date, currency: anchor?.reportedCurrency, metrics: [], findings: [], gaps: [] };
    if (!anchor) {
      result.gaps.push('No dated annual statements with a reporting currency are available for this company.');
      return result;
    }
    const same = r => r.date === anchor.date && r.reportedCurrency === anchor.reportedCurrency;
    const i = income.find(same), b = balances.find(same), c = flows.find(same);
    const prior = income.find(r => {
      const days = (Date.parse(anchor.date) - Date.parse(r.date)) / 86400000;
      return r.reportedCurrency === anchor.reportedCurrency && days >= 300 && days <= 430;
    });
    const metric = (label, value, unit, formula) => result.metrics.push({ label, value, unit, formula });
    const finding = (title, text) => result.findings.push({ title, text });
    const n = (row, key) => number(row?.[key]);
    const revenue = n(i, 'revenue'), profit = n(i, 'netIncome'), operating = n(i, 'operatingIncome');
    if (i) {
      if (revenue !== null) metric('Revenue', revenue, 'money', 'Annual income statement');
      if (profit !== null) metric('Net income', profit, 'money', 'Annual income statement');
      if (revenue > 0 && profit !== null) {
        const margin = profit / revenue * 100;
        metric('Net profit margin', margin, 'percent', 'Net income ÷ revenue × 100');
        finding('Profitability', `The company ${profit < 0 ? 'lost' : 'earned'} ${Math.abs(margin).toFixed(1)} in net ${profit < 0 ? 'loss' : 'profit'} for every 100 of revenue, in ${anchor.reportedCurrency}.`);
      }
      if (revenue > 0 && operating !== null) metric('Operating margin', operating / revenue * 100, 'percent', 'Operating income ÷ revenue × 100');
      const prevRevenue = n(prior, 'revenue'), prevProfit = n(prior, 'netIncome');
      if (revenue !== null && prevRevenue > 0) {
        const growth = (revenue / prevRevenue - 1) * 100;
        metric('Revenue change', growth, 'percent', `Compared with year ended ${prior.date}`);
        finding('Sales trend', `Revenue ${growth < 0 ? 'fell' : growth > 0 ? 'rose' : 'was unchanged'}${growth === 0 ? '' : ` by ${pct(Math.abs(growth))}`} versus the year ended ${prior.date}. This describes past performance, not a forecast.`);
      }
      if (profit !== null && prevProfit !== null) {
        const change = profit - prevProfit;
        metric('Net income change', change, 'money', `Current net income minus net income for ${prior.date}`);
        if (prevProfit <= 0 || profit < 0) finding('Profit trend', `Net income ${change > 0 ? 'improved' : change < 0 ? 'deteriorated' : 'was unchanged'} versus ${prior.date}.${prevProfit < 0 && profit >= 0 ? ' The company moved from a loss to a profit.' : prevProfit >= 0 && profit < 0 ? ' The company moved from a profit to a loss.' : ''}`);
        if (revenue > 0 && prevRevenue > 0) {
          const delta = (profit / revenue - prevProfit / prevRevenue) * 100;
          finding('Margin trend', `Net profit margin ${delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'was unchanged'}${delta === 0 ? '' : ` by ${Math.abs(delta).toFixed(1)} percentage points`} versus ${prior.date}. Review changes in costs, taxes and one-off items in the filings.`);
        }
      }
      if (!prior) result.gaps.push('A comparable prior annual income statement is unavailable; year-on-year trends are omitted.');
    } else result.gaps.push('No income statement matches this date and currency. Profitability and growth are omitted.');
    if (b) {
      const debt = n(b, 'totalDebt'), cash = n(b, 'cashAndCashEquivalents');
      const currentAssets = n(b, 'totalCurrentAssets'), currentLiabilities = n(b, 'totalCurrentLiabilities');
      if (debt !== null && cash !== null && debt >= 0 && cash >= 0) {
        const net = debt - cash;
        metric('Net debt', net, 'money', 'Total debt minus cash and cash equivalents');
        finding('Debt and cash', net > 0 ? 'Debt exceeds cash and cash equivalents. Review repayment dates, interest costs and available cash generation before assessing the debt burden.' : 'Cash and cash equivalents cover reported total debt. This excludes other obligations and does not establish financial strength.');
      }
      if (currentAssets !== null && currentAssets >= 0 && currentLiabilities > 0) {
        const ratio = currentAssets / currentLiabilities;
        metric('Current ratio', ratio, 'ratio', 'Current assets ÷ current liabilities');
        finding('Short-term liquidity', `Current assets are ${ratio.toFixed(2)} times current liabilities.${ratio < 1 ? ' Current liabilities exceed current assets.' : ''} Asset quality, timing and the company’s industry matter; this ratio alone cannot establish liquidity.`);
      }
    } else result.gaps.push('No balance sheet matches this date and currency. Debt and liquidity analysis are omitted.');
    if (c) {
      const ocf = n(c, 'operatingCashFlow'), capex = n(c, 'capitalExpenditure');
      const reportedFcf = n(c, 'freeCashFlow');
      const fcf = reportedFcf !== null ? reportedFcf : ocf !== null && capex !== null ? ocf - Math.abs(capex) : null;
      if (ocf !== null) {
        metric('Operating cash flow', ocf, 'money', 'Annual cash flow statement');
        finding('Cash generation', ocf < 0 ? 'Operations used cash during this year. Check working-capital movements and whether the company relied on borrowing, asset sales or new equity.' : 'Operations generated cash during this year. Review working-capital movements to understand how repeatable that generation may be.');
      }
      if (fcf !== null) {
        metric('Free cash flow', fcf, 'money', reportedFcf !== null ? 'Provider-reported free cash flow' : 'Derived: operating cash flow minus absolute capital expenditure');
        finding('Cash after investment', fcf < 0 ? 'Free cash flow was negative after capital expenditure. Check whether investment is temporary, expansion-related or recurring, and how it was financed.' : 'Free cash flow was non-negative after capital expenditure. This is before financing uses such as debt repayments, dividends and buybacks.');
      }
      if (ocf !== null && profit > 0) {
        const conversion = ocf / profit;
        metric('Cash conversion', conversion, 'ratio', 'Operating cash flow ÷ net income; matching annual period');
        finding('Profit versus cash', `Operating cash flow was ${conversion.toFixed(2)} times net income.${ocf < profit ? ' Cash generation lagged accounting profit; inspect receivables, inventory and non-cash items.' : ' Cash generation equalled or exceeded accounting profit; inspect working capital and non-cash items for context.'}`);
      }
    } else result.gaps.push('No cash flow statement matches this date and currency. Cash generation analysis is omitted.');
    if (!result.metrics.length) result.gaps.push('The matching statements do not contain enough numeric fields to calculate the supported metrics.');
    return result;
  }
  return { analyze };
});

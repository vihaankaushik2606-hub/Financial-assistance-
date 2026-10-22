const test=require("node:test"),assert=require("node:assert/strict");const {prepare}=require("./public/analysis-charts");
test("charts preserve zero, losses and missing cash; reject mismatched company/currency/date",()=>{
const d={symbol:"A",statements:{incomeStatement:{available:true,annualReports:[{symbol:"A",date:"2025-12-31",reportedCurrency:"USD",period:"FY",revenue:0,netIncome:-5},{symbol:"B",date:"2024-12-31",reportedCurrency:"USD",revenue:9},{symbol:"A",date:"2024-12-31",reportedCurrency:"EUR",revenue:9},{symbol:"A",date:"2025-09-30",reportedCurrency:"USD",period:"Q3",revenue:4}]},cashFlow:{available:true,annualReports:[{date:"2025-12-30",reportedCurrency:"USD",operatingCashFlow:50}]}}};
const r=prepare(d);assert.equal(r.charts[0].series[0].values[0],0);assert.equal(r.charts[1].series[0].values[0],-5);assert.equal(r.charts[2].series[1].values[0],null);assert.deepEqual(r.charts[0].dates,["2025-12-31"]);
});
test("charts sort annual dates, label demos, and return empty without usable statements",()=>{
const r=prepare({symbol:"A",isDemo:true,statements:{incomeStatement:{available:true,annualReports:[{date:"2025-12-31",reportedCurrency:"USD",revenue:20},{date:"2024-12-31",reportedCurrency:"USD",revenue:10}]}}});assert.equal(r.isDemo,true);assert.deepEqual(r.charts[0].series[0].values,[10,20]);assert.deepEqual(prepare({symbol:"A"}).charts,[]);
});
/**
 * Master Payment & Finance Automated Test Runner
 */

console.log("==============================================================================");
console.log("🏫 SCHOOL RESULT & PAYMENT SYSTEM — AUTOMATED AUDIT & TEST SUITE");
console.log("==============================================================================\n");

async function runAll() {
  const start = Date.now();
  let passed = 0;
  let failed = 0;

  const testSuites = [
    { name: "Payment Calculator & Math Unit Tests", path: "./unit/payment-calculator.test.ts" },
    { name: "Payment State Machine Unit Tests", path: "./unit/payment-state-machine.test.ts" },
    { name: "Payment Error Mapping Unit Tests", path: "./unit/payment-error-mapping.test.ts" },
    { name: "Payment Lifecycle & Gateway Integration Tests", path: "./integration/payment-flow.test.ts" },
    { name: "Idempotency & Deduplication Integration Tests", path: "./integration/payment-idempotency.test.ts" },
    { name: "Webhook & IPN Verification Integration Tests", path: "./integration/payment-webhook.test.ts" },
    { name: "Payment Refunds & Cumulative Limits Integration Tests", path: "./integration/payment-refund.test.ts" },
    { name: "Payment Security, Anti-Tampering & BOLA Tests", path: "./security/payment-security.test.ts" },
    { name: "10 End-to-End Production Scenarios Tests", path: "./integration/payment-production-scenarios.test.ts" },
    { name: "Academic Calculator Tests", path: "./unit/academic-calculator.test.ts" },
    { name: "Dashboard Calculator & Safe Math Unit Tests", path: "./unit/dashboard-calculator.test.ts" },
    { name: "Dashboard RBAC, Aggregators & Data Scoping Integration Tests", path: "./integration/dashboard-api.test.ts" },
  ];

  for (const suite of testSuites) {
    try {
      await import(suite.path);
      passed++;
    } catch (err: any) {
      console.error(`❌ Suite Failed: ${suite.name}`);
      console.error(err);
      failed++;
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log("==============================================================================");
  console.log(`📊 TEST SUITE SUMMARY:`);
  console.log(`✔ Passed Suites: ${passed}`);
  console.log(`❌ Failed Suites: ${failed}`);
  console.log(`⏱ Total Duration: ${duration}s`);
  console.log("==============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAll();

/**
 * Unit Test Suite: Monetary Math, Rounding, English Number-to-Words & Fee Aggregation
 */

import { roundCurrency, amountInWords, formatCurrency, calculateFine } from "../../src/lib/finance-utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

function runCalculatorTests() {
  console.log("▶ Running Unit Tests: Payment Calculator & Currency Utilities...");

  // 1. Rounding & Floating Point Drift
  assert(roundCurrency(10.1 + 20.2) === 30.3, "Floating point 10.1 + 20.2 should round to 30.3");
  assert(roundCurrency(0.1 + 0.2) === 0.3, "Floating point 0.1 + 0.2 should round to 0.3");
  assert(roundCurrency(1250.555) === 1250.56, "1250.555 should round to 1250.56");
  assert(roundCurrency("500.75") === 500.75, "String '500.75' should parse and round to 500.75");
  assert(roundCurrency(null) === 0, "null should return 0");
  assert(roundCurrency(undefined) === 0, "undefined should return 0");
  assert(roundCurrency("invalid") === 0, "invalid string should return 0");

  // 2. Format Currency
  assert(formatCurrency(1250) === "1,250 TK", "1250 should format as '1,250 TK'");
  assert(formatCurrency(1250, false) === "1,250", "1250 without symbol should format as '1,250'");
  assert(formatCurrency(1050000) === "1,050,000 TK", "1050000 should format as '1,050,000 TK'");

  // 3. English Number-to-Words (Taka System)
  assert(amountInWords(0) === "Zero Taka Only", "0 should return 'Zero Taka Only'");
  assert(amountInWords(500) === "Five Hundred Taka Only", "500 should return 'Five Hundred Taka Only'");
  assert(amountInWords(2500) === "Two Thousand Five Hundred Taka Only", "2500 should return 'Two Thousand Five Hundred Taka Only'");
  assert(amountInWords(105000) === "One Lakh Five Thousand Taka Only", "105000 should return 'One Lakh Five Thousand Taka Only'");
  assert(amountInWords(10000000) === "One Crore Taka Only", "10000000 should return 'One Crore Taka Only'");
  assert(amountInWords(250.50) === "Two Hundred Fifty Taka and Fifty Poisha Only", "250.50 should include poisha");

  // 4. Fine Calculation
  const dueDate = new Date("2026-01-10");
  const onTimeDate = new Date("2026-01-09");
  const lateDate = new Date("2026-01-15");
  
  assert(calculateFine(dueDate, onTimeDate, 10) === 0, "On-time payment should have 0 fine");
  assert(calculateFine(dueDate, dueDate, 10) === 0, "Same day payment should have 0 fine");
  assert(calculateFine(dueDate, lateDate, 10) === 50, "5 days late at 10 TK/day should be 50 TK fine");

  console.log("✔ All Payment Calculator unit tests passed successfully!\n");
}

try {
  runCalculatorTests();
} catch (e: any) {
  console.error("❌ Calculator Test Failed:", e.message);
  process.exit(1);
}

/**
 * Automated Verification Tests for FreshTrack AI
 * Tests prioritization engine, shelf-life heuristics, and stock calculations
 */
const assert = require('assert');
const { calculatePriority } = require('./src/services/prioritizationService');

console.log('🧪 Starting FreshTrack AI Automated Verification Suite...\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// 1. Prioritization Engine Tests
console.log('--- Test Suite 1: Stock Prioritization Engine ---');

it('should flag ROTTEN fruit as URGENT priority', () => {
  const batch = {
    quantity: 100,
    unit: 'kg',
    freshness: { state: 'ROTTEN', avg_freshness_pct: 12 },
    remaining_shelf_life_days: 0
  };
  const res = calculatePriority(batch);
  assert.strictEqual(res.level, 'urgent');
  assert.ok(res.score >= 90);
  assert.ok(res.reason.includes('ROTTEN'));
});

it('should flag batch with <= 1 day shelf life as URGENT', () => {
  const batch = {
    quantity: 50,
    unit: 'kg',
    freshness: { state: 'FRESH', avg_freshness_pct: 85 },
    remaining_shelf_life_days: 1
  };
  const res = calculatePriority(batch);
  assert.strictEqual(res.level, 'urgent');
  assert.ok(res.score >= 90);
});

it('should recommend SELL_FIRST for shelf life <= warning threshold', () => {
  const batch = {
    quantity: 80,
    unit: 'kg',
    freshness: { state: 'FRESH', avg_freshness_pct: 75 },
    remaining_shelf_life_days: 3
  };
  const res = calculatePriority(batch, { shelfLifeWarningDays: 3 });
  assert.strictEqual(res.level, 'sell_first');
  assert.ok(res.score >= 75);
});

it('should categorize uninspected batch as MANUAL_REVIEW', () => {
  const batch = {
    quantity: 40,
    unit: 'boxes',
    freshness: { state: 'NOT_INSPECTED', avg_freshness_pct: 0 },
    remaining_shelf_life_days: null
  };
  const res = calculatePriority(batch);
  assert.strictEqual(res.level, 'manual_review');
});

it('should assign NORMAL priority for healthy batch with ample shelf life', () => {
  const batch = {
    quantity: 100,
    unit: 'kg',
    freshness: { state: 'FRESH', avg_freshness_pct: 95 },
    remaining_shelf_life_days: 20
  };
  const res = calculatePriority(batch);
  assert.strictEqual(res.level, 'normal');
  assert.ok(res.score < 50);
});

it('should boost priority score for high volume at risk (>100kg)', () => {
  const batch = {
    quantity: 250,
    unit: 'kg',
    freshness: { state: 'FRESH', avg_freshness_pct: 70 },
    remaining_shelf_life_days: 2
  };
  const res = calculatePriority(batch);
  assert.strictEqual(res.level, 'sell_first');
  assert.ok(res.reason.includes('volume'));
});

it('should escalate priority as shelf life decreases over time', () => {
  const baseBatch = {
    quantity: 80,
    unit: 'kg',
    freshness: { state: 'FRESH', avg_freshness_pct: 85 }
  };

  // Day 0: 14 days remaining -> Normal priority
  const p14 = calculatePriority({ ...baseBatch, remaining_shelf_life_days: 14 });
  assert.strictEqual(p14.level, 'normal');

  // Day 10: 4 days remaining -> Sell first
  const p4 = calculatePriority({ ...baseBatch, remaining_shelf_life_days: 4 });
  assert.strictEqual(p4.level, 'sell_first');

  // Day 12: 2 days remaining -> Sell first
  const p2 = calculatePriority({ ...baseBatch, remaining_shelf_life_days: 2 });
  assert.strictEqual(p2.level, 'sell_first');

  // Day 13: 1 day remaining -> Urgent
  const p1 = calculatePriority({ ...baseBatch, remaining_shelf_life_days: 1 });
  assert.strictEqual(p1.level, 'urgent');
  assert.ok(p1.score >= 92);

  // Day 14: 0 days remaining (Expired) -> Urgent
  const p0 = calculatePriority({ ...baseBatch, remaining_shelf_life_days: 0 });
  assert.strictEqual(p0.level, 'urgent');
  assert.ok(p0.score >= 99);
});

it('should derive remaining shelf life from estimated_expiry if virtual property not present', () => {
  // Expiry in 18 hours (<= 1 day remaining)
  const batch = {
    quantity: 60,
    unit: 'kg',
    freshness: { state: 'FRESH', avg_freshness_pct: 80 },
    shelf_life: {
      estimated_expiry: new Date(Date.now() + 18 * 60 * 60 * 1000)
    }
  };
  const res = calculatePriority(batch);
  assert.strictEqual(res.level, 'urgent');
  assert.ok(res.score >= 92);
});

// 2. Shelf Life Heuristic Model Tests
console.log('\n--- Test Suite 2: Shelf-Life Heuristic Contracts ---');

it('should correctly cap rotten fruit shelf life at 0 days', () => {
  const estimateShelfDays = (fruit, p_fresh, state) => {
    if (state === 'ROTTEN') return 0;
    const table = { apple: 30, banana: 6, orange: 21, mango: 7 };
    return Math.max(0, Math.round((table[fruit] || 7) * p_fresh));
  };

  assert.strictEqual(estimateShelfDays('apple', 0.1, 'ROTTEN'), 0);
  assert.strictEqual(estimateShelfDays('banana', 0.95, 'FRESH'), 6);
  assert.strictEqual(estimateShelfDays('apple', 0.5, 'SEMI-FRESH'), 15);
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);

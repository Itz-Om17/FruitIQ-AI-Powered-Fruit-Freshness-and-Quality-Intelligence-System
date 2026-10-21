/**
 * FreshTrack AI — Fuzzy Logic Stock Prioritization Engine
 * Uses Mamdani/Sugeno Fuzzy Inference System (FIS) to determine dispatch priority,
 * urgency score, and transparent operational recommendations.
 */

// --- Fuzzy Membership Helper Functions ---
function trimf(x, a, b, c) {
  if (x <= a || x >= c) return 0.0;
  if (x === b) return 1.0;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

function trapmf(x, a, b, c, d) {
  if (x <= a || x >= d) return 0.0;
  if (x >= b && x <= c) return 1.0;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

// --- Fuzzification Functions ---
function fuzzifyShelfLife(days) {
  const d = Math.max(0, days);
  return {
    critical: trapmf(d, -1, 0, 1.0, 1.8),
    short: trimf(d, 1.2, 3.0, 5.0),
    medium: trimf(d, 4.0, 7.0, 12.0),
    long: trapmf(d, 10.0, 15.0, 100.0, 150.0)
  };
}

function fuzzifyQuantity(qty) {
  const q = Math.max(0, qty);
  return {
    small: trapmf(q, -1, 0, 15, 30),
    moderate: trimf(q, 20, 60, 120),
    bulk: trapmf(q, 100, 150, 100000, 200000)
  };
}

/**
 * Calculates batch priority using Fuzzy Logic Inference System
 */
function calculatePriority(batch, userPreferences = {}) {
  const warningDays = userPreferences.shelfLifeWarningDays || 3;
  const inspectionIntervalDays = userPreferences.inspectionIntervalDays || 2;
  const remainingQty = typeof batch.remaining_quantity === 'number'
    ? batch.remaining_quantity
    : (batch.quantity - (batch.sold_quantity || 0) - (batch.spoiled_quantity || 0));

  const freshnessState = batch.freshness?.state || 'NOT_INSPECTED';
  const remainingShelfDays = batch.remaining_shelf_life_days !== null && batch.remaining_shelf_life_days !== undefined
    ? batch.remaining_shelf_life_days
    : (batch.shelf_life?.estimated_days ?? null);

  const reasons = [];

  // 1. Handling uninspected stock
  if (freshnessState === 'NOT_INSPECTED' || remainingShelfDays === null) {
    return {
      level: 'manual_review',
      score: 65,
      reason: 'Batch has never undergone AI freshness inspection. Manual verification required.',
      last_calculated: new Date()
    };
  }

  // 2. Handling completely rotten fruit
  if (freshnessState === 'ROTTEN') {
    return {
      level: 'urgent',
      score: 95,
      reason: 'Batch freshness classified as ROTTEN via visual AI. Immediate quarantine or disposal recommended.',
      last_calculated: new Date()
    };
  }

  // 3. Fuzzy Inference System (Sugeno Weighted-Average)
  const sl = fuzzifyShelfLife(remainingShelfDays);
  const q = fuzzifyQuantity(remainingQty);

  // Fuzzy Rules with Consequent Singleton Urgency Scores (0 to 100):
  // R1: Critical Shelf Life + Bulk Quantity -> Emergency priority
  const w1 = Math.min(sl.critical, q.bulk);
  const z1 = 98;

  // R2: Critical Shelf Life + Moderate/Small Quantity -> Urgent priority
  const w2 = Math.min(sl.critical, Math.max(q.moderate, q.small));
  const z2 = 92;

  // R3: Short Shelf Life + Bulk Quantity -> Fast track dispatch
  const w3 = Math.min(sl.short, q.bulk);
  const z3 = 85;

  // R4: Short Shelf Life + Moderate Quantity -> Sell first
  const w4 = Math.min(sl.short, q.moderate);
  const z4 = 78;

  // R5: Short Shelf Life + Small Quantity -> Sell first / monitor
  const w5 = Math.min(sl.short, q.small);
  const z5 = 72;

  // R6: Medium Shelf Life + Semi-Fresh -> Close monitoring
  const isSemi = freshnessState === 'SEMI-FRESH' ? 1.0 : 0.0;
  const w6 = Math.min(sl.medium, isSemi);
  const z6 = 65;

  // R7: Medium Shelf Life + Bulk Quantity -> Monitor
  const w7 = Math.min(sl.medium, q.bulk);
  const z7 = 55;

  // R8: Long Shelf Life + Fresh -> Standard normal priority
  const w8 = Math.min(sl.long, q.bulk + q.moderate + q.small);
  const z8 = 25;

  const weights = [w1, w2, w3, w4, w5, w6, w7, w8];
  const consequents = [z1, z2, z3, z4, z5, z6, z7, z8];

  let sumNumerator = 0;
  let sumDenominator = 0;

  for (let i = 0; i < weights.length; i++) {
    sumNumerator += weights[i] * consequents[i];
    sumDenominator += weights[i];
  }

  // Defuzzified crisp score
  let score = sumDenominator > 0 ? (sumNumerator / sumDenominator) : 30;

  // Shelf-life threshold boundary checks
  if (remainingShelfDays <= 0) {
    score = Math.max(score, 99);
  } else if (remainingShelfDays <= 1) {
    score = Math.max(score, 90);
  } else if (remainingShelfDays <= warningDays) {
    score = Math.max(score, 75);
  }

  // Volume boost modifier
  if (remainingQty > 100 && score >= 70) {
    score = Math.min(100, score + 5);
  }

  score = Math.round(Math.min(100, Math.max(0, score)));

  // Map defuzzified score to categorical level
  let level = 'normal';
  if (score >= 92) {
    level = 'urgent';
    reasons.push(`Critically low shelf life (${remainingShelfDays} day remaining). Urgent dispatch or inspection required.`);
  } else if (score >= 72) {
    level = 'sell_first';
    reasons.push(`Approaching shelf-life deadline (${remainingShelfDays} days remaining). Sell or distribute first.`);
  } else if (score >= 50) {
    level = 'monitor';
    reasons.push(`Moderate shelf-life window (${remainingShelfDays} days). Monitor closely.`);
  } else {
    level = 'normal';
    reasons.push('Healthy shelf-life margin with stable freshness.');
  }

  if (remainingQty > 100) {
    reasons.push(`Substantial volume (${remainingQty} ${batch.unit || 'kg'}) at risk.`);
  }

  // Check inspection age
  if (batch.freshness?.last_inspection_date) {
    const daysSince = (Date.now() - new Date(batch.freshness.last_inspection_date)) / (1000 * 60 * 60 * 24);
    if (daysSince > inspectionIntervalDays * 2) {
      if (level === 'normal') level = 'manual_review';
      reasons.push(`Last inspection was ${Math.round(daysSince)} days ago.`);
    }
  }

  return {
    level,
    score,
    reason: reasons.join(' '),
    fuzzy_telemetry: {
      shelf_life_membership: sl,
      quantity_membership: q
    },
    last_calculated: new Date()
  };
}

module.exports = {
  calculatePriority,
  fuzzifyShelfLife,
  fuzzifyQuantity
};

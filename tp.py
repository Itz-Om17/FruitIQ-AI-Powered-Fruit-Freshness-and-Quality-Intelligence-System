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

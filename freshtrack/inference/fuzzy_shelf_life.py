"""
FreshTrack AI — Fuzzy Logic Shelf-Life Inference System
Applies Mamdani/Sugeno fuzzy rules to calculate remaining fruit shelf life
based on visual freshness probability, fruit variety baseline, and storage conditions.
"""
from typing import Dict, Tuple

# Baseline shelf lives in days under optimal cold storage
BASE_SHELF_LIFE: Dict[str, int] = {
    "apple": 30, "banana": 6, "orange": 21, "mango": 7, "tomato": 7,
    "potato": 60, "carrot": 28, "cucumber": 7, "capsicum": 10, "pepper": 10,
    "grape": 7, "strawberry": 5, "lemon": 21, "okra": 5, "onion": 60,
    "bellpepper": 10, "bittergroud": 5
}
DEFAULT_BASELINE = 7


def trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership function."""
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)


def trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal membership function."""
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a)
    return (d - x) / (d - c)


def compute_freshness_memberships(p_fresh: float) -> Dict[str, float]:
    """
    Fuzzification of neural freshness score (0.0 to 1.0) into fuzzy sets:
    - Rotten: high when p_fresh < 0.4
    - SemiFresh: peaks around 0.55
    - Fresh: high when p_fresh > 0.7
    """
    p = max(0.0, min(1.0, float(p_fresh)))
    return {
        "rotten": trapmf(p, -0.1, 0.0, 0.25, 0.45),
        "semi_fresh": trimf(p, 0.25, 0.55, 0.80),
        "fresh": trapmf(p, 0.60, 0.78, 1.0, 1.1)
    }


def compute_temp_memberships(temp_c: float) -> Dict[str, float]:
    """
    Fuzzification of storage temperature in Celsius:
    - Cold (optimal refrigeration): 0°C to 10°C
    - Ambient (room temperature): 10°C to 25°C
    - Warm (accelerated spoilage): 22°C to 45°C
    """
    t = float(temp_c)
    return {
        "cold": trapmf(t, -5.0, 0.0, 6.0, 12.0),
        "ambient": trimf(t, 8.0, 20.0, 27.0),
        "warm": trapmf(t, 22.0, 28.0, 50.0, 60.0)
    }


def fuzzy_shelf_life_ratio(p_fresh: float, temp_c: float = 12.0) -> Tuple[float, Dict[str, float]]:
    """
    Fuzzy Inference Engine (Sugeno-style defuzzification):
    Rules:
      R1: IF Freshness is Rotten THEN Ratio is 0.0
      R2: IF Freshness is SemiFresh AND Temp is Warm THEN Ratio is 0.25
      R3: IF Freshness is SemiFresh AND Temp is Ambient THEN Ratio is 0.50
      R4: IF Freshness is SemiFresh AND Temp is Cold THEN Ratio is 0.70
      R5: IF Freshness is Fresh AND Temp is Warm THEN Ratio is 0.65
      R6: IF Freshness is Fresh AND Temp is Ambient THEN Ratio is 0.85
      R7: IF Freshness is Fresh AND Temp is Cold THEN Ratio is 1.00
    """
    f = compute_freshness_memberships(p_fresh)
    t = compute_temp_memberships(temp_c)

    # Consequent singleton outputs (Ratio of base shelf-life)
    # R1: Rotten regardless of temperature
    w1 = f["rotten"]
    z1 = 0.0

    # R2: Semi-fresh + Warm
    w2 = min(f["semi_fresh"], t["warm"])
    z2 = 0.25

    # R3: Semi-fresh + Ambient
    w3 = min(f["semi_fresh"], t["ambient"])
    z3 = 0.50

    # R4: Semi-fresh + Cold
    w4 = min(f["semi_fresh"], t["cold"])
    z4 = 0.70

    # R5: Fresh + Warm
    w5 = min(f["fresh"], t["warm"])
    z5 = 0.65

    # R6: Fresh + Ambient
    w6 = min(f["fresh"], t["ambient"])
    z6 = 0.85

    # R7: Fresh + Cold
    w7 = min(f["fresh"], t["cold"])
    z7 = 1.00

    numerator = (w1 * z1 + w2 * z2 + w3 * z3 + w4 * z4 + w5 * z5 + w6 * z6 + w7 * z7)
    denominator = (w1 + w2 + w3 + w4 + w5 + w6 + w7)

    ratio = numerator / denominator if denominator > 0 else 0.0
    return round(ratio, 3), {
        "f_fresh": round(f["fresh"], 2),
        "f_semi": round(f["semi_fresh"], 2),
        "f_rotten": round(f["rotten"], 2)
    }


def estimate_shelf_life_fuzzy(fruit_type: str, p_fresh: float, state: str, temp_c: float = 12.0) -> int:
    """
    Calculates final remaining shelf life (days) using the defuzzified ratio.
    """
    if state == "ROTTEN":
        return 0

    key = fruit_type.lower()
    base = DEFAULT_BASELINE
    for k, d in BASE_SHELF_LIFE.items():
        if k in key:
            base = d
            break

    ratio, _ = fuzzy_shelf_life_ratio(p_fresh, temp_c)
    days = int(round(base * ratio))
    return max(0, days)

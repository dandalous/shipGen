/**
 * Evaluates a 1D cubic Bézier coordinate or its derivative at parameter t.
 */
function evalBezier1D(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function evalBezierDerivative1D(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

/**
 * Finds parameter t for a target X using Newton-Raphson iteration.
 */
function solveTForX(p0x, p1x, p2x, p3x, targetX, maxIterations = 8, epsilon = 1e-6) {
  // Initial guess using linear interpolation
  let t = (targetX - p0x) / (p3x - p0x);
  t = Math.max(0, Math.min(1, t));

  for (let i = 0; i < maxIterations; i++) {
    const currentX = evalBezier1D(p0x, p1x, p2x, p3x, t);
    const error = currentX - targetX;

    if (Math.abs(error) < epsilon) {
      return t;
    }

    const dx = evalBezierDerivative1D(p0x, p1x, p2x, p3x, t);
    if (Math.abs(dx) < 1e-8) break; // Avoid divide-by-zero on flat tangents

    t = t - error / dx;
    t = Math.max(0, Math.min(1, t)); // Clamp to valid range [0, 1]
  }

  return t;
}

/**
 * Evaluates Y for a given target X on a weighted/unweighted UE cubic segment.
 */
function evalUECubicSegment(k0, k1, targetX, isWeighted = true) {
  const dx = k1.x - k0.x;
  if (dx === 0) return k0.y;

  // 1. Calculate Control Point Lengths along X
  let len0 = dx / 3.0;
  let len1 = dx / 3.0;

  if (isWeighted) {
    if (k0.leavingTangentWeight > 0) len0 = k0.leavingTangentWeight;
    if (k1.arrivalTangentWeight > 0) len1 = k1.arrivalTangentWeight;
  }

  // 2. Build 2D Bézier Control Points
  const p0 = { x: k0.x, y: k0.y };
  const p1 = { x: k0.x + len0, y: k0.y + len0 * k0.leavingTangent };
  const p2 = { x: k1.x - len1, y: k1.y - len1 * k1.arrivalTangent };
  const p3 = { x: k1.x, y: k1.y };

  // 3. Solve for t where X(t) == targetX
  const t = solveTForX(p0.x, p1.x, p2.x, p3.x, targetX);

  // 4. Evaluate Y(t)
  return evalBezier1D(p0.y, p1.y, p2.y, p3.y, t);
}

/**
 * Converts UE FloatCurve raw array to Chart.js sample points.
 *
 * @param {Array<Array<number>>} ueKeys - [isCubic, X, Y, ArriveTan, ArriveWeight, LeaveTan, LeaveWeight]
 * @param {number} samplesPerSegment - Resolution of output samples
 */
function parseUECurveToChartJS(ueKeys, samplesPerSegment = 20) {
  if (!ueKeys || ueKeys.length === 0) return [];

  const keys = ueKeys.map((k) => ({
    isCubic: k[0],
    isWeighted: [k[4] != 0.0 || k[6] != 0.0],
    x: k[1],
    y: k[2],
    arrivalTangent: k[3],
    arrivalTangentWeight: k[4],
    leavingTangent: k[5],
    leavingTangentWeight: k[6],
  }));

  const chartPoints = [];

  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    const steps = k0.isCubic ? samplesPerSegment : 1;

    for (let step = 0; step < steps; step++) {
      const fraction = step / steps;
      const currentX = k0.x + fraction * (k1.x - k0.x);

      let currentY;
      if (k0.isCubic) {
        currentY = evalUECubicSegment(k0, k1, currentX, k0.isWeighted);
      } else {
        currentY = k0.y + fraction * (k1.y - k0.y);
      }

      chartPoints.push({ x: currentX, y: currentY });
    }
  }

  const lastKey = keys[keys.length - 1];
  chartPoints.push({ x: lastKey.x, y: lastKey.y });

  return chartPoints;
}

/**
 * Evaluates an interpsolated Y value at targetX from a sorted array of [{x, y}] points.
 * Uses linear interpolation between surrounding points.
 */
function interpsolateAtX(points, targetX) {
  if (!points || points.length === 0) return 0;
  if (targetX <= points[0].x) return points[0].y;
  if (targetX >= points[points.length - 1].x) return points[points.length - 1].y;

  // Binary search to find surrounding interval
  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].x === targetX) return points[mid].y;
    if (points[mid].x < targetX) low = mid + 1;
    else high = mid - 1;
  }

  const p0 = points[high];
  const p1 = points[low];

  // Linear interpolation between the two closest sampled points
  const t = (targetX - p0.x) / (p1.x - p0.x);
  return p0.y + t * (p1.y - p0.y);
}

/**
 * Extracts and sorts all unique X coordinates across multiple parsed point arrays.
 */
function getUnifiedXCoordinates(curves) {
  const xSet = new Set();
  for (const curve of curves) {
    for (const point of curve) {
      xSet.add(point.x);
    }
  }
  return Array.from(xSet).sort((a, b) => a - b);
}

/**
 * Mode 1: Merges multiple parsed UE curves into a single combined {x, y} curve
 * using an aggregation operation ('sum' | 'average' | 'min' | 'max').
 *
 * @param {Array<Array<{x: number, y: number}>>} curves - Array of parsed UE curves
 * @param {string} operation - Composite mode: 'sum' | 'average' | 'min' | 'max'
 * @returns {Array<{x: number, y: number}>} Single combined curve dataset
 */
function combineUECurvesToOne(curves, operation = "sum") {
  if (!curves || curves.length === 0) return [];
  if (curves.length === 1) return curves[0];

  const unifiedX = getUnifiedXCoordinates(curves);

  return unifiedX.map((x) => {
    const yValues = curves.map((curve) => interpsolateAtX(curve, x));

    let combinedY;
    switch (operation) {
      case "average":
        combinedY = yValues.reduce((acc, v) => acc + v, 0) / yValues.length;
        break;
      case "min":
        combinedY = Math.min(...yValues);
        break;
      case "max":
        combinedY = Math.max(...yValues);
        break;
      case "sum":
      default:
        combinedY = yValues.reduce((acc, v) => acc + v, 0);
        break;
    }

    return { x, y: combinedY };
  });
}

/**
 * Mode 2: Aligns multiple parsed UE curves onto a shared set of X-coordinates,
 * returning multi-series datasets suitable for separate Chart.js lines.
 *
 * @param {Array<Array<{x: number, y: number}>>} curves
 * @param {Array<string>} labels - Optional dataset labels
 * @returns {Array<Object>} Array of Chart.js dataset objects
 */
function alignUECurvesMultiSeries(curves, labels = []) {
  if (!curves || curves.length === 0) return [];

  const unifiedX = getUnifiedXCoordinates(curves);

  return curves.map((curve, index) => {
    const alignedData = unifiedX.map((x) => ({
      x,
      y: interpsolateAtX(curve, x),
    }));

    return {
      label: labels[index] || `Curve ${index + 1}`,
      data: alignedData,
    };
  });
}

/**
 * Evaluates a parsed UE curve at an arbitrary X position.
 *
 * @param {Array<{x: number, y: number}>} curve - Parsed Chart.js point array sorted by X.
 * @param {number} targetX - The arbitrary X position to query.
 * @param {Object} options - Extrapolation modes: 'clamp' | 'linear' | 'zero'
 * @returns {number} The evaluated Y value.
 */
function evaluateUECurve(curve, targetX, options = {}) {
  const { extrapolate = "clamp" } = options;

  if (!curve || curve.length === 0) return 0;

  const firstPoint = curve[0];
  const lastPoint = curve[curve.length - 1];

  // --- 1. Handle Out-of-Bounds Extrapolation ---
  if (targetX <= firstPoint.x) {
    if (extrapolate === "zero") return 0;
    if (extrapolate === "linear" && curve.length > 1) {
      const p1 = curve[1];
      const slope = (p1.y - firstPoint.y) / (p1.x - firstPoint.x);
      return firstPoint.y + slope * (targetX - firstPoint.x);
    }
    return firstPoint.y; // Default: Clamp (UE Default)
  }

  if (targetX >= lastPoint.x) {
    if (extrapolate === "zero") return 0;
    if (extrapolate === "linear" && curve.length > 1) {
      const p2 = curve[curve.length - 2];
      const slope = (lastPoint.y - p2.y) / (lastPoint.x - p2.x);
      return lastPoint.y + slope * (targetX - lastPoint.x);
    }
    return lastPoint.y; // Default: Clamp (UE Default)
  }

  // --- 2. Binary Search to Find Bounding Segment ---
  let low = 0;
  let high = curve.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midX = curve[mid].x;

    if (midX === targetX) {
      return curve[mid].y; // Exact match found
    }

    if (midX < targetX) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // At this point, `high` is the left bound and `low` is the right bound
  const p0 = curve[high];
  const p1 = curve[low];

  // --- 3. Linear interpolation Between Samples ---
  const t = (targetX - p0.x) / (p1.x - p0.x);
  return p0.y + t * (p1.y - p0.y);
}

/**
 * Blends two parsed UE curves into a single curve based on a bias percentage.
 * 
 * @param {Array<{x: number, y: number}>} curveA - First curve (0% bias target)
 * @param {Array<{x: number, y: number}>} curveB - Second curve (100% bias target)
 * @param {number} bias - Blend factor from 0.0 (0% -> 100% Curve A) to 1.0 (100% -> 100% Curve B)
 * @returns {Array<{x: number, y: number}>} Blended curve dataset for Chart.js
 */
function blendUECurves(curveA, curveB, bias = 0.5) {
  // Clamp bias between 0.0 (0%) and 1.0 (100%)
  const clampedBias = Math.max(0, Math.min(1, bias));

  // Fast paths for exact 0% and 100%
  if (clampedBias === 0) return curveA.map(p => ({ ...p }));
  if (clampedBias === 1) return curveB.map(p => ({ ...p }));

  // Collect and sort all unique X coordinates from both curves
  const xSet = new Set();
  if (curveA) curveA.forEach(p => xSet.add(p.x));
  if (curveB) curveB.forEach(p => xSet.add(p.x));
  const unifiedX = Array.from(xSet).sort((a, b) => a - b);

  // Blend Y values at each X coordinate
  return unifiedX.map(x => {
    // Evaluate Y on both curves (uses existing curve evaluation with clamping)
    const yA = evaluateUECurve(curveA, x, { extrapolate: 'clamp' });
    const yB = evaluateUECurve(curveB, x, { extrapolate: 'clamp' });

    // Linear interpolation: Y = Y_A * (1 - bias) + Y_B * bias
    const blendedY = yA + (yB - yA) * clampedBias;

    return { x, y: blendedY };
  });
}

function blendUERange(range, interp, bias) {
  return range[0] + ((range[1] - range[0]) * evaluateUECurve(interp, bias));
}

/**
 * Calculates the total area under a curve using the trapezoidal rule.
 * 
 * @param {Array<{x: number, y: number}>} curve - Array of point objects with 'x' and 'y' values.
 * @returns {number} The total area under the curve.
 */
function calculateCurveArea(curve, isAbsolute = false) {
  if (!Array.isArray(curve) || curve.length < 2) {
    return 0;
  }

  let totalArea = 0;

  for (let i = 0; i < curve.length - 1; i++) {
    const current = curve[i];
    const next = curve[i + 1];

    const dx = next.x - current.x; // Width of the interval
    const avgY = isAbsolute ? Math.abs((current.y + next.y)) / 2 : (current.y + next.y) / 2; // Average height

    // Area of trapezoid = width * average height
    totalArea += dx * avgY;
  }

  return totalArea;
}

// UE Keyframed Curves
// isCubic, X, Y, ArriveTan, ArriveWeight, LeaveTan, LeaveWeight
const interps = {
  linear: parseUECurveToChartJS([
    [false, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [false, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0],
  ]),
  eightyTwentyIncrease: parseUECurveToChartJS([
    [true, 0.0, 0.0, 0.99977005, 0.0, 0.99977005, 0.0],
    [true, 0.2, 0.15, 0.020336265, 0.0, 0.68228173, 0.0],
    [true, 0.55, 0.8, 1.7120018, 0.0, 0.78961885, 0.0],
    [true, 1.0, 1.0, 0.15827635, 0.0, 0.15827635, 0.0],
  ]),
  fastestIncrease: parseUECurveToChartJS([
    [true, 0.0, 0.0, 0.31228247, 0.0, 0.31228247, 0.0],
    [true, 0.15, 0.20000003, 2.1016095, 0.0, 2.1016095, 0.0],
    [false, 0.7, 0.9, 0.62173975, 0.0, 0.62173975, 0.0],
    [false, 1.0, 1.0, 0.15859462, 0.0, 0.15859462, 0.0]
  ]),
  fastIncrease: parseUECurveToChartJS([
    [true, 0.0, 0.0, 0.11933533, 0.0, 0.11933533, 0.0],
    [true, 0.5, 0.6, 1.4273598, 0.0, 1.4273598, 0.0],
    [true, 0.7, 0.85, 0.7198155, 0.0, 0.5996311, 0.0],
    [true, 1.0, 1.0, 0.5568982, 0.0, 0.5568982, 0.0]
  ]),
  relevantExtremesSharp: parseUECurveToChartJS([
    [true, 0.0, 0.0, 0.014516912, 0.0, 0.014516912, 0.0],
    [true, 0.2, 0.2, 1.5653703, 0.0, 1.5653703, 0.0],
    [true, 0.8, 0.65, 0.7006352, 0.0, 0.6235395, 0.0],
    [true, 1.0, 1.0, 0.47212306, 0.0, 0.47212306, 0.0]
  ]),
  relevantExtremes: parseUECurveToChartJS([
    [true, 0.0, 0.0, 0.014516912, 0.0, 0.014516912, 0.0],
    [true, 0.3, 0.4, 1.3806303, 0.0, 1.3806303, 0.0],
    [true, 0.7, 0.75, 1.368114, 0.0, 1.3312991, 0.0],
    [true, 1.0, 1.0, 0.47212306, 0.0, 0.47212306, 0.0]
  ]),
  slowestIncrease: parseUECurveToChartJS([
    [true, 0.0, 0.0, -0.009793764, 0.0, -0.009793764, 0.0],
    [true, 0.5, 0.35, 1.49291, 0.0, 1.49291, 0.0],
    [true, 0.7, 0.75, 1.9173164, 0.0, 1.9173164, 0.0],
    [true, 1.0, 1.0, 0.56861365, 0.0, 0.56861365, 0.0]
  ]),
  slowIncrease: parseUECurveToChartJS([
    [true, 0.0, 0.0, 0.33193496, 0.0, 0.33193496, 0.0],
    [true, 0.5, 0.42, 1.376541, 0.0, 1.376541, 0.0],
    [true, 0.7, 0.75, 1.1259788, 0.0, 0.86475396, 0.0],
    [true, 1.0, 1.0, 0.79227376, 0.0, 0.79227376, 0.0]
  ]),
  slowStartFastIncrease: parseUECurveToChartJS([
    [true, 0.0, 0.0, 0.73633724, 0.0, 0.73633724, 0.0],
    [true, 0.2, 0.15, 0.17444703, 0.0, 0.6289921, 0.0],
    [true, 0.45, 0.55, 2.09726, 0.0, 2.09726, 0.0],
    [true, 0.7, 0.9, 0.81818175, 0.0, 0.81818175, 0.0],
    [true, 1.0, 1.0, 0.09959691, 0.0, 0.09959691, 0.0]
  ]),
};

const curves = {
  gripBoost: { // linear(?) - Stability(?)
    min: parseUECurveToChartJS([
      [false, 0.0, 0.45, 0.0, 0.0, 0.0, 0.0],
      [true, 30.0, 0.45, -0.00012432545, 0.0, -0.00012432545, 0.0],
      [true, 60.0, 0.2, -0.008629269, 0.0, -0.008629269, 0.0],
      [true, 100.0, 0.0, -8.913733e-5, 0.0, -8.913733e-5, 0.0],
    ]),
    max: parseUECurveToChartJS([
      [false, 0.0, 0.45, 0.0, 0.0, 0.0, 0.0],
      [true, 60.0, 0.45, -0.00012432545, 0.0, -0.00012432545, 0.0],
      [true, 120.0, 0.2, -0.009737371, 0.0, -0.009737371, 0.0],
      [true, 160.0, 0.0, -8.913733e-5, 0.0, -8.912058e-5, 0.0],
    ]),
  },
  angularSpeed: { // slowIncrease - Steer
    min: parseUECurveToChartJS([
      [true, 300.0, 88.0, -0.00024442398, 0.0, -0.00024442398, 0.0],
      [true, 900.0, 72.0, -0.027335677, 0.0, -0.027335677, 0.0],
      [true, 1200.0, 68.0, 0.0, 0.0, 0.0, 0.0]
    ]),
    max: parseUECurveToChartJS([
      [true, 300.0, 100.0, 0.000101817306, 0.0, 0.000101817306, 0.0],
      [true, 899.2, 80.0, -0.03328433, 0.0, -0.03328433, 0.0],
      [true, 1200.0, 75.0, -2.9606665E-05, 0.0, -2.9606665E-05, 0.0]
    ]),
  },
  baseBoost: { // fastIncrease - Thrust
    min: parseUECurveToChartJS([
      [true, 0.0, 1.0, -0.0065984325, 0.0, -0.0065984325, 0.0],
      [true, 0.5, 1.2, 0.8119565, 0.0, 0.8119565, 0.0],
      [true, 2.8, 4.6, 0.0, 0.0, 0.0, 0.0],
      [false, 5.0, 4.6, 0.0, 0.0, 0.0, 0.0],
    ]),
    max: parseUECurveToChartJS([
      [true, 0.0, 3.0, -0.019849468, 0.0, -0.019849468, 0.0],
      [true, 0.5, 4.0, 3.7746482, 0.0, 3.7746482, 0.0],
      [true, 1.2, 7.0, -0.0023206505, 0.0, -0.0023206505, 0.0],
      [false, 5.0, 7.0, 0.0, 0.0, 0.0, 0.0],
    ]),
  },
  hyperBoost: { // slowStartFastIncrease - Thrust
    min: parseUECurveToChartJS([
      [true, 0.0, 0.5, -1.8105761, 0.0, -1.8105799, 0.0],
      [false, 0.99, -0.5, 0.0, 0.0, 0.0, 0.0],
      [true, 1.0, 6.0, -5.3025994, 0.0, -5.3026004, 0.0],
      [false, 3.0, 1.8, 0.0, 0.0, 0.0, 0.0],
      [false, 5.0, 1.8, 0.0, 0.0, 0.0, 0.0],
    ]),
    max: parseUECurveToChartJS([
      [true, 0.0, 1.5, -5.3358097, 0.0, -5.3358135, 0.0],
      [false, 0.99, -0.5, 0.0, 0.0, 0.0, 0.0],
      [true, 1.0, 11.0, -8.079093, 0.0, -8.079087, 0.0],
      [false, 3.0, 2.6, 0.0, 0.0, 0.0, 0.0],
      [false, 5.0, 2.6, 0.0, 0.0, 0.0, 0.0],
    ]),
  },
  heatDecreasePerSecBraking: { // linear(?) - Durability(?)
    min: parseUECurveToChartJS([
      [true, 0.0, 0.0, 13.8154, 0.0, 13.815412, 0.0],
      [false, 1.0, 8.0, 0.0, 0.0, 0.0, 0.0],
    ]),
    max: parseUECurveToChartJS([
      [true, 0.0, 0.0, 36.389168, 0.0, 36.389202, 0.0],
      [true, 1.0, 30.0, 0.8948785, 0.0, 0.8948791, 0.0],
    ])
  },
  heatLifeLossPerSec: parseUECurveToChartJS([
    [false, 0.0, 0.0, 0.0, 0.0, 0.0],
    [false, 0.8, 0.0, 0.0, 0.0, 0.0],
    [true, 0.81, 33.0, 0.0, 0.0, 0.0],
    [true, 1.0, 66.0, 273.8864, 0.0, 273.8864],
  ])
};

// UE Ranges
const statRanges = {
  maxLife: [150, 350],                  // slowestIncrease      - Durability
  autoHealSpeed: [0.4, 1.0],            // slowestIncrease      - Durability
  heatDecrease: [0, 19],                // slowestIncrease      - Durability
  heatIncrease: [38, 55],               // fastIncrease         - Thrust
  heatHyperIncrease: [0, 32],           // linear(?)            - Thrust
  topSpeed: [900, 1250],                // eightyTwentyIncrease - Top Speed
  flightTopSpeed: [750, 1100],          // eightyTwentyIncrease - Top Speed
  brakePower: [0.12, 0.35],             // slowIncrease         - Stability
  gripBoostMulti: [0, 0.55],            // linear(?)            - Stability
  angSpeedBraking: [1.05, 1.3],         // slowestIncrease      - Steer
  timeToMaxAngSpeedChg: [0.32, 0.12],   // slowIncrease         - Steer
  gripStrafeMulti: [0, 0.55],           // linear(?)            - Strafe
  strafeAccel: [9, 19],                 // relevantExtremes     - Strafe
  flightStrafeAccel: [9, 14],           // relevantExtremes     - Strafe
}

// Evaluations
const evalCurves = {
  baseBoost: Array.from({ length: 41 }, (_, i) => blendUECurves(curves.baseBoost.min, curves.baseBoost.max, evaluateUECurve(interps.fastIncrease, i / 40))),
  hyperBoost: Array.from({ length: 41 }, (_, i) => blendUECurves(curves.hyperBoost.min, curves.hyperBoost.max, evaluateUECurve(interps.slowStartFastIncrease, i / 40))),
  // heatDecreasePerSecBraking: Array.from({ length: 41 }, (_, i) => blendUECurves(curves.heatDecreasePerSecBraking.min, curves.heatDecreasePerSecBraking.max, evaluateUECurve(interps.linear, i / 40))),
  // gripBoost: Array.from({ length: 41 }, (_, i) => blendUECurves(curves.gripBoost.min, curves.gripBoost.max, i / 40)),
  // angularSpeed: Array.from({ length: 41 }, (_, i) => blendUECurves(curves.angularSpeed.min, curves.angularSpeed.max, evaluateUECurve(interps.slowIncrease, i / 40))),
};
const evalCurveCombos = {
  stackBoost: Array.from({ length: 41 }, (_, i) => combineUECurvesToOne([evalCurves.baseBoost[i], evalCurves.hyperBoost[i]])),
}

const gravAccel = 9.80665;
const evalRanges = {
  maxLife: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.maxLife, interps.slowestIncrease, i / 40)),
  autoHealSpeed: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.autoHealSpeed, interps.slowestIncrease, i / 40)),
  heatDecrease: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.heatDecrease, interps.slowestIncrease, i / 40)),
  heatIncrease: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.heatIncrease, interps.fastIncrease, i / 40)),
  heatHyperIncrease: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.heatHyperIncrease, interps.linear, i / 40)),
  baseBoostVelocity: Array.from({ length: 41 }, (_, i) => calculateCurveArea(evalCurves.baseBoost[i]) * gravAccel),
  hyperBoostVelocity: Array.from({ length: 41 }, (_, i) => calculateCurveArea(evalCurves.hyperBoost[i]) * gravAccel),
  stackBoostVelocity: Array.from({ length: 41 }, (_, i) => calculateCurveArea(evalCurveCombos.stackBoost[i]) * gravAccel),
  topSpeed: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.topSpeed, interps.eightyTwentyIncrease, i / 40)),
  flightTopSpeed: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.flightTopSpeed, interps.eightyTwentyIncrease, i / 40)),
  brakePower: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.brakePower, interps.slowIncrease, i / 40)),
  gripBoostMulti: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.gripBoostMulti, interps.linear, i / 40)),
  angSpeedBraking: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.angSpeedBraking, interps.slowestIncrease, i / 40)),
  timeToMaxAngSpeed: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.timeToMaxAngSpeedChg, interps.slowIncrease, i / 40)),
  gripStrafeMulti: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.gripStrafeMulti, interps.linear, i / 40)),
  strafeAccel: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.strafeAccel, interps.relevantExtremes, i / 40)),
  flightStrafeAccel: Array.from({ length: 41 }, (_, i) => blendUERange(statRanges.flightStrafeAccel, interps.relevantExtremes, i / 40)),
}
const evalRangeCombos = {
  heatStackIncrease: Array.from({ length: 41 }, (_, i) => evalRanges.heatIncrease[i] + evalRanges.heatHyperIncrease[i]),
}

const chartForceCurves = new Chart(document.getElementById("chart-force-curves").getContext("2d"), {
  type: "line",
  data: {
    datasets: [
      {
        label: "Boosting",
        data: evalCurves.baseBoost[0],
        fill: true,
        borderWidth: 2,
        borderDash: [6, 6],
        pointRadius: 0,
        pointHitRadius: 25,
        pointBorderWidth: 0,
      },
      {
        label: "Boosting",
        data: evalCurves.baseBoost[40],
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 25,
        pointBorderWidth: 0,
      },
      {
        label: "Hyperboosting",
        data: evalCurves.hyperBoost[0],
        fill: true,
        borderWidth: 2,
        borderDash: [6, 6],
        pointRadius: 0,
        pointHitRadius: 25,
        pointBorderWidth: 0,
      },
      {
        label: "Hyperboosting",
        data: evalCurves.hyperBoost[40],
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 25,
        pointBorderWidth: 0,
      },
      {
        label: "Stackboosting",
        data: combineUECurvesToOne([evalCurves.baseBoost[0], evalCurves.hyperBoost[0]]),
        fill: true,
        borderWidth: 2,
        borderDash: [6, 6],
        pointRadius: 0,
        pointHitRadius: 25,
        pointBorderWidth: 0,
      },
      {
        label: "Stackboosting",
        data: combineUECurvesToOne([evalCurves.baseBoost[40], evalCurves.hyperBoost[40]]),
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 25,
        pointBorderWidth: 0,
      },
    ],
  },
  options: {
    aspectRatio: 1,
    scales: {
      x: { type: "linear", position: "bottom" },
    },
    plugins: {
      legend: {
        display: false,
        labels: {
          font: {
            weight: "bold",
            size: 14,
          },
        },
      },
      tooltip: {
        callbacks: {
          title: function (ctx) {
            return `Time: ${ctx[0].parsed.x.toLocaleString(...extraFormat)}s`;
          },
          label: function (ctx) {
            const chartTable = (ctx.datasetIndex & 1 == 1) ? output.chart.comparison : output.chart.target;
            return [ctx.dataset.label, `${chartTable.id.innerHTML}: ${ctx.parsed.y.toLocaleString(...extraFormat)}G`];
          },
        },
      },
      dragData: {
        round: 1,
        showTooltip: true,
        onDragStart: function (e, element) {
          return false;
        },
        onDrag: function (e, dataset, i, value) {
          return false;
        },
        onDragEnd: function (e, dataset, i, value) {
          return false;
        },
        magnet: {
          to: Math.round,
        },
      },
    },
  },
});

// const chartAngleCurves = new Chart(document.getElementById("chart-angle-curves").getContext("2d"), {
//   type: "line",
//   data: {
//     datasets: [
//       {
//         label: "Ang Speed T.",
//         data: evalCurves.angularSpeed[0],
//         fill: true,
//         borderWidth: 2,
//         borderDash: [6, 6],
//         pointRadius: 0,
//         pointHitRadius: 25,
//         pointBorderWidth: 0,
//       },
//       {
//         label: "Ang Speed C.",
//         data: evalCurves.angularSpeed[40],
//         fill: true,
//         borderWidth: 2,
//         pointRadius: 0,
//         pointHitRadius: 25,
//         pointBorderWidth: 0,
//       },
//     ],
//   },
//   options:
//   {
//     aspectRatio: 1.33,
//     scales: {
//       x: { type: "linear", position: "bottom" },
//     },
//     plugins: {
//       legend: {
//         labels: {
//           font: {
//             weight: "bold",
//             size: 14,
//           },
//         },
//       },
//       tooltip: {
//         callbacks: {
//           title: function (ctx) {
//             const speed = getSpeeds(ctx[0].parsed.x);
//             return `Velocity: ${speed.kmh} km/h (${speed.mph} mph)`;
//           },
//           label: function (ctx) {
//             return `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString(...extraFormat)}°/s`;
//           },
//         },
//       },
//       dragData: {
//         round: 1,
//         showTooltip: true,
//         onDragStart: function (e, element) {
//           return false;
//         },
//         onDrag: function (e, dataset, i, value) {
//           return false;
//         },
//         onDragEnd: function (e, dataset, i, value) {
//           return false;
//         },
//         magnet: {
//           to: Math.round,
//         },
//       },
//     },
//   },
// });

const chartCurvesData = [
  {
    baseBoost: chartForceCurves.data.datasets[0],
    hyperBoost: chartForceCurves.data.datasets[2],
    stackBoost: chartForceCurves.data.datasets[4],
    // angularSpeed: chartAngleCurves.data.datasets[0],
  },
  {
    baseBoost: chartForceCurves.data.datasets[1],
    hyperBoost: chartForceCurves.data.datasets[3],
    stackBoost: chartForceCurves.data.datasets[5],
    // angularSpeed: chartAngleCurves.data.datasets[1],
  }
];

const chartRangesData = [
  {
    maxLife: document.getElementById("cell-target-maxlife"),
    autoHealSpeed: document.getElementById("cell-target-autohealspeed"),
    heatDecrease: document.getElementById("cell-target-heatdecrease"),
    heatIncrease: document.getElementById("cell-target-heatincrease"),
    heatHyperIncrease: document.getElementById("cell-target-heathyperincrease"),
    heatStackIncrease: document.getElementById("cell-target-heatstackincrease"),
    baseBoostVelocity: document.getElementById("cell-target-baseboostvelocity"),
    hyperBoostVelocity: document.getElementById("cell-target-hyperboostvelocity"),
    stackBoostVelocity: document.getElementById("cell-target-stackboostvelocity"),
    topSpeed: document.getElementById("cell-target-topspeed"),
    flightTopSpeed: document.getElementById("cell-target-flighttopspeed"),
    brakePower: document.getElementById("cell-target-brakepower"),
    gripBoostMulti: document.getElementById("cell-target-gripboostmulti"),
    angSpeedBraking: document.getElementById("cell-target-angspeedbraking"),
    timeToMaxAngSpeedChg: document.getElementById("cell-target-timetomaxangspeed"),
    gripStrafeMulti: document.getElementById("cell-target-gripstrafemulti"),
    strafeAccel: document.getElementById("cell-target-strafeaccel"),
    flightStrafeAccel: document.getElementById("cell-target-flightstrafeaccel"),
  },
  {
    maxLife: document.getElementById("cell-comparison-maxlife"),
    autoHealSpeed: document.getElementById("cell-comparison-autohealspeed"),
    heatDecrease: document.getElementById("cell-comparison-heatdecrease"),
    heatIncrease: document.getElementById("cell-comparison-heatincrease"),
    heatHyperIncrease: document.getElementById("cell-comparison-heathyperincrease"),
    heatStackIncrease: document.getElementById("cell-comparison-heatstackincrease"),
    baseBoostVelocity: document.getElementById("cell-comparison-baseboostvelocity"),
    hyperBoostVelocity: document.getElementById("cell-comparison-hyperboostvelocity"),
    stackBoostVelocity: document.getElementById("cell-comparison-stackboostvelocity"),
    topSpeed: document.getElementById("cell-comparison-topspeed"),
    flightTopSpeed: document.getElementById("cell-comparison-flighttopspeed"),
    brakePower: document.getElementById("cell-comparison-brakepower"),
    gripBoostMulti: document.getElementById("cell-comparison-gripboostmulti"),
    angSpeedBraking: document.getElementById("cell-comparison-angspeedbraking"),
    timeToMaxAngSpeedChg: document.getElementById("cell-comparison-timetomaxangspeed"),
    gripStrafeMulti: document.getElementById("cell-comparison-gripstrafemulti"),
    strafeAccel: document.getElementById("cell-comparison-strafeaccel"),
    flightStrafeAccel: document.getElementById("cell-comparison-flightstrafeaccel"),
  }
]

function randomizeChartCurvesColors() {
  const min = 0;
  const max = 192;
  chartForceCurves.data.datasets.forEach((data, i) => {
    const isOdd = (i & 1 == 1);
    const color = `rgb(${isOdd ? getRandomInt(min, max) : 255}, ${isOdd ? 255 : getRandomInt(min, max)}, ${getRandomInt(min, max)})`;
    const colorA = color.replace(/rgb/i, "rgba").replace(/\)/i, ", 0.15)");
    data.borderColor = color;
    data.backgroundColor = colorA;
  });
  // chartAngleCurves.data.datasets.forEach((data) => {
  //   const color = `rgb(${getRandomInt(min, max)}, ${getRandomInt(min, max)}, ${getRandomInt(min, max)})`;
  //   const colorA = color.replace(/rgb/i, "rgba").replace(/\)/i, ", 0.15)");
  //   data.borderColor = color;
  //   data.backgroundColor = colorA;
  // });
  chartForceCurves.update();
  // chartAngleCurves.update();
}
randomizeChartCurvesColors();
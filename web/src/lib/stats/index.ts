/**
 * Statistical helpers used across the site. Every function here is unit
 * tested, and the ones that mirror a Python reference (scipy, statsmodels,
 * PySAL esda) are checked against values that scripts/verify_stats.py
 * computes with those libraries.
 */
export * from "./bootstrap";
export * from "./correlation";
export * from "./multiple";
export * from "./proportion";
export * from "./random";
export * from "./regression";
export * from "./reliability";
export * from "./spatial";
export {
  erfc,
  gammaQ,
  lgamma,
  normalCdf,
  normalQuantile,
  normalSf,
  studentTCdf,
  studentTQuantile,
} from "./special";

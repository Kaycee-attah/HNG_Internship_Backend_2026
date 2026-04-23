// nlp.js — Rule-based natural language query parser
const { getCountryCode } = require("./countries");

/**
 * Parses a plain English query string into a set of filter conditions.
 * Returns null if the query cannot be interpreted.
 *
 * Supported patterns:
 *   Gender   : male, males, man, men, boy, boys, female, females, woman, women, girl, girls
 *   Age group: child, children, teenager, teen, teens, adult, adults, senior, seniors, elderly
 *   Young    : "young" → min_age=16, max_age=24 (for parsing only, not a stored age_group)
 *   Age range: "above N", "over N", "older than N" → min_age=N
 *              "below N", "under N", "younger than N" → max_age=N
 *   Country  : "from [country]", "in [country]" → country_id
 */
function parseQuery(q) {
  if (!q || typeof q !== "string") return null;

  const query = q.toLowerCase().trim();
  const filters = {};

  // ── Gender ─────────────────────────────────────────────────────────────────
  const hasMale = /\b(male|males|man|men|boy|boys)\b/.test(query);
  const hasFemale = /\b(female|females|woman|women|girl|girls)\b/.test(query);

  if (hasMale && !hasFemale) {
    filters.gender = "male";
  } else if (hasFemale && !hasMale) {
    filters.gender = "female";
  }
  // if both appear, no gender filter (e.g. "male and female teenagers")

  // ── "young" → ages 16–24 ───────────────────────────────────────────────────
  if (/\byoung\b/.test(query)) {
    filters.min_age = 16;
    filters.max_age = 24;
  }

  // ── Age groups ─────────────────────────────────────────────────────────────
  if (/\bchildren\b|\bchild\b/.test(query)) {
    filters.age_group = "child";
  } else if (/\bteenagers?\b|\bteens?\b/.test(query)) {
    filters.age_group = "teenager";
  } else if (/\badults?\b/.test(query)) {
    filters.age_group = "adult";
  } else if (/\bseniors?\b|\belderly\b/.test(query)) {
    filters.age_group = "senior";
  }

  // ── Numeric age thresholds ─────────────────────────────────────────────────
  // "above N" / "over N" / "older than N"
  const aboveMatch = query.match(/\b(?:above|over|older than)\s+(\d+)/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1], 10);
  }

  // "below N" / "under N" / "younger than N"
  const belowMatch = query.match(/\b(?:below|under|younger than)\s+(\d+)/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1], 10);
  }

  // "aged N" / "age N" → exact age range ±0 (treat as min+max)
  const agedMatch = query.match(/\b(?:aged?)\s+(\d+)\b/);
  if (agedMatch) {
    const age = parseInt(agedMatch[1], 10);
    filters.min_age = age;
    filters.max_age = age;
  }

  // ── Country ─────────────────────────────────────────────────────────────────
  // Match "from X" or "in X" where X is a country name
  const countryMatch = query.match(/\b(?:from|in)\s+([a-z][a-z\s']+?)(?:\s*$|\s+(?:and|with|above|below|over|under|aged?|who|that))/);
  if (countryMatch) {
    const raw = countryMatch[1].trim();
    const code = getCountryCode(raw);
    if (code) filters.country_id = code;
  }

  // Return null if nothing was parsed
  if (Object.keys(filters).length === 0) return null;

  return filters;
}

module.exports = { parseQuery };

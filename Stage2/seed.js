/**
 * seed.js — Seeds the database with profiles from the HNG-provided JSON file.
 *
 * Usage:
 *   node seed.js ./profiles.json
 *
 * The JSON file should be an array of profile objects with fields matching
 * the database schema. Re-running is safe — duplicates are skipped via
 * INSERT ... ON CONFLICT DO NOTHING.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { uuidv7 } = require("uuidv7");
const { getCountryName } = require("./countries");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

function classifyAge(age) {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
}

async function seed() {
  const filePath = process.argv[2] || "./profiles.json";
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    console.error(`❌ File not found: ${resolved}`);
    console.error("Usage: node seed.js ./profiles.json");
    process.exit(1);
  }

  let profiles;
  try {
    const raw = fs.readFileSync(resolved, "utf-8");
    profiles = JSON.parse(raw);
  } catch (e) {
    console.error("❌ Failed to parse JSON file:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(profiles)) {
    console.error("❌ JSON file must be an array of profile objects");
    process.exit(1);
  }

  console.log(`📦 Seeding ${profiles.length} profiles...`);

  let inserted = 0;
  let skipped = 0;

  for (const profile of profiles) {
    try {
      const id = profile.id || uuidv7();
      const country_name = profile.country_name || getCountryName(profile.country_id);
      const age_group = profile.age_group || classifyAge(profile.age);
      const created_at = profile.created_at || new Date().toISOString();

      const result = await pool.query(
        `INSERT INTO profiles
          (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [
          id,
          profile.name,
          profile.gender,
          profile.gender_probability,
          profile.age,
          age_group,
          profile.country_id,
          country_name,
          profile.country_probability,
          created_at,
        ]
      );

      if (result.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`⚠️  Error seeding profile "${profile.name}":`, err.message);
      skipped++;
    }
  }

  console.log(`✅ Done! Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

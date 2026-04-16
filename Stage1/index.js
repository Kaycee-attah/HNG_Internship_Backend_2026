require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { uuidv7 } = require("uuidv7");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id            TEXT PRIMARY KEY,
      name          TEXT UNIQUE NOT NULL,
      gender        TEXT,
      gender_probability NUMERIC,
      sample_size   INTEGER,
      age           INTEGER,
      age_group     TEXT,
      country_id    TEXT,
      country_probability NUMERIC,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("Database ready");
}

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Helpers ───────────────────────────────────────────────────────────────────
function classifyAge(age) {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
}

function formatProfile(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    gender_probability: parseFloat(row.gender_probability),
    sample_size: parseInt(row.sample_size),
    age: parseInt(row.age),
    age_group: row.age_group,
    country_id: row.country_id,
    country_probability: parseFloat(row.country_probability),
    created_at: new Date(row.created_at).toISOString(),
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/profiles
app.post("/api/profiles", async (req, res) => {
  const { name } = req.body;

  // 400 — missing or empty name
  if (name === undefined || name === null || name === "") {
    return res.status(400).json({ status: "error", message: "Missing or empty 'name' field" });
  }

  // 422 — non-string name
  if (typeof name !== "string") {
    return res.status(422).json({ status: "error", message: "Invalid 'name': must be a string" });
  }

  // Idempotency — return existing profile if name already stored
  const existing = await pool.query(
    "SELECT * FROM profiles WHERE LOWER(name) = LOWER($1)",
    [name]
  );
  if (existing.rows.length > 0) {
    return res.status(200).json({
      status: "success",
      message: "Profile already exists",
      data: formatProfile(existing.rows[0]),
    });
  }

  // Call all three APIs concurrently, identifying which one fails
  const [genderResult, agifyResult, nationalizeResult] = await Promise.allSettled([
    axios.get(`https://api.genderize.io?name=${encodeURIComponent(name)}`, { timeout: 5000 }).then(r => r.data),
    axios.get(`https://api.agify.io?name=${encodeURIComponent(name)}`, { timeout: 5000 }).then(r => r.data),
    axios.get(`https://api.nationalize.io?name=${encodeURIComponent(name)}`, { timeout: 5000 }).then(r => r.data),
  ]);

  if (genderResult.status === "rejected") {
    return res.status(502).json({ status: "502", message: "Genderize returned an invalid response" });
  }
  if (agifyResult.status === "rejected") {
    return res.status(502).json({ status: "502", message: "Agify returned an invalid response" });
  }
  if (nationalizeResult.status === "rejected") {
    return res.status(502).json({ status: "502", message: "Nationalize returned an invalid response" });
  }

  const genderData = genderResult.value;
  const agifyData = agifyResult.value;
  const nationalizeData = nationalizeResult.value;

  // Validate Genderize
  if (!genderData.gender || genderData.count === 0) {
    return res.status(502).json({ status: "502", message: "Genderize returned an invalid response" });
  }

  // Validate Agify
  if (agifyData.age === null || agifyData.age === undefined) {
    return res.status(502).json({ status: "502", message: "Agify returned an invalid response" });
  }

  // Validate Nationalize
  if (!nationalizeData.country || nationalizeData.country.length === 0) {
    return res.status(502).json({ status: "502", message: "Nationalize returned an invalid response" });
  }

  // Process data
  const gender = genderData.gender;
  const gender_probability = genderData.probability;
  const sample_size = genderData.count;

  const age = agifyData.age;
  const age_group = classifyAge(age);

  // Pick country with highest probability
  const topCountry = nationalizeData.country.reduce((best, c) =>
    c.probability > best.probability ? c : best
  );
  const country_id = topCountry.country_id;
  const country_probability = topCountry.probability;

  const id = uuidv7();
  const created_at = new Date().toISOString();

  // Store in DB
  const result = await pool.query(
    `INSERT INTO profiles (id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, name, gender, gender_probability, sample_size, age, age_group, country_id, country_probability, created_at]
  );

  return res.status(201).json({
    status: "success",
    data: formatProfile(result.rows[0]),
  });
});

// GET /api/profiles — list with optional filters
app.get("/api/profiles", async (req, res) => {
  const { gender, country_id, age_group } = req.query;

  let query = "SELECT * FROM profiles WHERE 1=1";
  const params = [];

  if (gender) {
    params.push(gender.toLowerCase());
    query += ` AND LOWER(gender) = $${params.length}`;
  }
  if (country_id) {
    params.push(country_id.toUpperCase());
    query += ` AND UPPER(country_id) = $${params.length}`;
  }
  if (age_group) {
    params.push(age_group.toLowerCase());
    query += ` AND LOWER(age_group) = $${params.length}`;
  }

  query += " ORDER BY created_at DESC";

  const result = await pool.query(query, params);

  return res.status(200).json({
    status: "success",
    count: result.rows.length,
    data: result.rows.map(formatProfile),
  });
});

// GET /api/profiles/:id
app.get("/api/profiles/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query("SELECT * FROM profiles WHERE id = $1", [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ status: "error", message: "Profile not found" });
  }

  return res.status(200).json({
    status: "success",
    data: formatProfile(result.rows[0]),
  });
});

// DELETE /api/profiles/:id
app.delete("/api/profiles/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query("DELETE FROM profiles WHERE id = $1 RETURNING id", [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ status: "error", message: "Profile not found" });
  }

  return res.status(204).send();
});

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialise database:", err);
    process.exit(1);
  });

module.exports = app;

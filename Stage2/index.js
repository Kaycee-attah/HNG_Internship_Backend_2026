require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { uuidv7 } = require("uuidv7");
const { Pool } = require("pg");
const { getCountryName } = require("./countries");
const { parseQuery } = require("./nlp");

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
      id                  TEXT PRIMARY KEY,
      name                VARCHAR UNIQUE NOT NULL,
      gender              VARCHAR,
      gender_probability  FLOAT,
      age                 INT,
      age_group           VARCHAR,
      country_id          VARCHAR(2),
      country_name        VARCHAR,
      country_probability FLOAT,
      created_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add country_name column if upgrading from Stage 1
  await pool.query(`
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_name VARCHAR
  `).catch(() => {});

  // Remove sample_size column from Stage 1 (not in Stage 2 schema)
  // We keep it if it exists to avoid breaking anything but don't expose it

  // Indexes for performance — no full-table scans
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age ON profiles(age)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_age_group ON profiles(age_group)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_id ON profiles(country_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_gender_probability ON profiles(gender_probability)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profiles_country_probability ON profiles(country_probability)`);

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
    age: parseInt(row.age),
    age_group: row.age_group,
    country_id: row.country_id,
    country_name: row.country_name || getCountryName(row.country_id),
    country_probability: parseFloat(row.country_probability),
    created_at: new Date(row.created_at).toISOString(),
  };
}

// Build filter + sort + pagination query
function buildProfilesQuery(queryParams) {
  const {
    gender, age_group, country_id,
    min_age, max_age,
    min_gender_probability, min_country_probability,
    sort_by, order,
    page, limit,
  } = queryParams;

  const conditions = [];
  const params = [];

  if (gender) {
    params.push(gender.toLowerCase());
    conditions.push(`LOWER(gender) = $${params.length}`);
  }
  if (age_group) {
    params.push(age_group.toLowerCase());
    conditions.push(`LOWER(age_group) = $${params.length}`);
  }
  if (country_id) {
    params.push(country_id.toUpperCase());
    conditions.push(`UPPER(country_id) = $${params.length}`);
  }
  if (min_age !== undefined) {
    params.push(parseInt(min_age));
    conditions.push(`age >= $${params.length}`);
  }
  if (max_age !== undefined) {
    params.push(parseInt(max_age));
    conditions.push(`age <= $${params.length}`);
  }
  if (min_gender_probability !== undefined) {
    params.push(parseFloat(min_gender_probability));
    conditions.push(`gender_probability >= $${params.length}`);
  }
  if (min_country_probability !== undefined) {
    params.push(parseFloat(min_country_probability));
    conditions.push(`country_probability >= $${params.length}`);
  }

  const WHERE = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Sorting
  const ALLOWED_SORT = ["age", "created_at", "gender_probability"];
  const sortField = ALLOWED_SORT.includes(sort_by) ? sort_by : "created_at";
  const sortOrder = order === "asc" ? "ASC" : "DESC";

  // Pagination
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
  const offset = (pageNum - 1) * limitNum;

  params.push(limitNum);
  const limitPlaceholder = params.length;
  params.push(offset);
  const offsetPlaceholder = params.length;

  const dataQuery = `
    SELECT * FROM profiles
    ${WHERE}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${limitPlaceholder} OFFSET $${offsetPlaceholder}
  `;

  // Count query uses same conditions but no pagination
  const countQuery = `SELECT COUNT(*) FROM profiles ${WHERE}`;
  const countParams = params.slice(0, params.length - 2); // remove limit/offset

  return { dataQuery, countQuery, params, countParams, pageNum, limitNum };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// ⚠️ IMPORTANT: /search must be declared BEFORE /:id
// GET /api/profiles/search — natural language query
app.get("/api/profiles/search", async (req, res, next) => {
  try {
    const { q, page, limit } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({ status: "error", message: "Missing or empty 'q' query parameter" });
    }

    const filters = parseQuery(q);

    if (!filters) {
      return res.status(400).json({ status: "error", message: "Unable to interpret query" });
    }

    const { dataQuery, countQuery, params, countParams, pageNum, limitNum } = buildProfilesQuery({
      ...filters,
      page,
      limit,
    });

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, countParams),
    ]);

    return res.status(200).json({
      status: "success",
      page: pageNum,
      limit: limitNum,
      total: parseInt(countResult.rows[0].count),
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles — advanced filtering, sorting, pagination
app.get("/api/profiles", async (req, res, next) => {
  try {
    const { dataQuery, countQuery, params, countParams, pageNum, limitNum } = buildProfilesQuery(req.query);

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, countParams),
    ]);

    return res.status(200).json({
      status: "success",
      page: pageNum,
      limit: limitNum,
      total: parseInt(countResult.rows[0].count),
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/profiles/:id
app.get("/api/profiles/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM profiles WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Profile not found" });
    }

    return res.status(200).json({
      status: "success",
      data: formatProfile(result.rows[0]),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/profiles
app.post("/api/profiles", async (req, res, next) => {
  try {
    const { name } = req.body;

    if (name === undefined || name === null || name === "") {
      return res.status(400).json({ status: "error", message: "Missing or empty 'name' field" });
    }
    if (typeof name !== "string") {
      return res.status(422).json({ status: "error", message: "Invalid 'name': must be a string" });
    }

    // Idempotency
    const existing = await pool.query(
      "SELECT * FROM profiles WHERE LOWER(name) = LOWER($1)", [name]
    );
    if (existing.rows.length > 0) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: formatProfile(existing.rows[0]),
      });
    }

    // Call all three APIs concurrently
    const [genderResult, agifyResult, nationalizeResult] = await Promise.allSettled([
      axios.get(`https://api.genderize.io?name=${encodeURIComponent(name)}`, { timeout: 5000 }).then(r => r.data),
      axios.get(`https://api.agify.io?name=${encodeURIComponent(name)}`, { timeout: 5000 }).then(r => r.data),
      axios.get(`https://api.nationalize.io?name=${encodeURIComponent(name)}`, { timeout: 5000 }).then(r => r.data),
    ]);

    if (genderResult.status === "rejected")
      return res.status(502).json({ status: "error", message: "Genderize returned an invalid response" });
    if (agifyResult.status === "rejected")
      return res.status(502).json({ status: "error", message: "Agify returned an invalid response" });
    if (nationalizeResult.status === "rejected")
      return res.status(502).json({ status: "error", message: "Nationalize returned an invalid response" });

    const genderData = genderResult.value;
    const agifyData = agifyResult.value;
    const nationalizeData = nationalizeResult.value;

    if (!genderData.gender || genderData.count === 0)
      return res.status(502).json({ status: "error", message: "Genderize returned an invalid response" });
    if (agifyData.age === null || agifyData.age === undefined)
      return res.status(502).json({ status: "error", message: "Agify returned an invalid response" });
    if (!nationalizeData.country || nationalizeData.country.length === 0)
      return res.status(502).json({ status: "error", message: "Nationalize returned an invalid response" });

    const topCountry = nationalizeData.country.reduce((best, c) =>
      c.probability > best.probability ? c : best
    );

    const id = uuidv7();
    const created_at = new Date().toISOString();
    const country_name = getCountryName(topCountry.country_id);

    const result = await pool.query(
      `INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        id, name,
        genderData.gender, genderData.probability,
        agifyData.age, classifyAge(agifyData.age),
        topCountry.country_id, country_name, topCountry.probability,
        created_at,
      ]
    );

    return res.status(201).json({
      status: "success",
      data: formatProfile(result.rows[0]),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/profiles/:id
app.delete("/api/profiles/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM profiles WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: "error", message: "Profile not found" });
    }
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

// 500 global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ status: "error", message: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
initDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch((err) => { console.error("DB init failed:", err); process.exit(1); });

module.exports = app;

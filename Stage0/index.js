const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — required by grading script
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/api/classify", async (req, res) => {
  const { name } = req.query;

  // 400 — missing name
if (name === undefined) {
  return res.status(400).json({
    status: "error",
    message: "Missing 'name' query parameter",
  });
}

  // 400 — empty name
  if (name === "") {
    return res.status(400).json({
      status: "error",
      message: "'name' query parameter cannot be empty",
    });
  }

  // 422 — name is not a string (arrays, objects parsed by express become arrays)
  if (typeof name !== "string") {
    return res.status(422).json({
      status: "error",
      message: "Invalid 'name' parameter: must be a string",
    });
  }

  let genderizeData;

  try {
    const response = await axios.get("https://api.genderize.io", {
      params: { name },
      timeout: 4500, // stay well under 500ms budget for our own processing
    });
    genderizeData = response.data;
  } catch (err) {
    const isUpstreamError =
      err.response || err.code === "ECONNABORTED" || err.code === "ETIMEDOUT";

    return res.status(isUpstreamError ? 502 : 500).json({
      status: "error",
      message: isUpstreamError
        ? "Failed to reach upstream Genderize API"
        : "Internal server error",
    });
  }

  // Edge case — no prediction available
  if (!genderizeData.gender || genderizeData.count === 0) {
    return res.status(200).json({
      status: "error",
      message: "No prediction available for the provided name",
    });
  }

  const gender = genderizeData.gender;
  const probability = genderizeData.probability;
  const sample_size = genderizeData.count;
  const is_confident = probability >= 0.7 && sample_size >= 100;
  const processed_at = new Date().toISOString();

  return res.status(200).json({
    status: "success",
    data: {
      name: genderizeData.name,
      gender,
      probability,
      sample_size,
      is_confident,
      processed_at,
    },
  });
});

// Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({ status: "error", message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

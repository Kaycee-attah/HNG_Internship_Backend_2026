# Stage 1 — Data Persistence & API Design

A REST API that calls three external APIs (Genderize, Agify, Nationalize), aggregates the results, and stores profiles in a PostgreSQL database.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/profiles` | Create a new profile by name |
| `GET` | `/api/profiles` | List all profiles (filterable) |
| `GET` | `/api/profiles/:id` | Get a single profile by UUID |
| `DELETE` | `/api/profiles/:id` | Delete a profile (204) |

---

### POST `/api/profiles`
```json
// Request
{ "name": "ella" }

// 201 Created
{
  "status": "success",
  "data": {
    "id": "uuid-v7",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DRC",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00.000Z"
  }
}

// If name already exists → 200 + "Profile already exists"
```

### GET `/api/profiles`
Optional query params: `gender`, `country_id`, `age_group` (all case-insensitive)
```
GET /api/profiles?gender=male&country_id=NG
```

### DELETE `/api/profiles/:id`
Returns `204 No Content` on success.

---

## Error Responses

| Status | Trigger |
|--------|---------|
| 400 | Missing or empty `name` |
| 422 | `name` is not a string |
| 404 | Profile not found |
| 502 | External API (Genderize / Agify / Nationalize) returned invalid data |

```json
{ "status": "error", "message": "<description>" }
```

---

## Run Locally

```bash
# 1. Create a .env file
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/hng_stage1" > .env

# 2. Install & start
npm install
npm start
```

The app auto-creates the `profiles` table on first run.

## Deploy on Railway

1. Push this folder to GitHub
2. Create a Railway project → add a **PostgreSQL** service
3. Deploy the app service, set Root Directory to `Stage1`
4. Railway automatically injects `DATABASE_URL`

## Stack
- Node.js + Express
- PostgreSQL (via `pg`)
- UUID v7 (`uuidv7` package)
- Axios, CORS

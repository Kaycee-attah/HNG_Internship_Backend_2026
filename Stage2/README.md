# Stage 2 — Intelligence Query Engine

Advanced filtering, sorting, pagination, and natural language search on top of the Stage 1 profiles system.

**Live API:** `https://YOUR_URL.up.railway.app`

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profiles` | List profiles with filtering, sorting, pagination |
| `GET` | `/api/profiles/search?q=` | Natural language query |
| `GET` | `/api/profiles/:id` | Get a single profile |
| `POST` | `/api/profiles` | Create a profile (calls 3 external APIs) |
| `DELETE` | `/api/profiles/:id` | Delete a profile (204) |

---

## GET /api/profiles

Supports all filters simultaneously.

### Filters
| Param | Type | Example |
|-------|------|---------|
| `gender` | string | `male` or `female` |
| `age_group` | string | `child`, `teenager`, `adult`, `senior` |
| `country_id` | string | `NG`, `GH`, `KE` |
| `min_age` | number | `25` |
| `max_age` | number | `40` |
| `min_gender_probability` | float | `0.8` |
| `min_country_probability` | float | `0.5` |

### Sorting
| Param | Values |
|-------|--------|
| `sort_by` | `age`, `created_at`, `gender_probability` |
| `order` | `asc`, `desc` (default: `desc`) |

### Pagination
| Param | Default | Max |
|-------|---------|-----|
| `page` | `1` | — |
| `limit` | `10` | `50` |

### Example
```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

### Response (200)
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [
    {
      "id": "uuid-v7",
      "name": "emmanuel",
      "gender": "male",
      "gender_probability": 0.99,
      "age": 34,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.85,
      "created_at": "2026-04-01T12:00:00.000Z"
    }
  ]
}
```

---

## GET /api/profiles/search

Natural language query endpoint. Rule-based parsing only — no AI.

### Example queries
```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=females above 30
GET /api/profiles/search?q=adult males from kenya
GET /api/profiles/search?q=teenagers from ghana
GET /api/profiles/search?q=seniors above 65
```

### Response (200) — same shape as GET /api/profiles

### Error — uninterpretable query
```json
{ "status": "error", "message": "Unable to interpret query" }
```

---

## Natural Language Parsing Approach

### How it works

The parser in `nlp.js` applies a sequence of regex rules to lowercase query text, extracting filters which are then passed directly to the same SQL builder used by `GET /api/profiles`.

### Supported keywords and their mappings

**Gender**
| Keyword | Maps to |
|---------|---------|
| `male`, `males`, `man`, `men`, `boy`, `boys` | `gender=male` |
| `female`, `females`, `woman`, `women`, `girl`, `girls` | `gender=female` |
| Both present (e.g. "male and female") | No gender filter applied |

**Age groups**
| Keyword | Maps to |
|---------|---------|
| `child`, `children` | `age_group=child` |
| `teenager`, `teen`, `teens` | `age_group=teenager` |
| `adult`, `adults` | `age_group=adult` |
| `senior`, `seniors`, `elderly` | `age_group=senior` |

**Age ranges**
| Phrase | Maps to |
|--------|---------|
| `young` | `min_age=16`, `max_age=24` (parsing only, not a stored age_group) |
| `above N`, `over N`, `older than N` | `min_age=N` |
| `below N`, `under N`, `younger than N` | `max_age=N` |
| `aged N` | `min_age=N`, `max_age=N` |

**Country**
| Phrase | Maps to |
|--------|---------|
| `from [country name]` | `country_id=[ISO code]` |
| `in [country name]` | `country_id=[ISO code]` |

Supports 80+ countries. Country names are matched case-insensitively.

### Example mappings
| Query | Filters produced |
|-------|-----------------|
| `young males` | `gender=male, min_age=16, max_age=24` |
| `females above 30` | `gender=female, min_age=30` |
| `people from angola` | `country_id=AO` |
| `adult males from kenya` | `gender=male, age_group=adult, country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager, min_age=17` |
| `seniors from nigeria` | `age_group=senior, country_id=NG` |

### Limitations

- **No synonym expansion** — "guys", "lads", "gals", "chaps" etc. are not recognised
- **No compound country names via articles** — "the United States" works but "the US of A" doesn't
- **No OR logic** — all parsed filters are ANDed together; cannot search for "males OR females"
- **No negation** — "not from nigeria" or "not male" is not supported
- **"young" is special** — it maps to ages 16–24 for parsing only and does NOT correspond to any stored age_group value
- **Ambiguous age + age_group conflicts** — if you specify both `young` and `teenager`, both filters apply simultaneously which may narrow results unexpectedly
- **Single country only** — cannot parse "from nigeria or ghana"
- **No fuzzy matching** — typos in country names will fail silently (no filter applied)
- **No language detection** — only English is supported

---

## Run Locally

```bash
cd Stage2
npm install

# Create .env
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/hng_stage2" > .env

# Start server
npm start

# Seed database (download profiles.json from Airtable first)
node seed.js ./profiles.json
```

## Deploy on Railway

1. Push to GitHub
2. Railway project → + New → GitHub Repo → HNG_Internship_Backend_2026
3. Settings → Root Directory → `Stage2`
4. Add PostgreSQL service → DATABASE_URL is injected automatically
5. Generate Domain

## Stack
- Node.js + Express
- PostgreSQL (via `pg`) with 7 indexes for performance
- UUID v7
- Rule-based NLP (no external libraries)
- CORS: `Access-Control-Allow-Origin: *`

# Stage 0 — Name Gender Classification API

Integrates with [Genderize.io](https://genderize.io) to predict the gender of a name with confidence scoring.

## Endpoint

```
GET /api/classify?name={name}
```

## Success Response

```json
{
  "status": "success",
  "data": {
    "name": "john",
    "gender": "male",
    "probability": 0.99,
    "sample_size": 1234,
    "is_confident": true,
    "processed_at": "2026-04-12T10:00:00.000Z"
  }
}
```

## Error Responses

| Status | Trigger |
|--------|---------|
| 400 | Missing or empty `name` parameter |
| 422 | `name` is not a string |
| 502 | Genderize API unreachable |
| 500 | Internal server error |

Error shape:
```json
{ "status": "error", "message": "<description>" }
```

Edge case — no prediction:
```json
{ "status": "error", "message": "No prediction available for the provided name" }
```

## Run Locally

```bash
cd Stage0
npm install
npm start
# Server on http://localhost:3000
```

## Stack
- Node.js + Express
- Axios
- CORS enabled (`Access-Control-Allow-Origin: *`)

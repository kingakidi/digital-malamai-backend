# Digital Malamai — Backend API

NestJS + TypeORM + MySQL API for Digital Malamai.

**Base URL:** `http://localhost:3001/api/v1` (set `PORT=3001` in `.env`)  
**Swagger:** `http://localhost:3001/api-docs`  
**Postman:** [`postman/Digital-Malamai-API.postman_collection.json`](./postman/Digital-Malamai-API.postman_collection.json)

Project-wide setup and deployment: [`../README.md`](../README.md)

---

## Setup

```bash
cp .env.example .env   # PORT=3001, CORS_ORIGINS includes http://localhost:3000
npm install
npm run start:dev
```

Superadmin is seeded on startup from `SUPER_ADMIN_*` env vars.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with watch |
| `npm run build` | Compile |
| `npm run start:prod` | Production server |
| `npm run migration:generate` | Generate migration from entity diff |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:run:prod` | Apply migrations from compiled `dist/` (Docker) |
| `npm run migration:revert` | Revert last migration |
| `npm run migration:show` | List migration status |

---

## Database migrations

TypeORM migrations manage production schema. **Do not use `synchronize` in production.**

| Variable | Development | Production |
|----------|-------------|------------|
| `DB_SYNCHRONIZE` | `true` (auto-sync entities) | `false` |
| `DB_MIGRATIONS_RUN` | `false` | `true` (apply on startup) |

### Fresh production database

```bash
mysql -e "CREATE DATABASE digital_malamai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

export DB_SYNCHRONIZE=false
export DB_MIGRATIONS_RUN=true

npm run migration:run
npm run seed:superadmin   # if available, or rely on startup seed
npm run start:prod
```

### Local development

With `DB_SYNCHRONIZE=true`, entity changes apply on `npm run start:dev`. When entities change for production, generate a migration:

```bash
npm run migration:generate
```

Review the file under `src/database/migrations/`, then commit it.

If your local DB was created with `synchronize`, you do not need to run the initial migration locally. For new production deploys, run `migration:run` on an empty database.

---

## Docker

Single-stage image (Node 22 Alpine) with entrypoint: wait for DB → optional migrations → start API. Pass all config via `docker run -e` or `--env-file`.

```bash
docker build -t digital-malamai-api .

docker run --rm -p 3001:3001 \
  -e PORT=3001 \
  -e NODE_ENV=production \
  -e API_PREFIX=api/v1 \
  -e SWAGGER_PATH=api-docs \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USERNAME=your-user \
  -e DB_PASSWORD=your-password \
  -e DB_DATABASE=digital_malamai \
  -e DB_SYNCHRONIZE=false \
  -e DB_MIGRATIONS_RUN=true \
  -e JWT_SECRET=your-secret \
  -e JWT_EXPIRES_IN=7d \
  -e CORS_ORIGINS=http://localhost:3000 \
  -e SUPER_ADMIN_EMAIL=admin@example.com \
  -e SUPER_ADMIN_PASSWORD=ChangeMe123! \
  # ... see .env for full list (SMTP, OTP, Flutterwave, etc.)
  digital-malamai-api
```

| File | Purpose |
|------|---------|
| `Dockerfile` | `npm ci` → build → prune dev deps |
| `docker-entrypoint.sh` | DB wait → `migration:run:prod` (if `DB_MIGRATIONS_RUN=true`) → `node dist/main.js` |
| `.dockerignore` | Excludes `node_modules`, `.env`, tests |

**Health check:** `GET /api/v1/health`

---

## Error responses

All API responses share one envelope. **`message` is always human-readable**; `error` is a machine-friendly category (or validation array).

```jsonc
// success
{ "status": true,  "message": "Login successful", "data": { } }

// error (single)
{ "status": false, "message": "Access code has already been used", "error": "Conflict" }

// error (validation)
{ "status": false, "message": "Validation failed", "error": ["email must be a string"] }
```

The global filter (`src/common/filters/http-exception.filter.ts`) preserves each exception's specific text in `message`. Validation failures keep `message: "Validation failed"` with field errors in `error`.

Common examples:

| Scenario | Status | `message` |
|----------|--------|-----------|
| Reused access code | 409 | `Access code has already been used` |
| Wrong password | 401 | `Invalid credentials` |
| Inactive account | 401 | `Account is inactive` |
| Course not found | 404 | `Course {id} not found or not published` |
| Already enrolled | 409 | `You are already enrolled in this course` |

Every thrown exception includes an explicit message — no bare `new XException()` calls.

---

## Key environment variables

See `.env.example` for the full list. Groups:

| Group | Examples |
|-------|----------|
| Core | `PORT` (default `3001`), `API_PREFIX`, `JWT_SECRET`, `JWT_EXPIRES_IN` |
| Database | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`, `DB_SYNCHRONIZE`, `DB_MIGRATIONS_RUN` |
| CORS | `CORS_ORIGINS` — include `http://localhost:3000` for local frontend |
| SMTP / OTP | `SMTP_*`, `OTP_TTL_MINUTES`, `OTP_HASH_SECRET` |
| WhatsApp / SMS | `WHATSAPP_DEFAULT_PROVIDER`, `TWILIO_*`, `META_WHATSAPP_*`, `SMS_ENABLED`, `TERMII_*` |
| Flutterwave | `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH`, `FLUTTERWAVE_BASE_URL` |
| S3 (optional) | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_REGION` |
| Seed | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_FIRST_NAME`, `SUPER_ADMIN_LAST_NAME` |

---

## License

MIT

# Orders ingestion service

Backend assessment implementation: ingest an orders file (~10k rows), store the raw upload in **Google Cloud Storage** with **Application Default Credentials (ADC)**, then parse, validate, and persist orders into a **sharded PostgreSQL** setup. Built with **Node.js**, **Express**, **Sequelize**, and **`@google-cloud/storage`**.

---

## What it does

| Spec area | This repo |
|-----------|-----------|
| File format | **CSV** (assessment allows CSV *or* Excel; CSV was chosen). |
| GCS + ADC | Upload via `Storage()` with no key file; credentials from ADC only. |
| Data | `order_id`, `customer_id`, `order_date`, `order_amount`, `status` (+ optional `raw_data` in schema). Invalid rows are **skipped**, counted, and **logged**. |
| Postgres | Four separate databases (application-level sharding), indexes on `customer_id`, `order_date`, `status`. |
| Scale | File read as a **stream**; inserts in **batches** (500) with a **transaction per shard**; file is not fully loaded into memory. |
| API | **`POST /upload-orders`** (required). `GET /orders/:orderId`, `GET /orders?customerId=`, **`GET /orders/count-by-database?database=`** (DB name, `DB_SHARD_N_URL`, or index `0`–`3`), `GET /health` are extra. |
| Tests | **Jest** — `npm test`; specs under `tests/`. |

Deliverables from the brief: **README** (this file), **`schema/schema.sql`**, **`.env.example`**, source in-repo. **Jest** unit tests are included under **`tests/`** (assessment bonus area).

---

## Setup

1. **Node.js** (v18+ recommended) and **PostgreSQL**.

2. **Create four databases** (names can differ; URLs must match `.env`):

   ```sql
   CREATE DATABASE orders_shard_0;
   CREATE DATABASE orders_shard_1;
   CREATE DATABASE orders_shard_2;
   CREATE DATABASE orders_shard_3;
   ```

3. **Install and configure**

   ```bash
   npm install
   ```

   Copy `.env.example` to `.env` and set:

   - `DB_SHARD_0_URL` … `DB_SHARD_3_URL` — Postgres connection strings (one per shard).
   - `GCS_BUCKET_NAME` — bucket name only (no `gs://` prefix).
   - `PORT` — optional; defaults to `3000`.

4. **Google ADC** — so GCS calls work without committing keys:

   ```bash
   gcloud auth application-default login
   ```

   In GCP deployments, use **workload identity** or the runtime’s service account the same way: still no JSON keys in the repo.

5. **Run**

   ```bash
   node index.js
   ```

   For file-watch reload on Windows: `npm run dev`.

   On startup, Sequelize **`sync()`** creates or updates the `orders` table on each shard. Ensure the DB user can run DDL for that first boot.

6. **Folders** — uploads go to `tmp/`, logs to `logs/`. Create them if the process errors with missing directory.

7. **API docs** — **`/api-docs`** (Swagger).

---

## Tests

Unit tests use **Jest** (`npm test`). Specs live under **`tests/`** (controller, ingestion service, repository, upload, parse, shard helpers).

```bash
npm test
```

---

## Project layout

| Path | Purpose |
|------|---------|
| `middleware/uploadMiddleware.js` | Multer (`tmp/` uploads). |
| `routes/orderRoutes.js` | HTTP routes. |
| `controllers/orderController.js` | Request/response only. |
| `services/orderIngestionService.js` | Orchestrates GCS upload + CSV ingest. |
| `services/uploadService.js` | GCS client calls. |
| `services/parseService.js` | Stream CSV, validate, batched inserts. |
| `services/shardService.js` | Shard index from `customer_id`. |
| `repositories/orderRepository.js` | Sequelize reads + order count by shard database name. |
| `config/` | DB shards, GCS bucket. |
| `models/order.js` | Sequelize `Order` model (per shard). |
| `utils/logger.js` | Winston logging. |
| `schema/schema.sql` | Reference DDL. |

---

## Sharding (required explanation)

- **Approach:** Application-level sharding — **four PostgreSQL databases**, same schema each, selected in code.
- **Shard key:** `customer_id`.
- **Routing:** `customer_id` is hashed (MD5, UTF-8), first 8 hex characters interpreted as a 32-bit integer, **`% 4`** → shard index `0`–`3`. Implementation: `services/shardService.js`; connections: `config/db.js`.
- **Correct shard on write:** Rows are grouped by computed shard before **`bulkCreate`** so each insert hits the right database.

Changing shard count means editing `SHARD_ENV_KEYS` in `config/db.js` and adding matching `DB_SHARD_*_URL` entries; rebalancing existing data is a separate migration problem.

---

## API

**`POST /upload-orders`** — `multipart/form-data`, field name **`file`**. Response includes upload path in GCS (`gcsPath`), `processed`, and `failed` row counts.

Example:

```bash
curl -X POST http://localhost:3000/upload-orders -F "file=@orders.csv"
```

Optional endpoints: `GET /orders/:orderId`, `GET /orders?customerId=<id>`, **`GET /orders/count-by-database?database=`** — `database` may be the **Postgres DB name** from your URL (e.g. `orders_shard_1`), the literal **`DB_SHARD_1_URL`**-style key, or a **numeric shard index** `0`–`3`. Response: `{ database, shardIndex, count }`.

---

## CSV format

Header row required. Columns (assessment field names; amount is `order_amount` in CSV/code):

| Column | Required | Notes |
|--------|----------|--------|
| `order_id` | No | If empty, a UUID is generated. |
| `customer_id` | Yes | Drives shard routing. |
| `order_date` | Yes | Must parse as a JavaScript `Date`. |
| `order_amount` | Yes | Numeric. |
| `status` | Yes | String. |

Malformed rows are skipped, included in `failed`, and written to logs (`Invalid row skipped`).

---

## Logging and errors

Upload / ingestion lifecycle, batch progress, processing summary, and failed/skipped rows are logged (Winston → console and `logs/`). Upload, parse, and database failures surface as errors in logs and typically **`500`** from `POST /upload-orders` with a short message in the body.

---

## Design trade-offs (short)

- **CSV only** — simpler streaming path than Excel for the target size.
- **Four shards via env URLs** — clear routing; not the same as Postgres native partitioning, but matches “multiple databases + routing.”
- **`ignoreDuplicates` on bulk insert** — duplicate `order_id` in a shard does not fail the whole batch; adjust if you need strict idempotency.
- **Layering** — HTTP (`controllers` + `routes`), uploads (`middleware`), ingestion orchestration (`orderIngestionService`), persistence (`repositories` + `parseService` for writes), and infra (`config`).

---

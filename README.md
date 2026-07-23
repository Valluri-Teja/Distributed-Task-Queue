# Distributed Task Queue

A production-grade distributed task queue built with Redis, FastAPI, and Python multiprocessing. Similar to how Celery or Amazon SQS work internally — built from scratch to understand the fundamentals.

**Live Dashboard:** https://distributed-task-queue.netlify.app  
**GitHub:** https://github.com/Valluri-Teja/Distributed-Task-Queue

---

## What it does

Clients submit tasks (send email, resize image, generate report) via a REST API. Tasks are stored in Redis priority queues and consumed by a pool of 3 parallel workers. Failed tasks are automatically retried with exponential backoff, and tasks that exhaust retries go to a dead letter queue for inspection and replay.

---

## Architecture
---

## Features

- **Priority scheduling** — two Redis lists (high/normal), workers always drain high first via BRPOPLPUSH
- **At-least-once delivery** — BRPOPLPUSH moves tasks to processing_queue atomically; watchdog recovers crashed worker tasks
- **Auto-retry with exponential backoff + jitter** — prevents thundering herd on retries
- **Dead letter queue** — failed tasks never silently lost; replay endpoint to requeue after bug fixes
- **Input validation** — Pydantic Literal types reject unknown task types; 10KB payload limit
- **Rate limiting** — 100 requests/min per IP via slowapi
- **Structured logging** — timestamps, log levels, worker context on every log line
- **systemd services** — API and worker auto-restart on EC2 reboot
- **Live monitoring dashboard** — throughput chart, task type breakdown, worker utilization, recent task feed
- **Load tested** — 52 req/sec, 7500+ tasks, 50 concurrent users via Locust
- **5 pytest unit tests** — queue priority, backoff math, DLQ routing

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI, Uvicorn |
| Queue | Redis 7 (BRPOPLPUSH pattern) |
| Workers | Python multiprocessing |
| Validation | Pydantic v2, slowapi |
| Frontend | React + Vite + Recharts |
| Reverse proxy | Nginx + SSL |
| Process manager | systemd |
| CI/CD | GitHub Actions |
| Cloud | AWS EC2 (t3.micro, Mumbai) |
| Frontend hosting | Netlify |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tasks` | Submit a task |
| GET | `/tasks/{id}` | Get task result |
| GET | `/stats` | Live queue stats |
| GET | `/stats/history` | Last 10 mins of throughput data |
| GET | `/analytics` | Task type counts, worker utilization, recent feed |
| GET | `/dead-letter` | View failed tasks |
| DELETE | `/dead-letter` | Clear dead letter queue |
| POST | `/dead-letter/replay` | Requeue all failed tasks |

---

## Interview Q&A

**Why multiprocessing over asyncio?**  
Our tasks are CPU-bound simulations (image resize, report generation) that hold the Python GIL. asyncio only helps I/O-bound tasks and does not give true parallelism for CPU work due to the GIL. multiprocessing spawns separate OS processes, each with their own GIL, giving real CPU parallelism. If tasks were pure I/O (HTTP calls, DB queries), asyncio would be the right choice.

**What happens if a worker dies mid-task?**  
Without protection, the task would be lost. We use the BRPOPLPUSH pattern: when a worker picks up a task, Redis atomically moves it from the queue to a processing_queue list. A watchdog background task runs every 30 seconds and scans processing_queue for tasks stuck longer than 60 seconds. Those tasks are requeued automatically. This guarantees at-least-once delivery even under worker failure.

**Why 52 req/sec specifically?**  
The bottleneck is Redis round-trip latency, not worker CPU. Each task submission involves one LPUSH to Redis and one response. At 52 req/sec we are saturating the single-threaded Redis event loop on a t3.micro instance. Adding more workers would not increase throughput past this point without upgrading Redis or batching inserts. The workers themselves were idle during the load test — the API layer was the ceiling.

**Why exponential backoff with jitter?**  
Immediate retries into a failing dependency hammer the service and delay recovery. Exponential backoff gives the dependency time to recover. Jitter prevents the thundering herd problem — all 3 workers retrying at the exact same millisecond and overwhelming the recovering service together.

---

## Local Setup

```bash
# 1. Start Redis
docker run -d --name redis-task-queue -p 6379:6379 redis

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start API
python -m uvicorn api:app --reload --port 8000

# 4. Start workers (separate terminal)
python worker.py

# 5. Start dashboard (separate terminal)
cd dashboard && npm install && npm run dev
```

Or run everything with Docker Compose:
```bash
docker-compose up --build
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `FAILURE_RATE` | `0.0` | Simulated failure rate for testing (0.0-1.0) |

---

## Load Test Results

Tested with Locust against live EC2 deployment:

- **Throughput:** 52 req/sec sustained
- **Concurrent users:** 50
- **Tasks processed:** 7,500+
- **Bottleneck:** Redis round-trip latency on t3.micro (not worker CPU)

---

## Resume Bullet

> Designed at-least-once task delivery with BRPOPLPUSH acknowledgment, exponential backoff retry, watchdog crash recovery, and dead-letter routing. Validated via Locust load test sustaining 52 req/sec across 7,500+ tasks. Deployed on AWS EC2 with Nginx, SSL, systemd, GitHub Actions CI/CD, and a React monitoring dashboard with live throughput charts.

---

## Project Structure
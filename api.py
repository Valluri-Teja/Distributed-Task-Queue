from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
from task_queue import (
    push_task, get_task_result, get_queue_stats, get_analytics,
    get_dead_letter_tasks, clear_dead_letter, replay_dead_letter,
    recover_stalled_tasks, r
)
import logging
import json
import asyncio
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)


async def watchdog_loop():
    while True:
        try:
            recovered = recover_stalled_tasks()
            if recovered > 0:
                logger.warning("Watchdog recovered %d stalled tasks", recovered)
        except Exception as e:
            logger.error("Watchdog error: %s", e)
        await asyncio.sleep(30)


async def stats_snapshot_loop():
    prev_processed = 0
    while True:
        try:
            stats = get_queue_stats()
            current_processed = stats["total_tasks_processed"]
            throughput = max(0, current_processed - prev_processed)
            prev_processed = current_processed
            snapshot = {
                "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
                "throughput": throughput,
                "queued": stats["high_priority_queue"] + stats["normal_queue"],
                "processing": stats["processing"],
                "dead": stats["dead_letter_queue"],
            }
            r.lpush("stats_history", json.dumps(snapshot))
            r.ltrim("stats_history", 0, 59)
        except Exception as e:
            logger.error("Stats snapshot error: %s", e)
        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    watchdog = asyncio.create_task(watchdog_loop())
    snapshotter = asyncio.create_task(stats_snapshot_loop())
    logger.info("Watchdog and stats snapshotter started")
    yield
    watchdog.cancel()
    snapshotter.cancel()


app = FastAPI(title="Task Queue API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    task_type: Literal["send_email", "resize_image", "failing_task", "generate_report", "data_sync"]
    payload: Optional[dict] = {}
    priority: int = 1

    @field_validator("payload")
    @classmethod
    def payload_size_limit(cls, v):
        if len(json.dumps(v)) > 10_000:
            raise ValueError("Payload too large. Maximum size is 10KB.")
        return v

    @field_validator("priority")
    @classmethod
    def priority_must_be_valid(cls, v):
        if v not in (1, 2):
            raise ValueError("Priority must be 1 (normal) or 2 (high).")
        return v


@app.post("/tasks")
@limiter.limit("100/minute")
def create_task(request: Request, body: TaskRequest):
    """Submit a new task"""
    task_id = push_task(body.task_type, body.payload, body.priority)
    logger.info("Task created | id=%s type=%s priority=%d", task_id, body.task_type, body.priority)
    return {"message": "Task added!", "task_id": task_id}


@app.get("/tasks/{task_id}")
def get_task(task_id: str):
    """Get status + result of a specific task"""
    result = get_task_result(task_id)
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task_id": task_id, "result": result}


@app.get("/stats")
def get_stats():
    """Live queue stats"""
    return get_queue_stats()


@app.get("/stats/history")
def get_stats_history():
    """Last 60 snapshots for throughput chart"""
    raw = r.lrange("stats_history", 0, -1)
    snapshots = [json.loads(s) for s in raw]
    snapshots.reverse()
    return {"history": snapshots}


@app.get("/analytics")
def get_analytics_endpoint():
    """Task type breakdown, worker utilization, recent task feed"""
    return get_analytics()


@app.get("/dead-letter")
def get_dead_letter():
    """See all failed tasks"""
    return {"failed_tasks": get_dead_letter_tasks()}


@app.delete("/dead-letter")
def clear_dead_letter_endpoint():
    """Clear dead letter queue"""
    return clear_dead_letter()


@app.post("/dead-letter/replay")
def replay_dead_letter_endpoint():
    """Requeue all dead letter tasks"""
    replayed = replay_dead_letter()
    logger.info("Replayed %d dead letter tasks", replayed)
    return {"message": f"Replayed {replayed} tasks back to queue"}


@app.get("/")
def root():
    return {"message": "Task Queue API is running! Go to /docs to test it."}

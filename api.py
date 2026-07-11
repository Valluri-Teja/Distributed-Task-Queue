from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
from task_queue import (
    push_task, get_task_result, get_queue_stats,
    get_dead_letter_tasks, clear_dead_letter, replay_dead_letter,
    recover_stalled_tasks, r
)
import logging
import json
import asyncio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


async def watchdog_loop():
    """
    Background watchdog — runs every 30 seconds.
    Finds tasks stuck in processing_queue longer than TASK_TIMEOUT_SECONDS
    and requeues them. This is what guarantees at-least-once delivery
    even when workers crash mid-task.
    """
    while True:
        try:
            recovered = recover_stalled_tasks()
            if recovered > 0:
                logger.warning("Watchdog recovered %d stalled tasks", recovered)
        except Exception as e:
            logger.error("Watchdog error: %s", e)
        await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start watchdog on startup
    task = asyncio.create_task(watchdog_loop())
    logger.info("Watchdog started")
    yield
    # Cancel watchdog on shutdown
    task.cancel()
    logger.info("Watchdog stopped")


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
    """
    Requeue all dead letter tasks back to normal queue.
    Use this after fixing a bug that caused mass failures.
    """
    replayed = replay_dead_letter()
    logger.info("Replayed %d dead letter tasks", replayed)
    return {"message": f"Replayed {replayed} tasks back to queue"}


@app.get("/")
def root():
    return {"message": "Task Queue API is running! Go to /docs to test it."}

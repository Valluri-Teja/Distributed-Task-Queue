from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Literal, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from task_queue import push_task, get_task_result, r
import logging
import json

# --- Structured logging (replaces all print statements) ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# --- Rate limiter (max 100 requests/min per IP) ---
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Task Queue API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    # Only allow known task types — no random strings accepted
    task_type: Literal["send_email", "resize_image", "failing_task", "generate_report", "data_sync"]
    payload: Optional[dict] = {}
    priority: int = 1

    # Prevent massive payloads crashing the system
    @field_validator("payload")
    @classmethod
    def payload_size_limit(cls, v):
        if len(json.dumps(v)) > 10_000:  # 10KB max
            raise ValueError("Payload too large. Maximum size is 10KB.")
        return v

    # Priority must be 1 (normal) or 2 (high) only
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
    task = get_task_result(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Also attach result if task is completed
    if task.get("status") == "completed":
        result = get_task_result(task_id)
        if result:
            task["result"] = result

    return task


@app.get("/stats")
def get_stats():
    """See queue stats + metrics"""
    durations = r.lrange("task_durations", 0, -1)
    durations = [float(d) for d in durations]
    avg_duration = round(sum(durations) / len(durations), 2) if durations else 0
    total_processed = r.get("total_tasks_processed") or 0

    return {
        "high_priority_queue": r.llen("high_priority_queue"),
        "normal_queue": r.llen("normal_queue"),
        "dead_letter_queue": r.llen("dead_letter_queue"),
        "total_tasks_processed": int(total_processed),
        "avg_processing_time_seconds": avg_duration,
    }


@app.get("/dead-letter")
def get_dead_letter_tasks():
    """See all failed tasks"""
    tasks = r.lrange("dead_letter_queue", 0, -1)
    return {"failed_tasks": [json.loads(t) for t in tasks]}


@app.get("/")
def root():
    return {"message": "Task Queue API is running! Go to /docs to test it."}

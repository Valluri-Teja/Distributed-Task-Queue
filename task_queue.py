import redis
import json
import os
import logging
import uuid
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

HIGH_PRIORITY_QUEUE = "high_priority_queue"
NORMAL_QUEUE = "normal_queue"
PROCESSING_QUEUE = "processing_queue"
DEAD_LETTER_QUEUE = "dead_letter_queue"
COMPLETED_SET = "completed"
TASK_TIMEOUT_SECONDS = 60


def push_task(task_type: str, task_data: dict, priority: int = 1, retries: int = 0):
    task_id = str(uuid.uuid4())
    task = {
        "id": task_id,
        "type": task_type,
        "payload": task_data,
        "priority": priority,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "retries": retries,
        "status": "pending"
    }
    payload = json.dumps(task)
    if priority == 2:
        r.lpush(HIGH_PRIORITY_QUEUE, payload)
    else:
        r.lpush(NORMAL_QUEUE, payload)
    logger.info("Task pushed | id=%s type=%s priority=%d", task_id, task_type, priority)
    return task_id


def pop_task():
    result = r.brpoplpush(HIGH_PRIORITY_QUEUE, PROCESSING_QUEUE, timeout=0.5)
    if not result:
        result = r.brpoplpush(NORMAL_QUEUE, PROCESSING_QUEUE, timeout=0.5)
    if result:
        task = json.loads(result)
        r.hset("task_heartbeat", task["id"], datetime.now(timezone.utc).isoformat())
        return task
    return None


def acknowledge_task(task_id: str):
    tasks = r.lrange(PROCESSING_QUEUE, 0, -1)
    for t in tasks:
        try:
            if json.loads(t).get("id") == task_id:
                r.lrem(PROCESSING_QUEUE, 1, t)
                break
        except Exception:
            pass
    r.hdel("task_heartbeat", task_id)


def complete_task(task_id: str, task_type: str = None, worker: str = None, result: dict = None):
    acknowledge_task(task_id)
    r.sadd(COMPLETED_SET, task_id)

    # Store result
    r.hset("task_results", task_id, json.dumps(result or {"status": "completed"}))
    r.expire("task_results", 86400)

    # Track task type counts
    if task_type:
        r.hincrby("task_type_counts", task_type, 1)

    # Track worker utilization
    if worker:
        r.hincrby("worker_counts", worker, 1)

    # Add to recent task feed (keep last 20)
    feed_entry = json.dumps({
        "id": task_id,
        "type": task_type or "unknown",
        "status": "completed",
        "worker": worker or "unknown",
        "duration": result.get("duration_seconds") if result else None,
        "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
    })
    r.lpush("recent_tasks", feed_entry)
    r.ltrim("recent_tasks", 0, 19)

    logger.info("Task completed | id=%s", task_id)


def fail_task(task: dict, error: str):
    acknowledge_task(task["id"])
    task["last_error"] = error
    task["status"] = "dead"
    r.lpush(DEAD_LETTER_QUEUE, json.dumps(task))

    # Track in recent feed
    feed_entry = json.dumps({
        "id": task["id"],
        "type": task.get("type", "unknown"),
        "status": "failed",
        "worker": "unknown",
        "duration": None,
        "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
    })
    r.lpush("recent_tasks", feed_entry)
    r.ltrim("recent_tasks", 0, 19)

    logger.error("Task dead | id=%s error=%s", task["id"], error)


def recover_stalled_tasks():
    now = datetime.now(timezone.utc)
    tasks = r.lrange(PROCESSING_QUEUE, 0, -1)
    recovered = 0
    for payload in tasks:
        try:
            task = json.loads(payload)
            task_id = task["id"]
            heartbeat = r.hget("task_heartbeat", task_id)
            if heartbeat:
                picked_at = datetime.fromisoformat(heartbeat)
                if picked_at.tzinfo is None:
                    picked_at = picked_at.replace(tzinfo=timezone.utc)
                age_seconds = (now - picked_at).total_seconds()
                if age_seconds > TASK_TIMEOUT_SECONDS:
                    logger.warning("Recovering stalled task | id=%s age=%.0fs", task_id, age_seconds)
                    r.lrem(PROCESSING_QUEUE, 1, payload)
                    r.hdel("task_heartbeat", task_id)
                    task["retries"] = task.get("retries", 0) + 1
                    task["status"] = "pending"
                    r.lpush(NORMAL_QUEUE, json.dumps(task))
                    recovered += 1
        except Exception as e:
            logger.error("Watchdog error | error=%s", e)
    return recovered


def replay_dead_letter():
    tasks = r.lrange(DEAD_LETTER_QUEUE, 0, -1)
    replayed = 0
    for payload in tasks:
        try:
            task = json.loads(payload)
            task["retries"] = 0
            task["status"] = "pending"
            task.pop("last_error", None)
            r.lpush(NORMAL_QUEUE, json.dumps(task))
            replayed += 1
        except Exception as e:
            logger.error("Replay error | error=%s", e)
    r.delete(DEAD_LETTER_QUEUE)
    return replayed


def get_task_result(task_id: str):
    result = r.hget("task_results", task_id)
    return json.loads(result) if result else None


def get_queue_stats():
    durations = r.lrange("task_durations", 0, -1)
    floats = [float(d) for d in durations] if durations else []
    avg = round(sum(floats) / len(floats), 2) if floats else 0
    return {
        "high_priority_queue": r.llen(HIGH_PRIORITY_QUEUE),
        "normal_queue": r.llen(NORMAL_QUEUE),
        "processing": r.llen(PROCESSING_QUEUE),
        "completed": r.scard(COMPLETED_SET),
        "dead_letter_queue": r.llen(DEAD_LETTER_QUEUE),
        "total_tasks_processed": int(r.get("total_tasks_processed") or 0),
        "avg_processing_time_seconds": avg,
    }


def get_analytics():
    """Returns task type counts, worker utilization, and recent task feed."""
    type_counts = r.hgetall("task_type_counts")
    worker_counts = r.hgetall("worker_counts")
    recent_raw = r.lrange("recent_tasks", 0, -1)
    recent = [json.loads(t) for t in recent_raw]
    return {
        "task_type_counts": {k: int(v) for k, v in type_counts.items()},
        "worker_counts": {k: int(v) for k, v in worker_counts.items()},
        "recent_tasks": recent,
    }


def get_dead_letter_tasks():
    return [json.loads(t) for t in r.lrange(DEAD_LETTER_QUEUE, 0, -1)]


def clear_dead_letter():
    r.delete(DEAD_LETTER_QUEUE)
    return {"message": "Dead letter queue cleared"}

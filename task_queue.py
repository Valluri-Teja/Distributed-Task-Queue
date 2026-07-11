import redis
import json
import os
import logging
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
PROCESSING_QUEUE = "processing_queue"  # BRPOPLPUSH target — tasks here are in-flight
DEAD_LETTER_QUEUE = "dead_letter_queue"
COMPLETED_SET = "completed"
TASK_TIMEOUT_SECONDS = 60  # tasks stuck longer than this are assumed crashed


def push_task(task_type: str, task_data: dict, priority: int = 1, retries: int = 0):
    """Push a task to the appropriate priority queue."""
    task_id = task_data.get("id") if isinstance(task_data, dict) and "id" in task_data else None
    if not task_id:
        import uuid
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
    """
    Pop a task using BRPOPLPUSH pattern.

    BRPOPLPUSH atomically:
    1. Pops from high_priority_queue (or normal_queue)
    2. Pushes to processing_queue in the same atomic operation

    This means if the worker crashes after popping but before completing,
    the task is still in processing_queue and can be recovered by the watchdog.
    This guarantees at-least-once delivery.
    """
    # Check high priority first
    result = r.brpoplpush(HIGH_PRIORITY_QUEUE, PROCESSING_QUEUE, timeout=0.5)
    if not result:
        # Fall back to normal queue
        result = r.brpoplpush(NORMAL_QUEUE, PROCESSING_QUEUE, timeout=0.5)
    if result:
        task = json.loads(result)
        # Store timestamp so watchdog knows when task was picked up
        r.hset("task_heartbeat", task["id"], datetime.now(timezone.utc).isoformat())
        logger.info("Task popped | id=%s type=%s", task["id"], task.get("type"))
        return task
    return None


def acknowledge_task(task_id: str):
    """
    Remove task from processing_queue after successful completion.
    Called by worker after process_task() succeeds.
    """
    # Remove from processing queue (find and remove the task JSON)
    tasks = r.lrange(PROCESSING_QUEUE, 0, -1)
    for t in tasks:
        try:
            if json.loads(t).get("id") == task_id:
                r.lrem(PROCESSING_QUEUE, 1, t)
                break
        except Exception:
            pass
    r.hdel("task_heartbeat", task_id)


def complete_task(task_id: str, result: dict = None):
    """Mark task as completed and store result."""
    acknowledge_task(task_id)
    r.sadd(COMPLETED_SET, task_id)
    r.hset("task_results", task_id,
           json.dumps(result or {"status": "completed"}))
    r.expire("task_results", 86400)  # 24h TTL
    logger.info("Task completed | id=%s", task_id)


def fail_task(task: dict, error: str):
    """Move task to dead letter queue after max retries."""
    acknowledge_task(task["id"])
    task["last_error"] = error
    task["status"] = "dead"
    r.lpush(DEAD_LETTER_QUEUE, json.dumps(task))
    logger.error("Task dead | id=%s retries=%d error=%s",
                 task["id"], task.get("retries", 0), error)


def recover_stalled_tasks():
    """
    Watchdog function — scans processing_queue for tasks that have been
    there longer than TASK_TIMEOUT_SECONDS (worker likely crashed).
    Requeues them so they are not lost.

    Interview answer: This is what makes the system fault-tolerant.
    Without this, a crashed worker = lost task. With this, we guarantee
    at-least-once delivery even under worker failure.
    """
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
                # Make picked_at timezone-aware if needed
                if picked_at.tzinfo is None:
                    picked_at = picked_at.replace(tzinfo=timezone.utc)
                age_seconds = (now - picked_at).total_seconds()

                if age_seconds > TASK_TIMEOUT_SECONDS:
                    logger.warning(
                        "Recovering stalled task | id=%s age=%.0fs",
                        task_id, age_seconds
                    )
                    # Remove from processing queue
                    r.lrem(PROCESSING_QUEUE, 1, payload)
                    r.hdel("task_heartbeat", task_id)
                    # Requeue it
                    task["retries"] = task.get("retries", 0) + 1
                    task["status"] = "pending"
                    r.lpush(NORMAL_QUEUE, json.dumps(task))
                    recovered += 1
        except Exception as e:
            logger.error("Error in watchdog | error=%s", e)

    if recovered > 0:
        logger.info("Watchdog recovered %d stalled tasks", recovered)
    return recovered


def replay_dead_letter():
    """
    Requeue all tasks from dead letter queue back to normal queue.
    Useful for retrying after fixing a bug that caused mass failures.
    """
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
            logger.error("Error replaying task | error=%s", e)
    r.delete(DEAD_LETTER_QUEUE)
    logger.info("Replayed %d tasks from dead letter queue", replayed)
    return replayed


def get_task_result(task_id: str):
    """Get stored result for a completed task."""
    result = r.hget("task_results", task_id)
    return json.loads(result) if result else None


def get_queue_stats():
    """Return live queue stats."""
    return {
        "high_priority_queue": r.llen(HIGH_PRIORITY_QUEUE),
        "normal_queue": r.llen(NORMAL_QUEUE),
        "processing": r.llen(PROCESSING_QUEUE),
        "completed": r.scard(COMPLETED_SET),
        "dead_letter_queue": r.llen(DEAD_LETTER_QUEUE),
        "total_tasks_processed": int(r.get("total_tasks_processed") or 0),
        "avg_processing_time_seconds": _get_avg_duration(),
    }


def _get_avg_duration() -> float:
    durations = r.lrange("task_durations", 0, -1)
    if not durations:
        return 0.0
    floats = [float(d) for d in durations]
    return round(sum(floats) / len(floats), 2)


def get_dead_letter_tasks():
    """Return all tasks in dead letter queue."""
    return [json.loads(t) for t in r.lrange(DEAD_LETTER_QUEUE, 0, -1)]


def clear_dead_letter():
    """Clear dead letter queue."""
    r.delete(DEAD_LETTER_QUEUE)
    return {"message": "Dead letter queue cleared"}

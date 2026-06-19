import redis
import json
import os
from datetime import datetime

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))

r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)

HIGH_PRIORITY_QUEUE = "high_priority_queue"
NORMAL_QUEUE = "normal_queue"
DEAD_LETTER_QUEUE = "dead_letter_queue"
PROCESSING_SET = "processing"
COMPLETED_SET = "completed"


def push_task(task_id: str, task_data: dict, priority: str = "normal"):
    task = {
        "id": task_id,
        "data": task_data,
        "priority": priority,
        "created_at": datetime.now().isoformat(),
        "retries": 0,
        "status": "pending"
    }
    payload = json.dumps(task)
    if priority == "high":
        r.lpush(HIGH_PRIORITY_QUEUE, payload)
    else:
        r.lpush(NORMAL_QUEUE, payload)
    print(f"Task {task_id} pushed to {priority} queue")
    return task


def pop_task():
    result = r.brpop([HIGH_PRIORITY_QUEUE, NORMAL_QUEUE], timeout=1)
    if result:
        _, payload = result
        task = json.loads(payload)
        r.sadd(PROCESSING_SET, task["id"])
        return task
    return None


def complete_task(task_id: str, result: dict = None):
    r.srem(PROCESSING_SET, task_id)
    r.sadd(COMPLETED_SET, task_id)
    # Store result so GET /tasks/{id} can return it
    if result is not None:
        r.hset("task_results", task_id, json.dumps(result))
    else:
        r.hset("task_results", task_id, json.dumps({"status": "completed"}))
    # Expire result after 24 hours so Redis doesn't fill up forever
    r.expire("task_results", 86400)


def fail_task(task: dict, error: str):
    task["retries"] = task.get("retries", 0) + 1
    task["last_error"] = error
    if task["retries"] >= 3:
        task["status"] = "dead"
        r.lpush(DEAD_LETTER_QUEUE, json.dumps(task))
        r.srem(PROCESSING_SET, task["id"])
        print(f"Task {task['id']} moved to dead letter queue after {task['retries']} retries")
    else:
        task["status"] = "retry"
        r.lpush(NORMAL_QUEUE, json.dumps(task))
        r.srem(PROCESSING_SET, task["id"])
        print(f"Task {task['id']} requeued (attempt {task['retries']})")


def get_task_result(task_id: str):
    result = r.hget("task_results", task_id)
    if result:
        return json.loads(result)
    return None


def get_queue_stats():
    return {
        "high_priority_pending": r.llen(HIGH_PRIORITY_QUEUE),
        "normal_pending": r.llen(NORMAL_QUEUE),
        "processing": r.scard(PROCESSING_SET),
        "completed": r.scard(COMPLETED_SET),
        "dead_letter": r.llen(DEAD_LETTER_QUEUE),
    }


def get_dead_letter_tasks():
    tasks = []
    dead = r.lrange(DEAD_LETTER_QUEUE, 0, -1)
    for item in dead:
        tasks.append(json.loads(item))
    return tasks


def clear_dead_letter():
    r.delete(DEAD_LETTER_QUEUE)
    return {"message": "Dead letter queue cleared"}
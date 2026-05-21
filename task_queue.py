import redis
import json
import uuid
import os
from datetime import datetime

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)
def push_task(task_type: str, payload: dict, priority: int = 1, retries: int = 0):
    """Add a task to the queue"""
    task = {
        "id": str(uuid.uuid4()),
        "type": task_type,
        "payload": payload,
        "priority": priority,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "retries": retries
    }

    # Save status in Redis so we can track it
    r.hset(f"task:{task['id']}", mapping={
        "status": "pending",
        "type": task_type,
        "created_at": task["created_at"],
        "retries": retries
    })

    if priority == 2:
        r.lpush("high_priority_queue", json.dumps(task))
        print(f"🔴 HIGH priority task added: {task['id']} | Type: {task_type}")
    else:
        r.lpush("normal_queue", json.dumps(task))
        print(f"🟢 NORMAL task added: {task['id']} | Type: {task_type}")

    return task["id"]

def pop_task():
    """Always check high priority queue first"""
    task_data = r.rpop("high_priority_queue")
    if task_data:
        task = json.loads(task_data)
        print(f"🔴 Got HIGH priority task: {task['id']} | Type: {task['type']}")
        update_task_status(task["id"], "processing")
        return task

    task_data = r.rpop("normal_queue")
    if task_data:
        task = json.loads(task_data)
        print(f"🟢 Got NORMAL task: {task['id']} | Type: {task['type']}")
        update_task_status(task["id"], "processing")
        return task

    return None

def update_task_status(task_id: str, status: str, error: str = None):
    """Update task status in Redis"""
    mapping = {
        "status": status,
        "updated_at": datetime.now().isoformat()
    }
    if error:
        mapping["error"] = error
    r.hset(f"task:{task_id}", mapping=mapping)

def get_task_status(task_id: str):
    """Get current status of a task"""
    data = r.hgetall(f"task:{task_id}")
    return data if data else None

def push_to_dead_letter(task):
    """Send a failed task to the dead letter queue"""
    task["status"] = "failed"
    task["failed_at"] = datetime.now().isoformat()
    r.lpush("dead_letter_queue", json.dumps(task))
    update_task_status(task["id"], "failed")
    print(f"💀 Task in dead letter queue: {task['id']}")


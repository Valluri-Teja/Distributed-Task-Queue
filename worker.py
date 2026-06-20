import time
import multiprocessing
import os
import logging
from task_queue import pop_task, push_task, push_to_dead_letter, update_task_status, complete_task
from datetime import datetime

# --- Structured logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

MAX_RETRIES = 3

# Configurable via environment variable — no more hardcoded values
# Default is 0.0 (no random failures) so production is clean
# Set FAILURE_RATE=0.2 locally if you want to test retry logic
FAILURE_RATE = float(os.getenv("FAILURE_RATE", "0.0"))


def process_task(task):
    """Actually execute the task"""
    import random
    start_time = datetime.now()
    worker_name = multiprocessing.current_process().name
    task_type = task["type"]
    task_id = task["id"]

    logger.info("Processing | worker=%s type=%s id=%s retries=%d",
                worker_name, task_type, task_id, task.get("retries", 0))

    # Simulate random failure for testing retry logic (only when FAILURE_RATE > 0)
    if FAILURE_RATE > 0 and random.random() < FAILURE_RATE:
        raise Exception(f"Simulated failure (FAILURE_RATE={FAILURE_RATE})")

    if task_type == "send_email":
        logger.info("Sending email to: %s", task["payload"].get("to", "unknown"))
        time.sleep(1)

    elif task_type == "resize_image":
        logger.info("Resizing image: %s", task["payload"].get("filename", "unknown"))
        time.sleep(2)

    elif task_type == "failing_task":
        raise Exception("This task type always fails by design")

    elif task_type == "generate_report":
        logger.info("Generating report: %s", task["payload"].get("report_name", "unknown"))
        time.sleep(1.5)

    elif task_type == "data_sync":
        logger.info("Syncing data for: %s", task["payload"].get("source", "unknown"))
        time.sleep(0.5)

    else:
        logger.warning("Unknown task type: %s | id=%s", task_type, task_id)

    duration = (datetime.now() - start_time).total_seconds()

    # Mark complete and store result
    result = {"duration_seconds": round(duration, 2), "worker": worker_name}
    complete_task(task_id, result=result)

    # Store metrics in Redis
    from task_queue import r
    r.lpush("task_durations", duration)
    r.ltrim("task_durations", 0, 999)  # keep last 1000 durations only
    r.incr("total_tasks_processed")

    logger.info("Completed | id=%s duration=%.2fs", task_id, duration)


def handle_failure(task, error):
    """Retry or send to dead letter queue"""
    task["retries"] = task.get("retries", 0) + 1
    task_id = task["id"]

    logger.warning("Task failed | id=%s retries=%d error=%s", task_id, task["retries"], error)

    update_task_status(task_id, "retrying", error=str(error))

    if task["retries"] < MAX_RETRIES:
        logger.info("Requeuing | id=%s attempt=%d", task_id, task["retries"])
        push_task(task["type"], task["payload"], task["priority"], retries=task["retries"])
    else:
        logger.error("Max retries reached, moving to dead letter queue | id=%s", task_id)
        push_to_dead_letter(task)


def run_worker(worker_id):
    """Single worker loop"""
    logger.info("Worker-%d started | FAILURE_RATE=%.2f", worker_id, FAILURE_RATE)
    while True:
        task = pop_task()
        if task:
            try:
                process_task(task)
            except Exception as e:
                handle_failure(task, str(e))
        else:
            time.sleep(2)


def run_worker_pool(num_workers=3):
    """Launch multiple workers in parallel"""
    logger.info("Starting worker pool | workers=%d", num_workers)
    processes = []

    for i in range(num_workers):
        p = multiprocessing.Process(target=run_worker, args=(i + 1,), name=f"Worker-{i + 1}")
        p.start()
        processes.append(p)
        logger.info("Worker-%d launched | pid=%d", i + 1, p.pid)

    for p in processes:
        p.join()


if __name__ == "__main__":
    run_worker_pool(num_workers=3)
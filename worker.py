import time
import multiprocessing
import os
import logging
import random
from datetime import datetime
from task_queue import pop_task, push_task, fail_task, complete_task

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

MAX_RETRIES = 3
FAILURE_RATE = float(os.getenv("FAILURE_RATE", "0.0"))


def get_retry_delay(attempt: int, base: float = 1.0, max_delay: float = 30.0) -> float:
    delay = min(base * (2 ** attempt), max_delay)
    jitter = random.uniform(0, delay * 0.3)
    return delay + jitter


def process_task(task: dict) -> dict:
    start_time = datetime.now()
    worker_name = multiprocessing.current_process().name
    task_type = task["type"]
    task_id = task["id"]
    logger.info("Processing | worker=%s type=%s id=%s retries=%d",
                worker_name, task_type, task_id, task.get("retries", 0))
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
    logger.info("Completed | id=%s duration=%.2fs", task_id, duration)
    return {"duration_seconds": round(duration, 2), "worker": worker_name}


def handle_failure(task: dict, error: str):
    task["retries"] = task.get("retries", 0) + 1
    task_id = task["id"]
    logger.warning("Task failed | id=%s retries=%d error=%s", task_id, task["retries"], error)
    if task["retries"] < MAX_RETRIES:
        delay = get_retry_delay(attempt=task["retries"] - 1)
        logger.info("Retrying with backoff | id=%s attempt=%d delay=%.2fs", task_id, task["retries"], delay)
        time.sleep(delay)
        push_task(task["type"], task["payload"], task["priority"], retries=task["retries"])
    else:
        logger.error("Max retries reached, moving to dead letter queue | id=%s", task_id)
        fail_task(task, error)


def run_worker(worker_id: int):
    logger.info("Worker-%d started | FAILURE_RATE=%.2f", worker_id, FAILURE_RATE)
    while True:
        task = pop_task()
        if task:
            try:
                result = process_task(task)
                complete_task(task["id"], result=result)
                from task_queue import r
                r.lpush("task_durations", result["duration_seconds"])
                r.ltrim("task_durations", 0, 999)
                r.incr("total_tasks_processed")
            except Exception as e:
                handle_failure(task, str(e))
        else:
            time.sleep(0.1)


def run_worker_pool(num_workers: int = 3):
    logger.info("Starting worker pool | workers=%d", num_workers)
    processes = []
    for i in range(num_workers):
        p = multiprocessing.Process(target=run_worker, args=(i + 1,), name=f"Worker-{i + 1}")
        p.start()
        processes.append(p)
        logger.info("Worker-%d launched | pid=%d", i + 1, p.pid)
    try:
        for p in processes:
            p.join()
    except KeyboardInterrupt:
        logger.info("Shutting down worker pool...")
        for p in processes:
            p.terminate()


if __name__ == "__main__":
    run_worker_pool(num_workers=3)

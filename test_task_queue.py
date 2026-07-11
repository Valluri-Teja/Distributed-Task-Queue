import pytest
import json
from unittest.mock import MagicMock, patch


# ── Mock Redis so tests don't need a real Redis connection ──────────────
@pytest.fixture(autouse=True)
def mock_redis(monkeypatch):
    """Replace the Redis connection with a mock for all tests."""
    mock_r = MagicMock()
    monkeypatch.setattr("task_queue.r", mock_r)
    return mock_r


# ── 1. push_task ────────────────────────────────────────────────────────
def test_push_task_normal_priority_goes_to_normal_queue(mock_redis):
    """Normal priority tasks must go to normal_queue, not high_priority_queue."""
    from task_queue import push_task
    push_task("send_email", {"to": "test@example.com"}, priority=1)
    # LPUSH should have been called on normal_queue
    calls = [str(call) for call in mock_redis.lpush.call_args_list]
    assert any("normal_queue" in c for c in calls), \
        "Normal priority task should go to normal_queue"


def test_push_task_high_priority_goes_to_high_queue(mock_redis):
    """High priority tasks must go to high_priority_queue."""
    from task_queue import push_task
    push_task("send_email", {"to": "test@example.com"}, priority=2)
    calls = [str(call) for call in mock_redis.lpush.call_args_list]
    assert any("high_priority_queue" in c for c in calls), \
        "High priority task should go to high_priority_queue"


# ── 2. get_retry_delay ──────────────────────────────────────────────────
def test_exponential_backoff_increases_with_attempts():
    """
    Retry delay must increase exponentially.
    attempt 0 -> ~1s, attempt 1 -> ~2s, attempt 2 -> ~4s
    This is the core of the backoff logic — if this fails, retries are broken.
    """
    from worker import get_retry_delay
    delay0 = get_retry_delay(attempt=0)
    delay1 = get_retry_delay(attempt=1)
    delay2 = get_retry_delay(attempt=2)
    assert delay1 > delay0, "Delay should increase with each attempt"
    assert delay2 > delay1, "Delay should increase with each attempt"


def test_exponential_backoff_respects_max_delay():
    """Delay must never exceed max_delay regardless of attempt number."""
    from worker import get_retry_delay
    # attempt=100 would give 2^100 without the cap
    delay = get_retry_delay(attempt=100, max_delay=30.0)
    assert delay <= 30.0 * 1.3, \
        f"Delay {delay} exceeded max_delay 30s (with jitter allowance)"


# ── 3. fail_task ────────────────────────────────────────────────────────
def test_fail_task_moves_to_dead_letter_queue(mock_redis):
    """
    After max retries, task must go to dead_letter_queue.
    This tests the DLQ guarantee — failed tasks are never silently lost.
    """
    from task_queue import fail_task
    task = {
        "id": "test-123",
        "type": "send_email",
        "payload": {},
        "priority": 1,
        "retries": 3,  # already at max
        "status": "retry"
    }
    fail_task(task, "Connection refused")
    # Should have pushed to dead_letter_queue
    calls = [str(call) for call in mock_redis.lpush.call_args_list]
    assert any("dead_letter_queue" in c for c in calls), \
        "Task should be in dead_letter_queue after max retries"

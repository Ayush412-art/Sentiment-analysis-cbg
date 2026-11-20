import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import agent  # noqa: E402
from app import create_app  # noqa: E402

FAKE_ANALYSIS = {
    "sentiment": "Negative",
    "confidence": 0.96,
    "emotion": "Frustration",
    "intent": "Complaint",
    "topic": "Refund / Customer Support",
    "urgency": "High",
    "customer_risk": "High",
    "key_issue": "Unresolved refund request",
    "reason": "The customer has repeatedly contacted support without a response.",
    "recommended_action": "Escalate the unresolved refund issue.",
    "suggested_response": "We sincerely apologize for the delay.",
}


@pytest.fixture()
def client(tmp_path):
    app = create_app({"DATABASE_PATH": str(tmp_path / "test.db"), "TESTING": True})
    return app.test_client()


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json() == {"status": "ok"}


def test_analyze_rejects_missing_body(client):
    res = client.post("/api/analyze", json={})
    assert res.status_code == 400
    assert res.get_json()["success"] is False


def test_analyze_rejects_empty_feedback(client):
    res = client.post("/api/analyze", json={"feedback": "    "})
    assert res.status_code == 400


def test_analyze_rejects_too_long(client):
    res = client.post("/api/analyze", json={"feedback": "x" * 5000})
    assert res.status_code == 413


def test_analyze_success_and_history_and_summary(client, monkeypatch):
    monkeypatch.setattr(agent, "analyze_feedback", lambda text: dict(FAKE_ANALYSIS))
    res = client.post(
        "/api/analyze", json={"feedback": "Nobody has responded about my refund."}
    )
    assert res.status_code == 200
    data = res.get_json()["data"]
    assert data["sentiment"] == "Negative"
    assert data["id"] == 1

    history = client.get("/api/history").get_json()["data"]
    assert len(history) == 1

    summary = client.get("/api/summary").get_json()["data"]
    assert summary["total"] == 1
    assert summary["negative"] == 1
    assert summary["negative_pct"] == 100.0
    assert summary["high_urgency"] == 1
    assert summary["high_risk"] == 1


def test_history_filters(client, monkeypatch):
    monkeypatch.setattr(agent, "analyze_feedback", lambda text: dict(FAKE_ANALYSIS))
    client.post("/api/analyze", json={"feedback": "Refund problem here."})
    assert len(client.get("/api/history?sentiment=Positive").get_json()["data"]) == 0
    assert len(client.get("/api/history?sentiment=Negative").get_json()["data"]) == 1
    assert client.get("/api/history?sentiment=Bogus").status_code == 400


def test_ai_failure_returns_friendly_error(client, monkeypatch):
    def boom(text):
        raise agent.AIRateLimitError("quota")

    monkeypatch.setattr(agent, "analyze_feedback", boom)
    res = client.post("/api/analyze", json={"feedback": "Some valid feedback text."})
    assert res.status_code == 429
    body = res.get_json()
    assert body["success"] is False
    assert "quota" not in body["error"]["message"]


def test_delete(client, monkeypatch):
    monkeypatch.setattr(agent, "analyze_feedback", lambda text: dict(FAKE_ANALYSIS))
    client.post("/api/analyze", json={"feedback": "Refund problem here."})
    assert client.post("/api/feedback/1/delete").status_code == 200
    assert client.post("/api/feedback/1/delete").status_code == 404


def test_ai_insight_insufficient_data(client):
    res = client.get("/api/insights/ai")
    assert res.status_code == 200
    assert res.get_json()["data"] is None


def test_invalid_model_output_is_rejected():
    class Resp:
        parsed = None
        text = '{"sentiment": "Angry"}'

    with pytest.raises(agent.AIResponseError):
        agent._validate(Resp(), agent.FeedbackAnalysis)

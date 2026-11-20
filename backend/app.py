"""Flask application: HTTP routes only. Business logic lives in agent.py / database.py."""
import logging
from typing import Any, Dict, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError

import agent
import database
from config import Config
from database import DatabaseError
from models import AnalyzeRequest

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("cbg.api")

VALID_SENTIMENTS = {"Positive", "Neutral", "Negative"}
VALID_LEVELS = {"Low", "Medium", "High"}
MAX_BATCH = 500  # max items per /api/analyze/batch request


def error_response(message: str, status: int, code: str = "error"):
    return jsonify({"success": False, "error": {"code": code, "message": message}}), status


def create_app(test_config: Optional[Dict[str, Any]] = None) -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(
        DATABASE_PATH=Config.DATABASE_PATH,
        MAX_FEEDBACK_LENGTH=Config.MAX_FEEDBACK_LENGTH,
    )
    if test_config:
        app.config.update(test_config)

    CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})

    db_path = app.config["DATABASE_PATH"]
    try:
        database.init_db(db_path)
    except DatabaseError:
        logger.exception("Database initialisation failed")

    # ------------------------------------------------------------------ routes
    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.post("/api/analyze")
    def analyze():
        body = request.get_json(silent=True)
        if not isinstance(body, dict) or not isinstance(body.get("feedback"), str):
            return error_response(
                "Please provide customer feedback to analyze.", 400, "invalid_request"
            )
        try:
            payload = AnalyzeRequest(feedback=body["feedback"])
        except ValidationError:
            return error_response("Invalid feedback.", 400, "invalid_request")

        text = payload.feedback
        if len(text) < Config.MIN_FEEDBACK_LENGTH:
            return error_response(
                "Please enter some customer feedback to analyze.", 400, "empty_feedback"
            )
        max_len = app.config["MAX_FEEDBACK_LENGTH"]
        if len(text) > max_len:
            return error_response(
                f"Feedback is too long. Please keep it under {max_len} characters.",
                413,
                "feedback_too_long",
            )

        try:
            analysis = agent.analyze_feedback(text)
        except agent.AIError as exc:
            logger.warning("Analysis failed: %s", exc)
            return error_response(exc.user_message, exc.status_code, "ai_error")

        try:
            record = database.insert_analysis(text, analysis, db_path=db_path)
        except DatabaseError:
            logger.exception("Failed to store analysis")
            return error_response(
                "The analysis completed but could not be saved. Please try again.",
                500,
                "database_error",
            )

        return jsonify({"success": True, "data": record}), 200

    @app.post("/api/analyze/batch")
    def analyze_batch():
        """Analyze many comments at once (used by the CSV / TXT upload)."""
        body = request.get_json(silent=True)
        items = body.get("feedbacks") if isinstance(body, dict) else None
        if not isinstance(items, list) or not items:
            return error_response(
                "Please provide a list of feedback to analyze.", 400, "invalid_request"
            )
        if len(items) > MAX_BATCH:
            return error_response(
                f"Too many items. Please send at most {MAX_BATCH} per request.",
                413,
                "batch_too_large",
            )

        max_len = app.config["MAX_FEEDBACK_LENGTH"]
        records, skipped = [], 0
        for raw in items:
            text = raw.strip() if isinstance(raw, str) else ""
            if not (Config.MIN_FEEDBACK_LENGTH <= len(text) <= max_len):
                skipped += 1
                continue
            try:
                analysis = agent.analyze_feedback(text)
            except agent.AINotConfiguredError as exc:
                # Setup problem (e.g. spaCy model missing): every item would fail.
                return error_response(exc.user_message, exc.status_code, "ai_error")
            except agent.AIError as exc:
                logger.warning("Batch item failed: %s", exc)
                skipped += 1
                continue
            try:
                records.append(database.insert_analysis(text, analysis, db_path=db_path))
            except DatabaseError:
                logger.exception("Failed to store batch item")
                skipped += 1

        return jsonify(
            {
                "success": True,
                "data": {"records": records, "analyzed": len(records), "skipped": skipped},
            }
        )

    @app.get("/api/history")
    def history():
        sentiment = request.args.get("sentiment") or None
        urgency = request.args.get("urgency") or None
        risk = request.args.get("risk") or None
        search = (request.args.get("search") or "").strip()[:200] or None

        if sentiment and sentiment not in VALID_SENTIMENTS:
            return error_response("Invalid sentiment filter.", 400, "invalid_request")
        if urgency and urgency not in VALID_LEVELS:
            return error_response("Invalid urgency filter.", 400, "invalid_request")
        if risk and risk not in VALID_LEVELS:
            return error_response("Invalid risk filter.", 400, "invalid_request")

        limit = min(max(request.args.get("limit", default=200, type=int), 1), 500)
        offset = max(request.args.get("offset", default=0, type=int), 0)

        try:
            rows = database.list_feedback(
                search=search,
                sentiment=sentiment,
                urgency=urgency,
                risk=risk,
                limit=limit,
                offset=offset,
                db_path=db_path,
            )
        except DatabaseError:
            logger.exception("History query failed")
            return error_response("Could not load feedback history.", 500, "database_error")
        return jsonify({"success": True, "data": rows})

    @app.get("/api/summary")
    def summary():
        try:
            stats = database.get_summary(db_path)
            stats["priority_issues"] = database.get_priority_issues(5, db_path)
        except DatabaseError:
            logger.exception("Summary query failed")
            return error_response("Could not load summary.", 500, "database_error")
        return jsonify({"success": True, "data": stats})

    @app.get("/api/insights/ai")
    def ai_insight():
        """Interpretation of stored statistics. Statistics are computed separately
        and deterministically; only the narrative comes from agent.py."""
        try:
            stats = database.get_summary(db_path)
            samples = database.get_negative_samples(15, db_path)
        except DatabaseError:
            logger.exception("Insight data query failed")
            return error_response("Could not load insight data.", 500, "database_error")

        if stats["total"] < Config.MIN_RECORDS_FOR_INSIGHT:
            return jsonify(
                {
                    "success": True,
                    "data": None,
                    "reason": "insufficient_data",
                    "minimum_required": Config.MIN_RECORDS_FOR_INSIGHT,
                }
            )
        try:
            insight = agent.generate_business_insight(stats, samples)
        except agent.AIError as exc:
            logger.warning("Insight generation failed: %s", exc)
            return error_response(exc.user_message, exc.status_code, "ai_error")
        return jsonify({"success": True, "data": insight, "based_on": stats["total"]})

    @app.post("/api/feedback/<int:feedback_id>/delete")
    def delete_feedback(feedback_id: int):
        try:
            deleted = database.delete_feedback(feedback_id, db_path)
        except DatabaseError:
            logger.exception("Delete failed")
            return error_response("Could not delete this record.", 500, "database_error")
        if not deleted:
            return error_response("Feedback record not found.", 404, "not_found")
        return jsonify({"success": True})

    # --------------------------------------------------------- error handlers
    @app.errorhandler(404)
    def not_found(_e):
        return error_response("Resource not found.", 404, "not_found")

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return error_response("Method not allowed.", 405, "method_not_allowed")

    @app.errorhandler(Exception)
    def unhandled(exc):
        logger.exception("Unhandled error: %s", exc)
        return error_response(
            "Something went wrong. Please try again.", 500, "internal_error"
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
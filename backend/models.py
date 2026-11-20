"""Pydantic schemas: API request validation and the Gemini response contract."""
from typing import List, Literal

from pydantic import BaseModel, Field, field_validator

Sentiment = Literal["Positive", "Neutral", "Negative"]
Level = Literal["Low", "Medium", "High"]


class AnalyzeRequest(BaseModel):
    feedback: str

    @field_validator("feedback")
    @classmethod
    def strip_feedback(cls, value: str) -> str:
        return value.strip()


class FeedbackAnalysis(BaseModel):
    """Structured output the AI analyst must return.

    Used both as the Gemini response schema and to validate the response
    before anything is stored or returned to the frontend.
    """

    sentiment: Sentiment = Field(description="Overall customer sentiment.")
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in the sentiment, from 0.0 to 1.0."
    )
    emotion: str = Field(
        description="Dominant emotion, e.g. Frustration, Satisfaction, Disappointment, Anxiety, Neutral."
    )
    intent: str = Field(
        description="Customer intent, e.g. Complaint, Inquiry, Praise, Request, Suggestion, Cancellation Threat."
    )
    topic: str = Field(
        description="Main business topic, e.g. Refund / Customer Support, Delivery, Billing, Product Quality."
    )
    urgency: Level = Field(description="How quickly the business should respond.")
    customer_risk: Level = Field(
        description="Risk of losing this customer or reputational damage."
    )
    key_issue: str = Field(description="One short sentence naming the core issue.")
    reason: str = Field(
        description="Brief explanation, grounded only in the feedback text."
    )
    recommended_action: str = Field(
        description="A practical internal business action."
    )
    suggested_response: str = Field(
        description="Professional, empathetic customer-facing reply."
    )

    @field_validator(
        "emotion",
        "intent",
        "topic",
        "key_issue",
        "reason",
        "recommended_action",
        "suggested_response",
    )
    @classmethod
    def not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be empty")
        return value


class BusinessInsight(BaseModel):
    """AI interpretation of aggregated statistics (kept separate from raw stats)."""

    insight: str = Field(
        description="2-3 sentence interpretation grounded only in the supplied statistics."
    )
    recommended_actions: List[str] = Field(
        description="3 to 4 concise business actions supported by the statistics."
    )

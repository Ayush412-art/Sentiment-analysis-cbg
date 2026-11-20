"""Customer Voice Intelligence Analyst: local spaCy implementation (no Gemini).

Drop-in replacement for the Gemini version. Same public interface:
    analyze_feedback(text) -> dict matching FeedbackAnalysis
    generate_business_insight(summary, negative_samples) -> dict matching BusinessInsight
    AIError and subclasses (status_code / user_message)

Sentiment comes from spaCy + spacytextblob, adjusted by a small complaint/praise
cue lexicon. Emotion, intent, topic, urgency and risk are rule-based heuristics.
Replies, reasons and actions are templates. Everything is deterministic.

Setup:
    pip install spacy spacytextblob
    python -m spacy download en_core_web_sm
    python -m textblob.download_corpora   # needed by TextBlob
"""
import logging
import re
from typing import Any, Dict, List, Optional

import spacy
from pydantic import ValidationError
from spacytextblob.spacytextblob import SpacyTextBlob  # noqa: F401  (registers the component)

from models import BusinessInsight, FeedbackAnalysis

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------- errors
class AIError(Exception):
    """Base class. `user_message` is safe to show to end users."""

    status_code = 502
    user_message = "The analysis service had a problem. Please try again."


class AINotConfiguredError(AIError):
    status_code = 503
    user_message = "Analysis is not configured. Please contact your administrator."


class AIRateLimitError(AIError):
    status_code = 429
    user_message = "The service is receiving a lot of requests. Please try again shortly."


class AIUnavailableError(AIError):
    status_code = 503
    user_message = "The analysis service is temporarily unavailable. Please try again shortly."


class AIResponseError(AIError):
    status_code = 502
    user_message = "The analysis returned an unexpected result. Please try again."


# ---------------------------------------------------------------- model
_nlp: Optional["spacy.language.Language"] = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            nlp = spacy.load("en_core_web_sm")
            nlp.add_pipe("spacytextblob")
        except OSError as exc:
            raise AINotConfiguredError(
                "spaCy model missing: run `python -m spacy download en_core_web_sm`"
            ) from exc
        except Exception as exc:
            raise AIUnavailableError(str(exc)) from exc
        _nlp = nlp
    return _nlp


# ---------------------------------------------------------------- lexicons
def _rx(words: List[str]) -> List["re.Pattern"]:
    return [re.compile(r"\b" + w + r"\b", re.I) for w in words]


NEG_CUES = _rx([
    r"never (?:arrived|came|responded|replied)", r"(?:hasn'?t|haven'?t|didn'?t|never|not) (?:arrived|responded|replied|answered|received|working|worked)",
    r"nobody (?:answers?|responds?|replied)", r"no (?:response|reply|one)", r"ignored", r"broke(?:n)?", r"cracked",
    r"damaged", r"faulty", r"defective", r"charged twice", r"double[- ]charged", r"overcharged", r"still waiting",
    r"waiting", r"delay(?:ed)?", r"late", r"missing", r"lost", r"worst", r"terrible", r"awful", r"horrible",
    r"unacceptable", r"rude", r"useless", r"scam", r"fraud", r"frustrat\w*", r"annoy\w*", r"disappoint\w*",
    r"angry", r"furious", r"complain\w*", r"problem", r"issue", r"cancel\w*", r"refund", r"logs? me out",
    r"keeps? (?:crashing|failing|logging)", r"waste of money", r"not (?:happy|satisfied|good)",
])
POS_CUES = _rx([
    r"love\w*", r"great", r"excellent", r"amazing", r"fantastic", r"perfect", r"wonderful", r"happy",
    r"impressed", r"helpful", r"friendly", r"polite", r"smooth", r"easy", r"fast", r"quick", r"thank\w*",
    r"recommend\w*", r"delighted", r"pleased", r"best", r"awesome", r"brilliant", r"early", r"great value",
])
CANCEL_CUES = _rx([r"cancel\w*", r"switch(?:ing)? to", r"switch(?:ing)? provider", r"leave you", r"leaving",
                   r"never (?:buy|order|shop)", r"take my business", r"close my account", r"stop using"])
ANGER_CUES = _rx([r"furious", r"angry", r"outrageous", r"disgusting", r"unacceptable", r"scam", r"fraud", r"rude"])
FRUSTRATION_CUES = _rx([r"frustrat\w*", r"annoy\w*", r"fed up", r"again", r"still", r"nobody", r"no response",
                        r"third time", r"every time", r"waiting"])
DISAPPOINT_CUES = _rx([r"disappoint\w*", r"expected better", r"let down", r"not what i expected", r"broke(?:n)?", r"cracked"])
CONFUSION_CUES = _rx([r"confus\w*", r"don'?t (?:understand|recogni[sz]e)", r"not sure", r"unclear", r"what is this"])
DELIGHT_CUES = _rx([r"love\w*", r"amazing", r"fantastic", r"delighted", r"impressed", r"wonderful", r"brilliant"])
GRATITUDE_CUES = _rx([r"thank\w*", r"grateful", r"appreciate\w*"])

URGENT_CUES = _rx([r"asap", r"urgent\w*", r"immediately", r"today", r"this morning", r"right now", r"deadline",
                   r"charged twice", r"double[- ]charged", r"overcharged", r"unauthori[sz]ed", r"fraud",
                   r"safety", r"dangerous", r"still (?:haven'?t|hasn'?t|waiting|not)", r"third time",
                   r"(?:two|three|four|\d+) (?:times|weeks|months)", r"over a (?:week|month)", r"\d+ days?",
                   r"every time", r"nobody", r"no response"])
REPEAT_CUES = _rx([r"third time", r"again", r"every time", r"still", r"(?:two|three|four|\d+) times",
                   r"multiple times", r"repeatedly", r"keeps?\b"])

REQUEST_CUES = _rx([r"please", r"i'?d like", r"i would like", r"can you", r"could you", r"i want", r"i need",
                    r"refund", r"replacement", r"replace", r"fix"])
SUGGEST_CUES = _rx([r"would be great", r"should", r"suggest\w*", r"wish", r"it would be nice", r"consider", r"if you (?:could|offered)"])
INQUIRY_START = re.compile(r"^\s*(how|what|when|where|why|who|can|could|do|does|is|are|will|would)\b", re.I)

TOPICS = [
    ("Refund / Customer Support", _rx([r"refund\w*", r"money back", r"reimburse\w*", r"return(?:ed)? (?:the|my) item"])),
    ("Customer Support", _rx([r"support", r"agent", r"callback", r"call(?:ed)?", r"customer service", r"email(?:s)?", r"chat", r"representative"])),
    ("Delivery", _rx([r"deliver\w*", r"shipping", r"shipment", r"parcel", r"package", r"courier", r"driver", r"tracking", r"arriv\w*", r"ordered"])),
    ("Billing", _rx([r"billing", r"invoice", r"charge[ds]?", r"subscription", r"fee", r"payment (?:failed|issue)", r"overcharged"])),
    ("Checkout / Payments", _rx([r"checkout", r"payment options?", r"pay(?:ing)?", r"discount code", r"promo"])),
    ("App Experience", _rx([r"\bapp\b", r"logs? me out", r"log ?in", r"crash\w*", r"update"])),
    ("Website Experience", _rx([r"website", r"site", r"page", r"navigation", r"search"])),
    ("Pricing", _rx([r"price", r"pricing", r"expensive", r"cost", r"value for money", r"overpriced"])),
    ("Product Quality", _rx([r"quality", r"broke(?:n)?", r"cracked", r"zipper", r"material", r"fit", r"size", r"product",
                              r"works?", r"damaged", r"defect\w*", r"taste", r"skin"])),
]

ACTIONS = {
    ("Delivery", "Negative"): "Locate the shipment with the carrier and give the customer a status update.",
    ("Billing", "Negative"): "Verify the charge on the account and correct it if it is confirmed as an error.",
    ("Refund / Customer Support", "Negative"): "Escalate the refund request to a support lead and assign a single owner for updates.",
    ("Customer Support", "Negative"): "Have a senior agent follow up and review how the earlier contact was handled.",
    ("Product Quality", "Negative"): "Log the issue for quality review and offer the customer a replacement or repair option.",
    ("App Experience", "Negative"): "Raise the issue with the app team and capture device and version details from the customer.",
    ("Website Experience", "Negative"): "Report the issue to the digital team and ask the customer for steps to reproduce it.",
    ("Checkout / Payments", "Negative"): "Review the payment flow for the reported problem and follow up with the customer.",
    ("Pricing", "Negative"): "Share the pricing concern with the commercial team and monitor for similar feedback.",
}

REPLIES_NEG = {
    "Delivery": "We're sorry about the problem with your delivery. We're looking into it and will follow up with you on the next steps.",
    "Billing": "Thank you for letting us know, and we apologise for the inconvenience. We'll review the charges on your account and follow up with you.",
    "Refund / Customer Support": "We sincerely apologise for the delay and the lack of a clear response. We're escalating your request so it can be reviewed promptly.",
    "Customer Support": "We're sorry we haven't met your expectations. We'll have someone look into this and get back to you as soon as possible.",
    "Product Quality": "We're sorry the product didn't meet your expectations. We'd like to help put this right and will share the available options with you.",
    "App Experience": "We're sorry for the trouble with the app. We're passing this to our team to investigate.",
    "Website Experience": "We're sorry for the difficulty you had on our website. We're passing this to our team to investigate.",
    "Checkout / Payments": "We're sorry for the trouble at checkout. We'll look into what happened and follow up with you.",
    "Pricing": "Thank you for being candid about pricing. We've noted your concern and will share it with our team.",
}
REPLY_NEG_DEFAULT = "We're sorry to hear about your experience. We'll look into this and follow up with you on the next steps."
REPLY_POS = "Thank you so much for the kind words! We're delighted to hear this and will pass your feedback on to the team."
REPLY_NEUTRAL = "Thank you for your feedback. We appreciate you taking the time to share it and will pass it on to the relevant team."
REPLY_INQUIRY = "Thanks for reaching out. Our team will look into your question and get back to you shortly."


# ---------------------------------------------------------------- helpers
def _count(patterns: List["re.Pattern"], text: str) -> int:
    return sum(1 for p in patterns if p.search(text))


def _level(score: int, high: int, medium: int) -> str:
    return "High" if score >= high else "Medium" if score >= medium else "Low"


def _pick_topic(text: str) -> str:
    best, best_hits = "General Feedback", 0
    for name, patterns in TOPICS:
        hits = _count(patterns, text)
        if hits > best_hits:
            best, best_hits = name, hits
    return best


def _short(text: str, limit: int = 110) -> str:
    text = text.strip().rstrip(".!?")
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "..."


# ---------------------------------------------------------------- public API
def analyze_feedback(feedback: str) -> Dict[str, Any]:
    """Analyse one customer comment. Returns a dict matching FeedbackAnalysis."""
    nlp = _get_nlp()
    try:
        doc = nlp(feedback)
        polarity = float(doc._.blob.polarity)
    except Exception as exc:
        logger.exception("spaCy analysis failed")
        raise AIUnavailableError(str(exc)) from exc

    text = feedback
    neg = _count(NEG_CUES, text)
    pos = _count(POS_CUES, text)
    cancel = _count(CANCEL_CUES, text) > 0
    repeats = _count(REPEAT_CUES, text)
    urgent_hits = _count(URGENT_CUES, text)
    is_question = text.strip().endswith("?") or bool(INQUIRY_START.match(text))

    # Blend the lexicon polarity with domain cues.
    score = max(-1.0, min(1.0, polarity + 0.18 * pos - 0.22 * neg))
    if score > 0.12:
        sentiment = "Positive"
    elif score < -0.12:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"

    # Confidence: strong score = high; mixed cues or very short text = lower.
    confidence = 0.55 + min(abs(score), 0.8) * 0.5
    if pos and neg:
        confidence -= 0.2
    if len(text.split()) < 4:
        confidence -= 0.15
    confidence = round(max(0.3, min(0.97, confidence)), 2)

    # Intent
    if cancel:
        intent = "Cancellation Threat"
    elif _count(SUGGEST_CUES, text):
        intent = "Suggestion"
    elif is_question:
        intent = "Inquiry"
    elif sentiment == "Negative" and _count(REQUEST_CUES, text):
        intent = "Request"
    elif sentiment == "Negative":
        intent = "Complaint"
    elif sentiment == "Positive":
        intent = "Praise"
    else:
        intent = "Comment"

    # Emotion
    if sentiment == "Positive":
        emotion = "Delight" if _count(DELIGHT_CUES, text) else "Gratitude" if _count(GRATITUDE_CUES, text) else "Satisfaction"
    elif _count(CONFUSION_CUES, text):
        emotion = "Confusion"
    elif sentiment == "Negative":
        emotion = (
            "Anger" if _count(ANGER_CUES, text) else
            "Frustration" if _count(FRUSTRATION_CUES, text) else
            "Disappointment" if _count(DISAPPOINT_CUES, text) else
            "Annoyance"
        )
    else:
        emotion = "Neutral"

    topic = _pick_topic(text)

    # Urgency and risk
    urgency_score = urgent_hits + (1 if sentiment == "Negative" else 0) + (2 if cancel else 0)
    if sentiment == "Positive":
        urgency = "Low"
    elif sentiment == "Neutral" and not urgent_hits:
        urgency = "Low"
    else:
        urgency = _level(urgency_score, high=3, medium=1)
    if sentiment == "Positive":
        risk = "Low"
    else:
        risk_score = (3 if cancel else 0) + repeats + (1 if sentiment == "Negative" else 0) + (1 if score < -0.5 else 0)
        risk = _level(risk_score, high=3, medium=1)
        if sentiment == "Neutral" and risk == "High":
            risk = "Medium"

    # Narrative fields (templates built only from the feedback and the labels above)
    first_sentence = next((s.text for s in doc.sents if s.text.strip()), text)
    key_issue = _short(first_sentence)
    cues = []
    if cancel:
        cues.append("mentions leaving or cancelling")
    if repeats:
        cues.append("describes a repeated problem")
    if neg and sentiment == "Negative":
        cues.append("uses negative or complaint wording")
    if pos and sentiment == "Positive":
        cues.append("uses positive wording")
    reason = (
        f"Classified as {sentiment.lower()} (score {score:+.2f}) about {topic.lower()}"
        + (f"; the customer {', '.join(cues)}." if cues else ".")
    )

    if sentiment == "Positive":
        action = "Share the positive feedback with the relevant team and recognise their work."
        response = REPLY_POS
    elif sentiment == "Negative":
        action = ACTIONS.get((topic, "Negative"), "Review the complaint and follow up with the customer.")
        if cancel:
            action += " Flag the account for a retention follow-up."
        response = REPLIES_NEG.get(topic, REPLY_NEG_DEFAULT)
    else:
        action = (
            "Route the question to support for a quick answer."
            if is_question else "Monitor for similar feedback and pass any suggestion to the relevant team."
        )
        response = REPLY_INQUIRY if is_question else REPLY_NEUTRAL

    try:
        result = FeedbackAnalysis(
            sentiment=sentiment, confidence=confidence, emotion=emotion, intent=intent,
            topic=topic, urgency=urgency, customer_risk=risk, key_issue=key_issue,
            reason=reason, recommended_action=action, suggested_response=response,
        )
    except ValidationError as exc:
        logger.error("Local analysis failed validation: %s", exc)
        raise AIResponseError(str(exc)) from exc
    return result.model_dump()


def generate_business_insight(
    summary: Dict[str, Any], negative_samples: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Template-based interpretation of stored statistics (no LLM)."""
    total = summary["total"]
    neg_pct, pos_pct = summary["negative_pct"], summary["positive_pct"]
    top_topics = summary.get("top_topics") or []
    top_emotions = summary.get("top_emotions") or []

    # Topic concentration among negative samples
    neg_topics: Dict[str, int] = {}
    for s in negative_samples:
        neg_topics[s["topic"]] = neg_topics.get(s["topic"], 0) + 1
    worst_topic = max(neg_topics, key=neg_topics.get) if neg_topics else None

    parts = [
        f"Across {total} analysed pieces of feedback, {neg_pct}% is negative and {pos_pct}% is positive."
    ]
    if top_topics:
        t = top_topics[0]
        parts.append(f"The most common topic is {t['name']} ({t['count']} records).")
    if worst_topic:
        parts.append(
            f"Recent negative feedback is concentrated in {worst_topic} "
            f"({neg_topics[worst_topic]} of the last {len(negative_samples)} negative records)."
        )
    if summary["high_urgency"] or summary["high_risk"]:
        parts.append(
            f"{summary['high_urgency']} records are high urgency and {summary['high_risk']} carry high customer risk."
        )
    insight = " ".join(parts[:3] if len(parts) > 3 else parts)
    if len(parts) > 3:
        insight = " ".join(parts[:2] + parts[3:4]) if not worst_topic else " ".join(parts[:3])

    actions: List[str] = []
    if worst_topic:
        actions.append(f"Review recent {worst_topic} complaints for a shared root cause.")
    if summary["high_urgency"]:
        actions.append("Work through high-urgency records first and confirm each has an owner.")
    if summary["high_risk"]:
        actions.append("Run a retention follow-up with customers flagged as high risk.")
    if top_emotions and top_emotions[0]["name"] != "Neutral":
        actions.append(f"Brief support on handling {top_emotions[0]['name'].lower()}, the most common emotion.")
    actions.append("Share positive feedback with the teams involved to reinforce what is working.")
    actions = actions[:4]
    while len(actions) < 3:
        actions.append("Keep tracking sentiment and topics weekly to spot changes early.")

    try:
        return BusinessInsight(insight=insight, recommended_actions=actions).model_dump()
    except ValidationError as exc:
        raise AIResponseError(str(exc)) from exc
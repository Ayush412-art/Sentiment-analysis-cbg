"""Insert SYNTHETIC demo feedback records.

All records below are fictional, written for demonstration only. They do NOT
represent real CBG customers or real CBG data.

Usage:
    python seed_data.py            # seeds only if the table is empty
    python seed_data.py --force    # appends even if data exists
    python seed_data.py --reset    # deletes ALL stored analyses, then seeds
"""
import sys
from datetime import datetime, timedelta, timezone

import database

# (feedback, sentiment, confidence, emotion, intent, topic, urgency, risk, key_issue, reason, action, response)
SYNTHETIC_RECORDS = [
    (
        "I ordered a blender two weeks ago and it still hasn't arrived. Tracking hasn't updated in ten days and nobody answers my emails.",
        "Negative", 0.95, "Frustration", "Complaint", "Delivery", "High", "High",
        "Order delayed with no tracking updates",
        "The customer reports a two-week delay, stale tracking and unanswered emails.",
        "Locate the shipment with the carrier and contact the customer with a status update.",
        "We're very sorry your order hasn't arrived and that you haven't heard back from us. We're looking into the shipment now and will update you as soon as we have more information.",
    ),
    (
        "I was charged twice for my monthly subscription. Please fix this and refund the extra charge.",
        "Negative", 0.93, "Annoyance", "Request", "Billing", "High", "Medium",
        "Duplicate subscription charge",
        "The customer states they were billed twice and is asking for a refund of the extra charge.",
        "Verify the duplicate charge and process a correction if confirmed.",
        "Thank you for letting us know, and we apologise for the inconvenience. We'll review the charges on your account and follow up on the next steps.",
    ),
    (
        "Love the new moisturiser! My skin feels great after just a week. Will definitely buy again.",
        "Positive", 0.97, "Satisfaction", "Praise", "Product Quality", "Low", "Low",
        "Customer is happy with product results",
        "The customer expresses satisfaction and intent to repurchase.",
        "Share the positive feedback with the product team.",
        "Thank you so much for the kind words! We're delighted that you're enjoying the product and look forward to serving you again.",
    ),
    (
        "I have contacted customer support three times about my refund and nobody has responded. This is extremely frustrating.",
        "Negative", 0.96, "Frustration", "Complaint", "Refund / Customer Support", "High", "High",
        "Unresolved refund request",
        "The customer has repeatedly contacted support without receiving a response.",
        "Escalate the unresolved refund request to the support team lead.",
        "We sincerely apologise for the delay and for the lack of response. We're escalating your refund request so it can be reviewed promptly.",
    ),
    (
        "The delivery driver was polite and the package arrived a day early. Great service.",
        "Positive", 0.94, "Satisfaction", "Praise", "Delivery", "Low", "Low",
        "Early, courteous delivery",
        "The customer praises the driver's politeness and the early arrival.",
        "Recognise the delivery team for the positive experience.",
        "Thank you for the lovely feedback! We'll pass your kind words on to our delivery team.",
    ),
    (
        "The zipper on my bag broke after only two weeks of normal use. Expected better quality for this price.",
        "Negative", 0.91, "Disappointment", "Complaint", "Product Quality", "Medium", "Medium",
        "Zipper failed after two weeks",
        "The customer reports early product failure and says quality did not match the price.",
        "Log the defect for quality review and offer the customer a replacement or repair option.",
        "We're sorry your bag didn't hold up as expected. We'd like to help make this right and will share the available options with you.",
    ),
    (
        "How do I change the delivery address for an order I placed this morning?",
        "Neutral", 0.9, "Neutral", "Inquiry", "Delivery", "Medium", "Low",
        "Needs to change a delivery address",
        "The customer asks a time-sensitive question about modifying a recent order.",
        "Route to support for a quick address update before dispatch.",
        "Thanks for reaching out. Our team will help you update the delivery address as quickly as possible.",
    ),
    (
        "The app keeps logging me out every few minutes. It's getting really annoying and I'm thinking of switching to another provider.",
        "Negative", 0.92, "Annoyance", "Cancellation Threat", "App Experience", "High", "High",
        "Repeated logouts and switching intent",
        "The customer reports a recurring logout problem and mentions switching providers.",
        "Raise the logout issue with the app team and prioritise a retention follow-up.",
        "We're sorry for the trouble with the app and understand how disruptive this is. We're looking into the logout issue and would like to help resolve it for you.",
    ),
    (
        "Support resolved my issue in under ten minutes. Very impressed with how helpful and friendly the agent was.",
        "Positive", 0.98, "Delight", "Praise", "Customer Support", "Low", "Low",
        "Fast and friendly support resolution",
        "The customer praises the speed and friendliness of the support interaction.",
        "Share the praise with the support agent and their team lead.",
        "Thank you for taking the time to share this! We're so glad our team could help quickly.",
    ),
    (
        "My invoice shows a fee I don't recognise. Can someone explain what it is?",
        "Neutral", 0.82, "Confusion", "Inquiry", "Billing", "Medium", "Medium",
        "Unrecognised fee on invoice",
        "The customer is confused by a charge and requests an explanation.",
        "Have billing review the invoice and explain the fee clearly.",
        "Thanks for flagging this. We'll review your invoice and explain the charge in detail.",
    ),
    (
        "Item arrived with a cracked screen. I'd like a replacement or my money back.",
        "Negative", 0.94, "Disappointment", "Request", "Product Quality", "High", "Medium",
        "Item arrived damaged",
        "The customer received a damaged item and requests a replacement or refund.",
        "Arrange a replacement or refund and review packaging with the carrier.",
        "We're sorry your item arrived damaged. We'll help you with a replacement or refund and follow up with the next steps.",
    ),
    (
        "It would be great if you offered more payment options at checkout. Otherwise the experience was fine.",
        "Neutral", 0.78, "Neutral", "Suggestion", "Checkout / Payments", "Low", "Low",
        "Wants more payment options",
        "The customer gives a constructive suggestion alongside an otherwise acceptable experience.",
        "Pass the suggestion to the product team for consideration.",
        "Thank you for the suggestion! We've shared it with our team as we continue to improve checkout.",
    ),
    (
        "I've been waiting over a month for my refund after returning the item. Every time I call I get a different answer.",
        "Negative", 0.95, "Frustration", "Complaint", "Refund / Customer Support", "High", "High",
        "Refund delayed with inconsistent answers",
        "The customer reports a month-long refund wait and conflicting information from support.",
        "Escalate the refund and ensure one owner provides a consistent update.",
        "We apologise for the long wait and the conflicting information. We're escalating your case so you receive a clear update.",
    ),
    (
        "Product is okay. Does what it says, nothing special.",
        "Neutral", 0.85, "Indifference", "Comment", "Product Quality", "Low", "Low",
        "Average product experience",
        "The customer describes the product as adequate without strong feeling either way.",
        "Monitor for similar lukewarm feedback.",
        "Thank you for your feedback. We're always working to improve and appreciate you sharing your experience.",
    ),
    (
        "Checkout was smooth and the discount code worked first time. Easy to use website.",
        "Positive", 0.93, "Satisfaction", "Praise", "Website Experience", "Low", "Low",
        "Smooth checkout experience",
        "The customer highlights an easy checkout and a working discount code.",
        "Share the positive experience with the digital team.",
        "Thank you! We're glad checkout went smoothly and hope you enjoy your purchase.",
    ),
    (
        "Third time my parcel has been left with a neighbour without any notice. Please stop doing this.",
        "Negative", 0.9, "Annoyance", "Complaint", "Delivery", "Medium", "Medium",
        "Repeated unannounced neighbour deliveries",
        "The customer reports a recurring delivery practice they have not agreed to.",
        "Add a delivery note for this customer and raise the issue with the carrier.",
        "We're sorry about your repeated delivery issues. We'll look into this with our delivery partner and note your preferences.",
    ),
    (
        "Great value for money. The size guide was accurate and the fit is perfect.",
        "Positive", 0.95, "Satisfaction", "Praise", "Product Quality", "Low", "Low",
        "Accurate sizing and good value",
        "The customer praises value for money and the accuracy of the size guide.",
        "Share with the merchandising team as evidence the size guide is working.",
        "We're so pleased the fit is perfect! Thank you for sharing your experience.",
    ),
    (
        "I was promised a callback yesterday and still haven't heard anything. If this isn't sorted today I'll cancel my account.",
        "Negative", 0.97, "Anger", "Cancellation Threat", "Customer Support", "High", "High",
        "Missed callback and threat to cancel",
        "The customer was promised a callback that did not happen and states they will cancel.",
        "Arrange an immediate callback from a senior agent and flag the account for retention follow-up.",
        "We sincerely apologise for missing your callback. We're arranging for someone to contact you as soon as possible.",
    ),
]


def seed(reset: bool = False, force: bool = False) -> int:
    database.init_db()
    if reset:
        with database.get_connection() as conn:
            conn.execute("DELETE FROM feedback_analysis")
    elif not force and database.get_summary()["total"] > 0:
        print("Database already contains data. Use --force to append or --reset to replace.")
        return 0

    now = datetime.now(timezone.utc)
    inserted = 0
    # Oldest first, spread across the last ~2 weeks.
    for i, rec in enumerate(SYNTHETIC_RECORDS):
        (feedback, sentiment, confidence, emotion, intent, topic, urgency, risk,
         key_issue, reason, action, response) = rec
        created = now - timedelta(hours=(len(SYNTHETIC_RECORDS) - i) * 17)
        database.insert_analysis(
            feedback,
            {
                "sentiment": sentiment, "confidence": confidence, "emotion": emotion,
                "intent": intent, "topic": topic, "urgency": urgency,
                "customer_risk": risk, "key_issue": key_issue, "reason": reason,
                "recommended_action": action, "suggested_response": response,
            },
            created_at=created.isoformat(timespec="seconds"),
        )
        inserted += 1
    return inserted


if __name__ == "__main__":
    count = seed(reset="--reset" in sys.argv, force="--force" in sys.argv)
    if count:
        print(f"Inserted {count} SYNTHETIC demo records (fictional, not real customer data).")

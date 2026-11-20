# CBG Customer sentiment analysis


An AI-powered prototype that turns unstructured customer feedback into structured business intelligence: sentiment, emotion, intent, topic, urgency, customer risk, key issue, recommended action and a suggested customer response.

> **Version 1 scope:** one feedback comment at a time. CSV/Excel upload and bulk processing are intentionally not included.

## 1. Project overview

CBG Customer Voice Intelligence lets a business user paste a customer comment and receive a detailed analysis in seconds. Every analysis is stored, so the dashboard, history and insights pages reflect real stored data.

## 2. Business problem

Customer feedback arrives as free text across support tickets, reviews and messages. It is slow to read manually, hard to compare, and urgent or high-risk cases are easy to miss. Leaders need to see *what customers are saying*, *how they feel*, and *what to act on first*.

## 3. Solution

An AI "Customer Voice Intelligence Analyst" (Google Gemini) classifies each comment against a strict schema. The backend validates the result with Pydantic, stores it in SQLite, and the React dashboard turns stored results into KPIs, charts and priority lists.

Statistics (counts, percentages, top topics) are always computed deterministically from the database. The optional **AI Business Insight** is a clearly separated, AI-written interpretation of those statistics, generated only on request.

## 4. Architecture

```
┌────────────────────┐   REST/JSON    ┌──────────────────────────┐
│ React + Vite       │ ─────────────▶ │ Flask API (app.py)       │
│ Tailwind, Recharts │ ◀───────────── │  routes + validation     │
└────────────────────┘                └──────┬───────────┬───────┘
                                             │           │
                                  ┌──────────▼───┐  ┌────▼─────────────┐
                                  │ agent.py     │  │ database.py      │
                                  │ Gemini +     │  │ SQLite,          │
                                  │ Pydantic     │  │ parameterized SQL│
                                  └──────────────┘  └──────────────────┘
```

| File | Responsibility |
|---|---|
| `backend/app.py` | Flask routes, input validation, error mapping |
| `backend/agent.py` | Analyst prompt, Gemini call, response validation |
| `backend/models.py` | Pydantic schemas (request + Gemini response contract) |
| `backend/database.py` | SQLite schema and queries |
| `backend/config.py` | Environment-based configuration |
| `backend/seed_data.py` | Optional synthetic demo data |

The analysis logic is a single function (`analyze_feedback(text)`), so Version 2 bulk processing can call it in a loop or queue without changing the API contract.

## 5. Technology stack

- **Frontend:** React 18, Vite, Tailwind CSS 3, Recharts
- **Backend:** Python, Flask, Flask-CORS
- **AI:** Google Gemini via the `google-genai` SDK (structured JSON output)
- **Validation:** Pydantic v2
- **Database:** SQLite

No LangChain, vector databases, RAG or extra AI frameworks.

## 6. Project structure

```
cbg-customer-voice-intelligence/
├── backend/
│   ├── app.py  agent.py  database.py  models.py  config.py
│   ├── seed_data.py
│   ├── requirements.txt  .env.example
│   ├── tests/test_api.py
│   └── instance/            # SQLite database is created here
├── frontend/
│   ├── package.json  vite.config.js  tailwind.config.js  postcss.config.js
│   └── src/
│       ├── components/  pages/  services/api.js  hooks/  utils/
│       ├── App.jsx  main.jsx  index.css
├── README.md
└── .gitignore
```

## 7. Environment setup

Requirements: Python 3.10+, Node.js 18+ (20+ recommended).

## 8. Gemini API setup

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Copy `backend/.env.example` to `backend/.env` and set:

```
GEMINI_API_KEY=your_api_key_here
```

The key is read from `.env` only. `.env` is git-ignored and never sent to the frontend. The default model is `gemini-2.5-flash`; override it with `GEMINI_MODEL` in `.env` if you prefer another available model.

## 9. Backend setup (Windows)

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` and add your key. Optionally load synthetic demo data:

```
python seed_data.py
```

## 10. Frontend setup (Windows)

```
cd frontend
npm install
copy .env.example .env
```

`frontend/.env` contains `VITE_API_URL=http://localhost:5000/api`.

## 11. How to run

Terminal 1 (backend, http://localhost:5000):

```
cd backend
venv\Scripts\activate
python app.py
```

Terminal 2 (frontend, http://localhost:5173):

```
cd frontend
npm run dev
```

Run backend tests (AI is mocked, no API key needed):

```
cd backend
python -m pytest
```

## 12. API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | `{ "status": "ok" }` |
| POST | `/api/analyze` | Body `{ "feedback": "..." }`. Analyzes, stores and returns the result |
| GET | `/api/history` | Stored analyses. Optional: `search`, `sentiment`, `urgency`, `risk`, `limit`, `offset` |
| GET | `/api/summary` | KPI counts, percentages, top topics/emotions/intents, priority issues |
| GET | `/api/insights/ai` | AI interpretation of stored statistics (needs at least 5 records) |
| POST | `/api/feedback/{id}/delete` | Deletes a stored analysis |

Responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "code", "message" } }` with friendly messages and appropriate status codes (400 invalid input, 404 not found, 413 too long, 429 rate limit, 502/503 AI problems, 500 database problems). Technical details are logged on the backend only.

## 13. Sample feedback

- *"I have contacted customer support three times regarding my refund and nobody has responded. This is extremely frustrating."*
- *"I was charged twice for my monthly subscription. Please fix this and refund the extra charge."*
- *"Love the new moisturiser! My skin feels great after just a week."*
- *"How do I change the delivery address for an order I placed this morning?"*

## 14. Demo flow (3–5 minutes)

1. Load synthetic data once: `python seed_data.py`, then open the **Dashboard** and show KPIs, sentiment chart and priority issues.
2. Go to **Analyze Feedback**, click *Use sample feedback* (or paste the refund example) and click **Analyze Feedback**.
3. Walk through sentiment, confidence, emotion, intent, topic, urgency, customer risk, key issue, recommended action and the suggested response. Click **Copy Response**.
4. Open **History** and show the new analysis at the top; open its details.
5. Return to the **Dashboard** and show the updated KPIs.
6. Optionally open **Insights** and generate the AI Business Insight.

## Synthetic data notice

`seed_data.py` inserts 18 **fictional, synthetic** records for demonstration only. They do not represent real CBG customers or data. To remove them: `python seed_data.py --reset` replaces all stored data, or delete records from the History page.

## Security notes

- API key loaded from `.env`, never hardcoded or stored in the database
- Input validated and limited to 2000 characters (`MAX_FEEDBACK_LENGTH`)
- Parameterized SQL only; no `eval` or dynamic execution
- CORS limited to the configured frontend origins (`CORS_ORIGINS`)
- Customer text is passed to the model as delimited data, with instructions to ignore embedded instructions
- Users never see stack traces or provider error text

## 15. Future enhancements (Version 2+)

CSV/Excel upload, bulk and batch analysis, trend analysis over time, exportable reports, authentication and roles. The current design supports these: analysis is a standalone function, the API is stateless, and storage is isolated in `database.py`.

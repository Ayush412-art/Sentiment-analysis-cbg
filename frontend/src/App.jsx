import { useCallback, useEffect, useMemo, useState } from 'react';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const CHUNK = 100;
const COLUMN_HINT = /feedback|comment|review|text|message|response/i;

/* ------------------------------------------------------------------ api */
async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the backend. Is it running on ' + API + ' ?');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error?.message || 'Something went wrong. Please try again.');
  }
  return json;
}

/* -------------------------------------------------------------- parsing */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function extractFeedback(name, raw) {
  const text = raw.replace(/^\uFEFF/, '');
  if (/\.csv$/i.test(name)) {
    const rows = parseCsv(text);
    if (rows.length < 2) return [];
    let col = rows[0].findIndex((c) => COLUMN_HINT.test(c));
    if (col < 0) col = 0;
    return rows.slice(1).map((r) => (r[col] || '').trim()).filter(Boolean);
  }
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

const fmtDate = (s) => (s ? new Date(s).toLocaleString() : '');
const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + '…' : s || '');

/* ------------------------------------------------------------ small UI */
function Badge({ value }) {
  const cls = { Positive: 'good', Low: 'good', Neutral: 'mid', Medium: 'warn', Negative: 'bad', High: 'bad' }[value] || 'mid';
  return <span className={`badge ${cls}`}>{value}</span>;
}

function Stat({ label, value, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <p className="muted">No data yet.</p>;
  return (
    <div>
      {data.map((d) => (
        <div className="bar-row" key={d.name}>
          <span className="bar-name">{d.name}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} /></div>
          <span className="bar-count">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function SentimentBar({ p, n, g }) {
  const total = p + n + g || 1;
  return (
    <div>
      <div className="stack">
        <div style={{ width: `${(p / total) * 100}%`, background: 'var(--good)' }} />
        <div style={{ width: `${(g / total) * 100}%`, background: 'var(--mid)' }} />
        <div style={{ width: `${(n / total) * 100}%`, background: 'var(--bad)' }} />
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--good)' }} />Positive {p}</span>
        <span><i style={{ background: 'var(--mid)' }} />Neutral {g}</span>
        <span><i style={{ background: 'var(--bad)' }} />Negative {n}</span>
      </div>
    </div>
  );
}

function Detail({ item, onClose, onDelete }) {
  if (!item) return null;
  const rows = [
    ['Emotion', item.emotion], ['Intent', item.intent], ['Topic', item.topic],
    ['Key issue', item.key_issue], ['Reason', item.reason],
    ['Recommended action', item.recommended_action], ['Suggested response', item.suggested_response],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3>Analysis</h3>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
        <p className="quote">{item.feedback}</p>
        <div className="row gap">
          <Badge value={item.sentiment} />
          <span className="muted">Confidence {Math.round(item.confidence * 100)}%</span>
          <span className="muted">Urgency</span><Badge value={item.urgency} />
          <span className="muted">Risk</span><Badge value={item.customer_risk} />
        </div>
        <dl>{rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
        {onDelete && <button className="btn danger" onClick={() => onDelete(item)}>Delete</button>}
      </div>
    </div>
  );
}

function ResultsTable({ rows, onSelect }) {
  if (!rows.length) return <p className="muted">Nothing to show.</p>;
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Date</th><th>Feedback</th><th>Sentiment</th><th>Topic</th><th>Urgency</th><th>Risk</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onSelect(r)}>
              <td className="nowrap muted">{fmtDate(r.created_at)}</td>
              <td>{cut(r.feedback, 90)}</td>
              <td><Badge value={r.sentiment} /></td>
              <td>{r.topic}</td>
              <td><Badge value={r.urgency} /></td>
              <td><Badge value={r.customer_risk} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- pages */
function Analyze({ onDone }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [single, setSingle] = useState(null);
  const [batch, setBatch] = useState(null);
  const [selected, setSelected] = useState(null);

  const analyzeOne = async () => {
    setBusy(true); setError(''); setSingle(null); setBatch(null);
    try {
      const res = await api('/analyze', { method: 'POST', body: { feedback: text.trim() } });
      setSingle(res.data); onDone();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    setError(''); setSingle(null); setBatch(null);
    if (!/\.(csv|txt)$/i.test(file.name)) { setError('Please choose a .csv or .txt file.'); return; }
    const items = extractFeedback(file.name, await file.text());
    if (!items.length) { setError('No feedback found in that file.'); return; }
    setBusy(true);
    const records = []; let skipped = 0;
    try {
      for (let i = 0; i < items.length; i += CHUNK) {
        setProgress(`Analyzing ${Math.min(i + CHUNK, items.length)} of ${items.length}…`);
        const res = await api('/analyze/batch', { method: 'POST', body: { feedbacks: items.slice(i, i + CHUNK) } });
        records.push(...res.data.records); skipped += res.data.skipped;
      }
    } catch (e) { setError(e.message); }
    setBatch({ records, skipped });
    setBusy(false); setProgress(''); onDone();
  };

  const counts = useMemo(() => {
    const c = { Positive: 0, Neutral: 0, Negative: 0 };
    (batch?.records || []).forEach((r) => { c[r.sentiment]++; });
    return c;
  }, [batch]);

  return (
    <div className="stackv">
      <section className="card">
        <h2>Analyze one comment</h2>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a customer comment…" />
        <div className="row gap">
          <button className="btn primary" disabled={busy || text.trim().length < 3} onClick={analyzeOne}>
            {busy && !progress ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Upload a file</h2>
        <p className="muted">CSV (header row; a column named feedback / comment / review / text is detected) or TXT (one comment per line).</p>
        <input type="file" accept=".csv,.txt" disabled={busy} onChange={(e) => { uploadFile(e.target.files?.[0]); e.target.value = ''; }} />
        {progress && <p>{progress}</p>}
      </section>

      {error && <div className="error">{error}</div>}

      {single && (
        <section className="card">
          <h2>Result</h2>
          <p className="quote">{single.feedback}</p>
          <div className="row gap"><Badge value={single.sentiment} /><span className="muted">Urgency</span><Badge value={single.urgency} /><span className="muted">Risk</span><Badge value={single.customer_risk} /></div>
          <button className="btn ghost" onClick={() => setSelected(single)}>View full analysis</button>
        </section>
      )}

      {batch && (
        <section className="card">
          <h2>Upload results</h2>
          <div className="grid4">
            <Stat label="Analyzed" value={batch.records.length} />
            <Stat label="Positive" value={counts.Positive} tone="good" />
            <Stat label="Neutral" value={counts.Neutral} />
            <Stat label="Negative" value={counts.Negative} tone="bad" />
          </div>
          {batch.skipped > 0 && <p className="muted">{batch.skipped} rows skipped (empty, too short or too long).</p>}
          <ResultsTable rows={batch.records} onSelect={setSelected} />
        </section>
      )}

      <Detail item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Dashboard({ refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [insight, setInsight] = useState(null);
  const [insightMsg, setInsightMsg] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setError('');
    api('/summary').then((r) => setData(r.data)).catch((e) => setError(e.message));
  }, [refreshKey]);

  const getInsight = async () => {
    setInsight(null); setInsightMsg('Generating…');
    try {
      const r = await api('/insights/ai');
      if (!r.data) setInsightMsg(`Need at least ${r.minimum_required} records first.`);
      else { setInsight(r.data); setInsightMsg(''); }
    } catch (e) { setInsightMsg(e.message); }
  };

  if (error) return <div className="error">{error}</div>;
  if (!data) return <p className="muted">Loading…</p>;
  if (data.total === 0) return <p className="muted">No feedback analyzed yet. Use the Analyze tab first.</p>;

  return (
    <div className="stackv">
      <div className="grid6">
        <Stat label="Total" value={data.total} />
        <Stat label="Positive" value={`${data.positive} (${data.positive_pct}%)`} tone="good" />
        <Stat label="Neutral" value={`${data.neutral} (${data.neutral_pct}%)`} />
        <Stat label="Negative" value={`${data.negative} (${data.negative_pct}%)`} tone="bad" />
        <Stat label="High urgency" value={data.high_urgency} tone="warn" />
        <Stat label="High risk" value={data.high_risk} tone="bad" />
      </div>

      <div className="grid3">
        <section className="card"><h2>Sentiment</h2><SentimentBar p={data.positive} g={data.neutral} n={data.negative} /></section>
        <section className="card"><h2>Top topics</h2><Bars data={data.top_topics} /></section>
        <section className="card"><h2>Emotions</h2><Bars data={data.top_emotions} /></section>
      </div>

      <section className="card">
        <h2>Priority issues</h2>
        <ResultsTable rows={data.priority_issues || []} onSelect={setSelected} />
      </section>

      <section className="card">
        <div className="row between">
          <h2>Business insight</h2>
          <button className="btn primary" onClick={getInsight}>{insight ? 'Regenerate' : 'Generate insight'}</button>
        </div>
        {insightMsg && <p className="muted">{insightMsg}</p>}
        {insight && (
          <>
            <p>{insight.insight}</p>
            <ol>{insight.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}</ol>
          </>
        )}
      </section>

      <Detail item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function History({ refreshKey, onChanged }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [urgency, setUrgency] = useState('');
  const [risk, setRisk] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set('search', search.trim());
    if (sentiment) p.set('sentiment', sentiment);
    if (urgency) p.set('urgency', urgency);
    if (risk) p.set('risk', risk);
    setError('');
    api('/history' + (p.toString() ? `?${p}` : '')).then((r) => setRows(r.data)).catch((e) => setError(e.message));
  }, [search, sentiment, urgency, risk]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load, refreshKey]);

  const remove = async (item) => {
    if (!window.confirm('Delete this analysis?')) return;
    try { await api(`/feedback/${item.id}/delete`, { method: 'POST' }); setSelected(null); load(); onChanged(); }
    catch (e) { setError(e.message); }
  };

  const select = (label, value, set, opts) => (
    <select aria-label={label} value={value} onChange={(e) => set(e.target.value)}>
      <option value="">{label}</option>
      {opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="stackv">
      <section className="card row gap wrap">
        <input type="search" placeholder="Search feedback, topic or issue…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        {select('All sentiment', sentiment, setSentiment, ['Positive', 'Neutral', 'Negative'])}
        {select('All urgency', urgency, setUrgency, ['High', 'Medium', 'Low'])}
        {select('All risk', risk, setRisk, ['High', 'Medium', 'Low'])}
      </section>
      {error && <div className="error">{error}</div>}
      <section className="card">
        {rows === null ? <p className="muted">Loading…</p> : <ResultsTable rows={rows} onSelect={setSelected} />}
        {rows && <p className="muted">{rows.length} records</p>}
      </section>
      <Detail item={selected} onClose={() => setSelected(null)} onDelete={remove} />
    </div>
  );
}

/* ------------------------------------------------------------------ app */
export default function App() {
  const [tab, setTab] = useState('analyze');
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <div className="app">
      <style>{CSS}</style>
      <header>
        <h1>Customer Sentiment Analyzer (Made in TCS)</h1>
        <nav>
          {[['analyze', 'Analyze'], ['dashboard', 'Dashboard'], ['history', 'History']].map(([id, label]) => (
            <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'analyze' && <Analyze onDone={bump} />}
        {tab === 'dashboard' && <Dashboard refreshKey={refreshKey} />}
        {tab === 'history' && <History refreshKey={refreshKey} onChanged={bump} />}
      </main>
    </div>
  );
}

const CSS = `
:root{--bg:#f4f6fa;--card:#fff;--text:#1b2433;--muted:#6b7585;--line:#e3e8ef;--brand:#2f5bea;--good:#1f9d63;--mid:#9aa5b5;--warn:#e29a1d;--bad:#d8453b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
.app{max-width:1150px;margin:0 auto;padding:20px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:20px}
h1{font-size:20px;margin:0}h2{font-size:15px;margin:0 0 12px}h3{margin:0}
nav{display:flex;gap:6px}.tab{border:0;background:transparent;padding:8px 14px;border-radius:8px;cursor:pointer;color:var(--muted);font:inherit}
.tab.active{background:var(--brand);color:#fff}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px}
.stackv>*+*{margin-top:16px}.row{display:flex;align-items:center}.gap{gap:10px}.between{justify-content:space-between}.wrap{flex-wrap:wrap}
.grid6{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.grid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:12px}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.stat-value{font-size:22px;font-weight:700}.stat-label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.stat.good .stat-value{color:var(--good)}.stat.bad .stat-value{color:var(--bad)}.stat.warn .stat-value{color:var(--warn)}
textarea,input[type=search],select{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit;background:#fff;color:var(--text)}
select{width:auto}textarea{margin-bottom:12px;resize:vertical}
.btn{border:1px solid var(--line);background:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;font:inherit}
.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}.btn.danger{background:var(--bad);border-color:var(--bad);color:#fff;margin-top:14px}
.btn.ghost{margin-top:10px}.btn:disabled{opacity:.5;cursor:not-allowed}
.muted{color:var(--muted);font-size:13px}.nowrap{white-space:nowrap}
.error{background:#fdecea;color:#8a1f17;border:1px solid #f5c2be;padding:10px 14px;border-radius:8px}
.badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
.badge.good{background:#e0f5ea;color:#12643f}.badge.mid{background:#eceff4;color:#46526a}.badge.warn{background:#fdf0d5;color:#8a5a06}.badge.bad{background:#fbe3e1;color:#9c261d}
.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}tbody tr{cursor:pointer}tbody tr:hover{background:#f7f9fc}
.bar-row{display:grid;grid-template-columns:120px 1fr 28px;gap:8px;align-items:center;margin:6px 0;font-size:13px}
.bar-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar-track{background:#eef1f6;border-radius:6px;height:10px}
.bar-fill{background:var(--brand);height:100%;border-radius:6px}.bar-count{text-align:right;color:var(--muted)}
.stack{display:flex;height:16px;border-radius:8px;overflow:hidden;background:#eef1f6}
.legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:13px}.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px}
.quote{border-left:3px solid var(--line);padding-left:12px;color:#344054;margin:12px 0}
.overlay{position:fixed;inset:0;background:rgba(16,24,40,.45);display:flex;align-items:center;justify-content:center;padding:16px;z-index:10}
.modal{background:#fff;border-radius:14px;padding:22px;max-width:640px;width:100%;max-height:90vh;overflow:auto}
dl{margin:14px 0 0}dt{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-top:10px}dd{margin:2px 0 0}
`;

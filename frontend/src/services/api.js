const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, timeoutMs = 60000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('The request took too long. Please try again.');
    }
    throw new ApiError(
      'Unable to reach the Customer Voice service. Please check that the backend is running and try again.'
    );
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* non-JSON response */
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message =
      payload?.error?.message || 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status);
  }
  return payload;
}

export async function analyzeFeedback(feedback) {
  const res = await request('/analyze', { method: 'POST', body: { feedback } });
  return res.data;
}

export async function getHistory({ search, sentiment, urgency, risk, limit } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (sentiment) params.set('sentiment', sentiment);
  if (urgency) params.set('urgency', urgency);
  if (risk) params.set('risk', risk);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const res = await request(`/history${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function getSummary() {
  const res = await request('/summary');
  return res.data;
}

export async function getAiInsight() {
  // Returns { data, reason?, minimum_required?, based_on? }
  return request('/insights/ai', { timeoutMs: 90000 });
}

export async function deleteFeedback(id) {
  await request(`/feedback/${id}/delete`, { method: 'POST' });
}

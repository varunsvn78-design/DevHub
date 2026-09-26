export const TOKEN_KEY = 'devhub_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export async function api(path, options = {}) {
  const token = getToken();
  let response;
  try {
    response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('session-expired'));
    }
    let message = data.error || `Request failed (${response.status}).`;
    if (response.status === 429) message += ` Retry in ${data.retryAfter || response.headers.get('Retry-After') || 60} seconds.`;
    const error = new Error(message); error.status = response.status; throw error;
  }
  return data;
}

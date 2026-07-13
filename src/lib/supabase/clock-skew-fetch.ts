/**
 * Clerk mints short-lived session tokens whose `nbf` (not-before) claim can
 * land a second or two ahead of Supabase's clock. When that happens Supabase
 * rejects the request with 401 "JWT not yet valid" even though the token is
 * fine a moment later. This fetch wrapper absorbs that race: on that exact
 * error it waits briefly and retries once with the same request.
 *
 * Shared by the server and browser Supabase clients (keep it framework-free).
 */

const RETRY_DELAY_MS = 1500;

export const fetchWithClockSkewRetry: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const body = await response
    .clone()
    .text()
    .catch(() => "");
  if (!body.toLowerCase().includes("not yet valid")) return response;

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return fetch(input, init);
};

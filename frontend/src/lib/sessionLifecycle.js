const leftSessionKey = (sessionId) => `codezenith:left-session:${sessionId}`;

export function markSessionLeft(sessionId) {
  if (!sessionId) return;
  sessionStorage.setItem(leftSessionKey(sessionId), "true");
}

export function clearSessionLeft(sessionId) {
  if (!sessionId) return;
  sessionStorage.removeItem(leftSessionKey(sessionId));
}

export function hasLeftSession(sessionId) {
  if (!sessionId) return false;
  return sessionStorage.getItem(leftSessionKey(sessionId)) === "true";
}

/**
 * Where to go after logging in. Kept in sessionStorage (this tab only) rather than in the URL,
 * so a path that holds a token (the email change link) never appears in the login page's URL,
 * server logs or browser history.
 */
const KEY = 'team-ops:return-to'

/**
 * Keeps a return path safe: only a path on this site. The value is parsed as a URL against
 * this origin, so tricks such as "//host", "/\host" or "/\t/host" cannot point elsewhere.
 */
export function safeNext(next: string | null): string | null {
  // eslint-disable-next-line no-control-regex
  if (next === null || !next.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(next)) {
    return null
  }
  try {
    const url = new URL(next, window.location.origin)
    if (url.origin !== window.location.origin) {
      return null
    }
    return url.pathname + url.search + url.hash
  } catch {
    return null
  }
}

export function saveReturnTo(path: string): void {
  const safe = safeNext(path)
  if (safe === null) return
  try {
    sessionStorage.setItem(KEY, safe)
  } catch {
    // Storage can be unavailable (private mode). Then the user lands on the home page.
  }
}

/** Reads the saved path without forgetting it (for showing a hint before login). */
export function peekReturnTo(): string | null {
  try {
    return safeNext(sessionStorage.getItem(KEY))
  } catch {
    return null
  }
}

/** Reads the saved path once and forgets it. */
export function takeReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return safeNext(value)
  } catch {
    return null
  }
}

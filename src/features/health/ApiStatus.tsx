import { useEffect, useState } from 'react'

type Status = 'checking' | 'ok' | 'unavailable'

const messages: Record<Status, string> = {
  checking: 'APIへの接続を確認しています',
  ok: 'APIに接続しました',
  unavailable: 'APIに接続できません。開発環境が起動しているか確認してください',
}

/** Shows whether the web app can reach team-ops-api (used to verify the local environment). */
export function ApiStatus() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'ok' : 'unavailable'))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setStatus('unavailable')
        }
      })
    return () => controller.abort()
  }, [])

  return (
    <p role="status" style={{ margin: 0, color: status === 'unavailable' ? 'var(--color-unread)' : 'var(--color-ink)' }}>
      {messages[status]}
    </p>
  )
}

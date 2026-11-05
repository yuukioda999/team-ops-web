import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Reads ?token= from a mail link once and then removes it from the address bar, so the token
 * does not stay in the browser history or reach the server again on reload (plan.md D7).
 */
export function useLinkToken(): string {
  const [params, setParams] = useSearchParams()
  const [token] = useState(() => params.get('token') ?? '')

  useEffect(() => {
    if (params.has('token')) {
      const rest = new URLSearchParams(params)
      rest.delete('token')
      setParams(rest, { replace: true })
    }
  }, [params, setParams])

  return token
}

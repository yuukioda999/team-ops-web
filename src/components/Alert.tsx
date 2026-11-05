import type { ReactNode } from 'react'

/** A message about what just happened. Errors are announced immediately (role=alert). */
export function Alert({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}

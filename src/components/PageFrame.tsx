import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Crest } from './Crest.tsx'

type Props = {
  title: string
  /** Where the brand links to. */
  home?: string
  /** Shown under the header after login (who is logged in). */
  signedInAs?: string
  /** Show the account button (to the settings page). */
  account?: boolean
  /** Extra control in the header, such as the team switcher. */
  headerExtra?: ReactNode
  children: ReactNode
}

export function PageFrame({ title, home = '/', signedInAs, account = false, headerExtra, children }: Props) {
  return (
    <div className="page">
      <header className="topbar">
        <Link to={home} className="topbar__brand">
          <Crest />
          <span className="topbar__title">{title}</span>
        </Link>
        <div className="topbar__actions">
          {headerExtra}
          {account && (
            <Link to="/settings" className="icon-button" aria-label="アカウント設定">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
            </Link>
          )}
        </div>
      </header>
      {signedInAs !== undefined && (
        <p className="signed-in-as">
          ログイン中:<strong>{signedInAs}</strong>
        </p>
      )}
      <main className="stack">{children}</main>
    </div>
  )
}

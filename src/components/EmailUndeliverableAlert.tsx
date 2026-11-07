import { useContext } from 'react'
import { Link, useLocation } from 'react-router'
import { SessionContext } from '../features/auth/session-context.ts'

/**
 * お知らせのメールがアドレスの問題で届かなかったことを本人に知らせる(AC-006-16)。
 * アドレスを変えると API の email_undeliverable が false になり、表示が消える(AC-006-17)。
 */
export function EmailUndeliverableAlert() {
  const session = useContext(SessionContext)
  const { pathname } = useLocation()
  if (session?.state.status !== 'signed-in' || !session.state.me.email_undeliverable) {
    return null
  }
  return (
    <div className="alert alert--error undeliverable" role="alert">
      <p className="undeliverable__text">メールが届いていません。メールアドレスを確認してください。</p>
      <p className="undeliverable__sub">直すまで、お知らせはメールで届かず、アプリだけに届きます。</p>
      {pathname !== '/settings' && (
        <Link to="/settings" className="text-link">
          メールアドレスを変更する
        </Link>
      )}
    </div>
  )
}

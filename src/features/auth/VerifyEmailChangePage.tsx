import { useState } from 'react'
import { Link } from 'react-router'
import { api, errorMessage, withCsrfRetry } from '../../api/client.ts'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useMe, useSession } from './session-context.ts'
import { useLinkToken } from './use-link-token.ts'

/**
 * 確認メールのリンクから開く画面。申請した本人がログインしているときだけ変更できる
 * (plan.md D5)。ログインしていなければ、ログインしてからこの画面に戻る(RequireSignedIn)。
 */
export function VerifyEmailChangePage() {
  const me = useMe()
  const { setMe } = useSession()
  const token = useLinkToken()
  const [result, setResult] = useState<'done' | string | null>(token === '' ? 'リンクの有効期限が切れています' : null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    const { data, response, error } = await withCsrfRetry(() =>
      api.POST('/api/me/email-changes/consume', { body: { token } }),
    )
    setBusy(false)
    if (data !== undefined) {
      setMe(data)
      setResult('done')
    } else {
      setResult(response.status === 410 || response.status === 422 ? 'リンクの有効期限が切れています' : errorMessage(error))
    }
  }

  if (result === 'done') {
    return (
      <PageFrame title="アカウント設定" pageTitle="メールアドレスを変更しました" signedInAs={me.email} account>
        <Panel tag="変更しました" title="メールアドレスを変更しました">
          <p className="panel__text">
            これからのお知らせは <strong>{me.email}</strong> に届きます。前のメールアドレスにも、変更したことを知らせました。
          </p>
          <Link to="/" className="button button--accent">
            チームの画面に戻る
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  if (result !== null) {
    return (
      <PageFrame title="アカウント設定" pageTitle={result} signedInAs={me.email} account>
        <Panel tag="メールアドレスの変更" title={result}>
          <p className="panel__text">
            確認メールのリンクは15分で無効になり、1回だけ使えます。変更を申請したアカウントでログインしているかも確認してください。
          </p>
          <Link to="/settings" className="button button--accent">
            アカウント設定から申請し直す
          </Link>
        </Panel>
      </PageFrame>
    )
  }

  return (
    <PageFrame title="アカウント設定" pageTitle="メールアドレスの変更" signedInAs={me.email} account>
      <Panel tag="メールアドレスの変更" meta="あと1ステップ" title="メールアドレスを変更しますか">
        <p className="panel__text">下のボタンを押すと、このメールで確認した新しいアドレスに変わります。</p>
        <button type="button" className="button button--accent" onClick={() => void confirm()} disabled={busy}>
          {busy ? '変更しています' : 'メールアドレスを変更する'}
        </button>
      </Panel>
    </PageFrame>
  )
}

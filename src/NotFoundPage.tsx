import { Link } from 'react-router'
import { PageFrame } from './components/PageFrame.tsx'
import { Panel } from './components/Panel.tsx'

export function NotFoundPage() {
  return (
    <PageFrame title="チーム運営" pageTitle="ページが見つかりません">
      <Panel tag="404" title="ページが見つかりません">
        <p className="panel__text">URL が間違っているか、ページが移動した可能性があります。</p>
        <Link to="/" className="button button--accent">
          トップに戻る
        </Link>
      </Panel>
    </PageFrame>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api, errorMessage, fieldErrors, withCsrfRetry, type CsvProblem, type PlayerImportPreview, type Team } from '../../api/client.ts'
import { Alert } from '../../components/Alert.tsx'
import { PageFrame } from '../../components/PageFrame.tsx'
import { Panel } from '../../components/Panel.tsx'
import { useMe } from '../auth/session-context.ts'
import { TeamPageGate } from '../invitations/TeamPageGate.tsx'
import { GRADE_LABELS } from './grades.ts'

/**
 * 名簿の CSV 取り込み(AC-003-13〜19・21、ADR-0014)。代表・役員だけ。
 * 確認で件数・先頭10行・エラー・重複の警告を見せ、確定では同じファイルをもう一度送る。
 */
export function ImportPage() {
  const { teamId = '' } = useParams()
  return (
    <TeamPageGate key={teamId} teamId={teamId} allowed={(team) => team.permissions.manage_players}>
      {(team) => <Import team={team} />}
    </TeamPageGate>
  )
}

/** The generated type has the file as a string (binary); the real File goes in through the body serializer. */
function upload(file: File, hash?: string) {
  const form = new FormData()
  form.append('file', file)
  if (hash !== undefined) form.append('file_hash', hash)
  return { body: { file: file.name, file_hash: hash ?? '' }, bodySerializer: () => form }
}

function Import({ team }: { team: Team }) {
  const me = useMe()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PlayerImportPreview | null>(null)
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function choose(chosen: File | null) {
    setFile(chosen)
    setPreview(null)
    setFileErrors([])
    setFailure(null)
  }

  async function check(event: FormEvent) {
    event.preventDefault()
    if (file === null) {
      setFileErrors(['CSVファイルを選んでください'])
      return
    }
    setBusy(true)
    const { data, error } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/players/import/preview', { params: { path: { team: team.id } }, ...upload(file) }),
    )
    setBusy(false)
    if (data !== undefined) {
      setPreview(data)
      setFileErrors([])
      setFailure(null)
    } else {
      setPreview(null)
      const fields = fieldErrors(error).file
      setFileErrors(fields ?? [])
      setFailure(fields === undefined ? errorMessage(error) : null)
    }
  }

  async function confirm() {
    if (file === null || preview === null) return
    setBusy(true)
    const { data, error } = await withCsrfRetry(() =>
      api.POST('/api/teams/{team}/players/import', { params: { path: { team: team.id } }, ...upload(file, preview.file_hash) }),
    )
    setBusy(false)
    if (data !== undefined) {
      navigate(`/teams/${team.id}/players`, { replace: true, state: { notice: `${data.imported}人を名簿に取り込みました。` } })
      return
    }
    // 確認から確定までの間にファイルや名簿が変わった場合。もう一度確認してもらう
    const fields = fieldErrors(error)
    setPreview(null)
    setFileErrors([...(fields.file ?? []), ...(fields.file_hash ?? [])])
    setFailure(fields.file === undefined && fields.file_hash === undefined ? errorMessage(error) : '取り込めませんでした。内容を直して、もう一度確認してください。')
  }

  return (
    <PageFrame title={team.name} pageTitle="CSVで一括登録" home={`/teams/${team.id}`} signedInAs={me.email} account>
      <Panel tag="名簿" meta={team.name} title="CSVで一括登録">
        <p className="panel__text">見出しが「表示名,学年,背番号」のCSVを選んでください。Excelで保存したファイル(Shift_JIS)もそのまま使えます。</p>
      </Panel>
      <section className="sheet" aria-labelledby="template-title">
        <h2 id="template-title" className="sheet__title">
          1. テンプレートを用意する
        </h2>
        <p className="sheet__text">学年は「未就学」「小1」〜「小6」「中1」〜「中3」のどれかです。背番号は空欄でもかまいません。500行・1MBまで取り込めます。</p>
        <a href={`/api/teams/${team.id}/players/import/template`} download="players-template.csv" className="button button--secondary">
          テンプレートをダウンロード
        </a>
      </section>
      <form className="sheet" onSubmit={(e) => void check(e)} noValidate aria-labelledby="file-title">
        <h2 id="file-title" className="sheet__title">
          2. ファイルを確認する
        </h2>
        <div className="field">
          <label className="field__label" htmlFor="csv-file">
            CSVファイル
          </label>
          <input
            id="csv-file"
            className="field__file"
            type="file"
            accept=".csv,text/csv"
            aria-invalid={fileErrors.length > 0 ? true : undefined}
            aria-describedby={fileErrors.length > 0 ? 'csv-file-error' : undefined}
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
          {fileErrors.length > 0 && (
            <ul id="csv-file-error" className="problem-list problem-list--error">
              {fileErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
        <button type="submit" className="button button--accent" disabled={busy}>
          内容を確認する
        </button>
      </form>
      {failure !== null && <Alert tone="error">{failure}</Alert>}
      {preview !== null && <PreviewResult preview={preview} busy={busy} onConfirm={() => void confirm()} />}
      <Link to={`/teams/${team.id}/players`} className="text-link">
        名簿に戻る
      </Link>
    </PageFrame>
  )
}

function Problems({ id, title, problems, tone }: { id: string; title: string; problems: CsvProblem[]; tone: 'error' | 'warning' }) {
  return (
    <div className="stack">
      <h3 id={id} className="sheet__subtitle">
        {title}
      </h3>
      <ul className={`problem-list problem-list--${tone}`} aria-labelledby={id}>
        {problems.map((p) => (
          <li key={`${p.line ?? 'file'}:${p.column ?? ''}:${p.message}`}>{p.message}</li>
        ))}
      </ul>
    </div>
  )
}

function PreviewResult({ preview, busy, onConfirm }: { preview: PlayerImportPreview; busy: boolean; onConfirm: () => void }) {
  const blocked = preview.errors.length > 0
  return (
    <section className="sheet" aria-labelledby="preview-title">
      <h2 id="preview-title" className="sheet__title">
        3. 確認して取り込む
      </h2>
      {blocked ? (
        <>
          <p className="sheet__text">エラーが{preview.errors.length}件あります。1件でもエラーがあると、取り込めません。CSVを直して、もう一度確認してください。</p>
          <Problems id="preview-errors" title="エラー" problems={preview.errors} tone="error" />
        </>
      ) : (
        <p className="sheet__text">
          <strong className="score preview-count">{preview.count}</strong>人を取り込みます。まだ登録はしていません。
        </p>
      )}
      {preview.warnings.length > 0 && (
        <Problems id="preview-warnings" title="重複の可能性(取り込めます)" problems={preview.warnings} tone="warning" />
      )}
      {preview.rows.length > 0 && (
        <div className="preview-table">
          <table>
            <caption>先頭{preview.rows.length}行</caption>
            <thead>
              <tr>
                <th scope="col">行</th>
                <th scope="col">表示名</th>
                <th scope="col">学年</th>
                <th scope="col">背番号</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.line}>
                  <td>{row.line}</td>
                  <td>{row.display_name}</td>
                  <td>{GRADE_LABELS[row.grade]}</td>
                  <td>{row.number ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!blocked && (
        <button type="button" className="button button--accent" onClick={onConfirm} disabled={busy}>
          {preview.count}人を取り込む
        </button>
      )}
    </section>
  )
}

import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Player, PlayerImportPreview } from '../../api/client.ts'
import { renderAt, signedIn, team } from '../../test/render.tsx'

const U10 = team()
const coachTeam = team({ roles: ['coach'], permissions: { manage_invitation: false, review_join_requests: false, manage_players: false, view_players: true, view_all_players: true } })
const parentTeam = team({ roles: ['parent'], permissions: { manage_invitation: false, review_join_requests: false, manage_players: false, view_players: true, view_all_players: false } })
const BASE = `/api/teams/${U10.id}`

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 1,
  display_name: '山田 太郎',
  grade: 'e3',
  number: 10,
  guardians: [{ membership_id: 11, display_name: '山田 母' }],
  ...overrides,
})
const roster = (players: Player[], scope: 'all' | 'own' = 'all') => ({ status: 200, body: { scope, players } })

describe('名簿を見る', () => {
  it('AC-003-08 a representative sees every player with grade, number and guardians', async () => {
    renderAt(`/teams/${U10.id}/players`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players`]: roster([player(), player({ id: 2, display_name: '佐藤 次郎', grade: 'e1', number: null, guardians: [] })]),
    })

    const list = await screen.findByRole('list', { name: '選手' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link', { name: '山田 太郎' })).toHaveAttribute('href', `/teams/${U10.id}/players/1`)
    expect(items[0]).toHaveTextContent('小3 / 保護者:山田 母')
    expect(items[0]).toHaveTextContent('背番号10')
    // 背番号なしは「-」を見せ、読み上げでは「背番号 なし」と伝える
    expect(within(items[1]).getByText('背番号')).toHaveClass('visually-hidden')
    expect(within(items[1]).getByText('なし')).toHaveClass('visually-hidden')
    expect(items[1]).toHaveTextContent('小1 / 保護者:未登録')
    expect(screen.getByText('2人')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '選手を登録する' })).toHaveAttribute('href', `/teams/${U10.id}/players/new`)
    expect(screen.getByRole('link', { name: 'CSVで一括登録する' })).toHaveAttribute('href', `/teams/${U10.id}/players/import`)
  })

  it('AC-003-08 a coach sees everyone but cannot change the roster', async () => {
    renderAt(`/teams/${U10.id}/players`, {
      'GET /api/me': signedIn({ teams: [coachTeam] }),
      [`GET ${BASE}`]: { status: 200, body: coachTeam },
      [`GET ${BASE}/players`]: roster([player()]),
    })

    expect(await screen.findByText('山田 太郎')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '山田 太郎' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '選手を登録する' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '絞り込む' })).toBeInTheDocument()
  })

  it('AC-003-09 a parent sees only their own children, with no filters or edit links', async () => {
    renderAt(`/teams/${U10.id}/players`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/players`]: roster([player()], 'own'),
    })

    expect(await screen.findByRole('heading', { name: 'あなたのお子さん' })).toBeInTheDocument()
    expect(screen.getByText(/他のご家庭の情報は表示されません/)).toBeInTheDocument()
    expect(await screen.findByText('山田 太郎')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '絞り込む' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '選手を登録する' })).not.toBeInTheDocument()
  })

  it('AC-003-09 a parent with no linked child is told who links them', async () => {
    renderAt(`/teams/${U10.id}/players`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/players`]: roster([], 'own'),
    })

    expect(await screen.findByRole('heading', { name: '紐づいている選手はいません' })).toBeInTheDocument()
    expect(screen.getByText('お子さんとの紐づけは、チームの代表・役員が行います。')).toBeInTheDocument()
  })

  it('AC-003-08 AC-003-09 the team home links to the roster for every role', async () => {
    renderAt(`/teams/${U10.id}`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
    })

    expect(await screen.findByRole('link', { name: 'お子さんの情報を見る' })).toHaveAttribute('href', `/teams/${U10.id}/players`)
  })

  it('AC-003-12 pressing the filter without changing it reloads the list instead of hanging', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/players`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players`]: roster([player()]),
    })

    await screen.findByText('山田 太郎')
    await userEvent.click(screen.getByRole('button', { name: '絞り込む' }))
    expect(await screen.findByText('山田 太郎')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '絞り込む' }))
    expect(await screen.findByText('山田 太郎')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === `${BASE}/players`)).toHaveLength(3)
  })

  it('AC-003-08 a member without roster permission is told who can see it', async () => {
    const noRoster = team({ roles: [], permissions: { manage_invitation: false, review_join_requests: false, manage_players: false, view_players: false, view_all_players: false } })
    renderAt(`/teams/${U10.id}/players`, {
      'GET /api/me': signedIn({ teams: [noRoster] }),
      [`GET ${BASE}`]: { status: 200, body: noRoster },
    })

    expect(await screen.findByText('名簿は、代表・役員・コーチと、選手に紐づく保護者が見られます。')).toBeInTheDocument()
  })

  it('AC-003-12 filters by grade and number', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/players`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players`]: roster([player()]),
    })

    await screen.findByText('山田 太郎')
    await userEvent.selectOptions(screen.getByLabelText('学年'), '小3')
    await userEvent.type(screen.getByLabelText('背番号'), '1a0')
    await userEvent.click(screen.getByRole('button', { name: '絞り込む' }))

    await screen.findByText('山田 太郎')
    const last = calls.filter((c) => c.path === `${BASE}/players`).at(-1)
    expect(new URLSearchParams(last?.search).get('grade')).toBe('e3')
    expect(new URLSearchParams(last?.search).get('number')).toBe('10')
  })
})

describe('選手を登録・編集する', () => {
  const candidates = { status: 200, body: { candidates: [{ membership_id: 11, display_name: '山田 母' }, { membership_id: 12, display_name: '山田 父' }] } }

  it('AC-003-01 registers a player and opens it to link guardians', async () => {
    const created = player({ id: 5, guardians: [] })
    const { calls, router } = renderAt(`/teams/${U10.id}/players/new`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players`]: { status: 201, body: { player: created, possible_duplicate: false } },
      [`GET ${BASE}/players/5`]: { status: 200, body: { player: created } },
      [`GET ${BASE}/guardian-candidates`]: candidates,
    })

    await userEvent.type(await screen.findByLabelText('表示名'), '山田 太郎')
    await userEvent.selectOptions(screen.getByLabelText('学年'), '小3')
    await userEvent.type(screen.getByLabelText('背番号(任意)'), '10')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByText('山田 太郎さんを登録しました。続けて保護者を紐づけられます。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/players/5`)
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ display_name: '山田 太郎', grade: 'e3', number: 10 })
  })

  it('AC-003-03 warns when a player with the same name and grade already exists', async () => {
    const created = player({ id: 5 })
    renderAt(`/teams/${U10.id}/players/new`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players`]: { status: 201, body: { player: created, possible_duplicate: true } },
      [`GET ${BASE}/players/5`]: { status: 200, body: { player: created } },
      [`GET ${BASE}/guardian-candidates`]: candidates,
    })

    await userEvent.type(await screen.findByLabelText('表示名'), '山田 太郎')
    await userEvent.selectOptions(screen.getByLabelText('学年'), '小3')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByText(/同じ表示名・学年の選手がすでにいます。重複していないか、名簿で確かめてください。/)).toBeInTheDocument()
  })

  it('AC-003-04 shows why the 201st player cannot be registered', async () => {
    const reason = '選手は1チーム200人までです。今は200人なので、登録できるのはあと0人です。'
    renderAt(`/teams/${U10.id}/players/new`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players`]: { status: 422, body: { message: '入力内容を確認してください', errors: { players: [reason] } } },
    })

    await userEvent.type(await screen.findByLabelText('表示名'), '201人目')
    await userEvent.selectOptions(screen.getByLabelText('学年'), '小1')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(reason)
  })

  it('AC-003-01 asks for the grade before sending', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/players/new`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
    })

    await userEvent.type(await screen.findByLabelText('表示名'), '山田')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByText('学年を選んでください')).toBeInTheDocument()
    expect(screen.getByLabelText('学年')).toHaveAttribute('aria-invalid', 'true')
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('AC-003-01 a coach cannot open the register page', async () => {
    renderAt(`/teams/${U10.id}/players/new`, {
      'GET /api/me': signedIn({ teams: [coachTeam] }),
      [`GET ${BASE}`]: { status: 200, body: coachTeam },
    })

    expect(await screen.findByRole('heading', { name: 'この画面を開く権限がありません' })).toBeInTheDocument()
  })

  it('AC-003-02 edits a player', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/players/1`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players/1`]: { status: 200, body: { player: player() } },
      [`GET ${BASE}/guardian-candidates`]: candidates,
      [`PATCH ${BASE}/players/1`]: { status: 200, body: { player: player({ grade: 'e4', number: null }) } },
    })

    expect(await screen.findByLabelText('表示名')).toHaveValue('山田 太郎')
    await userEvent.selectOptions(screen.getByLabelText('学年'), '小4')
    await userEvent.clear(screen.getByLabelText('背番号(任意)'))
    await userEvent.click(screen.getByRole('button', { name: '保存する' }))

    expect(await screen.findByText('保存しました。')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ display_name: '山田 太郎', grade: 'e4', number: null })
  })

  it('AC-003-02 deletes a player after a second confirmation', async () => {
    const { calls, router } = renderAt(`/teams/${U10.id}/players/1`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players/1`]: { status: 200, body: { player: player() } },
      [`GET ${BASE}/guardian-candidates`]: candidates,
      [`DELETE ${BASE}/players/1`]: { status: 204 },
      [`GET ${BASE}/players`]: roster([]),
    })

    await userEvent.click(await screen.findByRole('button', { name: '削除する' }))
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: '山田 太郎さんを削除する' }))

    expect(await screen.findByText('山田 太郎さんを名簿から削除しました。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/players`)
  })

  it('AC-003-05 AC-003-06 links and unlinks guardians from the parent candidates', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/players/1`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players/1`]: { status: 200, body: { player: player() } },
      [`GET ${BASE}/guardian-candidates`]: candidates,
      [`PUT ${BASE}/players/1/guardians`]: { status: 200, body: { player: player({ guardians: [{ membership_id: 12, display_name: '山田 父' }] }) } },
    })

    const mother = await screen.findByRole('checkbox', { name: '山田 母' })
    expect(mother).toBeChecked()
    await userEvent.click(mother)
    await userEvent.click(screen.getByRole('checkbox', { name: '山田 父' }))
    await userEvent.click(screen.getByRole('button', { name: '保護者の紐づけを保存する' }))

    expect(await screen.findByText('保護者の紐づけを保存しました。')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ membership_ids: [12] })
  })

  it('AC-003-05 allows up to four guardians', async () => {
    const many = { status: 200, body: { candidates: [11, 12, 13, 14, 15].map((id) => ({ membership_id: id, display_name: `保護者${id}` })) } }
    const four = [11, 12, 13, 14].map((id) => ({ membership_id: id, display_name: `保護者${id}` }))
    renderAt(`/teams/${U10.id}/players/1`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players/1`]: { status: 200, body: { player: player({ guardians: four }) } },
      [`GET ${BASE}/guardian-candidates`]: many,
    })

    expect(await screen.findByRole('checkbox', { name: '保護者15' })).toBeDisabled()
    expect(screen.getByText(/4人まで選べます。別の人を選ぶときは/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: '保護者11' }))
    expect(screen.getByRole('checkbox', { name: '保護者15' })).toBeEnabled()
  })

  it('AC-003-07 with no parent members, it points to the invitation instead', async () => {
    renderAt(`/teams/${U10.id}/players/1`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/players/1`]: { status: 200, body: { player: player({ guardians: [] }) } },
      [`GET ${BASE}/guardian-candidates`]: { status: 200, body: { candidates: [] } },
    })

    expect(await screen.findByText(/保護者の役割を持つメンバーがまだいません/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'メンバーを招待する' })).toHaveAttribute('href', `/teams/${U10.id}/invitation`)
  })
})

describe('CSVで一括登録する', () => {
  const csv = () => new File(['表示名,学年,背番号\n山田 太郎,小3,10\n'], 'players.csv', { type: 'text/csv' })
  const result = (overrides: Partial<PlayerImportPreview> = {}): PlayerImportPreview => ({
    file_hash: 'f'.repeat(64),
    count: 12,
    rows: [{ line: 2, display_name: '山田 太郎', grade: 'e3', number: 10 }],
    errors: [],
    warnings: [],
    ...overrides,
  })

  it('AC-003-13 offers the template download', async () => {
    renderAt(`/teams/${U10.id}/players/import`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
    })

    expect(await screen.findByRole('link', { name: 'テンプレートをダウンロード' })).toHaveAttribute('href', `${BASE}/players/import/template`)
  })

  it('AC-003-14 previews the count and rows, then imports the same file with its hash', async () => {
    const { calls, router } = renderAt(`/teams/${U10.id}/players/import`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players/import/preview`]: { status: 200, body: result() },
      [`POST ${BASE}/players/import`]: { status: 201, body: { imported: 12 } },
      [`GET ${BASE}/players`]: roster([player()]),
    })

    await userEvent.upload(await screen.findByLabelText('CSVファイル'), csv())
    await userEvent.click(screen.getByRole('button', { name: '内容を確認する' }))

    expect(await screen.findByText(/人を取り込みます。まだ登録はしていません。/)).toHaveTextContent('12人を取り込みます。')
    expect(within(screen.getByRole('table', { name: '先頭1行' })).getByText('山田 太郎')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === `${BASE}/players/import`)).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: '12人を取り込む' }))

    expect(await screen.findByText('12人を名簿に取り込みました。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/players`)
    // The test fetch reads the multipart body back with request.formData() (a FormData of the test runtime)
    const sent = calls.find((c) => c.path === `${BASE}/players/import`)?.body as FormData
    expect(sent.get('file_hash')).toBe('f'.repeat(64))
    expect(await (sent.get('file') as Blob).text()).toBe('表示名,学年,背番号\n山田 太郎,小3,10\n')
  })

  it('AC-003-15 lists the errors with line, column and reason and offers no import', async () => {
    const message = '3行目 学年:『小7』は選べません(未就学、小1〜小6、中1〜中3)'
    renderAt(`/teams/${U10.id}/players/import`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players/import/preview`]: { status: 200, body: result({ count: 1, errors: [{ line: 3, column: '学年', message }] }) },
    })

    await userEvent.upload(await screen.findByLabelText('CSVファイル'), csv())
    await userEvent.click(screen.getByRole('button', { name: '内容を確認する' }))

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByText(/1件でもエラーがあると、取り込めません/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /を取り込む/ })).not.toBeInTheDocument()
  })

  it('AC-003-17 shows the size or row limit', async () => {
    renderAt(`/teams/${U10.id}/players/import`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players/import/preview`]: {
        status: 422,
        body: { message: '入力内容を確認してください', errors: { file: ['CSVは500行(見出しを除く)までです。501行あります。'] } },
      },
    })

    await userEvent.upload(await screen.findByLabelText('CSVファイル'), csv())
    await userEvent.click(screen.getByRole('button', { name: '内容を確認する' }))

    expect(await screen.findByText('CSVは500行(見出しを除く)までです。501行あります。')).toBeInTheDocument()
    expect(screen.getByLabelText('CSVファイル')).toHaveAttribute('aria-invalid', 'true')
  })

  it('AC-003-21 shows possible duplicates as warnings and still allows the import', async () => {
    renderAt(`/teams/${U10.id}/players/import`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players/import/preview`]: {
        status: 200,
        body: result({ warnings: [{ line: 2, column: '表示名', message: '2行目:同じ表示名・学年の選手がすでに名簿にいます' }] }),
      },
    })

    await userEvent.upload(await screen.findByLabelText('CSVファイル'), csv())
    await userEvent.click(screen.getByRole('button', { name: '内容を確認する' }))

    expect(await screen.findByRole('heading', { name: '重複の可能性(取り込めます)' })).toBeInTheDocument()
    expect(screen.getByText('2行目:同じ表示名・学年の選手がすでに名簿にいます')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '12人を取り込む' })).toBeInTheDocument()
  })

  it('AC-003-14 when the roster changed before confirming, asks to check again', async () => {
    const reason = '選手は1チーム200人までです。今は198人なので、登録できるのはあと2人です。'
    renderAt(`/teams/${U10.id}/players/import`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`POST ${BASE}/players/import/preview`]: { status: 200, body: result({ count: 3 }) },
      [`POST ${BASE}/players/import`]: { status: 422, body: { message: '入力内容を確認してください', errors: { file: [reason] } } },
    })

    await userEvent.upload(await screen.findByLabelText('CSVファイル'), csv())
    await userEvent.click(screen.getByRole('button', { name: '内容を確認する' }))
    await userEvent.click(await screen.findByRole('button', { name: '3人を取り込む' }))

    expect(await screen.findByText(reason)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('取り込めませんでした。内容を直して、もう一度確認してください。')
    expect(screen.queryByRole('button', { name: '3人を取り込む' })).not.toBeInTheDocument()
  })

  it('AC-003-13 a parent cannot open the import page', async () => {
    renderAt(`/teams/${U10.id}/players/import`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
    })

    expect(await screen.findByRole('heading', { name: 'この画面を開く権限がありません' })).toBeInTheDocument()
  })
})

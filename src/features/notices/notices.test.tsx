import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Notice } from '../../api/client.ts'
import { permissions, renderAt, signedIn, team } from '../../test/render.tsx'

const U10 = team()
const coachTeam = team({ roles: ['coach'], permissions: permissions({ view_players: true, view_all_players: true, create_notices: true }) })
const parentTeam = team({ roles: ['parent'], permissions: permissions({ view_players: true }) })
const BASE = `/api/teams/${U10.id}`

const notice = (overrides: Partial<Notice> = {}): Notice => ({
  id: 7,
  title: '来週の試合',
  body: '集合は8時です。',
  target: { type: 'all', values: [] },
  status: 'published',
  scheduled_at: null,
  published_at: '2026-11-07T23:00:00+00:00',
  recipient_count: 12,
  author_display_name: '代表 太郎',
  ...overrides,
})

describe('チームのホームの導線', () => {
  it('everyone gets the notice list, and only senders get the compose link', async () => {
    renderAt(`/teams/${U10.id}`, { 'GET /api/me': signedIn({ teams: [parentTeam] }), [`GET ${BASE}`]: { status: 200, body: parentTeam } })

    expect(await screen.findByRole('link', { name: 'お知らせを見る' })).toHaveAttribute('href', `/teams/${U10.id}/notices`)
    expect(screen.queryByRole('link', { name: 'お知らせを書く' })).not.toBeInTheDocument()
  })
})

describe('お知らせ一覧と表示', () => {
  it('AC-005-14 lists notices addressed to me, newest first as returned', async () => {
    renderAt(`/teams/${U10.id}/notices`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/notices`]: { status: 200, body: { notices: [notice({ id: 8, title: '雨天中止' }), notice()] } },
    })

    const items = within(await screen.findByRole('list', { name: 'お知らせ' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', `/teams/${U10.id}/notices/8`)
    expect(items[1]).toHaveTextContent('来週の試合11/8(日) 08:00 / 代表 太郎')
    // 保護者には作成の導線を出さない
    expect(screen.queryByRole('link', { name: 'お知らせを書く' })).not.toBeInTheDocument()
  })

  it('AC-005-14 says when there is nothing yet, and offers writing to a coach', async () => {
    renderAt(`/teams/${U10.id}/notices`, {
      'GET /api/me': signedIn({ teams: [coachTeam] }),
      [`GET ${BASE}`]: { status: 200, body: coachTeam },
      [`GET ${BASE}/notices`]: { status: 200, body: { notices: [] } },
    })

    expect(await screen.findByRole('heading', { name: 'まだお知らせはありません' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'お知らせを書く' })).toHaveAttribute('href', `/teams/${U10.id}/notices/new`)
    expect(screen.getByRole('link', { name: '予約中のお知らせ' })).toBeInTheDocument()
  })

  it('AC-005-16 shows the body as text and links only http and https URLs', async () => {
    const body = '<script>alert(1)</script>\n詳しくは https://example.invalid/a?b=1 を見てください。\njavascript:alert(2) はリンクにしない'
    renderAt(`/teams/${U10.id}/notices/7`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/notices/7`]: { status: 200, body: { notice: notice({ body }) } },
    })

    const article = await screen.findByRole('article', { name: '本文' })
    expect(article).toHaveTextContent('<script>alert(1)</script>')
    expect(article.querySelector('script')).toBeNull()
    const links = within(article).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://example.invalid/a?b=1')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(screen.getByText(/代表 太郎さんから \/ 宛先:全員/)).toBeInTheDocument()
  })

  it('AC-005-15 a notice not addressed to me is shown as not found', async () => {
    renderAt(`/teams/${U10.id}/notices/9`, {
      'GET /api/me': signedIn({ teams: [parentTeam] }),
      [`GET ${BASE}`]: { status: 200, body: parentTeam },
      [`GET ${BASE}/notices/9`]: { status: 404, body: { message: '見つかりません' } },
    })

    expect(await screen.findByRole('heading', { name: 'お知らせが見つかりません' })).toBeInTheDocument()
  })
})

describe('お知らせを書く', () => {
  const page = (extra = {}) =>
    renderAt(`/teams/${U10.id}/notices/new`, {
      'GET /api/me': signedIn({ teams: [coachTeam] }),
      [`GET ${BASE}`]: { status: 200, body: coachTeam },
      [`POST ${BASE}/notices/recipient-count`]: { status: 200, body: { count: 5 } },
      ...extra,
    })

  it('AC-005-02 shows how many people it reaches, and cannot send to nobody', async () => {
    const { calls } = page()

    expect(await screen.findByText('5人に届きます(あなたを含む。同じ人には1通だけ)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5人に送信する' })).toBeEnabled()

    await userEvent.click(screen.getByRole('radio', { name: '学年で選ぶ' }))
    expect(screen.getByText('届く人がいません。宛先を選んでください。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '送信する' })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: '小3' }))
    await screen.findByText('5人に届きます(あなたを含む。同じ人には1通だけ)')
    expect(calls.filter((c) => c.path === `${BASE}/notices/recipient-count`).at(-1)?.body).toEqual({ target: { type: 'grades', values: ['e3'] } })
  })

  it('AC-005-01 sends now and opens the notice', async () => {
    const { calls, router } = page({
      [`POST ${BASE}/notices`]: { status: 201, body: { notice: notice({ id: 21 }) } },
      [`GET ${BASE}/notices/21`]: { status: 200, body: { notice: notice({ id: 21 }) } },
    })

    await userEvent.type(await screen.findByLabelText('タイトル'), '来週の試合')
    await userEvent.type(screen.getByLabelText('本文'), '集合は8時です。')
    await userEvent.click(await screen.findByRole('button', { name: '5人に送信する' }))

    await screen.findByRole('article', { name: '本文' })
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/notices/21`)
    expect(calls.find((c) => c.method === 'POST' && c.path === `${BASE}/notices`)?.body).toEqual({
      title: '来週の試合',
      body: '集合は8時です。',
      target: { type: 'all', values: [] },
      scheduled_at: null,
    })
  })

  it('AC-005-09 schedules for a date and time', async () => {
    const { calls, router } = page({
      [`POST ${BASE}/notices`]: { status: 201, body: { notice: notice({ id: 22, status: 'scheduled', scheduled_at: '2026-11-08T22:00:00+00:00', published_at: null }) } },
      [`GET ${BASE}/notices/scheduled`]: { status: 200, body: { notices: [] } },
    })

    await userEvent.type(await screen.findByLabelText('タイトル'), '翌朝の連絡')
    await userEvent.type(screen.getByLabelText('本文'), '7時に届けます')
    await userEvent.click(screen.getByRole('radio', { name: '予約して送る' }))
    await userEvent.type(screen.getByLabelText('予約日時'), '2026-11-09T07:00')
    await userEvent.click(screen.getByRole('button', { name: '予約する' }))

    expect(await screen.findByText('「来週の試合」を予約しました。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/notices/scheduled`)
    const sent = calls.find((c) => c.method === 'POST' && c.path === `${BASE}/notices`)?.body as { scheduled_at: string }
    expect(new Date(sent.scheduled_at).getTime()).toBe(new Date('2026-11-09T07:00').getTime())
  })

  it('AC-005-13 shows the allowed range when the server refuses the date', async () => {
    page({
      [`POST ${BASE}/notices`]: { status: 422, body: { message: '入力内容を確認してください', errors: { scheduled_at: ['予約できるのは、5分後から30日後までです。'] } } },
    })

    await userEvent.type(await screen.findByLabelText('タイトル'), 'x')
    await userEvent.type(screen.getByLabelText('本文'), 'x')
    await userEvent.click(screen.getByRole('radio', { name: '予約して送る' }))
    await userEvent.type(screen.getByLabelText('予約日時'), '2026-01-01T07:00')
    await userEvent.click(screen.getByRole('button', { name: '予約する' }))

    expect(await screen.findByText('予約できるのは、5分後から30日後までです。')).toBeInTheDocument()
    expect(screen.getByLabelText('予約日時')).toHaveAttribute('aria-invalid', 'true')
  })

  it('AC-005-09 asks for the date before sending a schedule', async () => {
    const { calls } = page()

    await userEvent.type(await screen.findByLabelText('タイトル'), 'x')
    await userEvent.type(screen.getByLabelText('本文'), 'x')
    await userEvent.click(screen.getByRole('radio', { name: '予約して送る' }))
    await userEvent.click(screen.getByRole('button', { name: '予約する' }))

    expect(await screen.findByText('予約日時を入力してください')).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST' && c.path === `${BASE}/notices`)).toHaveLength(0)
  })

  it('AC-005-04 a parent cannot open the page', async () => {
    renderAt(`/teams/${U10.id}/notices/new`, { 'GET /api/me': signedIn({ teams: [parentTeam] }), [`GET ${BASE}`]: { status: 200, body: parentTeam } })

    expect(await screen.findByText('お知らせは、代表・役員・コーチが送れます。')).toBeInTheDocument()
  })
})

describe('予約中のお知らせ', () => {
  const scheduled = notice({ id: 30, title: '翌朝の連絡', status: 'scheduled', scheduled_at: '2026-11-08T22:00:00+00:00', published_at: null, recipient_count: 0, target: { type: 'grades', values: ['e3', 'e4'] } })

  it('AC-005-10 lists scheduled notices and cancels one after a confirmation', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/notices/scheduled`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/notices/scheduled`]: { status: 200, body: { notices: [scheduled] } },
      [`DELETE ${BASE}/notices/30`]: { status: 204 },
    })

    const item = await screen.findByRole('region', { name: '翌朝の連絡' })
    expect(item).toHaveTextContent('11/9(月) 07:00に送信 / 宛先:小3・小4の家庭とスタッフ / 代表 太郎さんが作成')
    expect(within(item).getByRole('link', { name: '編集する' })).toHaveAttribute('href', `/teams/${U10.id}/notices/30/edit`)
    await userEvent.click(within(item).getByRole('button', { name: '取り消す' }))
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
    await userEvent.click(within(item).getByRole('button', { name: '予約を取り消す' }))

    expect(await screen.findByText('「翌朝の連絡」の予約を取り消しました。メールは送られません。')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '翌朝の連絡' })).not.toBeInTheDocument()
  })

  it('AC-005-10 edits a scheduled notice', async () => {
    const { calls, router } = renderAt(`/teams/${U10.id}/notices/30/edit`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/notices/scheduled`]: { status: 200, body: { notices: [scheduled] } },
      [`POST ${BASE}/notices/recipient-count`]: { status: 200, body: { count: 8 } },
      [`PATCH ${BASE}/notices/30`]: { status: 200, body: { notice: { ...scheduled, title: '時間変更' } } },
    })

    const title = await screen.findByLabelText('タイトル')
    expect(title).toHaveValue('翌朝の連絡')
    expect(screen.getByRole('checkbox', { name: '小3' })).toBeChecked()
    await userEvent.clear(title)
    await userEvent.type(title, '時間変更')
    await userEvent.click(await screen.findByRole('button', { name: '予約を保存する' }))

    expect(await screen.findByText('「時間変更」の予約を保存しました。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/notices/scheduled`)
    const body = calls.find((c) => c.method === 'PATCH')?.body as { title: string; target: unknown; scheduled_at: string }
    expect(body.title).toBe('時間変更')
    expect(body.target).toEqual({ type: 'grades', values: ['e3', 'e4'] })
    expect(new Date(body.scheduled_at).getTime()).toBe(new Date('2026-11-08T22:00:00Z').getTime())
  })

  it('AC-005-06 a notice already sent cannot be edited and the screen says how to correct it', async () => {
    renderAt(`/teams/${U10.id}/notices/30/edit`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/notices/scheduled`]: { status: 200, body: { notices: [scheduled] } },
      [`POST ${BASE}/notices/recipient-count`]: { status: 200, body: { count: 8 } },
      [`PATCH ${BASE}/notices/30`]: {
        status: 409,
        body: { message: 'この操作は完了できませんでした', errors: { notice: ['送信済みのお知らせは編集・取り消しできません。訂正は新しいお知らせで送ってください。'] } },
      },
    })

    await userEvent.click(await screen.findByRole('button', { name: '予約を保存する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('送信済みのお知らせは編集・取り消しできません。訂正は新しいお知らせで送ってください。')
  })

  it('AC-005-06 a notice that is no longer scheduled is shown as not found with the guidance', async () => {
    renderAt(`/teams/${U10.id}/notices/31/edit`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/notices/scheduled`]: { status: 200, body: { notices: [scheduled] } },
    })

    expect(await screen.findByRole('heading', { name: '予約中のお知らせが見つかりません' })).toBeInTheDocument()
    expect(screen.getByText(/訂正は新しいお知らせで送ってください/)).toBeInTheDocument()
  })
})

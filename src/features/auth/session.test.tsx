import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SESSION_EXPIRED_EVENT } from '../../api/client.ts'
import { renderAt, signedIn, signedOut } from '../../test/render.tsx'
import { safeNext } from './return-to.ts'

describe('ログインが必要な画面', () => {
  it('AC-000-02 sends signed-out users to the login page and remembers where they were going', async () => {
    const { router } = renderAt('/teams/new', { 'GET /api/me': signedOut })

    expect(await screen.findByRole('heading', { name: 'メールアドレスでログイン' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
    expect(sessionStorage.getItem('team-ops:return-to')).toBe('/teams/new')
  })

  it('AC-000-02 after logging in with the link, the user is back on the page they wanted', async () => {
    sessionStorage.setItem('team-ops:return-to', '/teams/new')
    renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn(),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    expect(await screen.findByLabelText('チーム名')).toBeInTheDocument()
    expect(sessionStorage.getItem('team-ops:return-to')).toBeNull()
  })

  it('AC-000-02 a new user enters a display name first, then goes to the page they wanted', async () => {
    sessionStorage.setItem('team-ops:return-to', '/teams/new')
    renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn({ display_name: null, needs_display_name: true }),
      'PATCH /api/me': signedIn(),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))
    await userEvent.type(await screen.findByLabelText('表示名'), '小田')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByLabelText('チーム名')).toBeInTheDocument()
  })

  it('shows an error with a retry button when the server cannot be reached, instead of the login page', async () => {
    let online = false
    renderAt('/start', { 'GET /api/me': () => (online ? signedIn() : 'network-error') })

    expect(await screen.findByRole('heading', { name: 'サーバーに接続できませんでした' })).toBeInTheDocument()
    online = true
    await userEvent.click(screen.getByRole('button', { name: 'もう一度読み込む' }))

    expect(await screen.findByRole('heading', { name: 'チームを用意しましょう' })).toBeInTheDocument()
  })

  it('a server error on /api/me is shown as an error, not as being logged out', async () => {
    renderAt('/start', { 'GET /api/me': { status: 500, body: { message: 'サーバーでエラーが発生しました' } } })

    expect(await screen.findByRole('heading', { name: 'サーバーに接続できませんでした' })).toBeInTheDocument()
  })

  it('AC-001-07 a 401 during use sends the user back to log in', async () => {
    renderAt('/start', { 'GET /api/me': signedIn() })
    expect(await screen.findByRole('heading', { name: 'チームを用意しましょう' })).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
    })

    expect(await screen.findByText('ログインの有効期限が切れました。もう一度ログインしてください。')).toBeInTheDocument()
  })

  it('AC-001-08 until a display name is entered, every page leads to the display name step', async () => {
    renderAt('/teams/new', { 'GET /api/me': signedIn({ display_name: null, needs_display_name: true }) })

    expect(await screen.findByRole('heading', { name: '表示名を登録してください' })).toBeInTheDocument()
  })

  it('AC-001-08 entering a display name completes registration', async () => {
    const { calls } = renderAt('/welcome', {
      'GET /api/me': signedIn({ display_name: null, needs_display_name: true }),
      'PATCH /api/me': signedIn({ display_name: '山田 花子' }),
    })

    await userEvent.type(await screen.findByLabelText('表示名'), '山田 花子')
    await userEvent.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByRole('heading', { name: 'チームを用意しましょう' })).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ display_name: '山田 花子' })
  })

  it('AC-001-08 shows the reason when the name is not accepted and moves focus to the field', async () => {
    renderAt('/welcome', {
      'GET /api/me': signedIn({ display_name: null, needs_display_name: true }),
      'PATCH /api/me': { status: 422, body: { message: '入力内容を確認してください', errors: { display_name: ['表示名を入力してください。'] } } },
    })

    await userEvent.click(await screen.findByRole('button', { name: '登録する' }))

    expect(await screen.findByText('表示名を入力してください。')).toBeInTheDocument()
    expect(screen.getByLabelText('表示名')).toHaveFocus()
  })

  it('shows who is logged in, so a user notices being logged in with someone else\'s link', async () => {
    renderAt('/start', { 'GET /api/me': signedIn({ email: 'someone@example.invalid' }) })

    expect(await screen.findByText('someone@example.invalid')).toBeInTheDocument()
  })
})

describe('safeNext', () => {
  it.each([
    ['/teams/new', '/teams/new'],
    ['/settings?tab=1', '/settings?tab=1'],
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['/\t/evil.example', null],
    ['/\n/evil.example', null],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
    ['https://evil.example', null],
    ['javascript:alert(1)', null],
    [null, null],
  ])('%s -> %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })
})

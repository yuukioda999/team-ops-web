import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderAt, signedIn, signedOut, team } from '../../test/render.tsx'

describe('ログイン用リンクの要求', () => {
  it('AC-001-01 sends a login link and tells the user to check the mail', async () => {
    const { calls } = renderAt('/login', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links': { status: 202, body: { message: 'メールを送信しました' } },
    })

    await userEvent.type(await screen.findByLabelText('メールアドレス'), 'coach@example.invalid')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン用のリンクを送る' }))

    expect(await screen.findByRole('heading', { name: 'メールを送信しました' })).toBeInTheDocument()
    expect(screen.getByText('coach@example.invalid')).toBeInTheDocument()
    expect(document.title).toBe('メールを送信しました | チーム運営')
    const post = calls.find((c) => c.method === 'POST')
    expect(post?.body).toEqual({ email: 'coach@example.invalid' })
    expect(post?.headers.get('X-XSRF-TOKEN')).toBe('test-xsrf-token')
  })

  it('D5 shows the email change hint only when the user came from an email change link', async () => {
    sessionStorage.clear()
    renderAt('/login', { 'GET /api/me': signedOut })

    expect(await screen.findByRole('heading', { name: 'メールアドレスでログイン' })).toBeInTheDocument()
    expect(screen.queryByText(/メールアドレスの変更を続けるには/)).not.toBeInTheDocument()
  })

  it('AC-001-02 shows the same screen whether or not the address is registered', async () => {
    renderAt('/login', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links': { status: 202, body: { message: 'メールを送信しました' } },
    })

    await userEvent.type(await screen.findByLabelText('メールアドレス'), 'nobody@example.invalid')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン用のリンクを送る' }))

    expect(await screen.findByRole('heading', { name: 'メールを送信しました' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/登録されていません|未登録|見つかりません/)
  })

  it('shows a message when the network is down instead of staying on "sending"', async () => {
    renderAt('/login', { 'GET /api/me': signedOut, 'POST /api/auth/login-links': 'network-error' })

    await userEvent.type(await screen.findByLabelText('メールアドレス'), 'coach@example.invalid')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン用のリンクを送る' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('通信に失敗しました')
    expect(screen.getByRole('button', { name: 'ログイン用のリンクを送る' })).toBeEnabled()
  })

  it('AC-001-05 shows the wait message when the limit is reached', async () => {
    renderAt('/login', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links': { status: 429, body: { message: '時間をおいてもう一度お試しください' } },
    })

    await userEvent.type(await screen.findByLabelText('メールアドレス'), 'coach@example.invalid')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン用のリンクを送る' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('時間をおいてもう一度お試しください')
    expect(screen.queryByRole('heading', { name: 'メールを送信しました' })).not.toBeInTheDocument()
  })

  it('AC-000-05 shows the field error next to the address', async () => {
    renderAt('/login', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links': {
        status: 422,
        body: { message: '入力内容を確認してください', errors: { email: ['メールアドレスの形式が正しくありません。'] } },
      },
    })

    await userEvent.type(await screen.findByLabelText('メールアドレス'), 'nope')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン用のリンクを送る' }))

    expect(await screen.findByText('メールアドレスの形式が正しくありません。')).toBeInTheDocument()
    expect(screen.getByLabelText('メールアドレス')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('メールアドレス')).toHaveFocus()
  })

  it('AC-001-07 explains that the session ended', async () => {
    renderAt('/login?expired=1', { 'GET /api/me': signedOut })

    expect(await screen.findByRole('status')).toHaveTextContent('ログインの有効期限が切れました')
  })
})

describe('メールのリンクからのログイン', () => {
  it('ADR-0008 opening the link does not log in until the button is pressed', async () => {
    const { calls } = renderAt('/login/verify?token=abc', { 'GET /api/me': signedOut })

    expect(await screen.findByRole('button', { name: 'ログインする' })).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
  })

  it('D7 removes the token from the address bar but still uses it', async () => {
    const { router, calls } = renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn(),
    })

    await screen.findByRole('button', { name: 'ログインする' })
    expect(router.state.location.search).toBe('')
    await userEvent.click(screen.getByRole('button', { name: 'ログインする' }))
    await screen.findByRole('heading', { name: 'チームを用意しましょう' })
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ token: 'abc' })
  })

  it('AC-001-04 a malformed link gets the same message as an expired one', async () => {
    renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': { status: 422, body: { message: '入力内容を確認してください', errors: { token: ['x'] } } },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    expect(await screen.findByRole('heading', { name: 'リンクの有効期限が切れています' })).toBeInTheDocument()
  })

  it('AC-001-03 a new user goes on to enter a display name', async () => {
    const { calls } = renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn({ display_name: null, needs_display_name: true }),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    expect(await screen.findByRole('heading', { name: '表示名を登録してください' })).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ token: 'abc' })
    expect(screen.getByText('coach@example.invalid')).toBeInTheDocument()
  })

  it('AC-001-03 a registered user goes to their team', async () => {
    renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn({ teams: [team()] }),
      'GET /api/teams/01jc9zb4x7q2n6r8t0v2w4y6z8': { status: 200, body: team() },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    expect(await screen.findByRole('heading', { name: 'あおば台FC U-10', level: 1 })).toBeInTheDocument()
  })

  it('AC-001-04 an expired or used link offers to send a new one', async () => {
    renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': { status: 410, body: { message: 'リンクの有効期限が切れています' } },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    expect(await screen.findByRole('heading', { name: 'リンクの有効期限が切れています' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ログイン用のリンクを送り直す' })).toHaveAttribute('href', '/login')
  })

  it('AC-001-04 a link without a token is treated as expired', async () => {
    renderAt('/login/verify', { 'GET /api/me': signedOut })

    expect(await screen.findByRole('heading', { name: 'リンクの有効期限が切れています' })).toBeInTheDocument()
  })

  it('AC-000-02 a saved return path to another site is ignored', async () => {
    sessionStorage.setItem('team-ops:return-to', '//evil.example/')
    renderAt('/login/verify?token=abc', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn(),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    expect(await screen.findByRole('heading', { name: 'チームを用意しましょう' })).toBeInTheDocument()
  })
})

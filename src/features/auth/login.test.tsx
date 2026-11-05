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

    expect(await screen.findByRole('heading', { name: 'メールを確認してください' })).toBeInTheDocument()
    expect(screen.getByText('coach@example.invalid')).toBeInTheDocument()
    const post = calls.find((c) => c.method === 'POST')
    expect(post?.body).toEqual({ email: 'coach@example.invalid' })
    expect(post?.headers.get('X-XSRF-TOKEN')).toBe('test-xsrf-token')
  })

  it('AC-001-05 shows the wait message when the limit is reached', async () => {
    renderAt('/login', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links': { status: 429, body: { message: '時間をおいてもう一度お試しください' } },
    })

    await userEvent.type(await screen.findByLabelText('メールアドレス'), 'coach@example.invalid')
    await userEvent.click(screen.getByRole('button', { name: 'ログイン用のリンクを送る' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('時間をおいてもう一度お試しください')
    expect(screen.queryByRole('heading', { name: 'メールを確認してください' })).not.toBeInTheDocument()
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

  it('returns to the page the user wanted after logging in, but only on this site', async () => {
    renderAt('/login/verify?token=abc&next=%2F%2Fevil.example%2F', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn(),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    expect(await screen.findByRole('heading', { name: 'チームを用意しましょう' })).toBeInTheDocument()
  })
})

import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderAt, signedIn, signedOut } from '../../test/render.tsx'

describe('アカウント設定', () => {
  it('AC-001-08 changes the display name', async () => {
    const { calls } = renderAt('/settings', {
      'GET /api/me': signedIn(),
      'PATCH /api/me': signedIn({ display_name: '小田' }),
    })

    const input = await screen.findByLabelText('表示名')
    await userEvent.clear(input)
    await userEvent.type(input, '小田')
    await userEvent.click(screen.getByRole('button', { name: '表示名を保存する' }))

    expect(await screen.findByText('表示名を保存しました')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ display_name: '小田' })
  })

  it('AC-001-09 requests an email change and explains the address stays until confirmed', async () => {
    const { calls } = renderAt('/settings', {
      'GET /api/me': signedIn(),
      'POST /api/me/email-changes': { status: 202, body: { message: '確認メールを送信しました' } },
    })

    await userEvent.type(await screen.findByLabelText('新しいメールアドレス'), 'new@example.invalid')
    await userEvent.click(screen.getByRole('button', { name: '確認メールを送る' }))

    expect(await screen.findByText(/new@example.invalid に確認メールを送りました/)).toBeInTheDocument()
    expect(screen.getByText(/今のメールアドレスのままです/)).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ new_email: 'new@example.invalid' })
  })

  it('AC-001-09 shows why the new address is not accepted', async () => {
    renderAt('/settings', {
      'GET /api/me': signedIn(),
      'POST /api/me/email-changes': {
        status: 422,
        body: { message: '入力内容を確認してください', errors: { new_email: ['現在のメールアドレスと同じです。'] } },
      },
    })

    await userEvent.type(await screen.findByLabelText('新しいメールアドレス'), 'coach@example.invalid')
    await userEvent.click(screen.getByRole('button', { name: '確認メールを送る' }))

    expect(await screen.findByText('現在のメールアドレスと同じです。')).toBeInTheDocument()
  })

  it('AC-001-06 logs out and returns to the login page', async () => {
    renderAt('/settings', {
      'GET /api/me': signedIn(),
      'POST /api/auth/logout': { status: 204 },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'ログアウトする' }))

    expect(await screen.findByRole('heading', { name: 'メールアドレスでログイン' })).toBeInTheDocument()
  })
})

describe('メールアドレス変更の確定', () => {
  it('AC-001-09 AC-001-10 confirms the change and says the old address was told', async () => {
    renderAt('/settings/email/verify?token=abc', {
      'GET /api/me': signedIn(),
      'POST /api/me/email-changes/consume': signedIn({ email: 'new@example.invalid' }),
    })

    await userEvent.click(await screen.findByRole('button', { name: 'メールアドレスを変更する' }))

    expect(await screen.findByRole('heading', { name: 'メールアドレスを変更しました' })).toBeInTheDocument()
    expect(screen.getAllByText('new@example.invalid').length).toBeGreaterThan(0)
    expect(screen.getByText(/前のメールアドレスにも、変更したことを知らせました/)).toBeInTheDocument()
  })

  it('D5 requires the requester to log in first, then comes back to confirm in the same tab', async () => {
    const { router } = renderAt('/settings/email/verify?token=change-token', {
      'GET /api/me': signedOut,
      'POST /api/auth/login-links/consume': signedIn(),
      'POST /api/me/email-changes/consume': signedIn({ email: 'new@example.invalid' }),
    })

    expect(await screen.findByRole('heading', { name: 'メールアドレスでログイン' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('') // the token is not in the login page's URL (D7)
    // the login link may open in another tab, which cannot come back here: say what to do
    expect(screen.getByText(/もう一度メールアドレスの確認のメールにあるリンクを開いてください/)).toBeInTheDocument()

    // the user opens the login link from the mail
    await act(() => router.navigate('/login/verify?token=login-token'))
    await userEvent.click(await screen.findByRole('button', { name: 'ログインする' }))

    await userEvent.click(await screen.findByRole('button', { name: 'メールアドレスを変更する' }))
    expect(await screen.findByRole('heading', { name: 'メールアドレスを変更しました' })).toBeInTheDocument()
  })

  it('AC-001-09 an expired, used or someone else\'s link offers to request again', async () => {
    renderAt('/settings/email/verify?token=abc', {
      'GET /api/me': signedIn(),
      'POST /api/me/email-changes/consume': { status: 410, body: { message: 'リンクの有効期限が切れています' } },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'メールアドレスを変更する' }))

    expect(await screen.findByRole('heading', { name: 'リンクの有効期限が切れています' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'アカウント設定から申請し直す' })).toHaveAttribute('href', '/settings')
  })

  it('AC-001-09 says when the address was taken in the meantime', async () => {
    renderAt('/settings/email/verify?token=abc', {
      'GET /api/me': signedIn(),
      'POST /api/me/email-changes/consume': {
        status: 409,
        body: { message: 'このメールアドレスはすでに使われているため、変更できません' },
      },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'メールアドレスを変更する' }))

    expect(await screen.findByRole('heading', { name: 'このメールアドレスはすでに使われているため、変更できません' })).toBeInTheDocument()
  })
})

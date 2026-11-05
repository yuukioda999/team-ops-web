import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderAt, signedIn, team } from '../../test/render.tsx'

const U10 = team()
const U12 = team({ id: '01jc9zb4x7q2n6r8t0v2w4y6z9', name: 'あおば台FC U-12' })

describe('チームに所属していない人', () => {
  it('AC-001-14 sees the two ways in: create a team or join from an invitation', async () => {
    renderAt('/', { 'GET /api/me': signedIn() })

    expect(await screen.findByRole('heading', { name: 'チームを用意しましょう' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'チームを作成する' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'チームを作成する' })).toHaveAttribute('href', '/teams/new')
    expect(screen.getByRole('heading', { name: '招待リンクから参加する' })).toBeInTheDocument()
  })
})

describe('チームの作成', () => {
  it('AC-001-11 creates the team and opens it', async () => {
    let created = false
    const { calls } = renderAt('/teams/new', {
      'GET /api/me': () => signedIn({ teams: created ? [U10] : [] }),
      'POST /api/teams': () => {
        created = true
        return { status: 201, body: U10 }
      },
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
    })

    await userEvent.type(await screen.findByLabelText('チーム名'), 'あおば台FC U-10')
    await userEvent.click(screen.getByRole('radio', { name: '野球' }))
    await userEvent.click(screen.getByRole('radio', { name: 'サッカー' }))
    await userEvent.click(screen.getByRole('button', { name: 'チームを作成する' }))

    expect(await screen.findByRole('heading', { name: 'あおば台FC U-10', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('あなたの役割:代表')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'あおば台FC U-10', sport: 'soccer' })
  })

  it('AC-001-11 shows field errors', async () => {
    renderAt('/teams/new', {
      'GET /api/me': signedIn(),
      'POST /api/teams': { status: 422, body: { message: '入力内容を確認してください', errors: { name: ['チーム名を入力してください。'] } } },
    })

    await userEvent.click(await screen.findByRole('button', { name: 'チームを作成する' }))

    expect(await screen.findByText('チーム名を入力してください。')).toBeInTheDocument()
    expect(screen.getByLabelText('チーム名')).toHaveAttribute('aria-invalid', 'true')
  })

  it('AC-001-12 explains why a sixth team cannot be created', async () => {
    renderAt('/teams/new', {
      'GET /api/me': signedIn(),
      'POST /api/teams': {
        status: 422,
        body: { message: '入力内容を確認してください', errors: { team: ['代表として作成できるチームは5つまでです。'] } },
      },
    })

    await userEvent.type(await screen.findByLabelText('チーム名'), 'FC 6')
    await userEvent.click(screen.getByRole('button', { name: 'チームを作成する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('代表として作成できるチームは5つまでです。')
  })
})

describe('チームの切り替え', () => {
  it('AC-001-13 lists every team and opens the chosen one', async () => {
    renderAt(`/teams/${U12.id}`, {
      'GET /api/me': signedIn({ teams: [U10, U12] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
      [`GET /api/teams/${U12.id}`]: { status: 200, body: U12 },
    })

    expect(await screen.findByRole('heading', { name: 'あおば台FC U-12', level: 1 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'チームを切り替える' }))
    const menu = screen.getByRole('navigation', { name: '所属しているチーム' })
    expect(within(menu).getByRole('link', { name: /U-12/ })).toHaveAttribute('aria-current', 'page')

    await userEvent.click(within(menu).getByRole('link', { name: /U-10/ }))

    expect(await screen.findByRole('heading', { name: 'あおば台FC U-10', level: 1 })).toBeInTheDocument()
  })

  it('AC-001-13 the menu closes with Escape and focus returns to the button', async () => {
    renderAt(`/teams/${U12.id}`, {
      'GET /api/me': signedIn({ teams: [U10, U12] }),
      [`GET /api/teams/${U12.id}`]: { status: 200, body: U12 },
    })

    const button = await screen.findByRole('button', { name: 'チームを切り替える' })
    await userEvent.click(button)
    expect(screen.getByRole('navigation', { name: '所属しているチーム' })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('navigation', { name: '所属しているチーム' })).not.toBeInTheDocument()
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('AC-001-13 the home page opens the first team', async () => {
    renderAt('/', {
      'GET /api/me': signedIn({ teams: [U10, U12] }),
      [`GET /api/teams/${U10.id}`]: { status: 200, body: U10 },
    })

    expect(await screen.findByRole('heading', { name: 'あおば台FC U-10', level: 1 })).toBeInTheDocument()
  })

  it('AC-000-01 a team the user is not in looks the same as a missing team', async () => {
    renderAt(`/teams/${U12.id}`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET /api/teams/${U12.id}`]: { status: 404, body: { message: '見つかりません' } },
    })

    expect(await screen.findByRole('heading', { name: 'チームが見つかりません' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '自分のチームを開く' })).toHaveAttribute('href', '/')
  })
})

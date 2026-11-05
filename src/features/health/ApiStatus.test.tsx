import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiStatus } from './ApiStatus.tsx'

describe('ApiStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    { name: 'API reachable', response: () => Promise.resolve(new Response('{}', { status: 200 })), text: 'APIに接続しました' },
    { name: 'API returns 503', response: () => Promise.resolve(new Response('{}', { status: 503 })), text: 'APIに接続できません' },
    { name: 'network error', response: () => Promise.reject(new TypeError('failed to fetch')), text: 'APIに接続できません' },
  ])('shows the result when $name', async ({ response, text }) => {
    vi.stubGlobal('fetch', vi.fn(response))
    render(<ApiStatus />)
    expect(await screen.findByText(new RegExp(text))).toBeInTheDocument()
  })
})

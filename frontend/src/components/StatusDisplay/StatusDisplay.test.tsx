import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StatusDisplay from './StatusDisplay'

const TEST_URL = '/health'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('StatusDisplay', () => {
  it('renders loading state initially', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))

    render(<StatusDisplay url={TEST_URL} />)

    expect(screen.getByText(/Checking service status/i)).toBeInTheDocument()
  })

  it('renders status value on successful fetch', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<StatusDisplay url={TEST_URL} />)

    await waitFor(() => {
      expect(screen.getByTestId('status-value')).toHaveTextContent('ok')
    })
  })

  it('renders error when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    render(<StatusDisplay url={TEST_URL} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    })
  })

  it('renders error when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Service Unavailable', { status: 503 })
    )

    render(<StatusDisplay url={TEST_URL} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('HTTP 503')
    })
  })

  it('is accessible: has aria-label on status container', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    render(<StatusDisplay url={TEST_URL} />)

    await waitFor(() => {
      expect(
        screen.getByLabelText('Service status')
      ).toBeInTheDocument()
    })
  })
})

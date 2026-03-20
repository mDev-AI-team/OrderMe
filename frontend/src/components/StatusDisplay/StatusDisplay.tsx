import { useEffect, useState } from 'react'

interface HealthResponse {
  status: string
}

type FetchState =
  | { phase: 'loading' }
  | { phase: 'ok'; data: HealthResponse }
  | { phase: 'error'; message: string }

interface StatusDisplayProps {
  url: string
}

export default function StatusDisplay({ url }: StatusDisplayProps) {
  const [state, setState] = useState<FetchState>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<HealthResponse>
      })
      .then((data) => {
        if (!cancelled) setState({ phase: 'ok', data })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          setState({ phase: 'error', message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [url])

  if (state.phase === 'loading') {
    return <p aria-live="polite">Checking service status…</p>
  }

  if (state.phase === 'error') {
    return (
      <p role="alert" aria-live="assertive">
        Error: {state.message}
      </p>
    )
  }

  return (
    <div aria-label="Service status">
      <p>
        Status:{' '}
        <strong data-testid="status-value">{state.data.status}</strong>
      </p>
    </div>
  )
}

import { ApiStatus } from './features/health/ApiStatus.tsx'

export default function App() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>team-ops</h1>
      <ApiStatus />
    </main>
  )
}

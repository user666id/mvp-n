import React from 'react'

interface State {
  hasError: boolean
}

const CHUNK_RE = /Loading chunk|dynamically imported module|Failed to fetch|importing a module script|ChunkLoadError/i

/**
 * Catches render-phase exceptions so a throw in any screen shows a recoverable
 * card instead of React unmounting the whole tree to a blank white screen.
 *
 * Also self-heals the classic stale-deploy case: an open session holding an old
 * index.html requests a hashed chunk that a new deploy replaced (404) → the
 * dynamic import() rejects. We do ONE hard reload (sessionStorage-guarded against
 * loops) to pull the fresh, no-store index + current chunks.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    const msg = String((error as Error)?.message || error || '')
    if (CHUNK_RE.test(msg) && !sessionStorage.getItem('mvpn_chunk_reloaded')) {
      sessionStorage.setItem('mvpn_chunk_reloaded', '1')
      location.reload()
      return
    }
    console.error('[mvp-n] render error', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    // i18n lives inside this boundary, so use a plain bilingual fallback.
    const ru = (() => {
      try {
        return localStorage.getItem('mvpn_lang') === 'ru'
      } catch {
        return false
      }
    })()
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-7 text-center">
        <p className="max-w-[300px] text-[15px] leading-relaxed text-muted">
          {ru ? 'Что-то пошло не так. Попробуйте перезагрузить.' : 'Something went wrong. Try reloading.'}
        </p>
        <button
          onClick={() => location.reload()}
          className="inline-flex h-[44px] items-center justify-center rounded-full bg-accent px-6 text-[15px] font-medium text-white active:bg-accent-hover"
        >
          {ru ? 'Перезагрузить' : 'Reload'}
        </button>
      </div>
    )
  }
}

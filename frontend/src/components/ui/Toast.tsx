import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastFn = (message: string) => void
const ToastCtx = createContext<ToastFn>(() => {})

export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback<ToastFn>((message) => {
    window.clearTimeout(timer.current)
    setMsg(message)
    timer.current = window.setTimeout(() => setMsg(null), 2200)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && (
        <div className="pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[60] flex justify-center px-4">
          <div className="glass-thin animate-toast-in rounded-full px-4 py-2.5 text-[14px] font-medium text-ink">
            {msg}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  )
}

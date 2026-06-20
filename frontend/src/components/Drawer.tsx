import { useEffect, useState } from 'react'
import { Layers, Settings, ShieldCheck } from './icons'
import { BRAND } from '../lib/config'
import { useT, type TKey } from '../lib/i18n'

export type Tab = 'configs' | 'settings' | 'admin'

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const DUR = 320

const items: { id: Tab; key: TKey; Icon: typeof Layers }[] = [
  { id: 'configs', key: 'tab.configs', Icon: Layers },
  { id: 'settings', key: 'tab.settings', Icon: Settings },
]

/** Left slide-in navigation drawer (Claude style). */
export function Drawer({
  open,
  onClose,
  active,
  onSelect,
  isAdmin,
}: {
  open: boolean
  onClose: () => void
  active: Tab
  onSelect: (t: Tab) => void
  /** Show the admin entry at the bottom (admins only). */
  isAdmin?: boolean
}) {
  const { t } = useT()
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const r = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const id = setTimeout(() => setMounted(false), DUR)
    return () => clearTimeout(id)
  }, [open])

  if (!mounted) return null
  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        style={{ opacity: shown ? 1 : 0, transition: `opacity ${DUR}ms ease` }}
      />
      <div
        className="absolute inset-y-0 left-0 flex w-[78%] max-w-[300px] flex-col bg-canvas shadow-sheet will-change-transform"
        style={{
          transform: shown ? 'translateX(0)' : 'translateX(-100%)',
          transition: `transform ${DUR}ms ${EASE}`,
        }}
      >
        <div className="px-5 pb-5 pt-[max(22px,env(safe-area-inset-top))]">
          <div className="font-display text-[24px] font-semibold lowercase text-ink">{BRAND}</div>
        </div>
        <nav className="px-3">
          {items.map(({ id, key, Icon }) => {
            const on = active === id
            return (
              <button
                key={id}
                onClick={() => {
                  onSelect(id)
                  onClose()
                }}
                className={
                  'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ' +
                  (on ? 'border border-ink/15 bg-surface-sunken text-ink' : 'text-ink active:bg-surface-sunken')
                }
              >
                <Icon size={22} strokeWidth={on ? 2.1 : 1.75} />
                <span className="text-[16px] font-medium">{t(key)}</span>
              </button>
            )
          })}

          {/* Admin panel — a top-level tab like the rest, right below them (admins
              only): selecting it switches tabs and highlights, same as Configs. */}
          {isAdmin && (
            <button
              onClick={() => {
                onSelect('admin')
                onClose()
              }}
              className={
                'mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ' +
                (active === 'admin' ? 'border border-ink/15 bg-surface-sunken text-ink' : 'text-ink active:bg-surface-sunken')
              }
            >
              <ShieldCheck size={22} strokeWidth={active === 'admin' ? 2.1 : 1.75} />
              <span className="text-[16px] font-medium">{t('settings.adminPanel')}</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  )
}

import { Layers, Settings, ShieldCheck } from './icons'
import { useT, type TKey } from '../lib/i18n'
import type { Tab } from './Drawer'

const items: { id: Tab; key: TKey; Icon: typeof Layers }[] = [
  { id: 'configs', key: 'tab.configs', Icon: Layers },
  { id: 'settings', key: 'tab.settings', Icon: Settings },
]

/**
 * Bottom tab bar (beta redesign) — one-tap top-level switching, replacing the
 * hamburger drawer. Admins get a third "Admin" entry that opens the admin sheet.
 */
export function BottomNav({
  active,
  onSelect,
  isAdmin,
  adminActive,
  onOpenAdmin,
}: {
  active: Tab
  onSelect: (t: Tab) => void
  isAdmin?: boolean
  adminActive?: boolean
  onOpenAdmin?: () => void
}) {
  const { t } = useT()

  const Item = ({
    on,
    label,
    Icon,
    onClick,
  }: {
    on: boolean
    label: string
    Icon: typeof Layers
    onClick: () => void
  }) => (
    <button
      onClick={onClick}
      className={
        'flex flex-1 flex-col items-center gap-1 py-1 transition-colors ' +
        (on ? 'text-accent' : 'text-muted active:text-ink')
      }
    >
      {/* Soft accent pill behind the active icon — a modern, finished indicator. */}
      <span
        className={
          'flex h-7 w-[52px] items-center justify-center rounded-full transition-colors ' +
          (on ? 'bg-accent-soft' : '')
        }
      >
        <Icon size={22} strokeWidth={on ? 2.2 : 1.8} />
      </span>
      <span className={'text-[11px] ' + (on ? 'font-semibold' : 'font-medium')}>{label}</span>
    </button>
  )

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch gap-1 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5">
        {items.map(({ id, key, Icon }) => (
          <Item
            key={id}
            on={active === id && !adminActive}
            label={t(key)}
            Icon={Icon}
            onClick={() => onSelect(id)}
          />
        ))}
        {isAdmin && onOpenAdmin && (
          <Item on={!!adminActive} label={t('settings.admin')} Icon={ShieldCheck} onClick={onOpenAdmin} />
        )}
      </div>
    </nav>
  )
}

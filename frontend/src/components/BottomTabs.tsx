import { Globe, Dollar, ShieldCheck } from './icons'
import { useT, type TKey } from '../lib/i18n'
import { selection } from '../lib/telegram'

/** Primary destinations. Account/Settings lives behind the top-left avatar
 *  (variant A); Admin is a SEPARATE detached circle (admin-only) to the right —
 *  like the search button beside Telegram's own tab bar. */
export type Tab = 'configs' | 'subscription' | 'admin'

const MAIN: { id: Tab; key: TKey; Icon: typeof Globe }[] = [
  { id: 'configs', key: 'tab.configs', Icon: Globe },
  { id: 'subscription', key: 'tab.subscription', Icon: Dollar },
]

// Shared frosted-glass surface (iOS "liquid glass") — defined once as `.glass` in
// index.css (translucent fill + blur + saturation + light edge + top highlight).
const GLASS = 'glass'

export function BottomTabs({
  active,
  onSelect,
  isAdmin,
}: {
  active: Tab
  onSelect: (t: Tab) => void
  isAdmin?: boolean
}) {
  const { t } = useT()
  // Index of the active tab within the main pill (-1 when Admin is active) — drives
  // the sliding indicator's position.
  const mainIdx = MAIN.findIndex((m) => m.id === active)
  const tap = (id: Tab) => {
    if (id !== active) selection()
    onSelect(id)
  }
  return (
    // Wrapper is click-through; only the pill + the admin circle catch taps.
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(10px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2">
        {/* main pill — the content tabs. A single indicator SLIDES between tabs
            (shared-layout, native feel) instead of fading in on the spot. */}
        <div className={'relative flex flex-1 items-stretch gap-1 rounded-full p-1 ' + GLASS}>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-ink/[0.13] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-inset ring-ink/[0.07] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{
              width: 'calc((100% - 12px) / 2)',
              transform: `translateX(calc(${Math.max(0, mainIdx)} * (100% + 4px)))`,
              opacity: mainIdx < 0 ? 0 : 1,
            }}
          />
          {MAIN.map(({ id, key, Icon }) => {
            const on = active === id
            return (
              <button
                key={id}
                onClick={() => tap(id)}
                className={
                  'relative flex flex-1 flex-col items-center gap-1 rounded-full py-1.5 text-[11px] font-medium transition-[color,transform] duration-150 active:scale-90 ' +
                  (on ? 'text-accent' : 'text-faint')
                }
              >
                <Icon
                  size={23}
                  strokeWidth={on ? 2.1 : 1.75}
                  className={'relative ' + (on ? 'animate-tab-pop' : '')}
                />
                <span className="relative">{t(key)}</span>
              </button>
            )
          })}
        </div>

        {/* Admin — a detached circle on the right (admin-only), like the search
            button next to Telegram's tab bar. */}
        {isAdmin && (
          <button
            onClick={() => tap('admin')}
            aria-label={t('tab.admin')}
            // Explicit square sized to the pill's height — a true circle, like the
            // search button beside Telegram's tab bar. (aspect-square / h-full
            // collapsed to the icon's content size inside this flex row.)
            className={
              'grid h-[65px] w-[65px] shrink-0 place-items-center rounded-full transition-transform duration-150 active:scale-90 ' +
              GLASS +
              (active === 'admin' ? ' text-accent' : ' text-faint')
            }
          >
            <ShieldCheck
              size={24}
              strokeWidth={active === 'admin' ? 2.1 : 1.75}
              className={active === 'admin' ? 'animate-tab-pop' : ''}
            />
          </button>
        )}
      </div>
    </nav>
  )
}

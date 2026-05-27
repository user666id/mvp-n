import { Layers, Sliders, Settings } from './icons'
import { useT, type TKey } from '../lib/i18n'

export type Tab = 'configs' | 'options' | 'settings'

const tabs: { id: Tab; key: TKey; Icon: typeof Layers }[] = [
  { id: 'configs', key: 'tab.configs', Icon: Layers },
  { id: 'options', key: 'tab.options', Icon: Sliders },
  { id: 'settings', key: 'tab.settings', Icon: Settings },
]

export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const { t } = useT()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[520px] items-stretch px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        {tabs.map(({ id, key, Icon }) => {
          const on = active === id
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={
                'mx-1 flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-colors ' +
                (on ? 'bg-accent-soft text-accent' : 'text-faint active:text-muted')
              }
            >
              <Icon size={23} strokeWidth={on ? 2.2 : 1.75} />
              <span className={'text-[11px] ' + (on ? 'font-semibold' : 'font-medium')}>{t(key)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

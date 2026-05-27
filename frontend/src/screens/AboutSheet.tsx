import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Collapse } from '../components/ui/Collapse'
import { Logo } from '../components/Logo'
import { ChevronRight } from '../components/icons'
import { useToast } from '../components/ui/Toast'
import { openLink } from '../lib/telegram'
import { BRAND, BOT } from '../lib/config'
import { useT, type TKey } from '../lib/i18n'

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT()
  const toast = useToast()

  const faq: { q: TKey; a: TKey }[] = [
    { q: 'about.q1', a: 'about.a1' },
    { q: 'about.q2', a: 'about.a2' },
    { q: 'about.q3', a: 'about.a3' },
    { q: 'about.q4', a: 'about.a4' },
    { q: 'about.q5', a: 'about.a5' },
    { q: 'about.q6', a: 'about.a6' },
    { q: 'about.q7', a: 'about.a7' },
    { q: 'about.q8', a: 'about.a8' },
  ]

  return (
    <Sheet open={open} onClose={onClose} title={t('about.title')}>
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={64} />
        <h2 className="font-display mt-3 text-[22px] font-semibold text-ink">{BRAND}</h2>
        <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted">
          {t('about.tagline')}
        </p>
      </div>

      <Section header={t('about.links')}>
        <Cell
          title={t('about.bot')}
          subtitle={BOT}
          after={<ChevronRight size={20} />}
          onClick={() => openLink('https://t.me/mvp_n_net_bot')}
          last
        />
      </Section>

      <div className="mb-2 px-3 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
        {t('about.faq')}
      </div>
      <div className="mb-5 flex flex-col gap-2">
        {faq.map((f) => (
          <Collapse key={f.q} title={<span className="text-[15px]">{t(f.q)}</span>}>
            <p className="px-4 py-3.5 text-[14px] leading-relaxed text-muted">{t(f.a)}</p>
          </Collapse>
        ))}
      </div>

      <Section header={t('about.legal')}>
        <Cell
          title={t('about.terms')}
          after={<ChevronRight size={20} />}
          onClick={() => toast(t('common.soon'))}
        />
        <Cell
          title={t('about.privacy')}
          subtitle="Zero-Logs"
          after={<ChevronRight size={20} />}
          onClick={() => toast(t('common.soon'))}
          last
        />
      </Section>

      <div className="flex flex-col items-center gap-1.5 pb-2">
        <span className="rounded-full bg-accent-soft px-3.5 py-1 text-[12px] font-medium text-accent">
          {t('about.version')}
        </span>
        <span className="font-display text-[13px] text-faint">{BRAND}</span>
      </div>
    </Sheet>
  )
}

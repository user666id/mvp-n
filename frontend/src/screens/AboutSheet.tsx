import { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Collapse } from '../components/ui/Collapse'
import { Logo } from '../components/Logo'
import { ChevronRight, ExternalLink, Github, Telegram } from '../components/icons'
import { openLink } from '../lib/telegram'
import { BRAND, BOT, GITHUB_URL } from '../lib/config'
import { RELEASES, APP_VERSION, type ChangeKind } from '../lib/changelog'
import { useT, type TKey } from '../lib/i18n'

const KIND_LABEL: Record<ChangeKind, TKey> = {
  added: 'about.added',
  changed: 'about.changed',
  fixed: 'about.fixed',
}

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT()
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [licensesOpen, setLicensesOpen] = useState(false)

  // Third-party attributions shown under About → Licenses.
  const licenses = [
    { name: 'mvp-n', license: 'AGPL-3.0', url: `${GITHUB_URL}/blob/main/LICENSE` },
    { name: 'Hanken Grotesk', license: 'OFL-1.1', url: 'https://openfontlicense.org/open-font-license-official-text/' },
    { name: 'Inter', license: 'OFL-1.1', url: 'https://github.com/rsms/inter/blob/master/LICENSE.txt' },
    { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
    { name: 'Vite', license: 'MIT', url: 'https://github.com/vitejs/vite/blob/main/LICENSE' },
    { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE' },
    { name: 'grammY', license: 'MIT', url: 'https://github.com/grammyjs/grammY/blob/main/LICENSE' },
    { name: 'Go', license: 'BSD-3-Clause', url: 'https://go.dev/LICENSE' },
  ]

  // Hosted legal pages on their own subdomain (clean URLs), opened in the
  // external browser. Follows the current UI language.
  const legalUrl = (doc: 'terms' | 'privacy') =>
    `https://legal.mvp-n.net/${doc}?lang=${lang}`

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

  const fmtDate = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t('about.title')}>
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={64} />
          <h2 className="font-display mt-3 text-[22px] font-semibold text-ink">{BRAND}</h2>
          <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-muted">{t('about.tagline')}</p>
        </div>

        <Section header={t('about.links')}>
          <Cell
            before={<Telegram size={20} />}
            title={t('about.bot')}
            subtitle={BOT}
            after={<ExternalLink size={18} className="text-faint" />}
            onClick={() => openLink('https://t.me/mvp_n_net_bot')}
          />
          <Cell
            before={<Github size={20} />}
            title={t('about.github')}
            after={<ExternalLink size={18} className="text-faint" />}
            onClick={() => openLink(GITHUB_URL)}
          />
          <Cell
            title={t('about.whatsnew')}
            after={
              <span className="flex items-center gap-1.5">
                <span className="text-[14px] text-muted">v{APP_VERSION}</span>
                <ChevronRight size={20} />
              </span>
            }
            onClick={() => setUpdatesOpen(true)}
            last
          />
        </Section>

        <Section header={t('about.legal')}>
          <Cell
            title={t('about.terms')}
            after={<ExternalLink size={18} className="text-faint" />}
            onClick={() => openLink(legalUrl('terms'))}
          />
          <Cell
            title={t('about.privacy')}
            after={<ExternalLink size={18} className="text-faint" />}
            onClick={() => openLink(legalUrl('privacy'))}
          />
          <Cell
            title={t('about.licenses')}
            after={<ChevronRight size={20} className="text-faint" />}
            onClick={() => setLicensesOpen(true)}
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

        <div className="flex flex-col items-center gap-1.5 pb-2">
          <span className="rounded-full bg-accent-soft px-3.5 py-1 text-[12px] font-medium text-accent">
            {t('about.versionLabel')} {APP_VERSION}
          </span>
          <span className="font-display text-[13px] text-faint">{BRAND}</span>
        </div>
      </Sheet>

      {/* Updates — its own page, rendered from the changelog data module */}
      <Sheet
        open={updatesOpen}
        onClose={() => setUpdatesOpen(false)}
        onBack={() => setUpdatesOpen(false)}
        title={t('about.whatsnew')}
      >
        <div className="flex flex-col gap-2">
          {RELEASES.map((r, i) => (
            <Collapse
              key={r.version}
              title={
                <span className="flex items-center gap-2 text-[15px]">
                  <span className="font-display font-semibold">v{r.version}</span>
                  <span className="text-[12px] text-faint">{fmtDate(r.date)}</span>
                  {i === 0 && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                      {t('about.latest')}
                    </span>
                  )}
                </span>
              }
            >
              <div className="flex flex-col gap-3 px-4 py-3.5">
                {r.groups.map((g, gi) => (
                  <div key={gi} className="flex flex-col gap-1.5">
                    <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-faint">
                      {t(KIND_LABEL[g.kind])}
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {g.items.map((it, j) => (
                        <li key={j} className="flex gap-2 text-[14px] leading-relaxed text-muted">
                          <span className="text-accent">•</span>
                          <span>{lang === 'ru' ? it.ru : it.en}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Collapse>
          ))}
        </div>
      </Sheet>

      {/* Licenses — third-party attributions */}
      <Sheet
        open={licensesOpen}
        onClose={() => setLicensesOpen(false)}
        onBack={() => setLicensesOpen(false)}
        title={t('about.licenses')}
      >
        <p className="mb-4 px-1 text-[13px] leading-relaxed text-muted">{t('about.licensesHint')}</p>
        <Section>
          {licenses.map((l, i) => (
            <Cell
              key={l.name}
              title={l.name}
              subtitle={l.license}
              after={<ExternalLink size={18} className="text-faint" />}
              onClick={() => openLink(l.url)}
              last={i === licenses.length - 1}
            />
          ))}
        </Section>
      </Sheet>
    </>
  )
}

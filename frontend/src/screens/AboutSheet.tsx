import { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Collapse } from '../components/ui/Collapse'
import brandMark from '../assets/brand-mark.png'
import { ChevronRight, ExternalLink, Github, Telegram } from '../components/icons'
import { openLink, effectivePalette } from '../lib/telegram'
import { BRAND, BOT, GITHUB_URL } from '../lib/config'
import { RELEASES, APP_VERSION, type ChangeKind, type ChangeGroup } from '../lib/changelog'
import { useT, type TKey } from '../lib/i18n'

const KIND_LABEL: Record<ChangeKind, TKey> = {
  added: 'about.added',
  changed: 'about.changed',
  fixed: 'about.fixed',
}

/** Added / Changed / Fixed groups — shared by a capsule and its refinements. */
function ChangeGroups({ groups }: { groups: ChangeGroup[] }) {
  const { t, lang } = useT()
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g, gi) => (
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
  )
}

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT()
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [licensesOpen, setLicensesOpen] = useState(false)

  // Third-party attributions shown under About → Licenses, grouped by area.
  // Covers the components shipped or run as part of the service; the complete
  // (incl. transitive) list lives in the source repos' go.mod / package.json.
  const licenseGroups: {
    header: TKey
    items: { name: string; license: string; url: string }[]
  }[] = [
    {
      header: 'lic.app',
      items: [{ name: 'mvp-n', license: 'AGPL-3.0', url: `${GITHUB_URL}/blob/main/LICENSE` }],
    },
    {
      header: 'lic.miniApp',
      items: [
        { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
        { name: 'TON Connect UI', license: 'Apache-2.0', url: 'https://github.com/ton-connect/sdk/blob/main/LICENSE' },
        { name: '@ton/core', license: 'MIT', url: 'https://github.com/ton-org/ton-core/blob/main/LICENSE' },
        { name: 'buffer', license: 'MIT', url: 'https://github.com/feross/buffer/blob/master/LICENSE' },
        { name: 'qrcode', license: 'MIT', url: 'https://github.com/soldair/node-qrcode/blob/master/license' },
        { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE' },
        { name: 'Vite', license: 'MIT', url: 'https://github.com/vitejs/vite/blob/main/LICENSE' },
        { name: 'TypeScript', license: 'Apache-2.0', url: 'https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt' },
      ],
    },
    {
      header: 'lic.bot',
      items: [
        { name: 'grammY', license: 'MIT', url: 'https://github.com/grammyjs/grammY/blob/main/LICENSE' },
        { name: 'Node.js', license: 'MIT', url: 'https://github.com/nodejs/node/blob/main/LICENSE' },
      ],
    },
    {
      header: 'lic.backend',
      items: [
        { name: 'Go', license: 'BSD-3-Clause', url: 'https://go.dev/LICENSE' },
        { name: 'golang-jwt', license: 'MIT', url: 'https://github.com/golang-jwt/jwt/blob/main/LICENSE' },
        { name: 'google/uuid', license: 'BSD-3-Clause', url: 'https://github.com/google/uuid/blob/master/LICENSE' },
        { name: 'lib/pq', license: 'MIT', url: 'https://github.com/lib/pq/blob/master/LICENSE.md' },
        { name: 'robfig/cron', license: 'MIT', url: 'https://github.com/robfig/cron/blob/master/LICENSE' },
        { name: 'gRPC-Go', license: 'Apache-2.0', url: 'https://github.com/grpc/grpc-go/blob/master/LICENSE' },
        { name: 'Protocol Buffers', license: 'BSD-3-Clause', url: 'https://github.com/protocolbuffers/protobuf-go/blob/master/LICENSE' },
        { name: 'golang.org/x/*', license: 'BSD-3-Clause', url: 'https://cs.opensource.google/go/x/crypto/+/master:LICENSE' },
      ],
    },
    {
      header: 'lic.vpn',
      items: [
        { name: 'Xray-core', license: 'MPL-2.0', url: 'https://github.com/XTLS/Xray-core/blob/main/LICENSE' },
        { name: 'uTLS', license: 'BSD-3-Clause', url: 'https://github.com/refraction-networking/utls/blob/master/LICENSE' },
        { name: 'REALITY', license: 'BSD-3-Clause', url: 'https://github.com/XTLS/REALITY/blob/main/LICENSE' },
        { name: 'quic-go', license: 'MIT', url: 'https://github.com/apernet/quic-go/blob/master/LICENSE' },
        { name: 'AmneziaWG', license: 'MIT', url: 'https://github.com/amnezia-vpn/amneziawg-go/blob/master/LICENSE' },
        { name: 'WireGuard', license: 'GPL-2.0', url: 'https://www.wireguard.com/' },
        { name: 'SagerNet/sing', license: 'GPL-3.0', url: 'https://github.com/SagerNet/sing/blob/main/LICENSE' },
        { name: 'juju/ratelimit', license: 'LGPL-3.0', url: 'https://github.com/juju/ratelimit/blob/master/LICENSE' },
      ],
    },
    {
      header: 'lic.infra',
      items: [
        { name: 'nginx', license: 'BSD-2-Clause', url: 'https://nginx.org/LICENSE' },
        { name: 'OpenSSL (TLS/SSL)', license: 'Apache-2.0', url: 'https://www.openssl.org/source/license.html' },
        { name: 'PostgreSQL', license: 'PostgreSQL', url: 'https://www.postgresql.org/about/licence/' },
        { name: 'Docker', license: 'Apache-2.0', url: 'https://github.com/moby/moby/blob/master/LICENSE' },
        { name: 'Telegram platform', license: 'Telegram ToS', url: 'https://core.telegram.org/api/terms' },
      ],
    },
    {
      header: 'lic.fonts',
      items: [
        { name: 'Hanken Grotesk', license: 'OFL-1.1', url: 'https://openfontlicense.org/open-font-license-official-text/' },
        { name: 'Inter', license: 'OFL-1.1', url: 'https://github.com/rsms/inter/blob/master/LICENSE.txt' },
      ],
    },
  ]

  // Hosted legal pages on their own subdomain (clean URLs), opened in the
  // external browser. Follows the current UI language.
  const legalUrl = (doc: 'terms' | 'privacy') =>
    `https://legal.mvp-n.net/${doc}?lang=${lang}&theme=${effectivePalette()}`

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
          {/* The real brand mark (the bot's app icon), clipped to a perfect circle
              to match the bot's round Telegram avatar. */}
          <span className="block overflow-hidden rounded-full shadow-pop" style={{ width: 84, height: 84 }}>
            <img src={brandMark} alt={BRAND} className="h-full w-full object-cover" />
          </span>
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

        <div className="flex flex-col items-center pb-2">
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
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted">
                      {t('about.latest')}
                    </span>
                  )}
                </span>
              }
            >
              <div className="flex flex-col gap-4 px-4 py-3.5">
                <ChangeGroups groups={r.groups} />

                {r.patches && r.patches.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[12px] font-medium uppercase tracking-[0.04em] text-faint">
                      {t('about.refinements')}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {r.patches.map((p) => (
                        <Collapse
                          key={p.version}
                          title={
                            <span className="flex items-center gap-2 text-[14px]">
                              <span className="font-display font-medium">v{p.version}</span>
                              <span className="text-[12px] text-faint">{fmtDate(p.date)}</span>
                            </span>
                          }
                        >
                          <div className="px-4 py-3">
                            <ChangeGroups groups={p.groups} />
                          </div>
                        </Collapse>
                      ))}
                    </div>
                  </div>
                )}
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
        {licenseGroups.map((grp) => (
          <Section key={grp.header} header={t(grp.header)}>
            {grp.items.map((l, i) => (
              <Cell
                key={l.name}
                title={l.name}
                subtitle={l.license}
                after={<ExternalLink size={18} className="text-faint" />}
                onClick={() => openLink(l.url)}
                last={i === grp.items.length - 1}
              />
            ))}
          </Section>
        ))}
      </Sheet>
    </>
  )
}

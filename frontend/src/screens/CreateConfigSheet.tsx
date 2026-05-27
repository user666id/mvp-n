import React, { useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Card'
import { RadioRow } from '../components/ui/Radio'
import { Switch } from '../components/ui/Switch'
import { Collapse } from '../components/ui/Collapse'
import { Note } from '../components/ui/Note'
import { Badge } from '../components/ui/Badge'
import { Globe } from '../components/icons'
import { useT } from '../lib/i18n'
import type { Protocol } from '../api/types'

export function CreateConfigSheet({
  open,
  onClose,
  onCreate,
  busy,
}: {
  open: boolean
  onClose: () => void
  onCreate: (opts: { protocol: Protocol; enhanced: boolean; game_mode: boolean }) => void
  busy: boolean
}) {
  const { t } = useT()
  const [protocol, setProtocol] = useState<Protocol>('vless')
  const [enhanced, setEnhanced] = useState(true) // on by default
  const [game, setGame] = useState(false)

  const protocols: {
    id: Protocol
    title: string
    transport: string
    recommended?: boolean
  }[] = [
    { id: 'vless', title: 'VLESS', transport: 'TCP', recommended: true },
    { id: 'awg', title: 'AmneziaWG', transport: 'UDP' },
  ]

  return (
    <Sheet open={open} onClose={onClose} title={t('create.title')}>
      {/* Location — single, fixed */}
      <div className="mb-2 px-1 pt-1 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
        {t('create.location')}
      </div>
      <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5">
        <span className="text-[22px]">🇳🇱</span>
        <span className="flex-1 text-[16px] font-medium text-ink">{t('configs.country')}</span>
        <Globe size={20} className="text-faint" />
      </div>
      <div className="mb-5" />

      {/* Protocol */}
      <Section header={t('create.protocolHeader')}>
        {protocols.map((p, i) => (
          <RadioRow
            key={p.id}
            selected={protocol === p.id}
            onSelect={() => setProtocol(p.id)}
            title={p.title}
            badge={
              <>
                <Badge tone="neutral">{p.transport}</Badge>
                {p.recommended && <Badge tone="success">{t('create.recommended')}</Badge>}
              </>
            }
            last={i === protocols.length - 1}
          />
        ))}
      </Section>

      {/* AmneziaWG note */}
      {protocol === 'awg' && (
        <div className="mb-5">
          <Note tone="info">{t('create.awgNote')}</Note>
        </div>
      )}

      {/* Additional settings — VLESS only */}
      {protocol === 'vless' && (
        <div className="mb-5">
          <Collapse title={t('create.advanced')}>
            <SettingRow
              title={t('create.enhanced')}
              checked={enhanced}
              disabled={game}
              onChange={(v) => {
                setEnhanced(v)
                if (v) setGame(false)
              }}
            />
            <SettingRow
              title={t('create.game')}
              checked={game}
              disabled={enhanced}
              onChange={(v) => {
                setGame(v)
                if (v) setEnhanced(false)
              }}
              last
            />
          </Collapse>
        </div>
      )}

      <div className="pb-2">
        <Button
          stretched
          loading={busy}
          onClick={() => onCreate({ protocol, enhanced, game_mode: game })}
        >
          {t('configs.create')}
        </Button>
      </div>
    </Sheet>
  )
}

function SettingRow({
  title,
  subtitle,
  badge,
  checked,
  onChange,
  disabled,
  last,
}: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  last?: boolean
}) {
  return (
    <div
      className={
        'flex min-h-[54px] items-center gap-3 px-4 py-2.5 ' +
        (last ? '' : 'border-b border-border ') +
        (disabled ? 'opacity-50' : '')
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-medium text-ink">{title}</span>
          {badge}
        </div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-muted">{subtitle}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

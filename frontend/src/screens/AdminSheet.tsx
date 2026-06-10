import { useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Button } from '../components/ui/Button'
import { ListSkeleton } from '../components/ui/Skeleton'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Copy, ChevronRight, Ban, Trash, ExternalLink, Refresh, Check } from '../components/icons'
import { DeviceRow } from '../components/DeviceRow'
import { ProfileDetails } from '../components/ProfileDetails'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { confirmDialog, notify, openLink } from '../lib/telegram'
import { padId, formatBytes } from '../lib/format'
import { configMeta, configListLabel } from '../lib/configMeta'
import { useT } from '../lib/i18n'
import {
  adminBlockProfile, adminBlockProfileDevice, adminCreateKeys, adminDeleteProfile,
  adminDeleteProfileDevice, adminGetDomains, adminGetProfileConfigs, adminGetProfileDevices,
  adminListKeys, adminListProfiles, adminResetProfile, adminRevokeKey, adminUnblockProfileDevice,
  type AccessKeyRow, type AdminConfig, type AdminProfile, type Device, type DomainStatus,
} from '../api'

/** Display name for a profile: @username, else first name, else empty. */
const profileName = (p: AdminProfile) =>
  p.username ? '@' + p.username : p.first_name || ''

export function AdminSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT()
  const toast = useToast()
  const [profiles, setProfiles] = useState<AdminProfile[] | null>(null)
  const [trafficToday, setTrafficToday] = useState<number | null>(null)
  const [keys, setKeys] = useState<AccessKeyRow[] | null>(null)
  const [count, setCount] = useState('1')
  const [genBusy, setGenBusy] = useState(false)
  const [sel, setSel] = useState<AdminProfile | null>(null)
  // Retained copy so the profile sheet can play its exit slide after sel clears.
  const [selProfile, setSelProfile] = useState<AdminProfile | null>(null)
  useEffect(() => {
    if (sel) setSelProfile(sel)
  }, [sel])
  const [query, setQuery] = useState('')
  const [domainsOpen, setDomainsOpen] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  const [profilesOpen, setProfilesOpen] = useState(false)

  const shown = (profiles ?? []).filter((p) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      padId(p.internal_id).toLowerCase().includes(q) ||
      (p.username ?? '').toLowerCase().includes(q) ||
      (p.first_name ?? '').toLowerCase().includes(q) ||
      String(p.id).includes(q)
    )
  })

  const loadProfiles = async () => {
    // Don't blank the list to a skeleton on a refetch (e.g. after block/unblock
    // or re-open) — keep the current rows visible and swap them in when the new
    // data arrives. The skeleton only shows on the very first load (profiles===null).
    try {
      const r = await adminListProfiles()
      setProfiles(r.profiles)
      setTrafficToday(r.traffic_today)
    } catch {
      setProfiles((prev) => prev ?? [])
    }
  }
  const loadKeys = async () => {
    try {
      setKeys(await adminListKeys())
    } catch {
      setKeys([])
    }
  }

  useEffect(() => {
    if (open) {
      loadProfiles()
      loadKeys()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const generate = async () => {
    setGenBusy(true)
    try {
      await adminCreateKeys({ count: Math.max(1, Number(count) || 1) })
      notify('success')
      toast(t('admin.keysGenerated'))
      await loadKeys()
    } catch {
      toast(t('admin.generateFailed'))
    } finally {
      setGenBusy(false)
    }
  }

  const revoke = async (k: AccessKeyRow) => {
    if (!(await confirmDialog(t('admin.keyDeleteConfirm')))) return
    try {
      await adminRevokeKey(k.id)
      setKeys((prev) => (prev ?? []).filter((x) => x.id !== k.id))
      toast(t('admin.keyDeleted'))
    } catch {
      toast(t('admin.deleteFailed'))
    }
  }

  const keyStatus = (k: AccessKeyRow) =>
    k.used_at ? { label: t('admin.keyUsed'), tone: 'neutral' as const }
      : k.is_valid ? { label: t('admin.keyActive'), tone: 'success' as const }
        : { label: t('admin.keyExpired'), tone: 'neutral' as const }

  const unusedKeys = (keys ?? []).filter((k) => !k.used_at)
  const usedKeys = (keys ?? []).filter((k) => k.used_at)

  const renderKeyRow = (k: AccessKeyRow, last: boolean) => {
    const st = keyStatus(k)
    return (
      <div
        key={k.id}
        className={'flex items-center gap-2 px-4 py-3 ' + (last ? '' : 'border-b border-border')}
      >
        <button
          onClick={() => copyText(k.key).then(() => toast(t('admin.keyCopied')))}
          className="flex min-w-0 flex-1 items-center gap-2 text-left active:opacity-60"
        >
          <span className="truncate font-mono text-[14px] text-ink">{k.key}</span>
          <Copy size={15} className="shrink-0 text-faint" />
        </button>
        {k.used_at && k.used_by_internal != null && (
          <span className="shrink-0 font-mono text-[12.5px] text-muted">
            → {padId(k.used_by_internal)}
          </span>
        )}
        <Badge tone={st.tone}>{st.label}</Badge>
        <button
          onClick={() => revoke(k)}
          className="shrink-0 text-danger active:opacity-60"
          aria-label={t('admin.deleteKey')}
        >
          <Trash size={17} />
        </button>
      </div>
    )
  }

  const totalTraffic = profiles
    ? formatBytes(profiles.reduce((s, p) => s + p.traffic_used, 0), lang)
    : '—'
  const todayTraffic = trafficToday != null ? formatBytes(trafficToday, lang) : '—'

  return (
    <>
      {/* Single-window navigation: a child sheet hides the parent (gated `open`),
          and each child shows a ‹ back button — so only one window is ever shown. */}
      <Sheet open={open} onClose={onClose} title={t('admin.title')}>
        {/* traffic — single card, two columns (total / today) */}
        <Section header={t('admin.traffic')}>
          <div className="flex">
            <TrafficStat label={t('admin.trafficTotalShort')} value={totalTraffic} />
            <div className="w-px self-stretch bg-border" />
            <TrafficStat label={t('admin.trafficTodayShort')} value={todayTraffic} />
          </div>
        </Section>

        <Section>
          <Cell
            title={t('admin.profiles')}
            after={<CountChevron n={profiles?.length} />}
            onClick={() => setProfilesOpen(true)}
          />
          <Cell
            title={t('admin.keys')}
            after={<CountChevron n={keys?.length} />}
            onClick={() => setKeysOpen(true)}
          />
          <Cell
            title={t('admin.domains')}
            after={<ChevronRight size={18} className="text-faint" />}
            onClick={() => setDomainsOpen(true)}
            last
          />
        </Section>
      </Sheet>

      {/* ── Keys sheet: generator on top, list below ── */}
      <Sheet
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        onBack={() => setKeysOpen(false)}
        title={t('admin.keys')}
      >
        <Section header={t('admin.newKey')}>
          <div className="flex items-end gap-2 px-4 py-3.5">
            <div className="w-20">
              <label className="text-[12px] text-faint">{t('admin.count')}</label>
              <input
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                className="mt-1 h-[44px] w-full rounded-xl border border-transparent bg-surface-sunken px-3 text-[16px] text-ink outline-none focus:border-accent"
              />
            </div>
            <Button className="h-[44px] flex-1" loading={genBusy} onClick={generate}>
              {t('admin.generate')}
            </Button>
          </div>
        </Section>

        {!keys ? (
          <Section footer={t('admin.keysFooter')}>
            <ListSkeleton rows={3} avatar={false} card={false} />
          </Section>
        ) : keys.length === 0 ? (
          <Section footer={t('admin.keysFooter')}>
            <div className="py-8 text-center text-[14px] text-muted">{t('admin.keysEmpty')}</div>
          </Section>
        ) : (
          <>
            {unusedKeys.length > 0 && (
              <Section header={t('admin.keysUnused', { n: unusedKeys.length })}>
                {unusedKeys.map((k, i) => renderKeyRow(k, i === unusedKeys.length - 1))}
              </Section>
            )}
            {usedKeys.length > 0 && (
              <Section
                header={t('admin.keysUsed', { n: usedKeys.length })}
                footer={t('admin.keysFooter')}
              >
                {usedKeys.map((k, i) => renderKeyRow(k, i === usedKeys.length - 1))}
              </Section>
            )}
          </>
        )}
      </Sheet>

      {/* ── Profiles sheet: search + list ── */}
      <Sheet
        open={profilesOpen}
        onClose={() => setProfilesOpen(false)}
        onBack={() => setProfilesOpen(false)}
        title={t('admin.profiles')}
      >
        {profiles && profiles.length > 0 && (
          <div className="mb-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.search')}
              className="h-[48px] w-full rounded-2xl border border-transparent bg-surface-sunken px-4 text-[15px] text-ink outline-none placeholder:text-faint focus:border-accent"
            />
          </div>
        )}
        {!profiles ? (
          <ListSkeleton rows={4} />
        ) : shown.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-muted">{t('admin.noMatches')}</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {shown.map((p, i) => {
              const name = profileName(p)
              return (
                <button
                  key={p.id}
                  onClick={() => setSel(p)}
                  className={
                    'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-sunken ' +
                    (i === shown.length - 1 ? '' : 'border-b border-border')
                  }
                >
                  <Avatar name={p.first_name} fallback={p.username} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-semibold text-ink">
                        {padId(p.internal_id)}
                      </span>
                      {name && <span className="truncate text-[14px] text-muted">{name}</span>}
                      {p.is_admin && <Badge tone="accent">{t('settings.admin')}</Badge>}
                      {p.is_blocked && <Badge>{t('devices.blockedShort')}</Badge>}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">
                      {t('admin.devShort', { n: p.devices_count })} · {formatBytes(p.traffic_used, lang)}
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-faint" />
                </button>
              )
            })}
          </div>
        )}
      </Sheet>

      {selProfile && (
        <AdminProfileSheet
          profile={selProfile}
          open={!!sel}
          onClose={() => setSel(null)}
          onBack={() => setSel(null)}
          onChanged={loadProfiles}
        />
      )}
      <DomainStatusSheet
        open={domainsOpen}
        onClose={() => setDomainsOpen(false)}
        onBack={() => setDomainsOpen(false)}
      />
    </>
  )
}

/** One half of the two-column traffic card: small label over a big value. */
function TrafficStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-4 py-3.5">
      <div className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className="mt-1 text-[20px] font-semibold text-ink">{value}</div>
    </div>
  )
}

/** Trailing "(N) ›" for a navigation cell whose count may still be loading. */
function CountChevron({ n }: { n?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {n != null && <span className="text-[14px] text-muted">{n}</span>}
      <ChevronRight size={18} className="text-faint" />
    </span>
  )
}

function DomainStatusSheet({
  open,
  onClose,
  onBack,
}: {
  open: boolean
  onClose: () => void
  onBack?: () => void
}) {
  const { t } = useT()
  const [items, setItems] = useState<DomainStatus[] | null>(null)

  const load = () => {
    setItems(null)
    adminGetDomains().then(setItems).catch(() => setItems([]))
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} onBack={onBack} title={t('admin.domains')}>
      {!items ? (
        <ListSkeleton rows={3} />
      ) : (
        (['web', 'vpn', 'svc'] as const).map((kind) => {
          const group = items.filter((d) => d.kind === kind)
          if (group.length === 0) return null
          const label =
            kind === 'web' ? t('admin.domainsWeb') : kind === 'vpn' ? t('admin.domainsVpn') : t('admin.domainsSvc')
          return (
            <div key={kind} className="mb-4">
              <div className="font-display mb-2 px-3 text-[13px] font-medium uppercase tracking-[0.06em] text-faint">
                {label}
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                {group.map((d, i) => {
                  const cls =
                    'flex w-full items-center gap-3 px-4 py-3.5 text-left ' +
                    (i === group.length - 1 ? '' : 'border-b border-border ')
                  const inner = (
                    <>
                      <span className={'h-2.5 w-2.5 shrink-0 rounded-full ' + (d.ok ? 'bg-success' : 'bg-danger')} />
                      <div className="min-w-0 flex-1">
                        <div className={'truncate text-[15px] font-medium ' + (kind === 'web' ? 'text-accent' : 'text-ink')}>
                          {d.name}
                        </div>
                        <div className="text-[12.5px] text-muted">
                          {d.ok ? t('admin.domainOk') : t('admin.domainDown')}
                          {d.status ? ` · ${d.status}` : ''} · {d.ms} ms
                        </div>
                      </div>
                      {kind === 'web' && <ExternalLink size={16} className="shrink-0 text-accent" />}
                    </>
                  )
                  return kind === 'web' ? (
                    <button key={d.name} onClick={() => openLink('https://' + d.name)} className={cls + 'active:bg-surface-sunken'}>
                      {inner}
                    </button>
                  ) : (
                    <div key={d.name} className={cls}>{inner}</div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
      <div className="pb-2">
        <Button variant="secondary" stretched disabled={!items} onClick={load}>
          <Refresh size={18} /> {t('admin.refresh')}
        </Button>
      </div>
    </Sheet>
  )
}

function AdminProfileSheet({
  profile,
  open,
  onClose,
  onBack,
  onChanged,
}: {
  profile: AdminProfile
  open: boolean
  onClose: () => void
  onBack: () => void
  onChanged: () => void
}) {
  const { t } = useT()
  const toast = useToast()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [configs, setConfigs] = useState<AdminConfig[] | null>(null)
  const [actions, setActions] = useState<Device | null>(null)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [configsOpen, setConfigsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const fallbackName = profile.username
    ? '@' + profile.username
    : t('admin.profileFallback', { id: padId(profile.internal_id) })

  const loadDevices = () =>
    adminGetProfileDevices(profile.id).then(setDevices).catch(() => setDevices([]))

  useEffect(() => {
    loadDevices()
    adminGetProfileConfigs(profile.id).then(setConfigs).catch(() => setConfigs([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const delDevice = async (d: Device) => {
    if (!(await confirmDialog(t('devices.deleteConfirm')))) return
    await adminDeleteProfileDevice(profile.id, d.id)
    setDevices((prev) => (prev ?? []).filter((x) => x.id !== d.id))
    toast(t('devices.deletedToast'))
  }

  const toggleBlockDevice = async (d: Device) => {
    const block = !d.is_blocked
    setDevices((prev) => (prev ?? []).map((x) => (x.id === d.id ? { ...x, is_blocked: block } : x)))
    try {
      if (block) await adminBlockProfileDevice(profile.id, d.id)
      else await adminUnblockProfileDevice(profile.id, d.id)
      toast(block ? t('devices.blockedToast') : t('devices.unblockedToast'))
    } catch {
      loadDevices()
    }
  }

  const reset = async () => {
    if (!(await confirmDialog(t('admin.resetSubConfirm')))) return
    setBusy(true)
    try {
      await adminResetProfile(profile.id)
      notify('success')
      toast(t('admin.resetDone'))
      setDevices([])
      setConfigs([])
      onChanged()
    } catch {
      toast(t('admin.deleteFailed'))
    } finally {
      setBusy(false)
    }
  }

  const block = async () => {
    if (profile.is_admin) {
      toast(t('admin.cantBlockAdmin'))
      return
    }
    setBusy(true)
    try {
      await adminBlockProfile(profile.id)
      toast(t('admin.done'))
      onChanged()
      onClose()
    } catch {
      toast(t('admin.cantBlockAdmin'))
    } finally {
      setBusy(false)
    }
  }

  const del = async () => {
    if (profile.is_admin) {
      toast(t('admin.cantDeleteAdmin'))
      return
    }
    if (!(await confirmDialog(t('admin.deleteProfileConfirm')))) return
    setBusy(true)
    try {
      await adminDeleteProfile(profile.id)
      notify('success')
      toast(t('admin.profileDeleted'))
      onChanged()
      onClose()
    } catch {
      toast(t('admin.cantDeleteAdmin'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <Sheet open={open} onClose={onClose} onBack={onBack} title={fallbackName}>
      <ProfileDetails p={profile} />

      {/* drill-down: configs / devices open their own sheets */}
      <Section>
        <Cell
          title={t('admin.configsTitle', { n: configs ? configs.length : profile.configs_count })}
          after={<ChevronRight size={18} className="text-faint" />}
          onClick={() => setConfigsOpen(true)}
        />
        <Cell
          title={t('admin.devicesTitle', { n: devices ? devices.length : profile.devices_count })}
          after={<ChevronRight size={18} className="text-faint" />}
          onClick={() => setDevicesOpen(true)}
          last
        />
      </Section>

      {/* management actions — same row style as the user's Account sheet */}
      <Section>
        <Cell
          before={<Refresh size={20} />}
          after={<ChevronRight size={20} />}
          title={t('admin.resetSub')}
          onClick={reset}
        />
        <Cell
          before={<Ban size={20} />}
          title={profile.is_blocked ? t('admin.unblockProfile') : t('admin.blockProfile')}
          onClick={block}
          last
        />
      </Section>

      <Section header={t('settings.danger')}>
        <Cell
          before={<Trash size={20} />}
          title={t('admin.deleteProfile')}
          onClick={del}
          destructive
          last
        />
      </Section>
    </Sheet>

    {/* configs sheet */}
    <Sheet
      open={configsOpen}
      onClose={() => setConfigsOpen(false)}
      onBack={() => setConfigsOpen(false)}
      title={t('admin.configsTitle', { n: configs ? configs.length : profile.configs_count })}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {!configs ? (
          <ListSkeleton rows={2} avatar={false} card={false} />
        ) : configs.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-muted">{t('admin.noConfigs')}</div>
        ) : (
          configs.map((c, i) => (
            <div
              key={c.id}
              className={'flex items-center gap-3 px-4 py-3 ' + (i !== configs.length - 1 ? 'border-b border-border' : '')}
            >
              <span className="text-[18px]">🇳🇱</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium text-ink">
                  {c.name || t('configs.country')}
                </div>
                <div className="truncate text-[12.5px] text-muted">
                  {configListLabel(configMeta(c, t))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Sheet>

    {/* devices sheet — same layout as the user "Connected devices" */}
    <Sheet open={devicesOpen} onClose={() => setDevicesOpen(false)} onBack={() => setDevicesOpen(false)} title={t('devices.title')}>
      {(() => {
        const groupHeader = (label: string) => (
          <div className="font-display mb-2 px-3 text-[15px] font-semibold text-ink">{label}</div>
        )
        const renderGroup = (list: Device[]) => (
          <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
            {list.map((d, i) => (
              <DeviceRow
                key={d.id}
                device={d}
                index={i}
                border={i !== list.length - 1}
                trailing={
                  <button
                    onClick={() => setActions(d)}
                    className="shrink-0 text-faint active:opacity-60"
                    aria-label={t('devices.actions')}
                  >
                    <ChevronRight size={20} />
                  </button>
                }
              />
            ))}
          </div>
        )
        if (!devices) {
          return <ListSkeleton rows={3} />
        }
        if (devices.length === 0) {
          return <div className="py-14 text-center text-[15px] text-muted">{t('devices.empty')}</div>
        }
        const vless = devices.filter((d) => d.kind !== 'awg')
        const awg = devices.filter((d) => d.kind === 'awg')
        return (
          <>
            {vless.length > 0 && (
              <>
                {groupHeader(t('devices.catVless'))}
                {renderGroup(vless)}
              </>
            )}
            {awg.length > 0 && (
              <>
                {groupHeader(t('devices.catAwg'))}
                {renderGroup(awg)}
              </>
            )}
          </>
        )
      })()}
    </Sheet>

    {/* device actions — block/unblock + delete (same as the user devices view) */}
    <Sheet
      open={!!actions}
      onClose={() => setActions(null)}
      onBack={() => setActions(null)}
      title={actions ? [actions.client, actions.name].filter(Boolean).join(' ') || t('common.device') : ''}
    >
      {actions && (
        <>
          <Section>
            <Cell
              before={actions.is_blocked ? <Check size={20} /> : <Ban size={20} />}
              title={actions.is_blocked ? t('devices.unblock') : t('devices.block')}
              onClick={() => {
                const d = actions
                setActions(null)
                toggleBlockDevice(d)
              }}
              last
            />
          </Section>
          <Section header={t('settings.danger')}>
            <Cell
              before={<Trash size={20} />}
              title={t('devices.deleteOne')}
              onClick={() => {
                const d = actions
                setActions(null)
                delDevice(d)
              }}
              destructive
              last
            />
          </Section>
        </>
      )}
    </Sheet>

    {busy && (
      <div className="fixed inset-0 z-[55] grid place-items-center bg-black/20">
        <Spinner size={30} />
      </div>
    )}
    </>
  )
}

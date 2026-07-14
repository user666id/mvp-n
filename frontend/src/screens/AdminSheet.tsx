import { useEffect, useState } from 'react'
import { Sheet } from '../components/ui/Sheet'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { Button } from '../components/ui/Button'
import { ListSkeleton } from '../components/ui/Skeleton'
import { BusyOverlay } from '../components/ui/BusyOverlay'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { Copy, ChevronRight, Ban, Trash, ExternalLink, Key, Phone } from '../components/icons'
import { DeviceRow } from '../components/DeviceRow'
import { StatusDot } from '../components/StatusDot'
import { ProfileDetails } from '../components/ProfileDetails'
import { SheetHero } from '../components/ui/SheetHero'
import { TrafficSheet } from './TrafficSheet'
import { useToast } from '../components/ui/Toast'
import { copyText } from '../lib/clipboard'
import { confirmDialog, notify, openLink } from '../lib/telegram'
import { padId, formatBytes } from '../lib/format'
import { subLabel } from '../lib/subscription'
import { useT } from '../lib/i18n'
import { useCachedResource } from '../lib/useForeground'
import * as cache from '../lib/cache'
import {
  adminApplyKey, adminBlockProfile, adminCreateKeys, adminDeleteProfile,
  adminDeleteProfileDevice, adminGetDomains, adminGetProfileDevices,
  adminListKeys, adminListProfiles, adminRevokeKey, ApiError,
  type AccessKeyRow, type AdminProfile, type Device, type DomainStatus,
} from '../api'

/** Display name for a profile: @username, else first name, else empty. */
const profileName = (p: AdminProfile) =>
  p.username ? '@' + p.username : p.first_name || ''

export function AdminScreen({
  active,
  onAccount,
  accountName,
  revalidate,
}: {
  active: boolean
  onAccount: () => void
  accountName?: string
  revalidate?: number
}) {
  const { t, lang } = useT()
  const toast = useToast()
  // Shared cache — admin profiles + keys are now on the same SWR store as the rest
  // of the app, so they show instantly on re-open and are healed by the app-wide
  // resume recovery (a dropped first fetch no longer leaves the panel stuck).
  const { data: profData } = useCachedResource('adminProfiles', adminListProfiles, { active, revalidate })
  const profiles = profData?.profiles ?? null
  const trafficToday = profData?.traffic_today ?? null
  const { data: keysData } = useCachedResource('adminKeys', adminListKeys, { active, revalidate })
  const keys = keysData ?? null
  const [keyDays, setKeyDays] = useState(0) // 0 = lifetime; else 7/30/90/365
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
  const [trafficOpen, setTrafficOpen] = useState(false)

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

  const generate = async () => {
    setGenBusy(true)
    try {
      await adminCreateKeys({ count: 1, plan_days: keyDays })
      notify('success')
      toast(t('admin.keysGenerated'))
      cache.invalidate('adminKeys')
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
      cache.mutate('adminKeys', (prev: AccessKeyRow[] | undefined) => prev?.filter((x) => x.id !== k.id))
      toast(t('admin.keyDeleted'))
    } catch {
      toast(t('admin.deleteFailed'))
    }
  }

  const keyStatus = (k: AccessKeyRow) =>
    k.used_at ? { label: t('admin.keyUsed'), tone: 'neutral' as const }
      : k.is_valid ? { label: t('admin.keyActive'), tone: 'success' as const }
        : { label: t('admin.keyExpired'), tone: 'neutral' as const }

  // Subscription length a key grants: lifetime (0/absent) or N days.
  const keyDayLabel = (d?: number) =>
    !d ? t('admin.keyLifetime')
      : ({ 7: t('pay.d7'), 30: t('pay.d30'), 90: t('pay.d90'), 365: t('pay.d365') } as Record<number, string>)[d] ||
        `${d} d`

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
          <span className="shrink-0 font-mono text-[13px] text-muted">
            → {padId(k.used_by_internal)}
          </span>
        )}
        <span className="shrink-0 text-[12px] text-faint">{keyDayLabel(k.plan_days)}</span>
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

  return (
    <>
      {/* Admin opens as a top-level tab (avatar header), like Configs/Subscription.
          Its drill-downs (keys, profiles, …) still open as ‹back› child sheets. */}
      <div className="animate-fade min-h-screen pb-24">
        <PageHeader title={t('admin.title')} onAccount={onAccount} accountName={accountName} />
        <div className="px-4 pt-4">
          {/* one column: traffic + profiles + keys + statuses */}
          <Section>
            <Cell
              title={t('admin.traffic')}
              after={<ChevronRight size={18} className="text-faint" />}
              onClick={() => setTrafficOpen(true)}
            />
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
        </div>
      </div>

      {/* ── Keys sheet: generator on top, list below ── */}
      <Sheet
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        onBack={() => setKeysOpen(false)}
        title={t('admin.keys')}
      >
        <Section header={t('admin.newKey')}>
          <div className="px-4 pt-3.5">
            <label className="text-[12px] text-faint">{t('admin.keyDuration')}</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {[0, 7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setKeyDays(d)}
                  className={
                    'rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-transform duration-150 active:scale-95 ' +
                    (keyDays === d
                      ? 'border-accent bg-surface text-ink'
                      : 'border-border bg-surface text-muted')
                  }
                >
                  {keyDayLabel(d)}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-3">
            <Button stretched className="h-[44px]" loading={genBusy} onClick={generate}>
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
            <EmptyState>{t('admin.keysEmpty')}</EmptyState>
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
              aria-label={t('admin.search')}
              className="h-[52px] w-full rounded-3xl border border-transparent bg-surface-sunken px-4 text-[15px] text-ink outline-none placeholder:text-faint focus:border-accent"
            />
          </div>
        )}
        {!profiles ? (
          <ListSkeleton rows={4} />
        ) : shown.length === 0 ? (
          <EmptyState>{t('admin.noMatches')}</EmptyState>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            {shown.map((p, i) => {
              const name = profileName(p)
              return (
                <button
                  key={p.id}
                  onClick={() => setSel(p)}
                  className={
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-[transform,background-color] duration-150 active:scale-[0.99] active:bg-surface-sunken ' +
                    (i === shown.length - 1 ? '' : 'border-b border-border')
                  }
                >
                  <Avatar name={p.first_name} fallback={p.username} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[15px] font-semibold text-ink">
                        {padId(p.internal_id)}
                      </span>
                      {name && <span className="min-w-0 truncate text-[14px] text-muted">{name}</span>}
                      {p.is_admin && <Badge tone="neutral">{t('settings.admin')}</Badge>}
                      {(() => {
                        const s = subLabel(p, t, lang)
                        return <Badge tone={s.tone === 'muted' ? 'neutral' : s.tone}>{s.text}</Badge>
                      })()}
                    </div>
                    <div className="truncate text-[13px] text-muted">
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
          onChanged={() => cache.invalidate('adminProfiles')}
        />
      )}
      <DomainStatusSheet
        open={domainsOpen}
        onClose={() => setDomainsOpen(false)}
        onBack={() => setDomainsOpen(false)}
      />
      <TrafficSheet
        open={trafficOpen}
        onClose={() => setTrafficOpen(false)}
        total={profiles ? profiles.reduce((s, p) => s + p.traffic_used, 0) : 0}
        today={trafficToday ?? 0}
      />
    </>
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
  // Shared cache: keeps the last status list and re-probes in the background on
  // re-open / resume instead of wiping to a skeleton each time (was setItems(null)).
  const { data: items } = useCachedResource<DomainStatus[]>(
    'adminDomains',
    () => adminGetDomains().catch(() => []),
    { active: open },
  )

  return (
    <Sheet open={open} onClose={onClose} onBack={onBack} title={t('admin.domains')} pills>
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
              <div className="mb-2 px-3 text-[12px] font-medium uppercase tracking-[0.06em] text-faint">
                {label}
              </div>
              <div className="overflow-hidden rounded-3xl border border-border bg-surface">
                {group.map((d, i) => {
                  const cls =
                    'flex w-full items-center gap-3 px-4 py-3 text-left ' +
                    (i === group.length - 1 ? '' : 'border-b border-border ')
                  const inner = (
                    <>
                      <StatusDot ok={d.ok} className="h-2.5 w-2.5" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[15px] font-medium text-ink">
                          {d.name}
                        </div>
                        <div className="text-[13px] text-muted">
                          {d.ok ? t('admin.domainOk') : t('admin.domainDown')}
                          {d.status ? ` · ${d.status}` : ''} · {d.ms} ms
                        </div>
                      </div>
                      {kind === 'web' && <ExternalLink size={16} className="shrink-0 text-faint" />}
                    </>
                  )
                  return kind === 'web' ? (
                    <button key={d.name} onClick={() => openLink('https://' + d.name)} className={cls + 'transition-[transform,background-color] duration-150 active:scale-[0.99] active:bg-surface-sunken'}>
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
  const { t, lang } = useT()
  const toast = useToast()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [keyOpen, setKeyOpen] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)

  const applyKey = async () => {
    if (!keyValue.trim() || applying) return
    setApplying(true)
    setKeyError(null)
    try {
      const res = await adminApplyKey(profile.id, keyValue)
      notify('success')
      toast(
        res.lifetime
          ? t('admin.keyAppliedLifetime')
          : t('admin.keyApplied', {
              date: new Date(res.paid_until as string).toLocaleDateString(
                lang === 'ru' ? 'ru-RU' : 'en-GB',
                { day: '2-digit', month: '2-digit', year: 'numeric' },
              ),
            }),
      )
      setKeyOpen(false)
      setKeyValue('')
      onChanged()
    } catch (e) {
      notify('error')
      setKeyError(e instanceof ApiError ? e.message : t('key.invalid'))
    } finally {
      setApplying(false)
    }
  }

  const fallbackName = profile.username
    ? '@' + profile.username
    : t('admin.profileFallback', { id: padId(profile.internal_id) })

  const loadDevices = () =>
    adminGetProfileDevices(profile.id).then(setDevices).catch(() => setDevices([]))

  useEffect(() => {
    loadDevices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const delDevice = async (d: Device) => {
    if (!(await confirmDialog(t('devices.deleteConfirm')))) return
    await adminDeleteProfileDevice(profile.id, d.id)
    setDevices((prev) => (prev ?? []).filter((x) => x.id !== d.id))
    toast(t('devices.deletedToast'))
  }

  const block = async () => {
    if (profile.is_admin) {
      toast(t('admin.cantBlockAdmin'))
      return
    }
    // Blocking cuts the user off entirely — confirm. Unblocking is restorative, no prompt.
    if (!profile.is_blocked && !(await confirmDialog(t('admin.blockProfileConfirm')))) return
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
    <Sheet open={open} onClose={onClose} onBack={onBack} title={fallbackName} pills>
      <ProfileDetails p={profile} />

      {/* drill-down: configs / devices open their own sheets */}
      <Section>
        <Cell
          before={<Phone size={20} />}
          title={t('admin.devicesTitle', { n: devices ? devices.length : profile.devices_count })}
          after={<ChevronRight size={18} className="text-faint" />}
          onClick={() => setDevicesOpen(true)}
          last
        />
      </Section>

      {/* management actions — same row style as the user's Account sheet */}
      <Section>
        <Cell
          before={<Key size={20} />}
          title={t('key.activateTitle')}
          after={<ChevronRight size={18} className="text-faint" />}
          onClick={() => {
            setKeyValue('')
            setKeyError(null)
            setKeyOpen(true)
          }}
          last
        />
      </Section>

      <Section>
        <Cell
          before={<Ban size={20} />}
          title={profile.is_blocked ? t('admin.unblockProfile') : t('admin.blockProfile')}
          onClick={block}
          destructive={profile.is_blocked}
          last
        />
      </Section>

      <Section>
        <Cell
          before={<Trash size={20} />}
          title={t('admin.deleteProfile')}
          onClick={del}
          destructive
          last
        />
      </Section>
    </Sheet>

    {/* devices sheet — same layout as the user "Connected devices" */}
    <Sheet open={devicesOpen} onClose={() => setDevicesOpen(false)} onBack={() => setDevicesOpen(false)} title={t('devices.title')} pills>
      {(() => {
        const groupHeader = (label: string) => (
          <div className="font-display mb-2 px-3 text-[15px] font-semibold text-ink">{label}</div>
        )
        const renderGroup = (list: Device[]) => (
          <div className="mb-4 overflow-hidden rounded-3xl border border-border bg-surface">
            {list.map((d, i) => (
              <DeviceRow
                key={d.id}
                device={d}
                index={i}
                border={i !== list.length - 1}
                trailing={
                  <button
                    onClick={() => delDevice(d)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger active:bg-danger/10"
                    aria-label={t('devices.deleteOne')}
                  >
                    <Trash size={18} />
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
          return <EmptyState>{t('devices.empty')}</EmptyState>
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


    {/* apply an access key to THIS profile — full-screen, mirrors the user's
        own key-activation sheet (same title, hero and layout, no extra copy) */}
    <Sheet open={keyOpen} onClose={() => setKeyOpen(false)} onBack={() => setKeyOpen(false)} title={t('key.activateTitle')}>
      <SheetHero icon={<Key size={30} />} title={t('key.activateTitle')} />
      <input
        value={keyValue}
        onChange={(e) => {
          setKeyValue(e.target.value.toUpperCase())
          setKeyError(null)
        }}
        placeholder="XXXX-XXXX"
        aria-label={t('key.activateTitle')}
        autoCapitalize="characters"
        className="h-[52px] w-full rounded-3xl border border-transparent bg-surface-sunken px-4 text-[16px] tracking-wider text-ink outline-none placeholder:text-faint focus:border-accent"
      />
      {keyError && <p className="mt-3 text-[14px] text-danger">{keyError}</p>}
      <div className="mt-4">
        <Button stretched disabled={!keyValue.trim() || applying} onClick={applyKey}>
          {t('key.activate')}
        </Button>
      </div>
    </Sheet>

    <BusyOverlay show={busy} />
    </>
  )
}

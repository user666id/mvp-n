import { useEffect, useRef, useState } from 'react'
import { useCachedResource } from '../lib/useForeground'
import * as cache from '../lib/cache'
import { Sheet } from '../components/ui/Sheet'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { ListSkeleton } from '../components/ui/Skeleton'
import { LoadError } from '../components/ui/LoadError'
import { WheelPicker } from '../components/ui/WheelPicker'
import { SheetHero } from '../components/ui/SheetHero'
import { Trash, ChevronDown, Refresh, Phone } from '../components/icons'
import { DeviceRow, isOSName } from '../components/DeviceRow'
import { useToast } from '../components/ui/Toast'
import { confirmDialog } from '../lib/telegram'
import { useT } from '../lib/i18n'
import {
  deleteDevice,
  deleteConfig,
  getDevices,
  getProfile,
  setDeviceLimit,
  renameDevice,
  resetSubscriptionLink,
  type Device,
} from '../api'

// Device-limit wheel options: 0 = no limit, then 1…10.
const LIMIT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function DevicesSheet({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const { t } = useT()
  const toast = useToast()
  // Shared cache: the device list + the home Devices widget read the SAME 'devices'
  // key, and the cap comes from the single 'profile' key — so they never disagree,
  // and re-opening shows the last list instantly (no setDevices(null)-on-open wipe).
  const { data: devices, error: failed, retry } = useCachedResource<Device[]>('devices', getDevices, {
    active: open,
  })
  const { data: profile } = useCachedResource('profile', getProfile, { active: open })
  const limit = profile?.device_limit || null
  const [renaming, setRenaming] = useState<Device | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitVal, setLimitVal] = useState(0)
  const limitRef = useRef<HTMLDivElement>(null)

  // Close the floating limit picker on a tap outside it (same as the language
  // dropdown) — the wheel itself lives inside the ref, so scrolling it never closes.
  useEffect(() => {
    if (!editingLimit) return
    const onDoc = (e: PointerEvent) => {
      if (limitRef.current && !limitRef.current.contains(e.target as Node)) setEditingLimit(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [editingLimit])

  // The list + cap come from the shared cache (revalidated on resume by App's
  // global recovery). Mutations update the cache so the home widget, the count and
  // this list stay in sync; refresh() reconciles against the server.
  const refresh = () => {
    cache.invalidate('devices', 'profile')
    onChanged?.()
  }

  // No Save button — the wheel auto-persists once it settles. Flip the cached count
  // instantly, then reconcile (revert to server truth on failure).
  const persistLimit = async (v: number) => {
    setLimitVal(v)
    cache.mutate('profile', (p: any) => (p ? { ...p, device_limit: v } : p))
    try {
      await setDeviceLimit(v)
      onChanged?.()
    } catch {
      cache.invalidate('profile')
    }
  }

  // Delete a device inline (with a confirm) — no separate actions sheet.
  const doDelete = async (d: Device) => {
    if (!(await confirmDialog(t('devices.deleteConfirm')))) return
    setBusy(true)
    try {
      // AmneziaWG "device" is its config → deleting it revokes the peer.
      if (d.kind === 'awg') await deleteConfig(d.id)
      else await deleteDevice(d.id)
      cache.mutate('devices', (l: Device[] | undefined) => l?.filter((x) => x.id !== d.id) ?? l)
      toast(t('devices.deletedToast'))
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const doRename = async () => {
    if (!renaming) return
    const name = renameVal.trim()
    if (!name) return
    setBusy(true)
    try {
      await renameDevice(renaming.id, name)
      cache.mutate('devices', (l: Device[] | undefined) =>
        l?.map((x) => (x.id === renaming.id ? { ...x, name } : x)) ?? l,
      )
      setRenaming(null)
      toast(t('devices.renamed'))
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const doDeleteAll = async () => {
    if (!(await confirmDialog(t('devices.deleteAllConfirm')))) return
    setBusy(true)
    try {
      await resetSubscriptionLink()
      // A reset wipes devices server-side and may clear configs — refresh both.
      cache.invalidate('devices', 'configs', 'profile')
      toast(t('devices.deletedAllToast'))
      onChanged?.()
    } finally {
      setBusy(false)
    }
  }

  const renderGroup = (list: Device[]) => (
    <div className="stagger mb-4 overflow-hidden rounded-3xl border border-border bg-surface">
      {list.map((d, i) => {
        const renamed = !isOSName(d.name)
        return (
          <DeviceRow
            key={d.id}
            device={d}
            index={i}
            border={i !== list.length - 1}
            onRename={() => {
              setRenameVal(renamed ? d.name : '')
              setRenaming(d)
            }}
            trailing={
              <button
                onClick={() => doDelete(d)}
                disabled={busy}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger active:bg-danger/10 disabled:opacity-50"
                aria-label={t('devices.deleteOne')}
              >
                <Trash size={18} />
              </button>
            }
          />
        )
      })}
    </div>
  )

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t('devices.title')}>
        <SheetHero icon={<Phone size={30} />} title={t('home.devices')} />

        {/* Device limit — ABOVE the list. Tapping floats the iOS wheel OVER the list
            on frosted glass (like the language picker); the value auto-saves when it
            settles (no Save button). A matching skeleton during load reserves its space
            so the list doesn't jump down when data arrives. */}
        {!devices && !failed && <div className="skeleton mb-4 h-[62px] w-full rounded-3xl" />}
        {devices && (
          <div className="relative z-20 mb-4" ref={limitRef}>
            <div className="overflow-hidden rounded-3xl border border-border bg-surface">
              <button
                onClick={() => {
                  setLimitVal(limit ?? 0)
                  setEditingLimit((e) => !e)
                }}
                className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-sunken"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[16px] font-semibold leading-tight text-ink tabular-nums">
                    {limit ? `${devices.length} / ${limit}` : devices.length}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {limit ? t('settings.deviceLimit') : t('settings.noLimit')}
                  </div>
                </div>
                <ChevronDown size={20} className={'text-faint transition-transform ' + (editingLimit ? 'rotate-180' : '')} />
              </button>
            </div>
            {/* Floating glass picker — overlays the device list instead of pushing it. */}
            <div
              aria-hidden={!editingLimit}
              className={
                'glass-thin absolute left-0 right-0 top-[calc(100%+6px)] z-30 origin-top overflow-hidden rounded-3xl px-4 py-2 transition-[opacity,transform] duration-200 ' +
                (editingLimit ? 'opacity-100 scale-100' : 'pointer-events-none scale-95 opacity-0')
              }
            >
              <WheelPicker
                value={limitVal}
                options={LIMIT_OPTIONS}
                onChange={persistLimit}
                format={(v) => (v === 0 ? t('settings.noLimit') : String(v))}
              />
            </div>
          </div>
        )}

        {failed ? (
          <LoadError onRetry={retry} />
        ) : !devices ? (
          <ListSkeleton rows={3} />
        ) : devices.length === 0 ? (
          <EmptyState>{t('devices.empty')}</EmptyState>
        ) : (
          // One flat list — no VLESS / AmneziaWG split.
          <div className="animate-fade">{renderGroup(devices)}</div>
        )}

        {devices && devices.length > 0 && (
          <Section>
            <Cell
              before={<Refresh size={20} />}
              title={t('devices.deleteAll')}
              onClick={doDeleteAll}
              destructive
              last
            />
          </Section>
        )}
      </Sheet>

      {/* rename */}
      <Sheet open={!!renaming} onClose={() => setRenaming(null)} onBack={() => setRenaming(null)} title={t('devices.renameTitle')}>
        <input
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          placeholder={t('devices.renamePlaceholder')}
          aria-label={t('devices.renameTitle')}
          className="mb-4 h-[52px] w-full rounded-3xl border border-transparent bg-surface-sunken px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="pb-2">
          <Button stretched loading={busy} disabled={!renameVal.trim()} onClick={doRename}>
            {t('devices.renameSave')}
          </Button>
        </div>
      </Sheet>

    </>
  )
}

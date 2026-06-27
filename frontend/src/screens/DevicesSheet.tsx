import { useEffect, useRef, useState } from 'react'
import { useForegroundRefetch } from '../lib/useForeground'
import { Sheet } from '../components/ui/Sheet'
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
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [renaming, setRenaming] = useState<Device | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [busy, setBusy] = useState(false)
  // Device limit lives here now (moved off the profile/Settings): the count + cap
  // are most meaningful right next to the device list. Edited inline with an
  // iOS-style wheel (no separate sheet, no typing). 0 = no limit.
  const [limit, setLimit] = useState<number | null>(null)
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

  const load = async () => {
    setFailed(false)
    setDevices(null)
    // Limit is best-effort — a failure just hides the cap, never blocks the list.
    getProfile()
      .then((p) => setLimit(p.device_limit || null))
      .catch(() => {})
    try {
      setDevices(await getDevices())
    } catch {
      // Don't fake an empty list (misleading) — show a retry instead.
      setFailed(true)
    }
  }

  // No Save button — the wheel auto-persists the value once it settles on a number.
  const persistLimit = async (v: number) => {
    setLimitVal(v)
    try {
      await setDeviceLimit(v)
      setLimit(v || null)
      onChanged?.()
    } catch {
      /* keep the wheel value; the user can re-pick to retry */
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Re-load when the app returns to the foreground while the sheet is open.
  useForegroundRefetch(open, load)

  const refresh = async () => {
    await load()
    onChanged?.()
  }

  // Delete a device inline (with a confirm) — no separate actions sheet.
  const doDelete = async (d: Device) => {
    if (!(await confirmDialog(t('devices.deleteConfirm')))) return
    setBusy(true)
    try {
      // AmneziaWG "device" is its config → deleting it revokes the peer.
      if (d.kind === 'awg') await deleteConfig(d.id)
      else await deleteDevice(d.id)
      toast(t('devices.deletedToast'))
      await refresh()
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
      setRenaming(null)
      toast(t('devices.renamed'))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const doDeleteAll = async () => {
    if (!(await confirmDialog(t('devices.deleteAllConfirm')))) return
    setBusy(true)
    try {
      await resetSubscriptionLink()
      toast(t('devices.deletedAllToast'))
      await refresh()
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
          <LoadError onRetry={load} />
        ) : !devices ? (
          <ListSkeleton rows={3} />
        ) : devices.length === 0 ? (
          <div className="py-14 text-center text-[15px] text-muted">{t('devices.empty')}</div>
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

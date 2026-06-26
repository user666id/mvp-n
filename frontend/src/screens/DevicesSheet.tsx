import { useEffect, useState } from 'react'
import { useForegroundRefetch } from '../lib/useForeground'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { ListSkeleton } from '../components/ui/Skeleton'
import { LoadError } from '../components/ui/LoadError'
import { Trash } from '../components/icons'
import { DeviceRow, isOSName } from '../components/DeviceRow'
import { useToast } from '../components/ui/Toast'
import { confirmDialog } from '../lib/telegram'
import { useT } from '../lib/i18n'
import {
  deleteDevice,
  deleteConfig,
  getDevices,
  renameDevice,
  resetSubscriptionLink,
  type Device,
} from '../api'

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

  const load = async () => {
    setFailed(false)
    setDevices(null)
    try {
      setDevices(await getDevices())
    } catch {
      // Don't fake an empty list (misleading) — show a retry instead.
      setFailed(true)
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

  const vlessList = (devices ?? []).filter((d) => d.kind !== 'awg')
  const awgList = (devices ?? []).filter((d) => d.kind === 'awg')

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
  const groupHeader = (label: string) => (
    <div className="font-display mb-2 px-3 text-[15px] font-semibold text-ink">{label}</div>
  )

  return (
    <>
      <Sheet open={open} onClose={onClose} title={t('devices.title')}>
        {failed ? (
          <LoadError onRetry={load} />
        ) : !devices ? (
          <ListSkeleton rows={3} />
        ) : devices.length === 0 ? (
          <div className="py-14 text-center text-[15px] text-muted">{t('devices.empty')}</div>
        ) : (
          // A labelled category per protocol that has devices.
          <div className="animate-fade">
            {vlessList.length > 0 && (
              <>
                {groupHeader(t('devices.catVless'))}
                {renderGroup(vlessList)}
              </>
            )}
            {awgList.length > 0 && (
              <>
                {groupHeader(t('devices.catAwg'))}
                {renderGroup(awgList)}
              </>
            )}
          </div>
        )}

        {devices && devices.length > 0 && (
          <Section>
            <Cell
              before={<Trash size={20} />}
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

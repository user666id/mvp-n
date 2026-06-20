import { useEffect, useState } from 'react'
import { useForegroundRefetch } from '../lib/useForeground'
import { Sheet } from '../components/ui/Sheet'
import { Button } from '../components/ui/Button'
import { Section } from '../components/ui/Card'
import { Cell } from '../components/ui/Cell'
import { ListSkeleton } from '../components/ui/Skeleton'
import { LoadError } from '../components/ui/LoadError'
import { ChevronRight, Ban, Check, Trash } from '../components/icons'
import { DeviceRow, isOSName } from '../components/DeviceRow'
import { useToast } from '../components/ui/Toast'
import { confirmDialog } from '../lib/telegram'
import { useT } from '../lib/i18n'
import {
  blockDevice,
  unblockDevice,
  deleteDevice,
  deleteConfig,
  getDevices,
  renameDevice,
  resetSubscriptionLink,
  type Device,
} from '../api'

/** "{Launcher} {OS}" — e.g. "Happ Windows"; empty when neither is known. */
const deviceLabel = (d: Device) => [d.client, d.name].filter(Boolean).join(' ')

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
  const [actions, setActions] = useState<Device | null>(null)
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

  const doBlock = async (d: Device) => {
    setActions(null)
    setBusy(true)
    try {
      await blockDevice(d.id)
      toast(t('devices.blockedToast'))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const doUnblock = async (d: Device) => {
    setActions(null)
    setBusy(true)
    try {
      await unblockDevice(d.id)
      toast(t('devices.unblockedToast'))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async (d: Device) => {
    setActions(null)
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
    <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-surface">
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
                onClick={() => setActions(d)}
                className="shrink-0 text-faint active:opacity-60"
                aria-label={t('devices.actions')}
              >
                <ChevronRight size={20} />
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

      {/* device actions */}
      <Sheet
        open={!!actions}
        onClose={() => setActions(null)}
        onBack={() => setActions(null)}
        title={actions ? deviceLabel(actions) || t('common.device') : ''}
      >
        {actions && (
          <>
            <Section>
              <Cell
                before={actions.is_blocked ? <Check size={20} /> : <Ban size={20} />}
                title={actions.is_blocked ? t('devices.unblock') : t('devices.block')}
                onClick={() => (actions.is_blocked ? doUnblock(actions) : doBlock(actions))}
                last
              />
            </Section>
            <Section>
              <Cell
                before={<Trash size={20} />}
                title={t('devices.deleteOne')}
                onClick={() => doDelete(actions)}
                destructive
                last
              />
            </Section>
          </>
        )}
      </Sheet>

      {/* rename */}
      <Sheet open={!!renaming} onClose={() => setRenaming(null)} onBack={() => setRenaming(null)} title={t('devices.renameTitle')}>
        <input
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          placeholder={t('devices.renamePlaceholder')}
          className="mb-4 h-[52px] w-full rounded-2xl border border-transparent bg-surface-sunken px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-accent"
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

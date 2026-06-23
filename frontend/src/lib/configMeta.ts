import type { TKey } from './i18n'

type Tfn = (key: TKey) => string

/** Minimal shape configMeta needs — satisfied by both Config and AdminConfig. */
type ConfigLike = { protocol: string; enhanced: boolean; game_mode: boolean }

export interface ConfigMeta {
  protocol: string // VLESS | AmneziaWG (brand, not translated)
  transport: string // TCP | UDP
  mode: string // localized; empty for AmneziaWG
  tech: string // localized
  purpose: string // localized
}

/** Derive a config's human description from protocol + flags (no port shown). */
export function configMeta(c: ConfigLike, t: Tfn): ConfigMeta {
  if (c.protocol === 'awg') {
    return {
      protocol: 'AmneziaWG',
      transport: 'UDP',
      mode: '',
      tech: t('tech.awg'),
      purpose: t('purpose.awg'),
    }
  }
  if (c.enhanced) {
    return {
      protocol: 'VLESS',
      transport: 'TCP',
      mode: t('meta.modeEnhanced'),
      tech: t('tech.xhttp'),
      purpose: t('purpose.enhanced'),
    }
  }
  if (c.game_mode) {
    return {
      protocol: 'VLESS',
      transport: 'TCP',
      mode: t('meta.modeGame'),
      tech: t('tech.noVision'),
      purpose: t('purpose.game'),
    }
  }
  return {
    protocol: 'VLESS',
    transport: 'TCP',
    mode: t('meta.modeNormal'),
    tech: t('tech.visionTcp'),
    purpose: t('purpose.normal'),
  }
}

/** Main-screen list card — mode-forward and glanceable:
 *  "VLESS · Enhanced" (mode is empty for AmneziaWG → just "AmneziaWG"). */
export function configListLabel(m: ConfigMeta): string {
  return [m.protocol, m.mode].filter(Boolean).join(' · ')
}

/** Detail sheet — full spec:
 *  "VLESS · TCP · REALITY + XHTTP" / "AmneziaWG · UDP · WireGuard + obfuscation". */
export function configSpecLine(m: ConfigMeta): string {
  return [m.protocol, m.transport, m.tech].filter(Boolean).join(' · ')
}

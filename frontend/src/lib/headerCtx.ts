import { createContext, useContext } from 'react'

/**
 * App-wide header context — lets full-screen Sheets (config detail, install,
 * admin drill-downs) render the SAME account-avatar + wallet pills as the main
 * PageHeader, so the profile/wallet never disappear when you drill in. Provided
 * once in App; the wallet pill is self-contained under the global TonConnect.
 */
export const HeaderCtx = createContext<{
  accountName?: string
  onAccount?: () => void
  /** True while the Account (Settings) sheet is open. The avatar pill then acts as
   *  "go home" (collapse everything to Configs) instead of "open Settings". */
  accountOpen?: boolean
  /** Collapse all sheets + return to the home (Configs) tab. The avatar pill calls
   *  this when it's in the back state — uniform "go home" from any screen. */
  goHome?: () => void
}>({})
export const useHeaderCtx = () => useContext(HeaderCtx)

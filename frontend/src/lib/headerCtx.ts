import { createContext, useContext } from 'react'

/**
 * App-wide header context — lets full-screen Sheets (config detail, install,
 * admin drill-downs) render the SAME account-avatar + wallet pills as the main
 * PageHeader, so the profile/wallet never disappear when you drill in. Provided
 * once in App; the wallet pill is self-contained under the global TonConnect.
 */
export const HeaderCtx = createContext<{ accountName?: string; onAccount?: () => void }>({})
export const useHeaderCtx = () => useContext(HeaderCtx)

import { haptic } from './telegram'

/** Copy text to clipboard with a legacy execCommand fallback (older webviews).
 *  Fires a light haptic tick on success — one place, so every copy in the app
 *  gets the same native feedback (obeys the Settings haptics toggle). */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    haptic('light')
    return
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
    haptic('light')
  }
}

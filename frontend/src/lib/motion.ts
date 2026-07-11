// Single source of truth for the app's motion system. Every slide, rubber-band
// bounce and pop uses the SAME easing + duration, so the whole UI moves as one
// consistent system. Import these instead of re-declaring per component.

/** iOS/Telegram-style ease-out — snappy start, soft settle. */
export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** Standard transition duration (ms) for sheet slides, bottom-sheet slides,
 *  and the pull-to-scroll bounce-back. */
export const DUR = 300

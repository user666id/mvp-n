import { lazy } from 'react'

// Charts are pure-SVG but sizeable; loading them lazily keeps Chart/BarChart (and
// their shared chartkit primitives) out of the main bundle. They only render when
// a stats/usage/traffic sheet is open with data, so the chunk loads on demand.
// Wrap usages in <Suspense> with a skeleton fallback.
export const AreaChart = lazy(() => import('./Chart').then((m) => ({ default: m.AreaChart })))
export const BarChart = lazy(() => import('./BarChart').then((m) => ({ default: m.BarChart })))

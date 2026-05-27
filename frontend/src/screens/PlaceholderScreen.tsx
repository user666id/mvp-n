import React from 'react'
import { PageHeader } from '../components/PageHeader'

/** Used for tabs that are scaffolded but not built yet (Опции, Настройки). */
export function PlaceholderScreen({
  title,
  icon,
  text,
  onMenu,
}: {
  title: string
  icon: React.ReactNode
  text: string
  onMenu?: () => void
}) {
  return (
    <div className="pb-10">
      <PageHeader title={title} onMenu={onMenu} />
      <div className="flex flex-col items-center px-8 pt-[20vh] text-center">
        <div className="text-faint">{icon}</div>
        <p className="mt-4 max-w-[280px] text-[15px] leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  )
}

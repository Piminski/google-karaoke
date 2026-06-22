import type { ReactNode } from 'react'

import { SiteHeader } from './SiteHeader'

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="frame-shell">
      <div className="frame">
        <SiteHeader />
        {children}
      </div>
    </div>
  )
}

import { Loader2Icon } from 'lucide-react'

import { NEWS_SOURCE_URL } from '../../newsSource'

export function LoadingHeadlines() {
  return (
    <div className="site-status-block">
      <p className="site-chrome site-status">
        <Loader2Icon className="site-status-icon" aria-hidden="true" />
        Loading headlines…
      </p>
      <p className="site-chrome site-source">
        Source:{' '}
        <a href={NEWS_SOURCE_URL} className="site-source-link" target="_blank" rel="noreferrer">
          {NEWS_SOURCE_URL}
        </a>
      </p>
    </div>
  )
}

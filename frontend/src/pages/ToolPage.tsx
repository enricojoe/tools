import { Suspense } from 'react'
import { Link, useParams } from 'react-router'
import { Icon } from '../components/Icon'
import { findTool } from '../tools/registry'
import { NotFoundPage } from './NotFoundPage'
import './pages.css'

export function ToolPage() {
  const tool = findTool(useParams().slug)
  if (!tool) return <NotFoundPage />

  return (
    <div className="page">
      <title>{`${tool.name} · Tools`}</title>
      <Link to="/" className="back-link">
        <Icon name="back" size={16} />
        All tools
      </Link>
      <header className="tool-header">
        <span className="tool-icon">
          <Icon name={tool.icon} size={24} />
        </span>
        <div>
          <h1>{tool.name}</h1>
          <p className="lead">{tool.description}</p>
        </div>
      </header>
      <Suspense fallback={<p className="loading">Getting things ready…</p>}>
        <tool.Component key={tool.slug} />
      </Suspense>
    </div>
  )
}

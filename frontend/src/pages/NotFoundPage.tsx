import { Link } from 'react-router'
import './pages.css'

export function NotFoundPage() {
  return (
    <div className="page not-found">
      <title>Page not found · Tools</title>
      <p className="not-found-code">404</p>
      <p className="kicker">Oops!</p>
      <h1>This page wandered off 🙈</h1>
      <p className="lead">We couldn't find what you were looking for.</p>
      <Link to="/" className="btn btn-primary">
        Take me home
      </Link>
    </div>
  )
}

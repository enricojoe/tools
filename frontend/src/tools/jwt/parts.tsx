import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import type { PartName } from './jwt'

const PART_CLASS: PartName[] = ['header', 'payload', 'signature']

/** The token painted in three colors, split at its dots (a JWE's five parts reuse them). */
function paint(text: string): ReactNode[] {
  const prefix = /^\s*(?:authorization:\s*)?bearer\s+/i.exec(text)?.[0] ?? ''
  const out: ReactNode[] = []
  if (prefix) out.push(<span key="prefix" className="jwt-c-prefix">{prefix}</span>)
  text
    .slice(prefix.length)
    .split('.')
    .forEach((segment, i) => {
      if (i > 0) out.push(<span key={`dot-${i}`} className="jwt-c-dot">.</span>)
      out.push(
        <span key={i} className={`jwt-c-${PART_CLASS[Math.min(i, 2)]}`}>
          {segment}
        </span>,
      )
    })
  return out
}

interface TokenFieldProps {
  id?: string
  value: string
  onChange?: (value: string) => void
  placeholder?: string
  label: string
  invalid?: boolean
}

/**
 * A textarea with the token colored underneath it: the text itself is
 * transparent, so the caret and selection work as usual over the colors.
 * Both layers share one grid cell, so the field grows with the token.
 */
export function TokenField({ id, value, onChange, placeholder, label, invalid }: TokenFieldProps) {
  return (
    <div className={onChange ? 'jwt-field' : 'jwt-field jwt-field-readonly'}>
      <pre className="jwt-field-paint" aria-hidden="true">
        {paint(value)}
        {/* Keeps the last line's height when the token ends with a line break. */}
        {'\n'}
      </pre>
      <textarea
        id={id}
        className="jwt-field-input"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
      />
    </div>
  )
}

/** Copy button that says "Copied!" for a moment, or asks for a manual copy if the clipboard is blocked. */
export function CopyButton({
  text,
  label = 'Copy',
  primary = false,
  small = false,
}: {
  text: string
  label?: string
  primary?: boolean
  small?: boolean
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 1800)
  }

  const className = small ? 'jwt-mini' : primary ? 'btn btn-primary' : 'btn btn-secondary'
  return (
    <button type="button" className={className} onClick={copy} disabled={text === ''}>
      <Icon name={state === 'copied' ? 'check' : 'copy'} size={small ? 14 : 18} />
      {state === 'copied' ? 'Copied!' : state === 'failed' ? 'Copy blocked: select it by hand' : label}
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Copied' : ''}
      </span>
    </button>
  )
}

export type StickerTone = 'good' | 'bad' | 'warn' | 'plain'

export function Sticker({ tone, icon, children, title }: { tone: StickerTone; icon?: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span className={`jwt-sticker jwt-sticker-${tone}`} title={title}>
      {icon}
      {children}
    </span>
  )
}

import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react'
import { Icon } from '../../components/Icon'
import {
  EXTENSIONS,
  bytesToText,
  decode,
  encodeBytes,
  explainGroup,
  formatBytes,
  hexPreview,
  looksLikeBase64,
  sniffType,
  toDataUrl,
  type EncodeOptions,
} from './base64'
import './Base64Tool.css'

type Mode = 'encode' | 'decode'

const MODES: { value: Mode; label: string }[] = [
  { value: 'encode', label: 'Encode' },
  { value: 'decode', label: 'Decode' },
]

const EXAMPLES: Record<Mode, string> = {
  encode: 'Hello, world! 👋',
  decode: 'U2VsYW1hdCBwYWdpISDimJXvuI8=',
}

const DRAFT_KEY = 'base64:draft'
const OPTIONS_KEY = 'base64:options'
// Drafts past this size aren't saved, so one huge paste can't fill storage.
const MAX_DRAFT = 200_000
const SAVE_DELAY_MS = 300
// Bigger files make a result too long to show or copy comfortably.
const MAX_FILE = 5 * 1024 * 1024

const DEFAULT_OPTIONS: EncodeOptions = { urlSafe: false, padding: true, wrap: false }

// Each mode keeps its own input, so switching modes doesn't mix them up.
type Texts = Record<Mode, string>

interface Draft extends Partial<Texts> {
  mode: Mode
  /** Single shared input saved by the first version of this tool. */
  text?: string
}

function draftTexts(draft: Draft): Texts {
  const texts: Texts = { encode: '', decode: '' }
  for (const m of ['encode', 'decode'] as const) {
    const value = draft[m] ?? (draft.mode === m ? draft.text : undefined)
    if (typeof value === 'string') texts[m] = value
  }
  return texts
}

interface PickedFile {
  name: string
  type: string
  bytes: Uint8Array
}

type Result =
  | { kind: 'text'; output: string; source: Uint8Array }
  | { kind: 'binary'; source: Uint8Array; mime: string; label: string }
  | { kind: 'error'; error: string }

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: unknown, remove = false): void {
  try {
    if (remove) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable or full: the choice just won't survive a reload.
  }
}

function download(data: BlobPart, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Give the browser a moment to start the download before letting go.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Base64Tool() {
  const [draft] = useState(() => load<Draft>(DRAFT_KEY, { mode: 'encode' }))
  const [mode, setMode] = useState<Mode>(draft.mode === 'decode' ? 'decode' : 'encode')
  const [texts, setTexts] = useState(() => draftTexts(draft))
  const [options, setOptions] = useState(() => load<EncodeOptions>(OPTIONS_KEY, DEFAULT_OPTIONS))
  const [asDataUrl, setAsDataUrl] = useState(false)
  const [file, setFile] = useState<PickedFile | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ids = useId()

  const text = texts[mode]
  // Deferring both inputs together means a mode switch shows the right
  // input's result at once; only typing is deferred.
  const deferredTexts = useDeferredValue(texts)
  const deferred = deferredTexts[mode]
  const encoding = mode === 'encode'
  const otherMode: Mode = encoding ? 'decode' : 'encode'
  const fileMode = encoding && file !== null

  const result = useMemo((): Result | null => {
    if (encoding) {
      if (file) {
        const output = asDataUrl ? toDataUrl(file.bytes, file.type) : encodeBytes(file.bytes, options)
        return { kind: 'text', output, source: file.bytes }
      }
      if (deferred === '') return null
      const source = new TextEncoder().encode(deferred)
      return { kind: 'text', output: encodeBytes(source, options), source }
    }
    if (deferred.trim() === '') return null
    const decoded = decode(deferred)
    if (!decoded.ok) return { kind: 'error', error: decoded.error }
    const asText = bytesToText(decoded.bytes)
    if (asText !== null && !decoded.mime?.startsWith('image/')) {
      return { kind: 'text', output: asText, source: decoded.bytes }
    }
    const sniffed = sniffType(decoded.bytes)
    const mime = decoded.mime ?? sniffed?.mime ?? 'application/octet-stream'
    return { kind: 'binary', source: decoded.bytes, mime, label: sniffed?.label ?? decoded.mime ?? 'Binary data' }
  }, [encoding, file, asDataUrl, options, deferred])

  // Typed into the wrong mode: Base64 to encode, or plain text to decode.
  const wrongMode = useMemo(() => {
    if (fileMode || deferred.trim() === '') return false
    if (encoding) return looksLikeBase64(deferred)
    // Words with spaces between them either fail to decode or decode to bytes of no known type.
    const garbled = result?.kind === 'error' || (result?.kind === 'binary' && result.mime === 'application/octet-stream')
    return garbled && /\s\S/.test(deferred.trim())
  }, [fileMode, encoding, deferred, result])

  const preview = useMemo(() => {
    if (result?.kind === 'binary' && result.mime.startsWith('image/')) return toDataUrl(result.source, result.mime)
    if (fileMode && file.type.startsWith('image/')) return toDataUrl(file.bytes, file.type)
    return null
  }, [result, fileMode, file])

  const explained = useMemo(
    () => (result && result.kind !== 'error' && result.source.length > 0 ? explainGroup(result.source, encoding && options.urlSafe) : null),
    [result, encoding, options.urlSafe],
  )

  useEffect(() => {
    const id = window.setTimeout(() => {
      const keep = (t: string) => (t.length > MAX_DRAFT ? '' : t)
      store(DRAFT_KEY, { mode, encode: keep(deferredTexts.encode), decode: keep(deferredTexts.decode) })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [mode, deferredTexts])

  useEffect(() => store(OPTIONS_KEY, options), [options])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  function setText(value: string, forMode: Mode = mode) {
    setTexts((t) => ({ ...t, [forMode]: value }))
  }

  function setOption(key: keyof EncodeOptions, value: boolean) {
    setOptions((o) => ({ ...o, [key]: value }))
  }

  function handleMode(next: Mode) {
    setMode(next)
    setCopyFailed(false)
  }

  function handleClear() {
    setText('')
    if (encoding) setFile(null)
    setFileError(null)
    textareaRef.current?.focus()
  }

  function handleExample() {
    setText(EXAMPLES[mode])
    textareaRef.current?.focus()
  }

  // Encoding takes the file's bytes; decoding reads the file as Base64 text.
  async function handleFile(picked: File | undefined) {
    if (!picked) return
    if (picked.size > MAX_FILE) {
      setFileError(`“${picked.name}” is ${formatBytes(picked.size)}; files up to ${formatBytes(MAX_FILE)} work here.`)
      return
    }
    try {
      if (encoding) {
        setFile({ name: picked.name, type: picked.type, bytes: new Uint8Array(await picked.arrayBuffer()) })
      } else {
        const forMode = mode
        setText(await picked.text(), forMode)
      }
      setFileError(null)
    } catch {
      setFileError(`Couldn't read “${picked.name}”.`)
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0])
  }

  // A pasted screenshot or copied file has no text; encode it as a file.
  function handlePaste(e: ClipboardEvent) {
    if (!encoding || e.clipboardData.types.includes('text/plain')) return
    const pasted = e.clipboardData.files[0]
    if (!pasted) return
    e.preventDefault()
    void handleFile(pasted)
  }

  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopyFailed(false)
      setCopied(true)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyFailed(true)
    }
  }

  // Moves text typed into the wrong mode over to the other one.
  function handleMoveText() {
    setTexts((t) => ({ ...t, [mode]: '', [otherMode]: t[mode] }))
    setMode(otherMode)
    textareaRef.current?.focus()
  }

  // Puts the result in the input and flips the mode, to check a round trip.
  function handleSwap(value: string) {
    setText(value, otherMode)
    setMode(otherMode)
    textareaRef.current?.focus()
  }

  function handleDownload() {
    if (!result || result.kind === 'error') return
    if (result.kind === 'binary') {
      download(result.source as BlobPart, `decoded.${EXTENSIONS[result.mime] ?? 'bin'}`, result.mime)
    } else {
      download(result.output, encoding ? 'base64.txt' : 'decoded.txt', 'text/plain;charset=utf-8')
    }
  }

  const textOutput = result?.kind === 'text' ? result.output : null
  const inputSize = result && result.kind !== 'error' ? result.source.length : 0
  const sizeNote =
    textOutput === null
      ? null
      : encoding
        ? `${formatBytes(inputSize)} → ${textOutput.length.toLocaleString()} characters` +
          (inputSize > 0 ? ` (+${Math.round((textOutput.length / inputSize - 1) * 100)}%)` : '')
        : `${deferred.trim().length.toLocaleString()} characters → ${formatBytes(inputSize)} of text`

  return (
    <div className="b64-tool">
      <section className="card b64-panel">
        <div className="b64-head">
          <div className="b64-chips" role="group" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className="b64-chip"
                aria-pressed={mode === m.value}
                onClick={() => handleMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="b64-actions">
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Icon name="upload" size={18} />
              File
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={text === '' && !fileMode}
            >
              <Icon name="trash" size={18} />
              Clear
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          hidden
          accept={encoding ? undefined : '.txt,text/plain'}
          onChange={(e) => {
            void handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        {fileMode ? (
          <div className="b64-file">
            {preview ? <img className="b64-thumb" src={preview} alt="" /> : <Icon name="binary" size={28} />}
            <div className="b64-file-text">
              <span className="b64-file-name">{file.name}</span>
              <span className="hint">
                {formatBytes(file.bytes.length)} · {file.type || 'unknown type'}
              </span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setFile(null)}>
              Back to text
            </button>
          </div>
        ) : (
          <div
            className={dragging ? 'b64-drop b64-drop-active' : 'b64-drop'}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <label htmlFor={`${ids}-text`} className="sr-only">
              {encoding ? 'Text to encode' : 'Base64 to decode'}
            </label>
            <textarea
              ref={textareaRef}
              id={`${ids}-text`}
              className="b64-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              placeholder={
                encoding
                  ? 'Type or paste text to encode, or drop / paste a file or screenshot…'
                  : 'Paste Base64 or a data: URL to decode, or drop a .txt file with it…'
              }
              spellCheck={false}
            />
            {dragging && (
              <span className="b64-drop-note" aria-hidden="true">
                {encoding ? 'Drop to encode the file' : 'Drop to decode the text in it'}
              </span>
            )}
          </div>
        )}

        {wrongMode && (
          <div className="b64-nudge" role="status">
            <span>
              {encoding ? 'This already looks like Base64.' : 'This looks like plain text, not Base64.'}
            </span>
            <button type="button" className="b64-action" onClick={handleMoveText}>
              {encoding ? 'Decode it instead' : 'Encode it instead'}
            </button>
          </div>
        )}

        {fileError && (
          <p className="error" role="alert">
            {fileError}
          </p>
        )}

        {encoding && (
          <fieldset className="b64-options">
            <legend className="b64-label">Options</legend>
            {fileMode && (
              <label className="b64-check">
                <input type="checkbox" checked={asDataUrl} onChange={(e) => setAsDataUrl(e.target.checked)} />
                As a <code>data:</code> URL (for HTML and CSS)
              </label>
            )}
            <label className="b64-check">
              <input
                type="checkbox"
                checked={options.urlSafe}
                disabled={fileMode && asDataUrl}
                onChange={(e) => setOption('urlSafe', e.target.checked)}
              />
              URL-safe (<code>-</code> and <code>_</code> instead of <code>+</code> and <code>/</code>)
            </label>
            <label className="b64-check">
              <input
                type="checkbox"
                checked={options.padding}
                disabled={fileMode && asDataUrl}
                onChange={(e) => setOption('padding', e.target.checked)}
              />
              Padding (<code>=</code> at the end)
            </label>
            <label className="b64-check">
              <input
                type="checkbox"
                checked={options.wrap}
                disabled={fileMode && asDataUrl}
                onChange={(e) => setOption('wrap', e.target.checked)}
              />
              Wrap lines at 76 characters (email / MIME)
            </label>
          </fieldset>
        )}

        <p className="hint">
          {encoding
            ? 'Text is encoded as UTF-8, so accents and emoji come back intact.'
            : 'Spaces and line breaks are ignored, URL-safe Base64 and missing padding are fine.'}{' '}
          Everything runs in your browser; text is kept on this device as a draft.
        </p>
      </section>

      <div className="b64-side">
        <section className="card b64-panel" aria-labelledby={`${ids}-result`}>
          <div className="b64-head">
            <h2 className="b64-label" id={`${ids}-result`}>
              {encoding ? 'Base64' : 'Decoded'}
            </h2>
            {result && result.kind !== 'error' && (
              <div className="b64-actions">
                {textOutput !== null && (
                  <>
                    <button type="button" className="btn btn-secondary" onClick={() => handleSwap(textOutput)}>
                      <Icon name="swap" size={18} />
                      {encoding ? 'Decode it' : 'Encode it'}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => handleCopy(textOutput)}>
                      <Icon name={copied ? 'check' : 'copy'} size={18} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className={textOutput === null ? 'btn btn-primary' : 'btn btn-secondary b64-icon-btn'}
                  onClick={handleDownload}
                  aria-label={textOutput === null ? undefined : 'Download as a file'}
                  title={textOutput === null ? undefined : 'Download as a file'}
                >
                  <Icon name="download" size={18} />
                  {textOutput === null && 'Download'}
                </button>
              </div>
            )}
          </div>

          {result === null && (
            <div className="b64-empty">
              <p>{encoding ? 'The Base64 shows up here as you type.' : 'The decoded text or file shows up here.'}</p>
              {!fileMode && (
                <button type="button" className="b64-action" onClick={handleExample}>
                  <Icon name="sparkle" size={16} />
                  Try an example
                </button>
              )}
            </div>
          )}

          {result?.kind === 'error' && (
            <p className="error" role="alert">
              {result.error}
            </p>
          )}

          {result?.kind === 'text' && (
            <>
              <textarea
                className="b64-textarea b64-output"
                value={result.output}
                readOnly
                aria-label={encoding ? 'Base64 result' : 'Decoded text'}
                spellCheck={false}
              />
              <p className="hint">{sizeNote}</p>
            </>
          )}

          {result?.kind === 'binary' && (
            <div className="b64-binary">
              <p className="b64-binary-title">
                {result.label} · {formatBytes(result.source.length)}
              </p>
              {preview && <img className="b64-preview" src={preview} alt="Decoded image" />}
              <pre className="b64-hex" aria-label="First bytes in hex">
                {hexPreview(result.source)}
              </pre>
              <p className="hint">This isn't text, so it's shown as a file. Download it to open it.</p>
            </div>
          )}

          {copyFailed && (
            <p className="error" role="alert">
              Couldn't copy automatically. Select the text and copy it by hand.
            </p>
          )}
          <p className="sr-only" role="status">
            {copied ? 'Copied' : ''}
          </p>
        </section>

        {explained && (
          <details className="card b64-explain">
            <summary className="b64-label">How it works</summary>
            <p className="hint">
              Base64 takes 3 bytes (24 bits) at a time and cuts them into 4 groups of 6 bits. Each group is a number
              from 0 to 63, which picks a letter from <code>A–Z a–z 0–9 {encoding && options.urlSafe ? '- _' : '+ /'}</code>.
              That's why the result is about a third longer. Here are your first bytes:
            </p>
            <div className="b64-explain-row" aria-label="Bytes">
              {explained.bytes.map((b, i) => (
                <div key={i} className="b64-box">
                  <span className="b64-box-top">{b.label}</span>
                  <span className="b64-bits">
                    {[...b.bits].map((bit, j) => (
                      <span key={j} className={`b64-bit b64-g${Math.floor((i * 8 + j) / 6) % 2}`}>
                        {bit}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            <div className="b64-explain-arrow" aria-hidden="true">
              ↓
            </div>
            <div className="b64-explain-row" aria-label="6-bit groups">
              {explained.sextets.map((s, i) => (
                <div key={i} className={`b64-box b64-box-g${i % 2}`}>
                  <span className="b64-bits">
                    {[...s.bits].map((bit, j) => (
                      <span key={j} className={i * 6 + j >= explained.bytes.length * 8 ? 'b64-bit b64-bit-fill' : 'b64-bit'}>
                        {bit}
                      </span>
                    ))}
                  </span>
                  <span className="b64-box-index">{s.index}</span>
                  <span className="b64-box-char">{s.char}</span>
                </div>
              ))}
              {Array.from({ length: encoding && !options.padding ? 0 : explained.padding }, (_, i) => (
                <div key={`pad-${i}`} className="b64-box b64-box-pad">
                  <span className="b64-bits">padding</span>
                  <span className="b64-box-index">&nbsp;</span>
                  <span className="b64-box-char">=</span>
                </div>
              ))}
            </div>
            {explained.padding > 0 && (!encoding || options.padding) && (
              <p className="hint">
                The last group was short, so it's filled with faded zero bits and the gap is marked with “=”.
              </p>
            )}
          </details>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { cleanOptions, DEFAULT_OPTIONS, type Mode, type Options } from './options'
import Studio from './Studio'
import SvgCompare from './SvgCompare'
import { load, MAX_DRAFT, SAVE_DELAY_MS, store } from './util'
import './SvgViewerTool.css'

const DRAFT_KEY = 'svg-viewer:draft'
const OPTIONS_KEY = 'svg-viewer:options'

const MODES: { value: Mode; label: string; icon: IconName }[] = [
  { value: 'studio', label: 'Studio', icon: 'palette' },
  { value: 'versus', label: 'A vs B', icon: 'swap' },
]

interface Draft {
  text: string
  name: string | null
}

/** The SVG viewer: the code and choices both modes share, and the switch between them. */
export default function SvgViewerTool() {
  const [draft] = useState(() => load<Draft>(DRAFT_KEY, { text: '', name: null }))
  const [text, setText] = useState(draft.text)
  const [name, setName] = useState(draft.name)
  const [options, setOptions] = useState(() => cleanOptions(load<Options>(OPTIONS_KEY, DEFAULT_OPTIONS)))

  useEffect(() => {
    const id = window.setTimeout(() => store(DRAFT_KEY, { text: text.length > MAX_DRAFT ? '' : text, name }), SAVE_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [text, name])

  useEffect(() => store(OPTIONS_KEY, options), [options])

  function open(value: string, fileName: string | null) {
    setText(value)
    setName(fileName)
  }

  const modeSwitch = (
    <div className="svgv-modes" role="group" aria-label="Mode">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className="svgv-mode-btn"
          aria-pressed={options.mode === m.value}
          onClick={() => setOptions((o) => ({ ...o, mode: m.value }))}
        >
          <Icon name={m.icon} size={18} />
          {m.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="svgv-root">
      {options.mode === 'versus' ? (
        <SvgCompare
          a={text}
          aName={name}
          onA={(value, fileName) => (fileName === undefined ? setText(value) : open(value, fileName))}
          options={options}
          setOptions={setOptions}
          modeSwitch={modeSwitch}
        />
      ) : (
        <Studio
          text={text}
          name={name}
          onEdit={setText}
          onOpen={open}
          options={options}
          setOptions={setOptions}
          modeSwitch={modeSwitch}
        />
      )}
    </div>
  )
}

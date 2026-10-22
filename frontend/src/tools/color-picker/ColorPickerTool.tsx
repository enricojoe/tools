import { useEffect, useState, type CSSProperties } from 'react'
import { InfoPanel } from './InfoPanel'
import { Picker } from './Picker'
import { SavedColors } from './SavedColors'
import { MAX_SAVED, hexToHsv, hsvToHex, loadSaved, storeSaved, type HsvColor } from './color'
import { useColorInfo } from './useColorInfo'
import './ColorPickerTool.css'

const START_COLOR: HsvColor = { h: 217, s: 0.76, v: 0.96 }

export default function ColorPickerTool() {
  const [color, setColor] = useState<HsvColor>(START_COLOR)
  const [saved, setSaved] = useState<string[]>(loadSaved)
  const [attempt, setAttempt] = useState(0)

  const hex = hsvToHex(color)
  const { info, error } = useColorInfo(hex, attempt)

  useEffect(() => storeSaved(saved), [saved])

  function pickHex(next: string) {
    setColor((prev) => hexToHsv(next, prev.h) ?? prev)
  }

  return (
    <div className="color-tool">
      <section className="card cp-card" style={{ '--pop': hex } as CSSProperties} aria-label="Color picker">
        <Picker color={color} hex={hex} onChange={setColor} onHex={pickHex} />
      </section>

      <InfoPanel
        hex={hex}
        info={info}
        error={error}
        onRetry={() => setAttempt((a) => a + 1)}
        onPick={pickHex}
      />

      <SavedColors
        saved={saved}
        current={hex}
        onSave={() => setSaved((s) => (s.includes(hex) ? s : [hex, ...s].slice(0, MAX_SAVED)))}
        onLoad={pickHex}
        onRemove={(h) => setSaved((s) => s.filter((x) => x !== h))}
      />
    </div>
  )
}

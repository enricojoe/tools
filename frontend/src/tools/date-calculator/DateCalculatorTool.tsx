import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { useStoredState } from '../../layout/useStoredState'
import { AddMode } from './AddMode'
import { initialAddState, type AddState } from './state'
import { BetweenMode, type BetweenState } from './BetweenMode'
import { ConvertMode, type ConvertState } from './ConvertMode'
import { fromDay, toDay, toIso, today } from './dates'
import './DateCalculatorTool.css'

type Tab = 'add' | 'between' | 'convert'

const TABS: { id: Tab; label: string; icon: IconName; blurb: string }[] = [
  { id: 'add', label: 'Add / subtract', icon: 'plus', blurb: 'What date is 10 days or 5 weeks from now?' },
  { id: 'between', label: 'Between dates', icon: 'calendar', blurb: 'How many days until, or since?' },
  { id: 'convert', label: 'Convert', icon: 'hourglass', blurb: 'How many days or weeks in a year?' },
]

function isTab(v: unknown): v is Tab {
  return TABS.some((t) => t.id === v)
}

/** Today until next New Year's Day, a handy first example. */
function initialBetween(): BetweenState {
  const now = today()
  return { from: toIso(now), to: toIso(toDay(fromDay(now).y + 1, 0, 1)), includeEnd: false }
}

export default function DateCalculatorTool() {
  const ids = useId()
  const [storedTab, setTab] = useStoredState<Tab>('date-calculator-tab', 'add')
  const tab = isTab(storedTab) ? storedTab : 'add'
  const [skipHolidays, setSkipHolidays] = useStoredState('date-calculator-skip-holidays', true)
  const [add, setAdd] = useState<AddState>(initialAddState)
  const [between, setBetween] = useState<BetweenState>(initialBetween)
  const [convert, setConvert] = useState<ConvertState>({ value: '1', unit: 'year', basis: 'common' })
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function onTabKey(e: KeyboardEvent, index: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    e.preventDefault()
    const next = (index + step + TABS.length) % TABS.length
    setTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  function countFromToday(field: 'days' | 'weeks' | 'months' | 'years', amount: number) {
    setAdd({
      ...initialAddState(),
      days: '',
      [field]: String(amount),
    })
    setTab('add')
  }

  return (
    <div className="dc-tool">
      <div className="dc-tabs" role="tablist" aria-label="Calculator">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${ids}-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`${ids}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            className="dc-tab"
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            <span className="dc-tab-icon">
              <Icon name={t.icon} size={20} />
            </span>
            <span className="dc-tab-text">
              <strong>{t.label}</strong>
              <span>{t.blurb}</span>
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${ids}-panel`} aria-labelledby={`${ids}-tab-${tab}`}>
        {tab === 'add' && (
          <AddMode state={add} setState={setAdd} skipHolidays={skipHolidays} setSkipHolidays={setSkipHolidays} />
        )}
        {tab === 'between' && (
          <BetweenMode
            state={between}
            setState={setBetween}
            skipHolidays={skipHolidays}
            setSkipHolidays={setSkipHolidays}
          />
        )}
        {tab === 'convert' && <ConvertMode state={convert} setState={setConvert} onCountFromToday={countFromToday} />}
      </div>
    </div>
  )
}

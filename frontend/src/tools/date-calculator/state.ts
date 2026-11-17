import { toIso, today } from './dates'

/** What the Add / subtract form holds; kept by the tool so Convert can fill it in. */
export interface AddState {
  start: string
  sign: 1 | -1
  count: 'calendar' | 'working'
  years: string
  months: string
  weeks: string
  days: string
  working: string
}

export function initialAddState(): AddState {
  return { start: toIso(today()), sign: 1, count: 'calendar', years: '', months: '', weeks: '', days: '10', working: '10' }
}

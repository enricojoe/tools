// The viewer's remembered choices, shared by Studio and A vs B.

import type { JsxOptions } from './jsx'
import type { Background } from './util'

export type Mode = 'studio' | 'versus'
export type StudioTab = 'code' | 'react'

export interface Options {
  mode: Mode
  background: Background
  custom: string
  transparentPng: boolean
  scale: number | 'custom'
  pngWidth: string
  jsx: Omit<JsxOptions, 'name'>
  /** Whether Studio's code / React panel is open, and on which tab. */
  drawer: boolean
  drawerTab: StudioTab
}

export const DEFAULT_OPTIONS: Options = {
  mode: 'studio',
  background: 'checker',
  custom: '#fde68a',
  transparentPng: true,
  scale: 2,
  pngWidth: '1024',
  jsx: { component: true, typescript: true, spreadProps: true, dropSize: false },
  drawer: false,
  drawerTab: 'code',
}

/** Options from storage, with anything old or broken put right. */
export function cleanOptions(o: Options): Options {
  // Older versions called the modes 'view' and 'compare'.
  const mode = (o.mode as string) === 'compare' || o.mode === 'versus' ? 'versus' : 'studio'
  const jsx = { ...DEFAULT_OPTIONS.jsx, ...o.jsx }
  return { ...o, mode, jsx, drawerTab: o.drawerTab === 'react' ? 'react' : 'code' }
}

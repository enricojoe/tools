import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { IconName } from '../components/Icon'

export interface Tool {
  /** URL segment: the tool lives at `/tools/:slug`. */
  slug: string
  name: string
  description: string
  category: string
  icon: IconName
  /** Extra search terms that are not in the name or description. */
  keywords: string[]
  Component: LazyExoticComponent<ComponentType>
}

/**
 * Every tool in the app. Adding a tool means adding an entry here and its
 * page under `src/tools/<slug>/`; navigation, search and routing pick it up.
 */
export const TOOLS: Tool[] = [
  {
    slug: 'qr-code',
    name: 'QR Code Generator',
    description: 'Turn any text or URL into a downloadable QR code.',
    category: 'Generators',
    icon: 'qr',
    keywords: ['qr', 'barcode', 'link', 'png'],
    Component: lazy(() => import('./qr/QRTool')),
  },
  {
    slug: 'lorem-ipsum',
    name: 'Lorem Ipsum Generator',
    description: 'Make placeholder text by the paragraph, sentence or word, as plain text or HTML.',
    category: 'Generators',
    icon: 'text',
    keywords: ['lorem', 'ipsum', 'placeholder', 'dummy', 'filler', 'text', 'latin', 'paragraph', 'words'],
    Component: lazy(() => import('./lorem-ipsum/LoremIpsumTool')),
  },
  {
    slug: 'word-counter',
    name: 'Word Counter',
    description: 'Count words, characters, sentences and paragraphs as you type, with reading time and a limit bar.',
    category: 'Text',
    icon: 'count',
    keywords: ['words', 'characters', 'letters', 'count', 'length', 'reading time', 'essay', 'tweet', 'limit'],
    Component: lazy(() => import('./word-counter/WordCounterTool')),
  },
  {
    slug: 'case-converter',
    name: 'Case Converter',
    description: 'Switch text between UPPER, lower, Title and Sentence case, or camelCase, snake_case and more for code.',
    category: 'Text',
    icon: 'case',
    keywords: [
      'uppercase', 'lowercase', 'capitalize', 'title', 'sentence', 'camel', 'pascal', 'snake', 'kebab',
      'constant', 'convert', 'text',
    ],
    Component: lazy(() => import('./case-converter/CaseConverterTool')),
  },
  {
    slug: 'qr-reader',
    name: 'QR Code Reader',
    description: 'Scan a QR code from an image or your camera and read what it says.',
    category: 'Readers',
    icon: 'scan',
    keywords: ['qr', 'scan', 'decode', 'camera', 'barcode', 'upload'],
    Component: lazy(() => import('./qr-reader/QRReaderTool')),
  },
  {
    slug: 'alarm',
    name: 'Alarm',
    description: 'Set alarms that ring on the server clock, once or on repeat.',
    category: 'Time',
    icon: 'alarm',
    keywords: ['clock', 'wake', 'alert', 'reminder', 'snooze', 'server time'],
    Component: lazy(() => import('./alarm/AlarmTool')),
  },
  {
    slug: 'timer',
    name: 'Timer',
    description: 'Count down from any time, with quick presets and a ring when it hits zero.',
    category: 'Time',
    icon: 'timer',
    keywords: ['countdown', 'stopwatch', 'pomodoro', 'minutes', 'alert'],
    Component: lazy(() => import('./timer/TimerTool')),
  },
  {
    slug: 'calendar',
    name: 'Calendar',
    description: 'Browse the calendar with every Indonesian public holiday and cuti bersama marked.',
    category: 'Time',
    icon: 'calendar',
    keywords: ['holiday', 'libur', 'tanggal merah', 'cuti bersama', 'indonesia', 'date', 'month'],
    Component: lazy(() => import('./calendar/CalendarTool')),
  },
  {
    slug: 'pomodoro',
    name: 'Pomodoro',
    description: 'Focus in timed rounds with short and long breaks, and see what you got done today.',
    category: 'Time',
    icon: 'tomato',
    keywords: ['focus', 'study', 'work', 'break', 'productivity', 'sessions', 'tomato'],
    Component: lazy(() => import('./pomodoro/PomodoroTool')),
  },
  {
    slug: 'stopwatch',
    name: 'Stopwatch',
    description: 'Time anything to the hundredth of a second, take laps and keep your saved runs.',
    category: 'Time',
    icon: 'stopwatch',
    keywords: ['lap', 'split', 'chrono', 'elapsed', 'time', 'race', 'count up'],
    Component: lazy(() => import('./stopwatch/StopwatchTool')),
  },
  {
    slug: 'color-picker',
    name: 'Color Picker',
    description: 'Pick a color and get its HEX, RGB, HSL and CMYK values, contrast, harmonies and shades.',
    category: 'Design',
    icon: 'palette',
    keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'palette', 'eyedropper', 'contrast', 'shades'],
    Component: lazy(() => import('./color-picker/ColorPickerTool')),
  },
  {
    slug: 'svg-viewer',
    name: 'SVG Viewer',
    description: 'Paste or drop an SVG to see it up close, check its size and colors, tidy the code and save it as PNG.',
    category: 'Design',
    icon: 'vector',
    keywords: ['svg', 'vector', 'preview', 'icon', 'viewbox', 'png', 'export', 'minify', 'format', 'data url', 'xml'],
    Component: lazy(() => import('./svg-viewer/SvgViewerTool')),
  },
  {
    slug: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert length, weight, temperature, volume, speed, data and more between metric and imperial units.',
    category: 'Converters',
    icon: 'ruler',
    keywords: [
      'length', 'weight', 'mass', 'temperature', 'volume', 'area', 'speed', 'data', 'bytes',
      'pressure', 'energy', 'metric', 'imperial', 'convert', 'units',
    ],
    Component: lazy(() => import('./unit-converter/UnitConverterTool')),
  },
  {
    slug: 'base64',
    name: 'Base64 Encoder / Decoder',
    description: 'Encode text or a file to Base64, or decode Base64 back to text, an image or a file.',
    category: 'Converters',
    icon: 'binary',
    keywords: ['base64', 'encode', 'decode', 'data url', 'data uri', 'url-safe', 'mime', 'atob', 'btoa', 'binary'],
    Component: lazy(() => import('./base64/Base64Tool')),
  },
  {
    slug: 'spin-wheel',
    name: 'Spin Wheel',
    description: 'Put names or choices on a wheel, give it a spin and let it pick one for you.',
    category: 'Fun',
    icon: 'wheel',
    keywords: ['random', 'picker', 'name', 'choose', 'decide', 'raffle', 'lottery', 'roulette', 'undian'],
    Component: lazy(() => import('./spin-wheel/SpinWheelTool')),
  },
  {
    slug: 'dice',
    name: 'Dice Roller',
    description: 'Roll up to ten dice, from d4 to d100, with a modifier, held dice and a running history.',
    category: 'Fun',
    icon: 'dice',
    keywords: ['random', 'roll', 'die', 'd6', 'd20', 'board game', 'rpg', 'dnd', 'dadu'],
    Component: lazy(() => import('./dice/DiceTool')),
  },
  {
    slug: 'coin-flip',
    name: 'Coin Flip',
    description: 'Flip a coin, or a hundred, and keep a tally of heads, tails and streaks.',
    category: 'Fun',
    icon: 'coin',
    keywords: ['random', 'heads', 'tails', 'toss', 'yes no', 'decide', '50/50', 'koin'],
    Component: lazy(() => import('./coin-flip/CoinFlipTool')),
  },
]

export function findTool(slug: string | undefined): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug)
}

/** Tools whose name, description, category or keywords contain every word of the query. */
export function searchTools(query: string): Tool[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return TOOLS
  return TOOLS.filter((t) => {
    const haystack = [t.name, t.description, t.category, ...t.keywords]
      .join(' ')
      .toLowerCase()
    return words.every((w) => haystack.includes(w))
  })
}

/** Groups tools by category, keeping registry order. */
export function groupByCategory(tools: Tool[]): [string, Tool[]][] {
  const groups = new Map<string, Tool[]>()
  for (const t of tools) {
    groups.set(t.category, [...(groups.get(t.category) ?? []), t])
  }
  return [...groups]
}

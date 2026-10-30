import type { IconName } from '../../components/Icon'

/** Icon per category id; unknown categories fall back to the ruler. */
const CATEGORY_ICONS: Record<string, IconName> = {
  length: 'ruler',
  mass: 'weight',
  temperature: 'thermometer',
  volume: 'beaker',
  area: 'area',
  speed: 'gauge',
  time: 'hourglass',
  data: 'database',
  pressure: 'pressure',
  energy: 'bolt',
}

export function categoryIcon(id: string): IconName {
  return CATEGORY_ICONS[id] ?? 'ruler'
}

interface Thing {
  emoji: string
  /** With its article, for "about 40% of a banana". */
  one: string
  many: string
  /** Size in the category's reference unit. */
  size: number
}

interface Scale {
  /** Unit id the sizes are in; its value is read from the conversion results. */
  unit: string
  /** How the comparison reads: "as long as", "as heavy as"… */
  verb: string
  things: Thing[]
}

/** Everyday things to compare a value with, per category (rough, well-known sizes). */
const SCALES: Record<string, Scale> = {
  length: {
    unit: 'm',
    verb: 'as long as',
    things: [
      { emoji: '🐜', one: 'an ant', many: 'ants', size: 0.005 },
      { emoji: '📎', one: 'a paperclip', many: 'paperclips', size: 0.03 },
      { emoji: '🍌', one: 'a banana', many: 'bananas', size: 0.18 },
      { emoji: '🧍', one: 'a person', many: 'people', size: 1.7 },
      { emoji: '🚌', one: 'a bus', many: 'buses', size: 12 },
      { emoji: '⚽', one: 'a football pitch', many: 'football pitches', size: 105 },
      { emoji: '🗼', one: 'an Eiffel Tower', many: 'Eiffel Towers', size: 330 },
      { emoji: '🏔️', one: 'a Mount Everest', many: 'Mount Everests', size: 8849 },
      { emoji: '🏃', one: 'a marathon', many: 'marathons', size: 42195 },
      { emoji: '🌍', one: 'a trip around the Earth', many: 'trips around the Earth', size: 40_075_000 },
      { emoji: '🌙', one: 'a trip to the Moon', many: 'trips to the Moon', size: 384_400_000 },
    ],
  },
  mass: {
    unit: 'kg',
    verb: 'as heavy as',
    things: [
      { emoji: '📎', one: 'a paperclip', many: 'paperclips', size: 0.001 },
      { emoji: '🥚', one: 'an egg', many: 'eggs', size: 0.06 },
      { emoji: '🍎', one: 'an apple', many: 'apples', size: 0.2 },
      { emoji: '🐈', one: 'a cat', many: 'cats', size: 4.5 },
      { emoji: '🧍', one: 'a person', many: 'people', size: 70 },
      { emoji: '🚗', one: 'a car', many: 'cars', size: 1500 },
      { emoji: '🐘', one: 'an elephant', many: 'elephants', size: 6000 },
      { emoji: '🐋', one: 'a blue whale', many: 'blue whales', size: 150_000 },
      { emoji: '🗼', one: 'an Eiffel Tower', many: 'Eiffel Towers', size: 7_300_000 },
    ],
  },
  volume: {
    unit: 'l',
    verb: 'as much as',
    things: [
      { emoji: '💧', one: 'a raindrop', many: 'raindrops', size: 0.00005 },
      { emoji: '🥫', one: 'a soda can', many: 'soda cans', size: 0.33 },
      { emoji: '🪣', one: 'a bucket', many: 'buckets', size: 10 },
      { emoji: '⛽', one: 'a car fuel tank', many: 'car fuel tanks', size: 50 },
      { emoji: '🛁', one: 'a bathtub', many: 'bathtubs', size: 150 },
      { emoji: '📦', one: 'a shipping container', many: 'shipping containers', size: 33_000 },
      { emoji: '🏊', one: 'an Olympic pool', many: 'Olympic pools', size: 2_500_000 },
    ],
  },
  area: {
    unit: 'm2',
    verb: 'as big as',
    things: [
      { emoji: '✉️', one: 'a stamp', many: 'stamps', size: 0.0005 },
      { emoji: '📄', one: 'an A4 sheet', many: 'A4 sheets', size: 0.0624 },
      { emoji: '🚪', one: 'a door', many: 'doors', size: 1.6 },
      { emoji: '🅿️', one: 'a parking spot', many: 'parking spots', size: 12.5 },
      { emoji: '🎾', one: 'a tennis court', many: 'tennis courts', size: 261 },
      { emoji: '⚽', one: 'a football pitch', many: 'football pitches', size: 7140 },
      { emoji: '🌳', one: 'a Central Park', many: 'Central Parks', size: 3_410_000 },
      { emoji: '🏙️', one: 'a Manhattan', many: 'Manhattans', size: 59_000_000 },
      { emoji: '🏝️', one: 'a Bali', many: 'Balis', size: 5_780_000_000 },
    ],
  },
  speed: {
    unit: 'kmh',
    verb: 'as fast as',
    things: [
      { emoji: '🐌', one: 'a snail', many: 'snails', size: 0.05 },
      { emoji: '🚶', one: 'a walk', many: 'walks', size: 5 },
      { emoji: '🚲', one: 'a bike ride', many: 'bike rides', size: 20 },
      { emoji: '🏃', one: 'Usain Bolt', many: 'Usain Bolts', size: 44.7 },
      { emoji: '🐆', one: 'a cheetah', many: 'cheetahs', size: 110 },
      { emoji: '🚄', one: 'a bullet train', many: 'bullet trains', size: 320 },
      { emoji: '✈️', one: 'an airliner', many: 'airliners', size: 900 },
      { emoji: '🔊', one: 'the speed of sound', many: 'times the speed of sound', size: 1235 },
      { emoji: '🛰️', one: 'the space station', many: 'space stations', size: 27_600 },
    ],
  },
  time: {
    unit: 's',
    verb: 'as long as',
    things: [
      { emoji: '👁️', one: 'a blink', many: 'blinks', size: 0.3 },
      { emoji: '❤️', one: 'a heartbeat', many: 'heartbeats', size: 0.8 },
      { emoji: '🎵', one: 'a song', many: 'songs', size: 210 },
      { emoji: '⚽', one: 'a football match', many: 'football matches', size: 5400 },
      { emoji: '😴', one: "a night's sleep", many: "nights' sleep", size: 28_800 },
      { emoji: '💼', one: 'a work week', many: 'work weeks', size: 144_000 },
      { emoji: '🗓️', one: 'a month', many: 'months', size: 2_630_000 },
      { emoji: '🎂', one: 'a lifetime', many: 'lifetimes', size: 2_500_000_000 },
    ],
  },
  data: {
    unit: 'B',
    verb: 'as big as',
    things: [
      { emoji: '🐦', one: 'a short post', many: 'short posts', size: 280 },
      { emoji: '📄', one: 'a page of text', many: 'pages of text', size: 2000 },
      { emoji: '💾', one: 'a floppy disk', many: 'floppy disks', size: 1_440_000 },
      { emoji: '📷', one: 'a photo', many: 'photos', size: 3_000_000 },
      { emoji: '💿', one: 'a CD', many: 'CDs', size: 700_000_000 },
      { emoji: '🎬', one: 'an HD movie', many: 'HD movies', size: 4_000_000_000 },
      { emoji: '📚', one: 'all of Wikipedia (text)', many: 'Wikipedias', size: 24_000_000_000 },
    ],
  },
  pressure: {
    unit: 'bar',
    verb: 'as strong as',
    things: [
      { emoji: '🏔️', one: 'the air on Everest', many: 'Everest summits', size: 0.33 },
      { emoji: '🌊', one: 'the air at sea level', many: 'atmospheres', size: 1.013 },
      { emoji: '🚗', one: 'a car tire', many: 'car tires', size: 2.2 },
      { emoji: '☕', one: 'an espresso machine', many: 'espresso machines', size: 9 },
      { emoji: '🤿', one: 'a scuba tank', many: 'scuba tanks', size: 200 },
      { emoji: '🐙', one: 'the deepest ocean floor', many: 'Mariana Trenches', size: 1086 },
    ],
  },
  energy: {
    unit: 'kcal',
    verb: 'as much as',
    things: [
      { emoji: '🔥', one: 'a match', many: 'matches', size: 0.24 },
      { emoji: '📱', one: 'a phone charge', many: 'phone charges', size: 13 },
      { emoji: '🍌', one: 'a banana', many: 'bananas', size: 105 },
      { emoji: '🍫', one: 'a chocolate bar', many: 'chocolate bars', size: 230 },
      { emoji: '🍽️', one: "a day's food", many: "days' food", size: 2000 },
      { emoji: '⛽', one: 'a liter of petrol', many: 'liters of petrol', size: 8100 },
      { emoji: '⚡', one: 'a lightning bolt', many: 'lightning bolts', size: 1_200_000 },
    ],
  },
}

export interface Comparison {
  emoji: string
  verb: string
  /** "about 2.3 bananas" or "about 40% of a banana". */
  text: string
  /** How many of the thing, for drawing (only meaningful from 1 to 10). */
  ratio: number
}

const short = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 2 })

function describe(ratio: number, thing: Thing): string {
  if (ratio >= 0.95 && ratio < 1.05) return `about ${thing.one}`
  if (ratio < 1) return `about ${short.format(ratio * 100)}% of ${thing.one}`
  return `about ${short.format(ratio)} ${thing.many}`
}

/**
 * Up to `count` everyday things closest in size to the value, best first.
 * `valueIn` reads the value in a unit id from the conversion. Empty when there's
 * no scale for the category or the value is zero or negative.
 */
export function compare(category: string, valueIn: (unit: string) => number | undefined, count = 3): Comparison[] {
  const scale = SCALES[category]
  if (scale === undefined) return []
  const v = valueIn(scale.unit)
  if (v === undefined || !Number.isFinite(v) || v <= 0) return []

  return scale.things
    .map((thing) => ({ thing, ratio: v / thing.size }))
    .sort((a, b) => Math.abs(Math.log10(a.ratio)) - Math.abs(Math.log10(b.ratio)))
    .slice(0, count)
    .map(({ thing, ratio }) => ({ emoji: thing.emoji, verb: scale.verb, text: describe(ratio, thing), ratio }))
}

export interface Landmark {
  celsius: number
  label: string
}

/** Thermometer range and marks, in °C. */
export const THERMO_MIN = -40
export const THERMO_MAX = 120
export const LANDMARKS: Landmark[] = [
  { celsius: 0, label: 'Water freezes' },
  { celsius: 37, label: 'Body' },
  { celsius: 100, label: 'Water boils' },
]

/** A one-line feel for a temperature in °C. */
export function temperatureMood(c: number): { emoji: string; text: string } {
  if (c < -20) return { emoji: '🐧', text: 'Penguin weather.' }
  if (c < 0) return { emoji: '❄️', text: 'Below freezing. Watch for ice.' }
  if (c < 12) return { emoji: '🧥', text: 'Grab a jacket.' }
  if (c < 18) return { emoji: '🍂', text: 'Crisp and cool.' }
  if (c < 26) return { emoji: '😌', text: 'Nice and comfy.' }
  if (c < 33) return { emoji: '☀️', text: 'A warm day.' }
  if (c < 45) return { emoji: '🥵', text: 'Scorching hot.' }
  if (c < 100) return { emoji: '♨️', text: 'Too hot to touch.' }
  return { emoji: '🫖', text: 'Water is boiling.' }
}

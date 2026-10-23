/** Reading colors out of a picture, all in the browser: the image is never uploaded. */
import { rgbToHex } from './color'

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
/** Bigger images are scaled down to this long side, which is plenty for picking colors. */
const MAX_SIDE = 1200

/** Returns a friendly message if the file can't be used, or null if it's fine. */
export function validateImage(file: File): string | null {
  if (!file.type.startsWith('image/')) return "That file isn't an image. Try a PNG, JPEG, WebP or GIF."
  if (file.size > MAX_IMAGE_BYTES) return 'That image is over 20 MB. Try a smaller one.'
  return null
}

/** Decodes an image file and draws it (scaled down if needed) into pixels we can read. */
export async function loadImageData(file: File): Promise<ImageData> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Image has no size')

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** "#RRGGBB" of the pixel at (x, y). Transparent pixels read as their RGB, ignoring alpha. */
export function pixelHex(image: ImageData, x: number, y: number): string {
  const i = (y * image.width + x) * 4
  return rgbToHex(image.data[i], image.data[i + 1], image.data[i + 2])
}

/** How far apart (RGB distance) two main colors must be, so near-duplicates don't fill the row. */
const MIN_DISTANCE = 48

/**
 * Finds up to `count` dominant colors: samples about 10,000 pixels, groups them into
 * 4-bit-per-channel buckets, and returns the average of the biggest distinct buckets.
 */
export function mainColors(image: ImageData, count = 6): string[] {
  const { width, height, data } = image
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 10_000)))
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>()

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      if (data[i + 3] < 128) continue // mostly transparent
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.n++
        bucket.r += r
        bucket.g += g
        bucket.b += b
      } else {
        buckets.set(key, { n: 1, r, g, b })
      }
    }
  }

  const picked: [number, number, number][] = []
  for (const { n, r, g, b } of [...buckets.values()].sort((a, z) => z.n - a.n)) {
    const rgb: [number, number, number] = [Math.round(r / n), Math.round(g / n), Math.round(b / n)]
    const distinct = picked.every((p) => Math.hypot(p[0] - rgb[0], p[1] - rgb[1], p[2] - rgb[2]) >= MIN_DISTANCE)
    if (distinct) picked.push(rgb)
    if (picked.length === count) break
  }
  return picked.map((rgb) => rgbToHex(...rgb))
}

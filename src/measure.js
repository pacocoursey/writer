import { settings } from './state'
import LineBreaker from '@rkusa/linebreak'
import { getEditorWidth } from './utils'

/** @type {CanvasRenderingContext2DSettings} */
let measureCtx
let monospaceWidth
const measureCache = new Map()

function cacheOrMeasure(text) {
  let width = measureCache.get(text)
  if (!width) {
    width = measureCtx.measureText(text).width
    measureCache.set(text, width)
  }
  return width
}

export function measure(text) {
  if (!text) {
    return 0
  }

  if (monospaceWidth) {
    return text.length * monospaceWidth
  }

  let width = 0

  for (const char of text) {
    width += cacheOrMeasure(char)
  }

  return width
}

const empty = []

export function getLineBreak(text) {
  // Skip measuring empty lines
  if (!text) return empty

  const maxWidth = getEditorWidth() - 10

  // Skip wrapping any lines that don't reach the full width of the editor
  if (measure(text) < maxWidth) {
    return empty
  }

  const breaker = new LineBreaker(text)

  let bk
  let prev = 0
  let width = 0
  const breaks = []

  while ((bk = breaker.nextBreak())) {
    const column = bk.position
    const addedWidth = measure(text.slice(prev, column))
    width += addedWidth

    if (width > maxWidth) {
      breaks.push(prev)
      width = addedWidth
    }

    prev = column
  }

  return breaks
}

function setup() {
  measureCtx = document
    .createElement('canvas')
    .getContext('2d', { alpha: false, desynchronized: true })
  const font = settings.text.fontSize + 'px' + ' ' + settings.text.font
  measureCtx.font = font

  const i = cacheOrMeasure('i')
  const W = cacheOrMeasure('W')
  if (i === W) {
    monospaceWidth = i
  }
}

setup()

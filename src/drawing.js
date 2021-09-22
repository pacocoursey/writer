import debounce from 'lodash.debounce'
import * as state from './state'
import * as utils from './utils'

let visibleLines = new Map()
let visibleCursors = new Map()

export function reset() {
  // Remove DOM elements
  state.elements.lines.innerHTML = ''
  Array.from(visibleCursors).forEach(([, c]) => c.remove())

  // Reset local state
  visibleLines = new Map()
  visibleCursors = new Map()

  // Reset global state
  utils.setScroll(0)
}

export function draw(force) {
  drawLines(force)
  drawCursors()
  drawTextarea()
  drawScrollbar()
}

export function drawScrollbar() {
  const percentScrolled = utils.getScroll() / utils.getMaxScroll()
  state.elements.scrollbarThumb.style.height =
    utils.getScrollbarThumbLength() + 'px'
  state.elements.scrollbarThumb.style.transform = `translateY(${
    percentScrolled *
    (utils.getScrollbarTrackLength() - utils.getScrollbarThumbLength())
  }px)`
}

export function drawTextarea() {
  const { textarea } = state.elements
  const cursor = utils.getMainCursor()
  drawCursor(cursor, textarea)
}

export function scrollMainCursorIntoView() {
  const { textarea } = state.elements
  const cursor = utils.getMainCursor()

  setTimeout(() => {
    textarea.focus()
  }, 1)

  return utils.scrollIntoViewIfNeeded(cursor.drawing.y)
}

export function drawCursors() {
  // No cursors drawn yet, mount them
  if (!visibleCursors.size) {
    state.editor.cursors.map((c) => {
      const el = cursor()
      state.elements.wrapper.appendChild(el)
      visibleCursors.set(c.id, el)
    })
  }

  state.editor.cursors.map((c) => {
    drawCursor(c, visibleCursors.get(c.id))
  })
}

function drawCursor(cursor, el) {
  el.style.transform = `translate(${cursor.drawing.x}px, ${cursor.drawing.y}px)`
}

export function drawLines(force = true) {
  const first = utils.getTopScreenLine()
  const last = utils.getBottomScreenLine()

  const height = Math.max(
    utils.getEditorHeight(),
    state.editor.buffer.screenLength * state.settings.text.lineHeight
  )

  state.elements.lines.style.height = height + 'px'

  // No lines rendered yet, render all visible ones
  if (!visibleLines.size) {
    for (let i = first; i <= last; i++) {
      const l = line(i)
      state.elements.lines.appendChild(l)
      visibleLines.set(i, l)
    }
    return
  }

  // Add any newly visible lines
  for (let i = first; i <= last; i++) {
    if (visibleLines.has(i)) {
      if (force) {
        const el = visibleLines.get(i)
        el.style.top = utils.getLineTop(i) + 'px'
        el.innerText = state.editor.buffer.getScreenLineContent(i)
      }
      continue
    }

    const l = line(i)
    state.elements.lines.appendChild(l)
    visibleLines.set(i, l)
  }

  // Remove any lines that are no longer visible
  for (let [index, item] of visibleLines.entries()) {
    if (index < first || index > last) {
      visibleLines.delete(index)
      item.remove()
    }
  }
}

export function editor() {
  const editor = document.createElement('div')
  editor.setAttribute('writer-editor', '')
  updateStyles(editor)
  return editor
}

export function textarea() {
  const textarea = document.createElement('textarea')
  textarea.setAttribute('writer-textarea', '')
  textarea.setAttribute('autocomplete', 'off')
  textarea.setAttribute('autocapitalize', 'off')
  textarea.setAttribute('autocorrect', 'off')
  textarea.setAttribute('spellcheck', 'false')
  textarea.setAttribute('tab-index', '0')
  return textarea
}

export function lines() {
  const lines = document.createElement('div')
  lines.setAttribute('writer-lines', '')
  return lines
}

export function line(screenIndex) {
  const line = document.createElement('div')
  line.setAttribute('writer-line', '')
  line.style.top = utils.getLineTop(screenIndex) + 'px'
  line.innerText = state.editor.buffer.getScreenLineContent(screenIndex)
  return line
}

export function decorations() {
  const decorations = document.createElement('div')
  decorations.setAttribute('writer-decorations', '')
  return decorations
}

export function decoration(screenIndex) {
  const decoration = document.createElement('div')
  decoration.setAttribute('writer-decoration', '')
  decoration.style.top = utils.getLineTop(screenIndex) + 'px'
  return decoration
}

export function cursor() {
  const cursor = document.createElement('div')
  cursor.setAttribute('writer-cursor', '')
  return cursor
}

export function scrollbar() {
  const scrollbar = document.createElement('div')
  scrollbar.setAttribute('writer-scrollbar', '')

  const thumb = document.createElement('div')
  thumb.setAttribute('writer-scrollbar-thumb', '')
  scrollbar.appendChild(thumb)

  return [scrollbar, thumb]
}

export function wrapper() {
  const wrapper = document.createElement('div')
  wrapper.setAttribute('writer-wrapper', '')
  return wrapper
}

export function updateStyles(el) {
  const style = el?.style || state.elements.editor.style

  // Text styles
  style.setProperty('--text-line-height', state.settings.text.lineHeight + 'px')
  style.setProperty('--text-color', state.settings.text.color)
  style.setProperty('--text-font-family', state.settings.text.font)

  // Selection styles
  style.setProperty('--selection-color', state.settings.selection.color)

  // Cursor styles
  style.setProperty('--cursor-width', state.settings.cursor.width + 'px')
  style.setProperty('--cursor-radius', state.settings.cursor.radius + 'px')
  style.setProperty('--cursor-color', state.settings.cursor.color)
  style.setProperty(
    '--cursor-animation-duration',
    state.settings.cursor.animation.duration + 'ms'
  )

  // Scrollbar styles
  style.setProperty('--scrollbar-width', state.settings.scrollbar.width + 'px')
  style.setProperty('--scrollbar-gap', state.settings.scrollbar.gap + 'px')
  style.setProperty('--scrollbar-color', state.settings.scrollbar.color)
  style.setProperty(
    '--scrollbar-active-color',
    state.settings.scrollbar.activeColor
  )
  style.setProperty(
    '--scrollbar-minHeight',
    state.settings.scrollbar.minHeight + 'px'
  )
  style.setProperty(
    '--scrollbar-animation-duration',
    state.settings.scrollbar.animation.duration + 'ms'
  )
}

export function wrapVisibleLines() {
  const first = utils.getTopScreenLine()
  const last = utils.getBottomScreenLine()

  for (let i = first; i <= last; i++) {
    state.editor.buffer.wrapScreenLine(i)
  }
}

let oldWidth

export function resize() {
  const height = state.elements.editor.parentElement.offsetHeight
  const width = utils.getEditorWidth()
  state.elements.editor.style.height = height + 'px'
  state.elements.lines.style.width = width + 'px'

  if (oldWidth !== undefined && oldWidth !== width) {
    wrapVisibleLines()
    rewrap()
  }

  draw(true)
  oldWidth = width
}

const rewrap = debounce(() => {
  state.editor.buffer.wrapAllLineBuffers()
}, 400)

let scrollTimer

export function showScrollbar() {
  clearTimeout(scrollTimer)
  state.elements.scrollbarThumb.style.opacity = '1'
}

export function hideScrollbar() {
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    state.elements.scrollbarThumb.style.opacity = '0'
  }, state.settings.scrollbar.animation.delay)
}

export function wheel(e) {
  if (utils.setScroll(state.editor.scroll + e.deltaY)) {
    draw()
    showScrollbar()
    hideScrollbar() // queue the hiding
  }
}

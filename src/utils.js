import { editor, settings, elements } from './state'
import { measure } from './measure'
import { Point } from './position'

/**
 * @param {Point} point Buffer point
 * @return {{ x: number, y:  number }}
 */
export function pointToXY(point) {
  const { buffer } = editor
  const [screenLine, screenColumn] = buffer.bufferToScreen(
    point.line,
    point.column
  )
  const text = buffer.getScreenLineContent(screenLine)
  const x = screenColumn === 0 ? 0 : measure(text.slice(0, screenColumn))
  const y = screenLine * settings.text.lineHeight
  return { x, y }
}

/** Editing */

export function swapLine(change) {
  // No change provided
  if (change == null) return

  const { cursors, buffer } = editor

  cursors.forEach((cursor) => {
    if (cursor.selection.isCollapsed) {
      const { line, column } = cursor.position

      if (buffer.swapLine(line, change)) {
        cursor.moveTo(line + change, column)
      }
    } else {
      const { start, end } = cursor.selection
      buffer.swapLines(start.line, end.line, change)
      cursor.moveSelection(
        new Point(start.line + change, start.column),
        new Point(end.line + change, end.column)
      )
    }
  })
}

export function copy() {
  const { cursors } = editor
  const texts = []

  cursors.forEach((cursor) => {
    if (cursor.selection.isCollapsed) {
      return
    }

    const text = getSelectionText(cursor.selection)
    texts.push(text)
  })

  navigator.clipboard.writeText(texts.join('\n')).catch((e) => {
    console.error('Failed to copy to clipboard!')
    console.error(e)
  })
}

export function cut() {
  const { cursors } = editor

  // Copy, then delete
  copy()
  cursors.forEach((cursor) => {
    cursor.deleteSelection()
  })
}

export function insertText(text) {
  const { cursors, buffer } = editor

  cursors.forEach((cursor) => {
    cursor.deleteSelection()
    const { line, column } = cursor.position
    buffer.insert(line, column, text)
    buffer.wrapLine(line)
    cursor.moveRight(text.length)
  })
}

export function deleteToStartOfLine() {
  const { cursors, buffer } = editor
  cursors.forEach((cursor) => {
    const { line, column } = cursor.position

    if (column === 0) {
      cursor.moveLeft()
      removeLine(line)
    } else {
      buffer.delete(line, column, -column)
      buffer.wrapLine(line)
      cursor.moveToStartOfLine()
    }
  })
}

export function deleteToStartOfWord() {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    if (!cursor.selection.isCollapsed) {
      cursor.deleteSelection()
      return
    }

    const { line, column } = cursor.position

    if (column === 0) {
      cursor.moveLeft()
      removeLine(line)
    } else {
      const current = cursor.selection.focus
      cursor.moveToStartOfWord()
      cursor.moveWithSelect(current, true)
      cursor.deleteSelection()
    }
  })
}

export function backspace() {
  const { cursors, buffer } = editor

  cursors.forEach((cursor) => {
    const { line, column } = cursor.position

    if (cursor.selection.isCollapsed) {
      if (column === 0) {
        cursor.moveLeft()
        removeLine(line)
      } else {
        buffer.delete(line, column, -1)
        buffer.wrapLine(line)
        cursor.moveLeft()
      }
    } else {
      cursor.deleteSelection()
    }
  })
}

/** @param {Selection} selection */
export function getSelectionText(selection) {
  const { buffer } = editor
  const { start, end } = selection

  if (start.line === end.line) {
    // Single buffer line
    const text = buffer.getLineContent(start.line)
    return text.slice(start.column, end.column)
  } else {
    // Spans multiple buffer lines
    const text = []

    // Get portion from first buffer line
    const textFirst = buffer.getLineContent(start.line)
    text.push(textFirst.slice(start.column))

    // Get buffer lines in between
    const x = start.line + 1
    const y = end.line - 1
    const between = y - x + 1
    for (let i = 0; i < between; i++) {
      text.push(buffer.getLineContent(i))
    }

    // Get portion from last buffer line
    const textLast = buffer.getLineContent(end.line)
    text.push(textLast.slice(0, end.column))

    return text.join('\n')
  }
}

export function newline() {
  const { cursors, buffer } = editor

  cursors.forEach((cursor) => {
    const { line, column } = cursor.position
    buffer.splitDown(line, column)
    cursor.startOfNextLine()
  })
}

export function removeLine(line) {
  if (line === 0) return
  const { buffer } = editor
  buffer.splitUp(line)
}

/** Cursor Operations */

export function moveRight(columns = 1, select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveRight(columns, select)
  })
  mergeCursors()
}

export function moveLeft(columns = 1, select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveLeft(columns, select)
  })
  mergeCursors()
}

export function moveUp(lines, select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveUp(lines, select)
  })
  mergeCursors()
}

export function moveDown(lines, select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveDown(lines, select)
  })
  mergeCursors()
}

export function moveToTop(select) {
  flattenToOneCursor()
  const { cursors } = editor
  cursors[0].moveToTop(select)
}

export function moveToBottom(select) {
  flattenToOneCursor()
  const { cursors } = editor
  cursors[0].moveToBottom(select)
}

export function selectAll() {
  flattenToOneCursor()
  const { cursors } = editor
  cursors[0].moveToTop()
  cursors[0].moveToBottom(true)
}

export function moveToEndOfLine(select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveToEndOfLine(select)
  })
}

export function moveToStartOfLine(select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveToStartOfLine(select)
  })
}

export function moveToStartOfWord(select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveToStartOfWord(select)
  })
}

export function moveToEndOfWord(select) {
  const { cursors } = editor
  cursors.forEach((cursor) => {
    cursor.moveToEndOfWord(select)
  })
}

export function mergeCursors() {
  const { cursors } = editor
  const newCursors = [...cursors]
  const unique = []
  let i = 0

  for (const cursor of cursors) {
    if (unique.some((pos) => pos.equals(cursor.position))) {
      newCursors.splice(i, 1)
    } else {
      unique.push(cursor.position)
    }
    i++
  }

  editor.cursors = newCursors
}

export function flattenToOneCursor() {
  editor.cursors = [editor.cursors[0]]
}

export function getMainCursor() {
  return editor.cursors[0]
}

export function getTotalLines() {
  return editor.buffer.screenLength
}

export function getTotalHeight() {
  return getTotalLines() * settings.text.lineHeight
}

export function getTopBufferLine() {
  const { buffer } = editor
  const screen = getTopScreenLine()
  const [bl] = buffer.screenToBuffer(screen, 0)
  return bl
}

export function getBottomBufferLine() {
  const { buffer } = editor
  const screen = getBottomScreenLine()
  const [bl] = buffer.screenToBuffer(screen, 0)
  return bl
}

export function getScroll() {
  return editor.scroll
}

export function scrollIntoViewIfNeeded(scroll) {
  const currentScroll = getScroll()

  // New scroll is above the current screen view
  if (scroll <= currentScroll) {
    return setScroll(scroll)
  }

  const height = getEditorHeight()

  // New scroll is below the current screen view
  // only scroll amount needed
  if (scroll + settings.text.lineHeight > currentScroll + height) {
    return setScroll(scroll + settings.text.lineHeight - height)
  }

  return false
}

// Really really long documents can have millions of pixels of scroll
// if it gets above 1M px, our scroll hack will stop working correctly
// so at the interval listed below, we'll reset the scroll back to 0
// and render lines as if they were offset from the new scroll of 0
// this lets us scroll infinitely without running into the 1M issue
// The 500k limit is copied from Monaco
const SCROLL_ROLLOVER = 500000

export function getLineTop(screenIndex) {
  let top = (screenIndex * settings.text.lineHeight) % SCROLL_ROLLOVER

  if (editor.rolloverScroll > SCROLL_ROLLOVER) {
    top -= SCROLL_ROLLOVER
  }

  return top
}

export function setScroll(newScroll) {
  const old = editor.scroll
  newScroll = clamp(0, getMaxScroll(), newScroll)
  editor.scroll = newScroll

  if (newScroll !== old) {
    let top = editor.scroll % SCROLL_ROLLOVER

    if (top > SCROLL_ROLLOVER) {
      top -= SCROLL_ROLLOVER
    }

    editor.rolloverScroll = top
    elements.wrapper.style.top = -top + 'px'
  }

  return newScroll !== old
}

function cached(fn) {
  const cache = new WeakMap()

  return (...args) => {
    console.log(...args, cache, cache.has([...args]))
    if (cache.has([...args])) {
      return cache.get([...args])
    }

    const result = fn(...args)
    cache.set([...args], result)
    return result
  }
}

function cachedUntilResize(fn) {
  let cache = null

  window.addEventListener('resize', () => (cache = null))

  return () => {
    if (!cache) {
      cache = fn()
    }
    return cache
  }
}

export const getEditorHeight = cachedUntilResize(
  () => elements.editor.offsetHeight
)

export const getEditorWidth = cachedUntilResize(
  () => elements.editor.offsetWidth
)

export const getEditorTop = cachedUntilResize(() => elements.editor.offsetTop)
export const getEditorLeft = cachedUntilResize(() => elements.editor.offsetLeft)

export function getScrollbarTrackLength() {
  return getEditorHeight() - settings.scrollbar.gap * 2
}

export function getScrollbarThumbLength() {
  const trackLength = getScrollbarTrackLength()
  return clamp(
    settings.scrollbar.minHeight,
    trackLength,
    trackLength / (1 + getMaxScroll() / trackLength)
  )
}

export function getTopScreenLine() {
  return Math.max(0, Math.floor(getScroll() / settings.text.lineHeight))
}

export function getBottomScreenLine() {
  // Why -1? who knows
  const bottom = getScroll() + getEditorHeight() - 1
  return Math.min(
    getTotalLines() - 1,
    Math.max(0, Math.floor(bottom / settings.text.lineHeight))
  )
}

export function lineToYWithScroll(lineNumber) {
  const { scroll } = editor
  return lineNumber * settings.text.lineHeight - scroll / 2
}

export function lineToY(lineNumber) {
  return lineNumber * settings.text.lineHeight
}

/**
 * @param {number} y screen coordinate
 * @returns Screen Line
 */
export function yToLine(y) {
  const { editor } = elements
  const realY = y + getScroll() - getEditorTop()
  return Math.max(0, Math.floor(realY / settings.text.lineHeight))
}

export function yToClampedLine(y) {
  return clamp(0, getLastLineNumber(), yToLine(y))
}

/**
 * @param {number} x screen coordinate
 * @param {number} lineNumber Screen line
 * @returns Screen Column
 */
export function xToColumn(x, lineNumber) {
  const { buffer } = editor
  const line = buffer.getScreenLineContent(lineNumber)
  const realX = x - getEditorLeft()
  let column = 0

  // TODO: speed up lol, binary search or smthn
  for (let i = 0; i <= line.length; i++) {
    const width = measure(line.slice(0, i))
    const char = line.slice(i - 1, i)
    const charWidth = measure(char)
    column = i

    if (width - charWidth / 2 > realX) {
      column = i - 1
      break
    }
  }

  return clamp(0, line.length, column)
}

// TODO
export function columnToX(column, lineNumber) {
  // const line = buffer.getLineContent(lineNumber)
}

export function getLastLineNumber() {
  const { buffer } = editor
  return buffer.length - 1
}

export function getLastScreenLineNumber() {
  const { buffer } = editor
  return buffer.screenLength - 1
}

export function getLastLine() {
  const { buffer } = editor
  return buffer.getLineContent(getLastLineNumber())
}

export function getLastScreenLine() {
  const { buffer } = editor
  return buffer.getScreenLineContent(getLastScreenLineNumber())
}

export function getLastLineLastColumn() {
  return new Point(getLastLineNumber(), getLastLine().length)
}

export function getLastScreenLineLastColumn() {
  return new Point(getLastScreenLineNumber(), getLastScreenLine().length)
}

export function bounds() {
  return {
    height: getEditorHeight(),
    width: getEditorWidth(),
  }
}

export function getMaxScroll() {
  const { height } = bounds()
  const totalHeight = getTotalHeight()

  if (totalHeight > height) {
    return totalHeight - height
  }

  return Math.min(totalHeight, height) - settings.text.lineHeight
}

export function relativeX(x) {
  return x - getEditorLeft()
}

export function relativeY(y) {
  return y - getEditorTop()
}

/**
 * @param {number} x
 * @param {number} y
 * @param {{ top: number, left: number, width: number, height: number }} bounds
 */
export function withinBounds(x, y, bounds) {
  x = relativeX(x)
  y = relativeY(y)
  const { top, left, width, height } = bounds
  return x >= left && x <= left + width && y >= top && y <= y + height
}

/** Generic */

export function delay() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

export function clamp(min, max, val) {
  return Math.max(min, Math.min(val, max))
}

/**
 * @template T
 * @param {T[]} arr
 * @return {T}
 */
export function last(arr) {
  return arr[arr.length - 1]
}

/**
 * @template T
 * @param {T[]} arr
 * @return {T}
 */
export function first(arr) {
  return arr[0]
}

/**
 * @param {number} ms
 */
export async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}

export function preventDefault(fn) {
  return (e) => {
    e.preventDefault()
    fn?.()
  }
}

export function removeAllChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild)
  }
}

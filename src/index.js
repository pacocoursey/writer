import keys from 'tinykeys'
import Buffer from './buffer'
import Cursor from './cursor'
import { Point } from './position'
import * as measure from './measure'
import * as state from './state'
import * as drawing from './drawing'
import * as utils from './utils'
const file = `Hey, welcome to writer.\n`

// Events

function paste(e) {
  e.preventDefault()
  const content = e.clipboardData.getData('text/plain')
  utils.insertText(content)
  drawing.scrollMainCursorIntoView()
  drawing.draw()
}

function input(e) {
  const content = e.target.value
  e.target.value = ''
  utils.insertText(content)
  drawing.scrollMainCursorIntoView()
  drawing.draw()
}

function keyDown(e) {
  let handled = true

  switch (e.key) {
    case 'Enter': {
      utils.newline()
      break
    }
    case 'Backspace': {
      if (e.metaKey) {
        utils.deleteToStartOfLine()
      } else if (e.altKey) {
        utils.deleteToStartOfWord()
      } else {
        utils.backspace()
      }
      break
    }
    case 'ArrowUp': {
      if (e.metaKey) {
        utils.moveToTop(e.shiftKey)
      } else if (e.altKey && !e.shiftKey) {
        utils.swapLine(-1)
      } else {
        utils.moveUp(1, e.shiftKey)
      }
      break
    }
    case 'ArrowDown': {
      if (e.metaKey) {
        utils.moveToBottom(e.shiftKey)
      } else if (e.altKey && !e.shiftKey) {
        utils.swapLine(1)
      } else {
        utils.moveDown(1, e.shiftKey)
      }
      break
    }
    case 'ArrowRight': {
      if (e.metaKey) {
        utils.moveToEndOfLine(e.shiftKey)
      } else if (e.altKey) {
        utils.moveToEndOfWord(e.shiftKey)
      } else {
        utils.moveRight(1, e.shiftKey)
      }
      break
    }
    case 'ArrowLeft': {
      if (e.metaKey) {
        utils.moveToStartOfLine(e.shiftKey)
      } else if (e.altKey) {
        utils.moveToStartOfWord(e.shiftKey)
      } else {
        utils.moveLeft(1, e.shiftKey)
      }
      break
    }
    case 'a': {
      if (e.metaKey) {
        utils.selectAll()
      } else {
        handled = false
      }
      break
    }
    case 'c': {
      if (e.metaKey) {
        utils.copy()
      } else {
        handled = false
      }
      break
    }
    // Paste is handled by textarea
    // case 'v': {}
    case 'x': {
      if (e.metaKey) {
        utils.cut()
      } else {
        handled = false
      }
      break
    }
    default: {
      handled = false
    }
  }

  if (handled) {
    e.preventDefault()
    drawing.scrollMainCursorIntoView()
    drawing.draw()
  }
}

function scrollbarMove(e) {
  const maxScroll = utils.getMaxScroll()
  const trackLength = utils.getScrollbarTrackLength()
  const thumbLength = utils.getScrollbarThumbLength()
  const ratio = maxScroll / (trackLength - thumbLength)
  const deltaY = e.pageY - state.editor.scrollbarContext.initialY

  const newScroll = utils.getScroll() + ratio * deltaY
  state.editor.scrollbarContext.initialY = e.pageY
  utils.setScroll(newScroll)
  drawing.draw()
}

function scrollbarUp() {
  window.removeEventListener('mousemove', scrollbarMove)
  window.removeEventListener('mouseup', this)
  state.editor.scrollbarContext = {}
  drawing.hideScrollbar()
}

function scrollbarDown(e) {
  e.preventDefault()
  state.editor.scrollbarContext.initialY = e.pageY
  state.elements.scrollbarThumb.style.opacity = '1'
  window.addEventListener('mousemove', scrollbarMove)
  window.addEventListener('mouseup', scrollbarUp)
}

function scrollbarEnter() {
  if (state.elements.scrollbarThumb.style.opacity !== '0') {
    drawing.showScrollbar()
  }
}

function scrollbarLeave() {
  if (!state.editor.scrollbarContext.initialY) {
    drawing.hideScrollbar()
  }
}

function selectionMove(e) {
  const { cursors, moveContext, buffer } = state.editor
  let { pageX: x, pageY: y } = e
  const line = utils.yToLine(y)
  const screenPoint =
    line > utils.getLastScreenLineNumber()
      ? utils.getLastScreenLineLastColumn()
      : new Point(line, utils.xToColumn(x, line))

  const [bl, bc] = buffer.screenToBuffer(screenPoint.line, screenPoint.column)
  const point = new Point(bl, bc)

  const cursor = cursors[0]

  if (!cursor.selection.focus.equals(point)) {
    if (moveContext?.detail === 2) {
      // Double click + drag
      cursor.selection.focus = point

      if (cursor.selection.direction === 'backward') {
        if (!moveContext?.reversed) {
          cursor.moveToEndOfWord()
          moveContext.reversed = true
        }
        cursor.moveToStartOfWord(true)
      } else {
        cursor.moveToEndOfWord(true)
      }
    } else if (moveContext.detail === 3) {
      // Triple click + drag
      cursor.selection.focus = point
      if (cursor.selection.direction === 'backward') {
        if (!moveContext?.reversed) {
          cursor.moveToEndOfParagraph()
          moveContext.reversed = true
        }
        cursor.moveToStartOfParagraph(true)
      } else {
        cursor.moveToEndOfParagraph(true)
      }
    } else {
      cursor.moveTo(point.line, point.column, true)
    }
  }

  drawing.scrollMainCursorIntoView()
  drawing.drawCursors()
}

function selectionUp() {
  window.removeEventListener('mousemove', selectionMove)
  window.removeEventListener('mouseup', this)
  state.editor.moveContext = {}
}

function selectionDown(e) {
  const { cursors, moveContext, buffer } = state.editor
  let { pageX: x, pageY: y } = e
  const line = utils.yToLine(y)
  const screenPoint =
    line > utils.getLastScreenLineNumber()
      ? utils.getLastScreenLineLastColumn()
      : new Point(line, utils.xToColumn(x, line))

  const [bl, bc] = buffer.screenToBuffer(screenPoint.line, screenPoint.column)
  const point = new Point(bl, bc)

  if (e.altKey) {
    // Add a new cursor at the spot
    const cursor = new Cursor()
    cursor.moveToPoint(point)
    cursors.push(cursor)
  } else {
    // When regular mousedown happens, flatten cursor to one
    utils.flattenToOneCursor()

    if (e.shiftKey) {
      // Expand selection
      cursors[0].moveToPoint(point, true)
    } else {
      cursors[0].moveToPoint(point)
    }

    moveContext.detail = e.detail

    if (e.detail === 2) {
      // Double click
      cursors[0].selectWord()
    } else if (e.detail === 3) {
      // Triple click
      cursors[0].selectParagraph()
    }
  }
  window.addEventListener('mousemove', selectionMove)
  window.addEventListener('mouseup', selectionUp)
  drawing.scrollMainCursorIntoView()
  drawing.draw()
}

function dragEnter(e) {
  e.stopPropagation()
  e.preventDefault()
  document.body.style.border = '2px solid red'
}

function dragOver(e) {
  e.stopPropagation()
  e.preventDefault()
}

function dragLeave(e) {
  e.stopPropagation()
  e.preventDefault()
  document.body.style.border = null
}

async function drop(e) {
  e.stopPropagation()
  e.preventDefault()
  document.body.style.border = null

  const dt = e.dataTransfer
  const files = dt.files

  const file = files[0]
  if (!file) return

  console.time('FULL load file')

  console.time('Resetting editor')
  drawing.reset()
  state.editor.cursors = [new Cursor()]
  console.timeEnd('Resetting editor')

  console.time('Load file into Buffer')
  const buffer = await Buffer.loadBrowserFile(file, measure.getLineBreak)
  console.timeEnd('Load file into Buffer')

  console.time('Wrap all line buffers (sync)')
  buffer.wrapAllLineBuffersSync()
  console.timeEnd('Wrap all line buffers (sync)')

  drawing.drawScrollbar()

  state.editor.buffer = buffer

  console.time('First draw')
  drawing.draw()
  console.timeEnd('First draw')
  console.timeEnd('FULL load file')
}

async function init(rootElement) {
  const { elements, editor } = state

  // Create elements
  elements.editor = drawing.editor()
  elements.textarea = drawing.textarea()
  elements.lines = drawing.lines()
  elements.decorations = drawing.decorations()
  elements.wrapper = drawing.wrapper()
  const [scrollbar, thumb] = drawing.scrollbar()
  elements.scrollbar = scrollbar
  elements.scrollbarThumb = thumb

  // Append
  elements.wrapper.appendChild(elements.textarea)
  elements.wrapper.appendChild(elements.decorations)
  elements.wrapper.appendChild(elements.lines)
  elements.editor.appendChild(elements.wrapper)
  elements.editor.appendChild(elements.scrollbar)

  // Write to DOM
  rootElement.appendChild(elements.editor)

  // /Event Listeners
  window.addEventListener('resize', drawing.resize)
  document.body.addEventListener('dragenter', dragEnter)
  document.body.addEventListener('dragover', dragOver)
  document.body.addEventListener('dragleave', dragLeave)
  document.body.addEventListener('drop', drop)
  elements.editor.addEventListener('mousedown', () =>
    setTimeout(() => elements.textarea.focus(), 1)
  )
  elements.editor.addEventListener('wheel', drawing.wheel)
  elements.lines.addEventListener('mousedown', selectionDown)
  elements.textarea.addEventListener('input', input)
  elements.textarea.addEventListener('paste', paste)
  elements.textarea.addEventListener('keydown', keyDown)
  elements.scrollbarThumb.addEventListener('mousedown', scrollbarDown)
  elements.scrollbar.addEventListener('mouseenter', scrollbarEnter)
  elements.scrollbar.addEventListener('mouseleave', scrollbarLeave)

  // State
  const buffer = new Buffer(measure.getLineBreak)
  console.time('Load text into buffer')
  buffer.loadText(file)
  console.timeEnd('Load text into buffer')

  console.time('Wrap all line buffers (sync)')
  buffer.wrapAllLineBuffersSync()
  console.timeEnd('Wrap all line buffers (sync)')

  editor.buffer = buffer
  editor.cursors = [new Cursor()]

  elements.lines.style.height =
    buffer.screenLength * state.settings.text.lineHeight + 'px'

  console.time('Draw first screen')
  drawing.resize()
  console.timeEnd('Draw first screen')

  // test()

  keys(window, {
    '$mod+z': utils.preventDefault(() => editor.buffer.undo()),
    '$mod+Shift+z': utils.preventDefault(() => editor.buffer.redo()),
    '$mod+d': utils.preventDefault(dump),
    '$mod+s': utils.preventDefault(),
    '$mod+p': utils.preventDefault(() => drawing.draw()),
  })
}

// Init
init(document.querySelector('main'))

function dump() {
  console.log(state.editor)
  console.log(measure.measureCache)
}

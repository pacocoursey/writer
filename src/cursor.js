import Selection from './selection'
import { Point } from './position'
import { calculateSelection } from './textarea'
import * as state from './state'
import * as utils from './utils'

const genId = () => Math.random().toString(16).slice(2)

class Cursor {
  constructor(params = {}) {
    this.id = genId()
    this.selection = new Selection(params)
    this.drawing = utils.pointToXY(this.selection.focus)
  }

  get position() {
    return this.selection.focus
  }

  deleteSelection() {
    const { buffer } = state.editor
    const { start, end } = this.selection

    if (start.line === end.line) {
      // Deletion within a single buffer line
      buffer.delete(start.line, start.column, end.column - start.column)
      buffer.wrapLine(start.line)
    } else {
      // Deletion spans multiple buffer lines
      // Delete portion from first buffer line
      const len = buffer.getScreenLineContent(start.line).length
      buffer.delete(start.line, len, start.column - len)
      buffer.wrapLine(start.line)

      // Delete buffer lines in between
      const x = start.line + 1
      const y = end.line - 1
      const between = y - x + 1
      for (let i = 0; i < between; i++) {
        buffer.removeLine(x)
      }

      // Delete portion from last buffer line
      const last = end.line - between
      buffer.delete(last, 0, end.column)
      buffer.splitUp(last)
    }

    this.moveToPoint(start)
  }

  moveSelection(anchor, focus) {
    this.moveTo(anchor.line, anchor.column, false, false)
    this.moveTo(focus.line, focus.column, true, true)
  }

  moveToPoint(point, ...args) {
    this.moveTo(point.line, point.column, ...args)
  }

  moveTo(line, column, select = false) {
    let point
    if (line instanceof Point) {
      point = Point.from(line)
    } else {
      point = new Point(line, column)
    }

    this.drawing = utils.pointToXY(point)
    this.selection.focus = point

    if (!select) {
      this.selection.anchor = point
    }
  }

  moveWithSelect(point, select) {
    return this.moveTo(point.line, point.column, select)
  }

  moveUp(lines = 1, select) {
    const { buffer } = state.editor
    let newPoint = Point.from(this.position)

    // If already on the first line, move up means go to start of line
    if (this.position.line === 0) {
      newPoint = new Point(0, 0)
    } else {
      const [screenLine, screenCol] = buffer.bufferToScreen(
        this.position.line,
        this.position.column
      )
      const newLine = Math.max(0, screenLine - lines)
      const newCol = Math.min(
        screenCol,
        buffer.getScreenLineContent(newLine).length
      )
      const [bl, bc] = buffer.screenToBuffer(newLine, newCol)
      newPoint.line = bl
      newPoint.column = bc
    }
    this.moveWithSelect(newPoint, select)
  }

  // FIXME
  moveDown(lines = 1, select) {
    const { buffer } = state.editor
    let newPoint = Point.from(this.position)

    // If already on the last line, move down means go to end of line
    if (this.position.line === utils.getLastLineNumber()) {
      newPoint = utils.getLastLineLastColumn()
    } else {
      const [screenLine, screenCol] = buffer.bufferToScreen(
        this.position.line,
        this.position.column
      )
      const newLine = Math.min(
        utils.getLastScreenLineNumber(),
        screenLine + lines
      )
      const newCol = Math.min(
        screenCol,
        buffer.getScreenLineContent(newLine).length
      )
      const [bl, bc] = buffer.screenToBuffer(newLine, newCol)
      newPoint.line = bl
      newPoint.column = bc
    }
    this.moveWithSelect(newPoint, select)
  }

  // TODO: these are kinda wrong, need to decrement in a loop
  // in case it spans multiple lines
  moveRight(cols = 1, select) {
    if (!this.selection.isCollapsed && !select) {
      return this.moveToPoint(this.selection.end)
    }

    if (this.position.equals(utils.getLastLineLastColumn())) {
      return this.moveWithSelect(utils.getLastLineLastColumn(), select)
    }

    const { buffer } = state.editor
    const newColumn = this.position.column + cols
    const thisLine = buffer.getLineContent(this.position.line)
    const newPoint = Point.from(this.position)

    if (newColumn >= thisLine.length + 1) {
      // Wrap to next line
      newPoint.line++
      newPoint.column = cols - 1
    } else {
      newPoint.column += cols
    }
    this.moveWithSelect(newPoint, select)
  }

  moveLeft(cols = 1, select) {
    if (!this.selection.isCollapsed && !select) {
      return this.moveToPoint(this.selection.start)
    }

    // Cannot go left
    if (this.position.column <= 0 && this.position.line <= 0) {
      return
    }

    const { buffer } = state.editor
    const newPoint = Point.from(this.position)

    // Go to previous line
    if (this.position.column === 0) {
      newPoint.line--
      newPoint.column = buffer.getLineContent(newPoint.line).length - cols + 1
    } else {
      newPoint.column -= cols
    }

    this.moveWithSelect(newPoint, select)
  }

  moveToTop(select) {
    const newPoint = new Point(0, 0)
    this.moveWithSelect(newPoint, select)
  }

  moveToBottom(select) {
    const newPoint = utils.getLastLineLastColumn()
    this.moveWithSelect(newPoint, select)
  }

  moveToStartOfLine(select) {
    const { buffer } = state.editor
    const [sL] = buffer.bufferToScreen(this.position.line, this.position.column)
    const [bL, bC] = buffer.screenToBuffer(sL, 0)
    const newPoint = new Point(bL, bC)
    this.moveWithSelect(newPoint, select)
  }

  // FIXME
  moveToEndOfLine(select) {
    const { buffer } = state.editor
    const [sL] = buffer.bufferToScreen(this.position.line, this.position.column)
    const lastColumn = buffer.getScreenLineContent(sL).length
    const [bL, bC] = buffer.screenToBuffer(sL, lastColumn)
    const newPoint = new Point(bL, bC)
    this.moveWithSelect(newPoint, select)
  }

  startOfNextLine() {
    this.moveTo(this.position.line + 1, 0)
  }

  moveToStartOfWord(select) {
    const { buffer } = state.editor
    const line = buffer.getLineContent(this.position.line)
    const prevLine = buffer.getLineContent(this.position.line - 1)
    const newPoint = Point.from(this.position)

    if (this.position.line !== 0) {
      const column = calculateSelection({
        text: `${prevLine}\n${line}`,
        direction: 'backward',
        amount: 'word',
        column: this.position.column + prevLine.length,
      })

      if (column <= prevLine.length) {
        newPoint.column = column
        newPoint.line--
      } else {
        newPoint.column = column - prevLine.length - 1
      }
    } else {
      const column = calculateSelection({
        text: line,
        direction: 'backward',
        amount: 'word',
        column: this.position.column,
      })
      newPoint.column = column
    }
    this.moveWithSelect(newPoint, select)
  }

  moveToEndOfWord(select) {
    if (this.position.equals(utils.getLastLineLastColumn())) {
      this.moveWithSelect(utils.getLastLineLastColumn(), select)
      return
    }

    const { buffer } = state.editor
    const line = buffer.getLineContent(this.position.line)
    const nextLine = buffer.getLineContent(this.position.line + 1)
    const newPoint = Point.from(this.position)

    if (nextLine != null) {
      const column = calculateSelection({
        text: `${line}\n${nextLine}`,
        direction: 'forward',
        amount: 'word',
        column: this.position.column,
      })

      if (column > line.length) {
        newPoint.column = column - line.length - 1
        newPoint.line++
      } else {
        newPoint.column = column
      }
    } else {
      const column = calculateSelection({
        text: line,
        direction: 'forward',
        amount: 'word',
        column: this.position.column,
      })
      newPoint.column = column
    }
    this.moveWithSelect(newPoint, select)
  }

  moveToStartOfParagraph(select) {
    this.moveWithSelect(new Point(this.position.line, 0), select)
  }

  moveToEndOfParagraph(select) {
    const { buffer } = state.editor
    const column = buffer.getLineContent(this.position.line).length
    const point = new Point(this.position.line, column)
    this.moveWithSelect(point, select)
  }

  selectWord() {
    this.moveToStartOfWord(false)
    this.moveToEndOfWord(true)
  }

  selectParagraph() {
    this.moveToStartOfParagraph(false)
    this.moveToEndOfParagraph(true)
  }
}

export default Cursor

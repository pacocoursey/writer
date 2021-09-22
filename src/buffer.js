import * as utils from './utils'

const Rnewline = /\r\n|\r|\n/

class LineBuffer {
  constructor(lines = [], getLineBreak) {
    /** @type {string[]} */
    this.lines = lines

    /** @type {number[][]} */
    this.breaks = []

    this.getLineBreak = getLineBreak
    this.length = lines.length
    this.screenLength = lines.length
  }

  /** Calculate line breaks for this entire LineBuffer */
  wrap() {
    this.breaks = this.lines.map((line) => this.getLineBreak(line))
    this.screenLength = this.breaks.reduce((acc, cur) => {
      return acc + cur.length + 1
    }, 0)
  }

  /** Calculate line breaks for this buffer line */
  wrapLine(lineNumber) {
    const line = this.lines[lineNumber]
    const before = this.breaks[lineNumber].length + 1
    this.breaks[lineNumber] = this.getLineBreak(line)
    this.screenLength += this.breaks[lineNumber].length + 1 - before
  }

  /** Add line to end */
  append(text) {
    this.lines.push(text)
    const lineBreaks = this.getLineBreak(text)
    this.breaks.push(lineBreaks)
    this.length++
    this.screenLength += lineBreaks.length + 1
  }

  /** Insert line */
  insert(index, text) {
    const lineBreaks = this.getLineBreak(text)
    this.lines.splice(index, 0, text)
    this.breaks.splice(index, 0, lineBreaks)
    this.length++
    this.screenLength += lineBreaks.length + 1
  }

  /** Remove line */
  remove(index) {
    const [deleted] = this.lines.splice(index, 1)
    const [lineBreaks] = this.breaks.splice(index, 1)
    this.length--
    this.screenLength -= lineBreaks.length + 1
    return deleted
  }
}

export default class Buffer {
  constructor(getLineBreak) {
    /** @type {LineBuffer[]} */
    this.lineBuffers = []
    this.length = 0
    this.screenLength = 0
    this.getLineBreak = getLineBreak

    /** @type {File | null} */
    this.file = null
    this.lineLimit = 5000
  }

  wrapLine(lineNumber) {
    const [buffer, index] = this.getLineInfo(lineNumber)
    buffer.wrapLine(index)
    this.recalculateScreenLength()
  }

  wrapScreenLine(lineNumber) {
    const { bufferLineNumber } = this.getScreenLineInfo(lineNumber)
    return this.wrapLine(bufferLineNumber)
  }

  wrapAllLineBuffers(start = 0) {
    this.screenLength = this.length

    return new Promise((resolve) => {
      const wrap = (index) => {
        if (index >= this.lineBuffers.length) {
          return resolve()
        }
        this.wrapLineBuffer(index)
        requestAnimationFrame(() => wrap(index + 1))
      }

      requestAnimationFrame(() => wrap(start))
    })
  }

  wrapAllLineBuffersSync(start = 0) {
    this.screenLength = this.length
    for (let i = start; i < this.lineBuffers.length; i++) {
      this.wrapLineBuffer(i)
    }
  }

  wrapLineBuffer(index) {
    this.lineBuffers[index]?.wrap()
    this.recalculateScreenLength()
  }

  recalculateScreenLength() {
    this.screenLength = this.lineBuffers.reduce((acc, cur) => {
      return acc + cur.screenLength
    }, 0)
  }

  /**
   * @param {File} file
   * @returns {Buffer}
   */
  static async loadBrowserFile(file, getLineBreak) {
    const buffer = new Buffer(getLineBreak)
    buffer.getLineBreak = getLineBreak

    // Stream is slightly faster than file.text()
    // Both are much faster than file.buffer()
    const stream = file.stream()
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    return new Promise((resolve) => {
      reader.read().then(function process({ done, value }) {
        if (done) {
          return resolve(buffer)
        }

        const text = decoder.decode(value)
        buffer.loadText(text)
        return reader.read().then(process)
      })
    })
  }

  loadText(text) {
    const lines = text.split(Rnewline)

    for (let i = 0; i < lines.length; i += this.lineLimit) {
      const buffer = new LineBuffer(
        lines.slice(i, i + this.lineLimit),
        this.getLineBreak
      )
      this.lineBuffers.push(buffer)
      this.length += buffer.length
      this.screenLength += buffer.screenLength
    }
  }

  getLineContent(lineNumber) {
    const [buffer, idx] = this.getLineInfo(lineNumber)
    return buffer?.lines[idx]
  }

  /**
   * Convert the screen position (line, column) to buffer position (line, column)
   * @param {number} screenLine
   * @param {number} screenColumn
   */
  screenToBuffer(screenLine, screenColumn) {
    // Get the buffer line and start/end for this screen line
    const { startColumn, bufferLineNumber } = this.getScreenLineInfo(screenLine)

    // Return the buffer line, and offset the screen column by the entire line start
    return [bufferLineNumber, startColumn + screenColumn]
  }

  bufferToScreen(bufferLine, bufferColumn) {
    bufferLine = utils.clamp(0, this.length - 1, bufferLine)
    const [buffer, idx, bufferIdx] = this.getLineInfo(bufferLine)
    const bufferBreaks = buffer.breaks[idx] || []

    let screenLine = this.lineBuffers
      .slice(0, bufferIdx)
      .reduce((acc, cur) => acc + cur.screenLength, 0)
    let screenColumn = 0

    // All the screen lines before this buffer line
    for (let i = 0; i < idx; i++) {
      screenLine += buffer.breaks[i].length + 1
    }

    // How deep into the breaks for this buffer line?
    let screenOffset = 0

    for (let j = 0; j < bufferBreaks.length; j++) {
      if (bufferBreaks[j] > bufferColumn) {
        break
      }

      screenOffset++
    }

    screenLine += screenOffset
    const x = bufferBreaks[screenOffset - 1] || 0
    screenColumn = bufferColumn - x
    return [screenLine, screenColumn]
  }

  getScreenLineContent(lineNumber) {
    const { bufferLine, startColumn, endColumn } =
      this.getScreenLineInfo(lineNumber)

    if (!bufferLine) {
      return ''
    }

    return bufferLine.slice(startColumn, endColumn)
  }

  getScreenLineInfo(lineNumber) {
    let bufferScreenStart = 0
    let bufferStart = 0

    for (const buffer of this.lineBuffers) {
      const { lines, breaks } = buffer
      const bufferEnd = bufferStart + buffer.length
      const bufferScreenEnd = bufferScreenStart + buffer.screenLength

      if (lineNumber < bufferScreenEnd) {
        // This is the right buffer
        const offsetLineNumber = lineNumber - bufferScreenStart

        let i = 0
        let bufferLineNumber = 0

        for (const lineBreaks of breaks) {
          if (i + lineBreaks.length >= offsetLineNumber) {
            // This is the right buffer line
            const bufferLine = lines[bufferLineNumber]

            const splitOffset = offsetLineNumber - i
            const startColumn = lineBreaks[splitOffset - 1] || 0
            const endColumn = lineBreaks[splitOffset]

            return {
              bufferLine,
              bufferLineNumber: bufferLineNumber + bufferStart,
              startColumn,
              endColumn,
            }
          }

          bufferLineNumber++
          i += lineBreaks.length + 1
        }
      }
      bufferScreenStart = bufferScreenEnd
      bufferStart = bufferEnd
    }

    console.warn('Did not find screen line!', lineNumber)
    return {}
  }

  /**
   * @param {number} lineNumber
   * @returns {[LineBuffer, number]}
   */
  getLineInfo(lineNumber) {
    let bufferStart = 0
    let i = 0

    for (const buffer of this.lineBuffers) {
      const bufferEnd = bufferStart + buffer.lines.length - 1

      if (bufferEnd >= lineNumber) {
        // This is the right buffer
        return [buffer, lineNumber - bufferStart, i]
      }

      bufferStart += buffer.length
      i++
    }

    console.warn('Did not find buffer line!', lineNumber)
    return []
  }

  /** Insert {text} at {line, column} */
  insert(line, column, text) {
    const [buffer, idx] = this.getLineInfo(line)
    const original = buffer.lines[idx]

    if (column >= original.length) {
      buffer.lines[idx] += text
    } else {
      const left = original.slice(0, column)
      const right = original.slice(column)
      const modified = left + text + right
      buffer.lines[idx] = modified
    }

    buffer.wrapLine(idx)
    this.recalculateScreenLength()
  }

  /** Append {text} to the end of {line} */
  append(line, text) {
    this.insert(line, Infinity, text)
  }

  /** Append {text} as a new line at the end of the file */
  appendLine(text) {
    const lastBuffer = utils.last(this.lineBuffers)
    lastBuffer.append(text)
    this.length++
    this.recalculateScreenLength()
    return [lastBuffer, lastBuffer.lines.length]
  }

  /** Add line at {index} with contents {text} */
  insertLine(index, text = '') {
    // If trying to add a line past the end of the buffer, append
    if (index > this.length - 1) {
      return this.appendLine(text)
    }

    // Can't insert before 0, just insert at 0
    index = Math.max(index, 0)
    const [buffer, idx] = this.getLineInfo(index)
    buffer.insert(idx, text)
    this.length++
    this.recalculateScreenLength()
    return [buffer, idx + 1]
  }

  /**
   * Remove line {index}
   * @param {number} index
   * @returns {string} The contents of the removed line
   */
  removeLine(index) {
    const [buffer, idx] = this.getLineInfo(index)
    const deleted = buffer.remove(idx)
    this.length--
    this.recalculateScreenLength()
    return deleted
  }

  swapLines(start, end, change) {
    if (change < 0) {
      for (let i = start; i <= end; i++) {
        this.swapLine(i, change)
      }
    } else {
      for (let i = end; i >= start; i--) {
        this.swapLine(i, change)
      }
    }
  }

  swapLine(index, change) {
    // Off the edges, do nothing
    if (index === 0 && change < 0) return
    if (index === this.length - 1 && change > 0) return

    const newIndex = index + change
    const deleted = this.removeLine(index)
    this.insertLine(newIndex, deleted)
    return true
  }

  delete(line, column, change) {
    if (change === 0) {
      return
    }

    if (change > 0) {
      return this.delete(line, column + change, -change)
    }

    const [buffer, idx] = this.getLineInfo(line)
    const original = buffer.lines[idx]
    // const deleted = original.substr(column, change)
    const modified = original.slice(0, column + change) + original.slice(column)
    buffer.lines[idx] = modified
    // return deleted
  }

  splitDown(line, column) {
    const [buffer, idx] = this.getLineInfo(line)
    const original = buffer.lines[idx]

    const before = original.slice(0, column)
    const after = original.slice(column)

    buffer.lines[idx] = before
    this.insertLine(line + 1, after)
  }

  splitUp(line) {
    if (line === 0) return
    const text = this.removeLine(line)
    this.append(line - 1, text)
  }

  toString() {
    let str = ''

    for (const buffer of this.lineBuffers) {
      for (const line of buffer) {
        str += line
        str += '\n'
      }
    }

    return str
  }
}

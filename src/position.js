export class Point {
  constructor(line = 0, column = 0) {
    this.line = line
    this.column = column
  }

  static from(point) {
    return new Point(point.line, point.column)
  }

  /**
   * Is this point equal to another
   * @param {Point} point
   */
  equals(point) {
    return this.line === point.line && this.column === point.column
  }

  /**
   * Is this point before another
   * @param {Point} point
   */
  before(point) {
    return this.line < point.line
      ? true
      : this.line === point.line
      ? this.column < point.column
      : false
  }

  /**
   * Is this point after another
   * @param {Point} point
   */

  after(point) {
    return this.line > point.line
      ? true
      : this.line === point.line
      ? this.column > point.column
      : false
  }
}

export class Range {
  /**
   * @param {Point} start
   * @param {Point} end
   */
  constructor(start, end) {
    this.start = start
    this.end = end
  }
}

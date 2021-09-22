import { Point } from './position'

export default class Selection {
  /**
   * @param {{ point: Point }} params
   */
  constructor(params = {}) {
    /** @private */
    this._focus = params.point || new Point()
    /** @private */
    this._anchor = params.point || new Point()
    this.start = params.point || new Point()
    this.end = params.point || new Point()

    /** @type {boolean} */
    this.isCollapsed = true

    /** @type {'forward' | 'backward'} */
    this.direction = getDirection(this._focus, this._anchor)
  }

  /**
   * @returns {Point}
   */
  get focus() {
    return this._focus
  }

  get anchor() {
    return this._anchor
  }

  set focus(focus) {
    this._focus = focus
    this.derive()
  }

  set anchor(anchor) {
    this._anchor = anchor
    this.derive()
  }

  derive() {
    this.direction = getDirection(this.focus, this.anchor)
    this.isCollapsed = this.focus.equals(this.anchor)
    this.start = this.direction === 'forward' ? this.anchor : this.focus
    this.end = this.direction === 'forward' ? this.focus : this.anchor
  }
}

function getDirection(focus, anchor) {
  if (focus.before(anchor)) {
    return 'backward'
  }

  return 'forward'
}

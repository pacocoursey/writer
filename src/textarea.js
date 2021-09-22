import { elements } from './state'

export function calculateSelection({ text, direction, amount, column }) {
  const { textarea: element } = elements
  element.value = text
  element.setSelectionRange(column, column, 'forward')
  const selection = window.getSelection()
  element.focus()
  selection.modify('move', direction, amount)
  const col = element.selectionStart
  element.value = ''
  return col
}

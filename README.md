# writer

Big
- [ ] Operational transform (multiplayer editing + text markers)
  - Something like `buffer.point` that stay up-to-date with any buffer changes
  - I can create `buffer.point(line=10, col=0)` and then read its coordinates
  - OT should also solve history system? Just apply undo transformations
- [ ] History system (deltas)

App
- [ ] File system
- [ ] Focus modes (word, line, paragraph)
- [ ] Thesaurus
- [ ] Tree-sitter markdown
- [ ] Option to hide cursor
- [ ] Figma stuff

Small

- [ ] Wrap on-demand (?)
- [x] Scrollbar interaction and making it not shitty
- [x] Cursor should use buffer coords
- [x] Add ⌥↑↓ to move blocks
- [x] Triple click paragraph
- [x] Scrollbar
- [x] Wrap on resize (buggy)
- [x] Fit canvas on resize
- [x] Selection deletion
- [x] Fix ⌥⌫ for single char line
- [x] Fix mouseDown selection on scroll
- [x] Fix editing with multiple chunks
- [x] Fix not finding buffer lines
- [x] Learn how to animate cursor
- [x] Only render visible selections/cursors
- [x] Support non-mono font

Notes

Hold command for tiling mode
Quick is swap, long is split
Command and double click to close it out
Settings file is plaintext but parts are read only
Comments are part of document
The UI is just a layer on top

Line based reading
Writer is also reader
Sentence completion
Convert articles to reader
Markup is same as comments

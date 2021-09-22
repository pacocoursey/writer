# writer

Plain text editor from scratch, made for the web. Drag and drop files to open them.

### Architecture

- Buffer is an array of array of lines
- Text is manually measured and wrapped with canvas
- Lines are virtualized on scroll and drawn as divs
- Cursor and selection are also divs
- Word boundary operations are emulated with textarea
- Styling through CSS variables

### Future

- B-tree buffer with height map
- History system
- Operational transform
- Alternate canvas renderer with FreeType and Harfbuzz

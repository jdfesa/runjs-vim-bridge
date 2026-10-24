# Relative Line Numbers

Optional counted-motion practice aid, enabled at build time with
`--relative-lines`. This emulates the display of Neovim's `number` plus
`relativenumber`; those options are not enabled by default in clean Neovim.

With the cursor on line 8:

```text
  3  // line 5
  2  // line 6
  1  // line 7
  8  // current line: actual line number
  1  // line 9
  2  // line 10
  3  // line 11
```

For a line showing `3` below the cursor, `3j` moves down three buffer lines;
`3k` moves up three. This does not add or change those Vim mappings.

## Build and Install

Follow the [installation guide](installation.md), supplying your app location.
For an existing bridge, keep the accepted appearance while adding relative numbers:

```sh
python3 scripts/build-patch.py --app "$RUNJS_APP" \
  --upgrade --appearance mint --relative-lines
```

For an unpatched app, omit `--upgrade`. Omit `--appearance mint` to keep native
appearance. Quit RunJS and install normally; every install gets a new backup.
Repeat `--relative-lines` in future builds if you want to retain the feature.

## Behavior

- The current line shows its absolute number; all others show cursor distance.
- Numbers follow the selection head/cursor independently in each code editor/tab.
- Wrapped display rows do not count as extra buffer lines.
- Insert, Normal, and Visual modes use the same numbering; there is no hidden
  mode-dependent switch to absolute numbers.
- **Settings → Editor → Line Numbers** still controls visibility. If it is off,
  this patch does not silently change the saved preference or turn it back on.
- It leaves exercise text, undo history, Vim mappings, breakpoints, logpoints,
  folding gutters, output, and settings fields alone.

The patch uses the native `lineNumberFormatter` API. Cursor motion refreshes the
gutter only when the line anchor changes. Structural edits also check label width
without reading exercise text. Stable padding avoids narrow gutters near EOF.

## Disable and Validation

Rebuild with `--upgrade` and the desired appearance but without `--relative-lines`,
then install. Or restore the matching pre-install backup. Runtime cleanup restores
the previous formatter and releases listeners/timers.

Synthetic tests cover lifecycle, offsets, visibility, tab independence, stable
width, and minimal updates. An isolated browser check with RunJS4.1.0's bundled
engine verifies actual redraw, a counted `5j` motion and restoration. It does not
replace checking the final installed app's layout and native key routing.

Reference: [Neovim number/relativenumber](https://neovim.io/doc/user/options/#'relativenumber').

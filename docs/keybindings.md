# Keybindings and Compatibility

## Short Answer

**No, this is not all of Neovim.** RunJS's bundled Vim engine supplies the basic
editing commands below. Bridge **1.4.0** adds real host save/quit adapters and
default `ZZ`/`ZQ` maps, while preserving the existing execution/sandbox workflow.
These adapters are **implemented and tested in isolation**. On 2026-10-24 the
user confirmed native startup, `:w` with file inspection, modified `:q` refusal,
`:wq` save/close and canceled unnamed `:wq` staying open. **Extended native
acceptance is still pending.** Earlier 1.3.0 builds do not include them.

See [host commands](host-commands.md) for exact semantics, safety checks and
native acceptance steps; [patch scope](patch-scope.md) separates responsibilities.

## Evidence and Notation

Audit dated **2026-10-24**: RunJS **4.1.0**, bundled CodeMirror **5.65.17**, clean
Neovim **0.11.4**. Of **67 synthetic cases**, 59 match text/cursor/mode, five have
the same text but different cursor columns, and three are host-operation
boundaries. This is a fixture count, **not a percentage of all Neovim commands**.

- **E**: verified in the isolated bundled engine against clean Neovim.
- **D**: implemented, but a measured cursor-column difference exists.
- **B**: bridge host adapter; isolated parser/policy evidence plus the exact
  user-reported native basic checks above, not every alias/variant.

Native RunJS/macOS key delivery remains a separate check, especially Ctrl keys.
Detailed inputs/results and reproduction: [command audit](command-audit.md).
Keys are case-sensitive; `dd` means two successive presses. `<C-r>` means
Control+r, not Command+r. `…` means inserted text, not a literal key.

**Mode:** every flow below starts in Normal. `i/a/o/I/A/O/cw/cc/ciw/C` enter
Insert; `R` enters Replace. `v`, `V`, `<C-v>` enter Visual, Visual Line and
Visual Block. `<Esc>` finishes an inserted/replaced edit; `y` or `d` completes
the tested selection flows and returns to Normal. Ex commands require `<CR>`.

## Save and Quit: Host Adapter

In **1.4.0 source builds**, `:w` uses native Save/Save As and waits for the actual
write callback. `:q` refuses a modified buffer; `:q!` closes that tab without a
new write. `:wq` saves before closing; cancel, error or a later edit prevents close.
`:x`/`ZZ` writes only when modified. `ZQ` is `:q!`.

`:qa[!]` exits the app, not just a tab. **RunJS session recovery remains intact**:
`!` skips the bridge's unsaved-file gate, not session persistence. This is not
Neovim's buffer/window/session model. Native licensing and filesystem permissions
still apply. Filename arguments/ranges are rejected rather than approximated.

Use disposable exercises for remaining native acceptance checks. Native **Cmd+S**, **Cmd+Shift+S** and **Cmd+W** remain available on macOS:
[RunJS shortcuts](https://runjs.app/docs/features/shortcuts).
The original 67-case bare-engine audit remains historical evidence: `:w` alone
has no persistence hook, and `:q`/`:wq` are unregistered without our adapter.

## Visual Guide Essentials

Covers the visual guide's Modes, Movement, Editing, Undo/redo and Save/quit
lessons. It is a teaching simulation; RunJS is a different application.

| Keys / flow | Meaning | Status | Fixture |
| --- | --- | --- | --- |
| `i … <Esc>` | Insert before the cursor, then return to Normal. | E | `insert-before` |
| `h` | Move left. | E | `motion-h` |
| `j` | Move down one buffer line. | E | `motion-j` |
| `k` | Move up one buffer line. | E | `motion-k` |
| `l` | Move right. | E | `motion-l` |
| `w` | Move to the next word start. | E | `motion-w` |
| `b` | Move to a word start backward. | E | `motion-b` |
| `0` | Move to the first character. | E | `motion-bol` |
| `$` | Move to the last character. | E | `motion-eol` |
| `a … <Esc>` | Append after the cursor. | E | `append` |
| `o … <Esc>` | Open a line below and insert. | E | `open-below` |
| `x` | Delete the character under the cursor. | E | `delete-char` |
| `dd` | Cut the current line. | D | `delete-line` |
| `u` | Undo an edit. | E | `undo` |
| `<C-r>` | Redo an undone edit. | E | `redo` |
| `:w<CR>` | Save the actual file. | B | `host-w` |
| `:q<CR>` | Quit with unsaved-change protection. | B | `host-q` |
| `:wq<CR>` | Save and quit. | B | `host-wq` |
| `dd` | Cut the current line. | E | `delete-line-at-start` |

## Bridge Host Commands (1.4.0)

All entries below have status **B**; only the exact basic native flows noted
above have user-reported acceptance. Append `<CR>` to Ex
commands. `ZZ`/`ZQ` are two Normal-mode key presses with no colon or Enter.

| Commands | Meaning in this bridge |
| --- | --- |
| `:w`, `:write`, `:w!` | Save the active exercise through native Save; unnamed exercises open Save As. |
| `:q`, `:quit` | Close the active tab only if clean; otherwise report E37. |
| `:q!`, `:quit!`, `ZQ` | Close the active tab without requesting a new disk write. |
| `:wq[!]` | Always save, then close that tab only after a successful, still-current write. |
| `:x[!]`, `:xit[!]`, `:exit[!]`, `ZZ` | Save only if modified, then close that tab. |
| `:qa[!]`, `:qall[!]` | Exit RunJS; without `!`, every tab must be verified and clean. |
| `:wa[!]`, `:wall[!]` | Save modified tabs sequentially; stop on cancellation/failure. |
| `:wqa[!]`, `:wqall[!]` | Save modified tabs, then exit only if all are clean. |
| `:xa[!]`, `:xall[!]` | Save modified tabs, then exit only if all are clean. |
| `:sav[!]`, `:saveas[!]` | Open RunJS's native Save As dialog; filename arguments are not supported. |

`[!]` means an optional literal `!`. It does **not** grant permission to overwrite
read-only files, bypass licensing, or discard edits typed during a write. The
native last-tab/window behavior is retained. Closing a tab can still be reversible
through RunJS's Reopen Tab; it is not secure erasure.

## Everyday Editing from the Learning Guide

The native editing subset, not the educational profile plugin maps.

| Keys / flow | Meaning | Status | Fixture |
| --- | --- | --- | --- |
| `yy p` | Copy the line and put a copy below. | E | `yank-put` |
| `yy P` | Copy the line and put a copy above. | E | `yank-put-before` |
| `3yy P` | Copy three lines and put them above. | E | `count-yank` |
| `3dd` | Cut three lines, including the current one. | E | `count-delete` |
| `v l y p` | Select two characters, copy them and put after. | E | `visual-char-yank` |
| `v l d` | Select and cut two characters. | E | `visual-char-delete` |
| `V 2j d` | Select three whole lines and cut them. | E | `visual-line-cut` |
| `V j y G p` | Copy two lines and put them below the last line. | E | `visual-line-yank` |
| `5j` | Move a counted number of buffer lines. | E | `count-down` |
| `3k` | Move a counted number of buffer lines. | E | `count-up` |

## Additional Useful Stock Commands

Representative flows, not exhaustive tests of every argument, mode or edge case.

| Keys / flow | Meaning | Status | Fixture |
| --- | --- | --- | --- |
| `I … <Esc>` | Insert before the first nonblank character. | E | `insert-first` |
| `A … <Esc>` | Append at the end of the line. | E | `append-end` |
| `O … <Esc>` | Open a line above and insert. | E | `open-above` |
| `e` | Move to the end of the word. | E | `word-end` |
| `^` | Move to the first nonblank character. | E | `first-nonblank` |
| `gg` | Move to the first line. | D | `first-line` |
| `G` | Move to the last line. | E | `last-line` |
| `dw` | Cut through the next word motion. | E | `delete-word` |
| `cw … <Esc>` | Change the word and return to Normal. | E | `change-word` |
| `cc … <Esc>` | Change the current line. | E | `change-line` |
| `D` | Cut through the end of the line. | E | `delete-to-end` |
| `C … <Esc>` | Change through the end of the line. | E | `change-to-end` |
| `ciw … <Esc>` | Change the inner word from inside it. | E | `change-inner-word` |
| `di"` | Cut inside double quotes while keeping the quotes. | E | `delete-inner-quotes` |
| `da(` | Cut a parenthesized object including its delimiters. | E | `delete-around-parens` |
| `2d3w` | Multiply operator and motion counts. | E | `multiply-counts` |
| `rX` | Replace one character without entering Insert. | E | `replace-char` |
| `R … <Esc>` | Overwrite characters in Replace mode. | E | `replace-mode` |
| `x .` | Repeat the last character deletion. | E | `repeat-delete` |
| `ciw … <Esc> w .` | Repeat a word change including inserted text. | E | `repeat-change` |
| `fa` | Find/till a character on the current line. | E | `find-f` |
| `ta` | Find/till a character on the current line. | E | `find-t` |
| `Fa` | Find/till a character on the current line. | E | `find-F` |
| `Ta` | Find/till a character on the current line. | E | `find-T` |
| `fa ; ,` | Repeat a character find forward and backward. | E | `repeat-find` |
| `%` | Jump to the matching bracket. | E | `match-pair` |
| `J` | Join the next line. | E | `join` |
| `"ayy j "ap` | Copy into a named register and put it. | E | `register` |
| `qa x j q @a` | Record and replay a delete-and-move macro. | E | `macro` |
| `ma G `a` | Set a local mark and return to its exact position. | E | `mark` |
| `<C-v> j l d` | Cut a rectangular two-column block. | E | `visual-block` |
| `* n N` | Search the word under the cursor and move between matches. | E | `search-word` |
| `#` | Search backward for the word under the cursor. | E | `search-backward` |
| `>>` | Indent the current line by one shift width. | D | `indent` |
| `<<` | Remove one shift width of indentation. | E | `unindent` |
| `gg` | Move to the first line. | E | `first-line-at-start` |
| `G` | Move to the last line. | D | `last-line-from-column` |
| `<<` | Remove one shift width of indentation. | D | `unindent-from-column` |

## Counts, Registers and Scope

A count includes the current line for `3yy`, `3dd` and `V 2j`. Counts compose
with operators/motions: `2d3w` deletes six word motions in the tested fixture.
Yank/delete/put use Vim registers, **not automatically the system clipboard**.
Another yank/delete can replace the unnamed register.

Named-register, mark and macro checks are within one editor. They do not prove
cross-tab persistence, clipboard integration, or every macro/input combination.
The `.` checks cover deletion and an inserted word change, not every operator.
Escape from Insert is tested; general prompt cancellation is still pending.

## Measured Cursor Differences

Clean Neovim 0.11.4 defaults to **`nostartofline`**: several linewise operations
retain the column when possible. The bundled Vim engine instead uses a
first-nonblank-style position in these fixtures:

| Fixture | RunJS engine cursor | Clean Neovim cursor | Text result |
| --- | --- | --- | --- |
| `dd` from line 2, column 4 | line 2, column 1 | line 2, column 4 | Same |
| `gg` from column 5 | line 1, column 1 | line 1, column 5 | Same |
| `G` from column 5 | last line, column 1 | last line, column 5 | Same |
| `>>` from column 1 | column 3 | column 1 | Same 2-space indentation |
| `<<` from column 6 | column 1 | column 5 | Same unindentation |

This table uses one-based positions; the JSON report uses zero-based coordinates.
These are nuances, not absent commands. **The current patch does not correct
them.** Reference: [startofline](https://neovim.io/doc/user/options/#'startofline').

## Not Yet Established

`/`/`?` prompt interaction/cancellation, general regex, substitution ranges,
page scrolling/`zz`, jump lists, system clipboard registers, cross-tab registers,
macro input edge cases, IME/Unicode, wrapped-row motions and Insert-mode Ctrl
shortcuts need dedicated fixtures and/or native checks. **Pending is not
missing, but it is not verified compatibility either.**

## Not Part of This Bridge

The separate `nvim-learning` profile's tree, picker, Leader menus,
`<Leader>ff`, `<Leader>fb`, `<Leader>e`, custom `<C-h/j/k/l>` window maps,
buffer/tab maps, completion/snippet plugins, LSP and Mason are not stock
Neovim editing commands and are not provided here. RunJS tabs/output are not
Neovim buffers/windows. No native Neovim runtime or split/window model is embedded.

References: [Neovim quick reference](https://neovim.io/doc/user/quickref/),
[editing guide](https://neovim.io/doc/user/usr_04/),
[RunJS editor settings](https://runjs.app/docs/settings/editor).

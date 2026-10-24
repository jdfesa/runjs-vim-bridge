# Basic-Command Audit

> This is the historical **bare bundled-engine** audit, without the 1.4.0 host
> adapter. Its three host boundaries remain valid baseline observations, not
> the current source feature inventory. See [host commands](host-commands.md)
> for new parser/policy evidence and pending native acceptance.


## Recorded Result

Date: **2026-10-24**. RunJS **4.1.0**, bundled CodeMirror **5.65.17**, clean
Neovim **0.11.4**. **67 cases: 59 exact matches, five cursor-only differences,
three host boundaries.** The [JSON snapshot](command-audit-results.json) includes
outcomes by fixture ID, engine/module hashes and reference options. The
[fixtures](../tests/vim-audit/cases.json) contain initial text, cursor and actions.
The meanings and statuses are in [keybindings](keybindings.md).

The audit takes its starting set from the user's visual guide's native editing
lessons and the native Everyday Editing subset of the educational guide. It adds
operators, counts, objects, repeat, find, registers, a macro, a mark and block
selection. Plugin/custom Leader maps are deliberately excluded, not counted as
missing stock commands.

## Method

1. Read the selected app and verify version and ASAR header integrity.
2. Require the audited editor bundle fingerprint. The extractor is pinned to this
   exact webpack layout; it refuses unknown bundles, including modified 4.1.0 builds.
3. Extract only five CodeMirror/Vim/support modules and native CSS into a private
   directory **outside the repository**. Original bundles remain unchanged.
4. Generate reference results using Neovim without user config, plugins, swap or
   ShaDa. The reference starts from synthetic text for each fixture and runs typed
   key input. It never runs save/quit cases against real files.
5. Run the isolated bundled engine in a browser on the same fixtures. Compare
   text, zero-based cursor, final mode and thrown error. Capture Ex notifications
   separately, because unknown commands may notify rather than throw.

Reference options: `startofline=false`, `expandtab=true`, `shiftwidth=2`,
`tabstop=2`, no auto/smart indentation, no language/filetype. This is an explicit
editing baseline, not a reproduction of RunJS's language service or formatting.

Text insertion uses CodeMirror input operations; Replace models its overwrite
path. The first harness revision falsely reported Replace as insertion; that was
fixed in the **test harness**, not the app. `R` matches in the corrected audit.

The five retained differences are `dd`, `gg`, `G`, `>>`, `<<` starting from the
documented columns. Their text matches; cursor placement differs with clean
Neovim's `nostartofline`. `:w` lacks a disk-save hook in the bare engine; `:q`
and `:wq` notify that they are not registered editor commands.

## Reproduce Locally

Needs Python 3.10+, Node.js 18+, Neovim and a browser. Commands are from this
checkout's root; supply your own app location. No network downloads are needed.

```sh
printf 'Path to your RunJS.app: '
IFS= read -r RUNJS_APP
AUDIT_DIR=$(mktemp -d)
python3 scripts/prepare-vim-audit.py --app "$RUNJS_APP" --output "$AUDIT_DIR"
python3 -m http.server 8768 --bind 127.0.0.1 --directory "$AUDIT_DIR"
```

Open `http://127.0.0.1:8768`, click **Run audit**, then expand **Machine-readable
report**. Keep the server bound to localhost. Stop it with Ctrl+C afterward.
The result reflects the installed Neovim version recorded in the report; compare
versions/options before interpreting a changed result. The checked snapshot uses
0.11.4. The preparation tool rejects a nonempty output directory or one inside
the source checkout or overlapping the app bundle. Optional `--neovim` selects
another executable explicitly.

The generated directory contains proprietary extracted modules/native CSS.
**Do not commit, publish or redistribute it.** The checked-in cases, runner,
reference script and JSON outcomes are our synthetic evidence, not RunJS source.

## What This Does Not Establish

- Native RunJS/Electron/macOS menu routing for physical keys, including Ctrl+r/v.
- Actual disk persistence, close-tab/quit behavior, or unsaved-change protection.
- Every variant of a command, general Ex/search regex behavior, language-aware
  indentation, cross-tab state, clipboard access, Unicode/IME or every undo case.
- Behavior of the entire configured educational Neovim profile or its plugins.

Do not turn 59 passing fixtures into “all basics supported” or a command-coverage
percentage. Do not fix the app until a difference is separated from harness
behavior and verified at the layer that owns it.

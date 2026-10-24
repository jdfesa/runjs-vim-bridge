# Neovim Transition Roadmap

**Goal:** transferable default Neovim editing habits inside RunJS, preserving
JS/TS execution, preview and sandbox without another configuration layer.
No native Neovim integration. Planned items below are not shipped features.

## Established Baseline

The [command audit](command-audit.md) now compares 67 synthetic flows with clean
Neovim: 59 exact outcomes, five cursor-only differences and three host boundaries.
[Keybindings](keybindings.md) is the canonical command/meaning/status reference.
The mode indicator, optional relative numbers and optional dark/translucent
profile are implemented. Version 1.4.0 source now adds host commands and default
`ZZ`/`ZQ` compatibility maps; this does not replace the bundled editing engine.

## 1. Accept Native Save/Quit — Highest Priority

The [1.4.0 host adapters](host-commands.md) are implemented in modular source.
They reuse native Save/Save As/licensing and tab close, wait for actual writes,
protect dirty buffers and reject unsupported arguments. The 32-case real-engine
parser audit and synthetic host tests pass. The user confirmed native startup,
`:w`, dirty `:q` refusal, `:wq` and canceled Save As. **Extended native acceptance
remains pending**; do not treat all variants as native-verified.

- Run the disposable-exercise checklist for named/unnamed tabs, cancel, errors,
  edits during a write, native shortcuts and all-tab commands.
- Confirm last-tab behavior and session recovery are accurately described.
- Do not install, sign or launch an app as part of routine source work.
- Keep the optional visual profile and relative gutters unchanged during acceptance.

**Acceptance:** reliable native operations with recorded evidence; never silent
false confidence about persistence or a full-Neovim claim.

## 2. Verify Native Shortcut Routing — High Priority

- Test physical Control+r/v first, then Control+d/u/o/i where relevant.
- Check native menus, Electron, macOS and keyboard layout; an engine test alone
  does not prove key delivery.
- Test editor focus, new/closed tabs, Vim off/on, settings, dialogs and output.
- Fix only confirmed conflicts with reversible, editor-scoped handling.

**Acceptance:** normal editing works without hijacking non-editor controls.

## 3. Resolve Measured Semantic Nuances — High Priority

`dd`, `gg`, `G`, `>>`, `<<` can differ from clean Neovim's default cursor-column
behavior. They are present and produce the same text in the audited fixtures.

- Keep differences documented now; do not call them missing commands.
- Evaluate the smallest compatibility adapter only if it preserves counts,
  operators, marks, repeat and undo, and does not rewrite original bundles.
- Add edge cases before changing behavior: empty/short/indented lines and EOF.
- Do not change the reference to `startofline=true` merely to make the audit pass.

**Acceptance:** verified fixes or clearly retained limitations, no invented remaps.

## 4. Expand High-Value Coverage — Medium Priority

- Search prompts `/`/`?`, cancellation, regex/substitution ranges and matching.
- Insert/replace input, repeat after edits, undo grouping and multiline paste.
- Cross-tab registers, system clipboard, macro input and jump lists.
- Unicode/IME, wrapped-row motions, long lines, empty buffers and viewport scroll.
- Separate input-layer limitations from engine semantics before reporting a bug.

**Acceptance:** new fixture evidence linked to the command reference; no global
compatibility percentage extrapolated from a finite test set.

## 5. Improve Feedback and Practice — Medium Priority

- Consider live row/column and `showcmd`-style pending count/operator feedback
  using engine state/events, not a key recorder or retained input history.
- Provide a small English help/cheat-sheet entry point using the documented
  command set; avoid a new Leader scheme or configuration framework.
- Add short JS/TS drills: counts, `ciw`, `di"`, `.` and `yy/dd/p/P`, then search,
  registers and macros. Show equivalent steps in clean Neovim.
- Keep hints optional, layout unobtrusive, and cleanup/recovery tested.

**Acceptance:** useful learning feedback without hiding errors or duplicating
RunJS's preview/runtime.

## Boundaries

No plugin/LSP/tree/picker parity, native Neovim buffers/windows, extra runtime,
arbitrary Leader maps, silent preference rewrites or full-Neovim promise.
Version 4.1.0 remains the target; more versions/platforms require evidence.

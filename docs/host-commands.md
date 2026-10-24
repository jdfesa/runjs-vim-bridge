# Native Save and Quit Compatibility

## Status and Scope

**Bridge 1.4.0: implemented; core native checks accepted by user report.**
On **2026-10-24**, the user confirmed startup, `:w` with actual file inspection,
modified `:q` refusal, `:wq` save/close and cancellation of unnamed `:wq` Save As
leaving the tab open. Extended native acceptance below remains pending.
The command inventory and meanings are canonical in [keybindings](keybindings.md).
Only the pinned RunJS **4.1.0 / CodeMirror 5.65.17** bundles are accepted. An app
with the same version but different bundles is refused until reviewed.

Earlier 1.3.0 builds do not gain these commands until an explicitly authorized
upgrade. Use disposable exercises for initial native checks, not irreplaceable work.

## What Is Reused

- `:w` invokes the existing native Save menu action. Its Save As dialog, license
  restrictions, extension/path selection and working-directory updates remain native.
- The native editor performs the actual write. The bridge observes its callback;
  it does not implement another filesystem writer or call textarea synchronization
  a disk save. No user source text or filename is sent over the new host IPC.
- `:q` uses native tab removal/cleanup. A one-use, sender/tab-scoped close ticket
  skips only that command's native confirmation after bridge checks. Ordinary
  menu/close-button confirmation is unchanged.
- `:qa` uses normal `app.quit()`, never hard process exit or window destruction.
  **RunJS's persistent session stays intact**, including drafts recovered next time.

RunJS tabs are not Neovim windows or buffers. `:q` closes one RunJS tab; the final
tab retains RunJS's native window behavior. `:qa` exits the application. `:q!`/`ZQ`
requests no new disk write, but RunJS may retain that closed tab for Reopen Tab.
Neither forced command promises secure deletion or removal from session recovery.

## Safety Rules

- Independent CodeMirror generations track modified state, including unnamed
  nonempty exercises. Undo back to a known saved generation is clean.
- RunJS clears its native unsaved flag *before* `fs.writeFile` finishes. The
  bridge therefore waits for the callback and restores accurate dirty feedback
  on errors or edits made during that write.
- Save cancellation, filesystem failure, missing native action, unverified write
  completion, or an editor disappearing aborts save-and-close. No fallback closes it.
- Editing while a save runs keeps the buffer dirty. Even `:wq!` will not discard
  those new edits. Concurrent Ex commands and quitting during a tracked native
  write are rejected. Overlapping native writes require another isolated save.
- All-tab saves run sequentially and stop at the first failure/cancellation.
  Earlier successful saves are not rolled back. The original tab is restored if
  the operation stays open. All-tab quit rechecks every tab before exit.
- Visit every tab before non-forced all-tab commands; unknown editor state is
  refused rather than assumed clean. `:qa!` intentionally skips that dirty gate,
  but still refuses a known pending write.
- `!` never bypasses licensing, filesystem permissions or save-completion checks.
  `:sav` opens native Save As without a filename argument: a deliberate adaptation,
  not full Neovim `:saveas` semantics.
- Host commands reject line ranges, filename arguments, shell writes, append
  writes and command chains. Examples: `:1,3w`, `:%w`, `:w file.ts`, `:w !cmd`,
  `:w >>file`, `:q | quit!`. Rejection occurs before a host action.

The bridge only attaches to code editors identified by native tab IDs. It does
not install global key handlers, change settings/dialog keys, edit the original
minified bundles, weaken preload/sandbox/navigation controls or collect telemetry.

## Modules and Version Pins

- `bridge-host/commands.cjs`: abbreviations, `ZZ`/`ZQ`, argument validation and
  save/quit sequencing, independent of Electron.
- `bridge-host/native-save.cjs`: locate native Save actions; temporarily observe
  synchronous native dialog dispatch and filesystem invocation, restoring methods
  in `finally` before any async wait. Only callbacks remain wrapped until completion.
- `bridge-host/save-tracker.cjs`: per-editor native listeners, dirty generations,
  write completion and cleanup. Normal native Save remains callable.
- `bridge-host/renderer.cjs`: discover code editors; obtain existing runtime
  exports for the editor, tab metadata and event bus without copying app code.
- `bridge-host/main.cjs`: narrow IPC, exact local main-frame checks, native close
  authorization and normal quit. Native confirmation registration is wrapped
  only while the original startup bundle loads; `ipcMain.handle` is then restored.
- `runjs-bridge-main.cjs`: select owned modules, then delegate original startup.

Paths above are inside `patches/runjs-4.1.0/`. The builder adds them to the ASAR;
do not manually paste them into RunJS bundles. The native engine/main SHA-256 pins
live in `scripts/runjs_bridge/composition.py`. Renderer module IDs are specific to
this build, not public RunJS APIs. See [installation](installation.md) for locations
and [development](development.md) for tooling responsibilities.

## Evidence and Reproduction

- Python synthetic app tests: archive/integrity, bundle refusal, nested assets,
  upgrades, backup hashes and rollback after relocating the backup.
- Node synthetic host tests: sequencing, dirty/forced scopes, cancel/error/races,
  write callbacks, cleanup, one-use close tickets and sender rejection.
- [Parser report](host-command-audit-results.json): **32/32** cases using the real
  pinned CodeMirror engine and our actual command module with a **synthetic host**.
  It verifies command parsing, abbreviations, bang arguments, range/argument
  rejection, `ZZ`/`ZQ` and representative cancel/clean flows, not native I/O.

Prepare the isolated parser check, using paths you supply:

```sh
rtk python3 scripts/prepare-host-audit.py --app "$RUNJS_APP" --output "$AUDIT_DIR"
rtk proxy python3 -m http.server 8770 --bind 127.0.0.1 --directory "$AUDIT_DIR"
```

Use an empty private temporary directory outside both checkout and app. This
reuses the [baseline preparation](command-audit.md), including a clean Neovim
reference executable. Open the local server, press **Run host audit** and inspect
the report. Stop the server afterward. Never publish its extracted engine/assets.

## Native Acceptance Checklist

**Partially completed by the user for 1.4.0**, exactly as listed above. Forced
commands, aliases, all-tab flows, write failures/races, last-tab behavior and
session recovery still need native checks. Only install with explicit user authorization,
saved work, closed RunJS and a verified new full backup. Preserve desired optional
appearance/relative-number flags on upgrade. Record app/bridge versions and results.

Use new disposable JS/TS exercises and a dedicated temporary folder:

1. Named file: edit, `:w`, inspect the actual file in another reader. Native
   Cmd+S must still work; confirm the dirty indicator after editing again.
2. Unnamed exercise: `:w` must open native Save As. Cancel and verify the tab
   and text remain; repeat, select a filename and inspect its actual contents.
3. Dirty `:q` must show E37 and leave text/tab intact. Clean `:q` closes only
   that tab. `:q!`/`ZQ` closes only the disposable target, without a new disk write.
4. `:wq` and dirty `:x`/`ZZ` save before closing. Clean `:x` must not rewrite.
   Cancel Save As during `:wq`: nothing closes. Repeat in a second tab.
5. With a disposable unwritable destination, verify save failure leaves the tab
   open and dirty. Never change protections on a real exercise to run this check.
6. Verify edits during a delayed write prevent close; a second Ex operation and
   quit during a pending write must be refused. Synthetic tests cover the race;
   a native delayed-write environment is still needed for full acceptance.
7. Test `:wa`, `:wqa`/`:xa`: multiple dirty tabs, cancellation partway, later tab
   edits, unknown/unvisited tabs and restoration of the original active tab.
8. `:qa` refuses any dirty tab. `:qa!` exits without requesting new saves. Reopen
   RunJS and verify the documented session recovery, not Neovim session semantics.
9. Test last-tab behavior, native menu/close-button confirmation, Vim off/on,
   settings, search inputs, output controls, execution and Web View. None should
   acquire global Vim interception or lose its existing workflow.

Report **user-accepted native basic flows** separately from the remaining
**isolated-only/untested native variants**. Never extrapolate to full Neovim parity.

References: [Neovim file editing](https://neovim.io/doc/user/editing/),
[Electron IPC](https://www.electronjs.org/docs/latest/api/ipc-main),
[RunJS shortcuts](https://runjs.app/docs/features/shortcuts).

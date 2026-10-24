# What the Patch Does and Does Not Do

## Responsibilities

| Responsibility | Owner | Current bridge behavior |
| --- | --- | --- |
| JavaScript/TypeScript execution, runtime selection, console and sandbox | RunJS | Preserved, not reimplemented |
| Normal/Insert/Visual editing, operators, motions, registers and repeat | Bundled CodeMirror Vim engine | Existing behavior; representative results in the command audit |
| Mode feedback, optional visuals and host save/quit compatibility | This patch | Additive version-specific assets, safe build/install/restore tooling |

Calling a command supported by the engine does not mean the patch implemented
it, that it matches every Neovim semantic, or that every native key combination
reaches it. [Keybindings](keybindings.md) separates those claims.

## Implemented in 1.4.0 Source

- Native Save/Save As adapters for `:w`, `:wq`, `:x` and all-tab variants; write
  callbacks and independent buffer generations gate closing.
- `:q[!]`, `:qa[!]`, `ZZ`/`ZQ`, modified-buffer protection and clear rejection
  of unsupported ranges, filenames and shell arguments.
- Modular archive/composition/build/backup/install/restore tooling; each backup
  includes the Python modules needed for independent rollback.
- English mode indicator for Normal, Insert, Visual, Visual Line, Visual Block,
  Replace, Vim off and editor loading, with contextual hints.
- Per-tab editor discovery and listener cleanup; no exercise-text logging.
- Optional relative line numbers: current line absolute, others buffer distance;
  native visibility stays user-controlled; previous formatter restored on cleanup.
- Optional Kitty-inspired black/mint/amber profile with background-only alpha,
  macOS vibrancy and opaque text. No runtime dependency on Kitty configuration.
- Low-priority dark Web View defaults with that profile; exercise styles win.
- Version-specific additive construction, hash checks, full backups, local
  signing, verified restoration and explicit upgrades of recognized bridge assets.

The command audit and its fixture/reference tools are **development evidence**,
not an embedded Neovim runtime, telemetry, or code that runs against user exercises.

## Not Implemented

- A replacement Vim engine or a general Neovim file/buffer/window model.
- Filename/range/shell variants of host commands, `:e`/`:edit`, `:cq`, splits,
  `:bd`/`:bn` or a file-manager interface. Use RunJS native actions instead.
- Corrections to the audited `dd`, `gg`, `G`, `>>`, `<<` cursor-column nuances.
- A general Ex command interpreter, Vimscript/Lua configuration, `.vimrc` or
  `init.lua` loading, Neovim buffers, splits, terminals or session semantics.
- Leader menus, file trees, pickers, LSP/plugin/snippet parity with a configured
  Neovim distribution or the separate educational profile.
- New HTML/CSS editor languages or embedded-language parsing inside JS strings.
- New execution previews, sandbox/runtime security changes, or preference rewrites.

## Tested Versus Pending

The historical bare-engine [audit](command-audit.md) compares 67 synthetic flows with clean Neovim.
It finds 59 exact outcomes, five cursor-only differences and three host boundaries.
Automated tests cover host policy/cancellation/failure, scoped Electron/native
write observation, build/backup/restore safety, HUD/gutter lifecycle and appearance.
A separate real-engine parser audit covers 32 host-command flows with a synthetic
host. **Neither alone proves native saving or quitting.** The user subsequently
confirmed startup, `:w` file persistence, dirty `:q` refusal, `:wq` save/close
and canceled unnamed Save As in native 1.4.0. Extended native checks remain pending.

Prior user feedback confirms the installed appearance opens and Web View is dark.
Isolated real-engine tests confirm relative gutters and a counted `5j` motion.
Neither proves all commands in native RunJS. Prompt interaction, Ctrl delivery,
clipboard/cross-tab persistence, Unicode/IME, wrapped motions and broader
undo/repeat cases remain explicit follow-up work.

## Safety Boundary

Source tests and builds do not modify or reinstall the app. Installation needs
explicit user authorization and closed RunJS, followed by the
[host acceptance checklist](host-commands.md#native-acceptance-checklist).
No native save/close claim should be marked verified before that check.

The [roadmap](roadmap.md) prioritizes follow-up without promising full Neovim.

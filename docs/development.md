# Development and Validation

## Layout and Architecture

- `patches/runjs-4.1.0/`: additive bootstrap, HUD, relative gutters and optional styles.
- `bridge-host/` inside it: Ex policy, native Save observation, generation tracking,
  renderer discovery and main-process host actions; see [host commands](host-commands.md).
- `runjs-relative-lines.js` in that directory: optional per-editor gutter formatter.
- `scripts/`: thin CLI entry points, plus reproducible private audit preparation.
- `scripts/runjs_bridge/`: `archive.py` owns parsing/packing/integrity;
  `composition.py` owns assets/HTML/version pins; `build.py` owns orchestration;
  `backup.py`, `install.py` and `restore.py` own their respective lifecycle stages.
  Backup copies include these modules so restore does not depend on the checkout.
- `tests/`: synthetic app safety tests and simulated editor/DOM HUD tests.
- `docs/`: installation, compatibility targets, and future work.
- `AGENTS.md`: project conventions. README.md stays an entry point.

The renderer discovers `.editor .CodeMirror` instances, subscribes to mode/focus/
keymap events, and shows the active tab's mode. A lightweight scan detects new
tabs and releases removed editors. The HUD does not read exercises, alter mappings, or send network requests.
The separate host adapter uses generations for dirty state and reads existing
editor/tab metadata as needed; it never logs content or records keystrokes. CSS reserves 30 pixels below the app for the HUD.

The builder resolves app/asset paths at runtime, appends changed virtual files,
preserves original packed bytes, and updates the ASAR header hash in the plist.
The installer verifies hashes, backs up the app, and signs only that local copy.
Backup hashes and source-app hashes are rechecked after backup, before writes.
The restorer verifies original files and, for current installs, rejects later
app changes. See [installation](installation.md) for exact destinations.

## Checks

From the project root, with Python 3.10+ and Node.js 18+:

```sh
rtk python3 -m unittest discover -s tests -v
rtk proxy node --test tests/*.cjs
rtk proxy node --check patches/runjs-4.1.0/runjs-vim-mode.js
```

RTK is a contributor workflow, not an end-user dependency. Plain commands appear
in the README. No dependencies need downloading for these tests.

| Layer | Proves | Does not prove |
| --- | --- | --- |
| Python synthetic apps | ASAR construction, integrity, refusal paths, restore | Real signing, launch, UI |
| Public documentation guards | Short README, valid relative links, no machine-specific locations | Completeness of instructions or distribution rights |
| Node simulated editor/DOM | English HUD, events, tab lifecycle, cleanup | Vim semantics, real layout, native key delivery |
| Node simulated Electron | Scoped native actions, close tickets, sender rejection, bootstrap and appearance | Actual dialogs, persistence, licensing UI or vibrancy rendering |
| Node synthetic save tracker/policy | Callback wait, cancel/error/races, dirty generations, forced scopes, cleanup | Actual native file save/quit |
| Real-engine host parser audit | 32 command/alias/argument flows against the actual parser with synthetic host | Native persistence, dialogs or OS key delivery |
| Real-engine command audit | Representative bundled-engine text/cursor/mode outcomes vs clean Neovim | OS/menu routing, full parity or file operations |
| Native manual checks | Actual focus, layout, menus, startup | All commands or versions |

The earlier prototype passed local engine checks and native startup. That history
does not verify newly edited sources or establish complete compatibility. No
extracted RunJS code belongs in this project.

Record fixtures/versions before calling shortcuts compatible. Keep renderer and
build-manifest patch versions consistent. Never modify the installed app during
source tests. No native Neovim bridge or new configuration framework is planned.

The optional [appearance profile](appearance.md) uses our own package bootstrap
without changing bundled JS. Upgrades replace recognized bridge assets and
deduplicate references; native-profile builds remove appearance without disabling
host commands. Only `--no-host-commands` explicitly omits the host adapters.
Optional [relative numbers](relative-lines.md) use the native formatter and editor
events. Test cursor/head movement, doc swaps, cleanup, width growth, and native
line-number visibility without modifying exercise text or keymaps.

The [command audit](command-audit.md) has a separate preparation/reproduction
workflow. Normal Python/Node tests guard its checked evidence and tool safety;
they do not automatically rerun a browser or clean Neovim. The real audit uses
only synthetic text and records a pinned editor fingerprint and reference version.

## Publication Review

Use English [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
for local history, with coherent behavior changes and their related tests/docs.
Examples: `feat(ex): add native save and quit commands`,
`fix(gutter): preserve width near end of buffer`,
`refactor(tooling): separate archive and installation responsibilities`.
Inspect the staged file list/diff and run relevant checks before committing.
A first import is one truthful baseline; do not fabricate historical commits.
Local commits do not authorize creating a remote, choosing a license or publishing.

Resolve RunJS permissions and choose a license for our code before release.
Inspect every file to be published, even if Git has not been initialized. Exclude
app archives, backups, local manifests, bundles, preferences, logs, and exercises.
Use relative examples/user-supplied locations, not one person's installation.
Do not infer distribution rights from a public repository or educational intent.

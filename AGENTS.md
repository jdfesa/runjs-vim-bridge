# Project Conventions

## Primary Goal

- Bring most default Neovim editing shortcuts into RunJS for JS/TS exercises.
- Preserve RunJS's execution, preview, and sandbox workflow; do not duplicate them.
- No native Neovim integration, extra runtime, or new configuration burden.
- Reuse the bundled CodeMirror Vim engine and repair confirmed compatibility gaps.

## Portability

- Never commit usernames, developer-machine paths, or personal backup locations.
- Use project-relative examples and derive paths in code. Users supply their app
  location; do not assume an install folder or checkout location.
- Resolve machine-specific paths only at runtime. Generated build/backup manifests
  may contain resolved local paths and must remain excluded from publication.
- Do not commit RunJS binaries, extracted bundles, ASAR files, ZIPs, exercises,
  preferences, logs, or private backups. Audit files, not just ignore rules.

## Language and Documentation

- Write UI, tooltips, CLI help/errors, settings labels, comments, and project
  documentation in English. Conversation can follow the user's language.
- Keep README.md short; put installation, rollback, architecture, and plans in docs/.
- Explain where patch files go and how users apply and restore them themselves.
- Clearly separate implemented, verified, and planned behavior.
- Update this file as project conventions evolve.

## Appearance

- Keep visual profiles opt-in and portable; never read Kitty config at runtime.
- Preserve opaque text and apply alpha to backgrounds, not the whole window.
- Web View defaults must be lower priority than exercise-authored CSS/inline styles.
- Do not alter runtime security, preload, Node access, or navigation guards for styling.
- Add our own bootstrap/assets rather than rewriting original minified bundles.
- Relative numbers are opt-in, use the buffer cursor per editor, respect native
  line-number visibility, and restore the previous formatter on cleanup. Do not
  present this practice aid as an enabled-by-default Neovim setting.

## Keybinding Policy

- Default Neovim behavior is the reference, not a plugin distribution or personal
  setup. Prioritize motions, operators, counts, objects, registers, repeat, and undo.
- Do not invent Leader schemes, silently remap familiar keys, or call plugin
  behavior a default. Optional training aids must be labeled and opt-in.
- Audit RunJS/Electron/macOS shortcut interception before adding key handlers.
- Scope fixes to the active code editor, not settings, dialogs, search inputs,
  or output controls. Never capture keys globally to simulate Vim.
- Do not add a configuration framework just to introduce compatibility fixes.
- Document unsupported commands honestly; do not promise full Neovim parity.
- Keep docs/keybindings.md canonical for command meanings, origin and evidence.
  Separate exact engine results, semantic differences, unverified native routing
  and missing host operations. A fixture count is not full command coverage.
- Never treat an accepted Ex command or lack of an error as proof of disk saving.
  Save/quit integration must preserve native cancellation and unsaved-change safety.

## Module Boundaries

- Keep CLI entry points thin. Group Python code under scripts/runjs_bridge by
  archive, asset composition, build, backup, installation and restoration.
- Group renderer/main host adapters under bridge-host by command policy, native
  Save observation, save-generation tracking, editor discovery and IPC lifecycle.
- Do not split only to meet a line count: each module must have one coherent job.
- Backups must include the modules needed to restore independently of a moved or
  deleted checkout. Test that relocated recovery path.
- Bind host commands through the bundled Vim API, not global keyboard listeners.
  Keep one-tab close distinct from app quit and preserve native session recovery.
- Pin both native bundle hashes before including version-specific host adapters.
  Scope temporary native-method observation synchronously and restore in finally.
- Native unsaved flags are not write-completion signals. Wait for the actual write
  callback, reject ambiguous/concurrent saves and retain dirty edits after a write.

## Commit Workflow

- Use English Conventional Commits: type(scope): imperative summary. Scope is
  optional; choose feat, fix, refactor, test, docs or chore to match the change.
- Keep each commit coherent and reviewable, including related tests and docs.
  Do not combine unrelated behavior, visual changes and maintenance work.
- Run the relevant checks before committing. Inspect the staged diff and file
  list, not just ignore rules; never commit generated app assets or private data.
- An initial repository import is a truthful baseline, not a fabricated sequence
  of historical feature implementations. Subsequent work uses incremental commits.
- Do not create a remote, push, rewrite shared history or publish without explicit
  authorization. Do not change the user's Git identity automatically.

## Safety and Validation

- Support RunJS 4.1.0 only until other versions have explicit fixtures/checks.
- Keep patches additive and reversible; preserve untouched original bytes.
- Verify builds and backups before writing; refuse stale builds and changed apps.
- Do not reinstall, sign, launch, or modify the user's installed app during ordinary
  source work. Installation requires an explicit user request.
- Never log exercise content, capture keystrokes, or add network telemetry.
- Prefix development shell commands with `rtk`; use `rtk proxy` for unsupported
  commands. RTK is not an end-user installation dependency.
- Run Python safety tests, Node renderer tests, and JavaScript syntax checks.
- Simulated editor tests prove HUD behavior, not Vim semantics or native routing.
- Verify shortcuts against the pinned bundled engine; routing changes also need
  a native RunJS check. Record versions, fixtures, and limitations.
- Keep extracted audit modules outside the checkout. Check the pinned bundle
  fingerprint, use synthetic text and clean Neovim, and publish only our fixtures
  and outcome data, never extracted code or native stylesheet assets.
- Do not publish, create a remote, choose a license, or redistribute app assets
  without explicit authorization and permissions review.

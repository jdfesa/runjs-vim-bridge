# RunJS Vim Bridge

**An experimental, unofficial learning bridge from RunJS to Neovim.**

The main goal is to bring **most default Neovim editing shortcuts into RunJS**,
while keeping its JavaScript/TypeScript execution, preview, and sandbox workflow.
Practice transferable modal editing without another layer of editor configuration.
This is not a native Neovim integration or a replacement for RunJS's features.

## Status

- Target: **RunJS 4.1.0 on macOS**; other versions/platforms are unsupported.
- Patch 1.4.0 source: native save/quit adapters, English HUD and optional visuals.
- Editing engine: RunJS's bundled CodeMirror Vim emulation, **not Neovim**.
- Default `:w`, `:q[!]`, `:wq`, `:x`, `ZZ`/`ZQ` and all-tab variants.
- Core native save/quit checks passed by user report; extended acceptance remains pending.
- Local proof of concept; publication and the license for our code are pending.

## Get Started

1. Follow the [installation and rollback guide](docs/installation.md).
2. Enable **Vim Keys** in RunJS's editor settings.
3. Try `i` to insert text and `<Esc>` to return to Normal mode.
4. Review the [keybinding targets and verification status](docs/keybindings.md).

Supply your own app location when building. Nothing depends on the author's
username, checkout directory, or installed app path. Do not copy patch assets
into the app's Resources directory as loose files.

## Documentation

- [Installation](docs/installation.md): prerequisites, destinations, backups, restore.
- [Keybindings](docs/keybindings.md): default-Neovim targets versus verified behavior.
- [Host commands](docs/host-commands.md): save/quit semantics, safety and acceptance.
- [Patch scope](docs/patch-scope.md): what we add, preserve, and do not implement.
- [Command audit](docs/command-audit.md): reproducible evidence and known gaps.
- [Roadmap](docs/roadmap.md): prioritized compatibility improvements.
- [Appearance](docs/appearance.md): dark Web View and background translucency.
- [Relative numbers](docs/relative-lines.md): counted-motion practice aid.
- [Development](docs/development.md): architecture, tests, validation limits.
- [Project conventions](AGENTS.md): portability, English text, safe changes.

## Validate

From the project root, with Python 3.10+ and Node.js 18+:

```sh
python3 -m unittest discover -s tests -v
node --test tests/*.cjs
node --check patches/runjs-4.1.0/runjs-vim-mode.js
```

Tests use synthetic app files and a simulated editor. They do not modify RunJS
or establish full native keybinding compatibility.

## Distribution

Only our patch sources and tools belong here, not RunJS, its bundles, or backups.
This project is not affiliated with RunJS or Neovim. Review the
[RunJS EULA](https://runjs.app/eula) and resolve modification/distribution
permissions before publishing; educational purpose alone does not grant permission.
Choose a license for our code before release. Never publish app copies, generated
archives, local manifests, or backups.

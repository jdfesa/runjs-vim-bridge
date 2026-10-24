# RunJS Vim Bridge

[![CI](https://github.com/jdfesa/runjs-vim-bridge/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jdfesa/runjs-vim-bridge/actions/workflows/ci.yml)

**An educational proof of concept for personal Neovim practice inside RunJS.**

The main goal is to bring **most default Neovim editing shortcuts into RunJS**,
while keeping its JavaScript/TypeScript execution, preview, and sandbox workflow.
Practice transferable modal editing without another layer of editor configuration.
This is not a native Neovim integration or a replacement for RunJS's features.

## Status

- Verified app target: **RunJS 4.1.0 on macOS**.
- Native RunJS integration on Linux and Windows has not been tested yet.
- Patch 1.4.0 source: native save/quit adapters, English HUD and optional visuals.
- Editing engine: RunJS's bundled CodeMirror Vim emulation, **not Neovim**.
- Default `:w`, `:q[!]`, `:wq`, `:x`, `ZZ`/`ZQ` and all-tab variants.
- Core native save/quit checks passed by user report; extended acceptance remains pending.
- Experimental learning project, not a supported RunJS extension or full Neovim runtime.

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
- [Appearance](docs/appearance.md): Mint Dark, dark Web View and translucency.
- [Relative numbers](docs/relative-lines.md): counted-motion practice aid.
- [Development](docs/development.md): architecture, tests, validation limits.
- [Project conventions](AGENTS.md): portability, English text, safe changes.

## Validate

From the project root, with Python 3.10+ and Node.js 22+ (including npm):

```sh
npm test
```

No npm dependencies are required. This runs Python tests, Node tests and JavaScript
syntax checks using synthetic fixtures; it does not modify RunJS or prove native parity.

## Project Scope

This repository contains our bridge sources, tools, documentation, and synthetic
test fixtures. It does not include RunJS, extracted bundles, app copies, or backups.
The project is unofficial and is not affiliated with RunJS or Neovim.

If you choose to try this experimental patch, you are responsible for your own
installation and backups. Use disposable exercises first and review the documented
version-specific limitations before relying on it for personal practice.

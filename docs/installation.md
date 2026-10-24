# Installation and Rollback

## Requirements

Experimental support: **RunJS 4.1.0 on macOS only**. Review the
[RunJS EULA](https://runjs.app/eula) and resolve the relevant permissions before
modifying or distributing anything. No app binaries are supplied here.

You need Python 3.10+, your own RunJS installation, write access to that app,
space for a full backup, and macOS tools `codesign`, `ditto`, `unzip`, and `pgrep`.
Node.js 22+ (including npm) is needed only for development tests.

Run these commands **from the project root**, wherever you placed it. Enter your
own paths at the prompts, without surrounding quotes. Arguments are quoted below
so spaces in paths are supported. Do not reuse someone else's backup paths.

## 1. Choose Your App and Build

Locate an **unpatched** RunJS 4.1.0 app bundle in Finder, copy its pathname,
and enter it here:

```sh
printf 'Path to your unpatched RunJS.app: '
IFS= read -r RUNJS_APP
python3 scripts/build-patch.py --app "$RUNJS_APP"
```

The app argument is required; no system install path is assumed. The builder
only reads that app and writes `build/` in this checkout:

```text
build/
├── app.patched.asar
├── Info.patched.plist
└── manifest.json
```

For another output directory, pass `--output` with your directory, then use that
same directory with the installer's `--build-dir` option.

To include the optional dark/translucent profile and dark Web View defaults:

```sh
python3 scripts/build-patch.py --app "$RUNJS_APP" --appearance kitty
```

See [appearance](appearance.md) for its palette, behavior, and limitations.

Add `--relative-lines` for [relative numbering](relative-lines.md); native Line
Numbers visibility remains user-controlled. Repeat desired optional flags on
every build, including upgrades.

Host commands are included by default and require the pinned native bundle
fingerprints, not just a matching version label. Use `--no-host-commands` only
for a feedback/visuals-only build. See [host commands](host-commands.md) for limits
and the required native acceptance checklist.

The builder rejects other versions, inconsistent ASAR header integrity,
unexpected HTML, and already-patched apps unless `--upgrade` is explicit. Unchanged packed files are checked
byte for byte. Preexisting internal integrity mismatches are reported and
preserved, not silently repaired.

## 2. Install with a Backup

Save your work and **quit RunJS completely**, then run:

```sh
python3 scripts/install-patch.py
```

For a custom build directory:

```sh
printf 'Path to your build directory: '
IFS= read -r BUILD_DIR
python3 scripts/install-patch.py --build-dir "$BUILD_DIR"
```

The manifest identifies the app selected during the build. Do not move or modify
it between build and install. The installer checks app and artifact hashes,
creates and ZIP-tests a full backup, installs the artifacts, and verifies local
ad-hoc signing. If installation or signing fails, it attempts rollback.

Backups use the current user's home:
`$HOME/.local/share/runjs-vim-bridge/backups/runjs-4.1.0-<unique-id>/`.
**Keep the exact `backup_directory` printed by the installer.** It contains
`runjs-original.zip`, verified `original-files/`, a private manifest, and a
`restore-runjs.py` plus its portable `runjs_bridge/` Python modules. Keep
that directory together with the script. Do not publish or discard it.

Generated manifests intentionally record your resolved app/backup locations.
They are local recovery data, not portable configuration or repository content.

## Where the Patch Goes

These destinations are **relative to the app bundle you selected**, not fixed
locations on your disk:

| Source or action | Destination inside your app bundle |
| --- | --- |
| `patches/runjs-4.1.0/runjs-vim-mode.js` | Virtual `runjs-vim-mode.js` inside `Contents/Resources/app.asar` |
| `patches/runjs-4.1.0/runjs-vim-mode.css` | Virtual `runjs-vim-mode.css` inside the same ASAR |
| Builder adds asset references | Virtual `index.html` inside the same ASAR |
| Default host commands | Virtual `runjs-ex-commands.js`, `bridge-host/*.cjs`, main bootstrap and its `package.json` metadata inside the ASAR |
| Optional appearance profile | Virtual `preview.html`, `runjs-appearance-main.cjs`, `runjs-appearance.css`, `runjs-preview-defaults.css` inside the ASAR |
| Optional relative numbers | Virtual `runjs-relative-lines.js` and its reference in `index.html` |
| Builder updates the ASAR header hash | `Contents/Info.plist` |
| Installer signs the modified app | `Contents/MacOS/RunJS` and `Contents/_CodeSignature/CodeResources` |

`app.asar` is an archive, **not a normal folder**. Do not copy JS/CSS into
Resources as loose files or edit the original minified bundles. The builder
adds the stylesheet before `</head>` and the script before `</body>` in the
original HTML read from your app. That HTML is not distributed here.

Host commands or the appearance profile select our small package bootstrap,
which runs the original `entry-bundle.js` unchanged. Appearance adds a low-priority
stylesheet to the preview head; no runtime bundle or preload is rewritten.

Only four real files are replaced or affected by signing: the ASAR, plist,
executable, and CodeResources listed above. System-wide protections remain
unchanged. The modified outer signature is local ad-hoc, not the distributor's.

## 3. Enable and Check

Open RunJS and enable **Vim Keys** under **Settings → Editor**. Focus the code
editor and check `NORMAL`, `i` → `INSERT`, and `<Esc>` → `NORMAL`. The Insert
hint should read **Type text · Esc: Normal**. Check a second tab too.
With Vim Keys disabled, the indicator reads `VIM OFF`.

The patch translates its own text to English; it does not rewrite native
settings, change the application's locale, or enable Vim Keys automatically.
With `--appearance kitty`, also check the editor backdrop, an empty Web View,
and an exercise that explicitly defines its own background/text colors.

## Restore or Update

Quit RunJS and enter the exact backup directory printed during installation:

```sh
printf 'Path to your backup directory: '
IFS= read -r BACKUP_DIR
python3 scripts/restore-runjs.py "$BACKUP_DIR"
```

Alternatively run the `restore-runjs.py` **saved inside that backup** without
arguments. The current installer records patched file hashes: restore refuses
later app changes and verifies original hashes before writing. Do not edit the
manifest to bypass a refusal.

For a recognized bridge 1.0.0 through 1.4.0 installation, an explicit upgrade
can replace our assets without stacking HTML references:

```sh
python3 scripts/build-patch.py --app "$RUNJS_APP" --upgrade --appearance kitty
```

Add `--relative-lines` if desired; repeat every optional flag you want to keep.
Install normally afterward and complete the disposable-exercise
[host acceptance checks](host-commands.md#native-acceptance-checklist). A new full backup captures the **pre-upgrade state**,
which may already contain an older bridge. Keep earlier backups if you also want
to restore the original distributor installation. Unknown/custom patches are
not supported; restore using their matching script/backup first. Never borrow
another installation's backup. Legacy backups may have different checks.

Updates/reinstalls may remove the patch. Never restore an old backup over a
newer app. Check support first: versions other than 4.1.0 are currently rejected.
If rollback fails, stop, keep the backup, and recover from a trusted original app.

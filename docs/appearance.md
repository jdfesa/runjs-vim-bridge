# Mint Dark Appearance

An optional built-in profile, selected at build time with `--appearance mint`.
Mint Dark is a self-contained black/mint/amber palette. No external theme,
terminal configuration import, or new settings framework is required. The default build keeps native RunJS appearance unchanged.

## Palette and Translucency

- Black background: `#000000`.
- Mint foreground: `#d8ffd8`; green accent: `#00e65c`.
- Amber keywords/active-tab accent: `#ff9d00`.
- Background alpha: `0.85`. Text and the window's overall opacity remain `1`.
- macOS uses native `under-window` vibrancy, not a whole-window fade.

The profile uses Electron background and vibrancy APIs. Native blur/material
appearance depends on macOS, accessibility settings, wallpaper, overlapping
windows and window composition. Separate native preview windows can composite
differently from the editor backdrop.

## Web View Defaults

The optional profile adds dark background/mint text and `color-scheme: dark`
inside a low-priority CSS layer. It survives replacing `document.body.innerHTML`
because the stylesheet lives in the preview head. It does not change exercises,
add a placeholder, or set inline styles on user-created elements.

Regular exercise CSS and inline styles take priority. For example, this remains
an intentionally light exercise:

```js
document.body.style.background = 'white';
document.body.style.color = 'black';
document.body.innerHTML = '<h1>My own page styles</h1>';
```

Explicit document replacement, deleting the stylesheet, or exercise-authored
styles may remove/override these defaults by design. A bare Web View still has
no visible content until the exercise renders something.

## Implementation and Recovery

Our package bootstrap registers styling hooks before delegating to RunJS's
original entry bundle. Only exact local app/preview URLs are eligible. Settings
windows, unrelated files, external pages, and subframe navigation are untouched.
The original bundled JS and sandbox/preload/navigation security stay unchanged.

The profile overlays the editor's native theme; it does not rewrite the saved
theme/font preferences. A built-in theme change may therefore not visibly replace
the overlay. To remove it, restore the matching pre-install backup, or rebuild
with `--upgrade --appearance native` and install with a fresh backup.

Use the [installation guide](installation.md). Upgrading makes a new backup of
the current installation, not necessarily the pristine distributor app.

## Validation Limits

Synthetic tests cover package delegation, local-window scoping, fallbacks,
upgrades, integrity, and rollback checks. Browser QA with the installed native
stylesheet verifies dark defaults, opaque text, and authored CSS precedence.
That does not prove exact macOS blur/transparency or every native overlay/menu.
Confirm those visually in RunJS after installation.

# Screenshots and Recordings

Use the real RunJS window, not a mockup or the synthetic test/audit harness.
The goal is to show the editor, native execution results and bridge HUD together.

## Prepare the Demo

1. Use a disposable RunJS tab with **Vim Keys** enabled. Save unrelated work first.
2. For the Mint Dark showcase, use an existing build with the optional
   [appearance profile](appearance.md) and [relative numbers](relative-lines.md).
   Do not change personal preferences or reinstall the app just for a capture.
3. Paste [readme-demo.js](../examples/readme-demo.js) into that tab and let it run.
   It needs no dependencies, filesystem access, network or Web View.
4. The result is three lessons and a summary: `completed: 1`, `remaining: 2`,
   `minutes: 35`. The assertions should not report any failures.
5. Keep the editor, gutter, results and full HUD readable. Dismiss menus, search,
   dialogs and notifications; leave enough room to see the whole exercise.

## Capture NORMAL and INSERT

1. Focus the editor, press `<Esc>`, then type `16G`. The cursor should be on
   `minutes,`, showing the current absolute line and relative distances around it.
2. Capture **NORMAL** with the live HUD visible.
3. Press `i` without changing any text and capture **INSERT** in the same frame.
4. Press `<Esc>` to finish. Keep the original PNGs; do not recreate HUD labels,
   recolor the screenshot or overlay line numbers to imply app behavior.

Capture only the app window with a neutral, non-private desktop behind it if
translucency is visible. Check tabs, title bars, output and notifications for
personal paths, filenames, account details or unrelated code before sharing.
Recapture with clean content rather than publishing private information.

## Optional Short Recording

An 8–12 second clip can show actual transitions more clearly than extra images:
start in Normal mode, use `3j` and `3k`, move to a word, use `ciw`, type a
replacement, press `<Esc>`, then `u` to restore it. End with the unchanged demo.
Avoid save/quit commands or destructive edits during the recording. Do not use
a synthetic recording as evidence that native key routing has been verified.

## Publish in the README

After privacy review, place genuine app captures in `docs/images/`, for example
`normal-mode.png` and `insert-mode.png`. Use project-relative image links and
descriptive alt text. Put the Normal-mode image near the README introduction;
keep a second image or recording only if it adds useful information.

Caption the actual RunJS/bridge versions, platform and enabled optional visuals
shown in the capture. A screenshot documents appearance and the demonstrated
state; it does not prove all keybindings or other platforms work. Do not add
links until the image files exist, and never include original app assets,
exercise files or private backup data as part of a media contribution.

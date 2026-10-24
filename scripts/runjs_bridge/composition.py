"""Compose owned assets without rewriting original bundles."""

import json
from pathlib import Path
import re

from .archive import content, digest

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'patches/runjs-4.1.0'
PATCH_VERSION = '1.4.0'
PINNED_BUNDLES = {
    'index-bundle.js': '469ba2be820babe8b76c490209def8e09de0d3b479770b6064cd210d34054243',
    'entry-bundle.js': '1eb4093f3dfbcc3b7efb567a839bac52057a031b87c7c198934c2190c1fc4fa5',
}


def normalize_appearance(value):
    """Keep earlier build commands usable without advertising old profile names."""
    return 'mint' if value == 'kitty' else value


def remove_reference(html, reference):
    if html.count(reference) > 1:
        raise SystemExit('Duplicate bridge asset reference; refusing to build.')
    return html.replace(reference, '')


def compose(original_entries, payload, args):
    html = content(payload, original_entries['index.html']).decode()
    previous_patch = None
    if 'runjs-vim-mode' in html:
        if not args.upgrade:
            raise SystemExit('This installation already contains the patch. Restore the original or use --upgrade.')
        if 'runjs-vim-mode.js' not in original_entries:
            raise SystemExit('Unrecognized existing bridge patch; refusing to upgrade.')
        prior_source = content(payload, original_entries['runjs-vim-mode.js']).decode()
        version = re.search(r"version: '(1\.[01234]\.0)'", prior_source)
        if not version or '__runjsVimModePatch' not in prior_source:
            raise SystemExit('Unrecognized existing bridge patch; refusing to upgrade.')
        previous_patch = version.group(1)
    elif args.upgrade:
        raise SystemExit('--upgrade requires an existing recognized bridge patch.')
    for reference in [
        '<link rel="stylesheet" href="./runjs-vim-mode.css">',
        '<script src="./runjs-vim-mode.js"></script>',
        '<link rel="stylesheet" href="./runjs-appearance.css">',
        '<script src="./runjs-relative-lines.js"></script>',
        '<script src="./runjs-ex-commands.js"></script>',
    ]:
        html = remove_reference(html, reference)
    if html.count('</head>') != 1 or html.count('</body>') != 1:
        raise SystemExit('Unexpected index.html structure; refusing to build the patch.')
    html = html.replace('</head>', '<link rel="stylesheet" href="./runjs-vim-mode.css"></head>')
    if args.appearance == 'mint':
        html = html.replace('</head>', '<link rel="stylesheet" href="./runjs-appearance.css"></head>')
    html = html.replace('</body>', '<script src="./runjs-vim-mode.js"></script></body>')
    if args.relative_lines:
        html = html.replace('</body>', '<script src="./runjs-relative-lines.js"></script></body>')
    additions = {
        'index.html': html.encode(),
        'runjs-vim-mode.js': (ASSETS / 'runjs-vim-mode.js').read_bytes(),
        'runjs-vim-mode.css': (ASSETS / 'runjs-vim-mode.css').read_bytes(),
    }
    if args.relative_lines:
        additions['runjs-relative-lines.js'] = (ASSETS / 'runjs-relative-lines.js').read_bytes()
    if args.host_commands:
        for name, expected in PINNED_BUNDLES.items():
            if digest(content(payload, original_entries[name])) != expected:
                raise SystemExit('Unsupported native bundle fingerprint: ' + name)
        html = html.replace('</body>', '<script src="./runjs-ex-commands.js"></script></body>')
        additions['index.html'] = html.encode()
        for source in sorted((ASSETS / 'bridge-host').glob('*.cjs')):
            additions['bridge-host/' + source.name] = source.read_bytes()
        additions['runjs-ex-commands.js'] = (ASSETS / 'runjs-ex-commands.js').read_bytes()
    if args.host_commands or args.appearance == 'mint' or 'runjs-bridge-main.cjs' in original_entries:
        if not all(name in original_entries for name in ['package.json', 'preview.html']):
            raise SystemExit('Missing package.json or preview.html; refusing appearance patch.')
        package = json.loads(content(payload, original_entries['package.json']))
        if package.get('main') == 'runjs-bridge-main.cjs':
            metadata = package.get('runjsVimBridge', {})
            if not args.upgrade or metadata.get('originalMain') != 'entry-bundle.js':
                raise SystemExit('Unrecognized bridge bootstrap; refusing to replace it.')
            package['main'] = 'entry-bundle.js'
            package.pop('runjsVimBridge', None)
        if package.get('name') != 'runjs' or package.get('version') != '4.1.0' or package.get('main') != 'entry-bundle.js':
            raise SystemExit('Unexpected RunJS package entry point; refusing appearance patch.')
        preview = content(payload, original_entries['preview.html']).decode()
        preview = remove_reference(preview, '<link rel="stylesheet" href="./runjs-preview-defaults.css">')
        if preview.count('</head>') != 1:
            raise SystemExit('Unexpected preview.html structure; refusing appearance patch.')
        if args.host_commands or args.appearance == 'mint':
            package['main'] = 'runjs-bridge-main.cjs'
            package['runjsVimBridge'] = {
                'originalMain': 'entry-bundle.js', 'patchVersion': PATCH_VERSION, 'appearance': args.appearance,
                'hostCommands': args.host_commands,
            }
            additions['runjs-bridge-main.cjs'] = (ASSETS / 'runjs-bridge-main.cjs').read_bytes()
        if args.appearance == 'mint':
            preview = preview.replace('</head>', '<link rel="stylesheet" href="./runjs-preview-defaults.css"></head>')
            for name in ['runjs-appearance-main.cjs', 'runjs-appearance.css', 'runjs-preview-defaults.css']:
                additions[name] = (ASSETS / name).read_bytes()
        additions['package.json'] = (json.dumps(package, indent=2) + '\n').encode()
        additions['preview.html'] = preview.encode()
    return additions, previous_patch

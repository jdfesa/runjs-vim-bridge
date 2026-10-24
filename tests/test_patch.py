"""Patch Safety Tests

Use synthetic files: these tests do not read or modify the installed app.
"""

import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load_script(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), ROOT / 'scripts' / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def pack(files, stale_entry=False):
    header = {'files': {}}
    payload = bytearray()
    for name, data in files.items():
        value = digest(data)
        header['files'][name] = {
            'size': len(data), 'offset': str(len(payload)),
            'integrity': {'algorithm': 'SHA256', 'hash': value,
                          'blockSize': 4096, 'blocks': [value]},
        }
        payload.extend(data)
    if stale_entry:
        header['files']['entry-bundle.js']['integrity']['hash'] = '0' * 64
    raw = json.dumps(header, separators=(',', ':')).encode()
    padding = b'\0' * (-(len(raw) + 4) % 4)
    inner = struct.pack('<II', len(raw) + len(padding) + 4, len(raw)) + raw + padding
    return struct.pack('<II', 4, len(inner)) + inner + payload, digest(raw)


def unpack(data):
    _, header_size, _, string_size = struct.unpack('<4I', data[:16])
    raw = data[16:16 + string_size]
    header = json.loads(raw)
    payload = data[8 + header_size:]
    files = {name: payload[int(entry['offset']):int(entry['offset']) + entry['size']]
             for name, entry in header['files'].items()}
    return header, raw, files


class PatchTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='runjs-bridge-test-')
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.app = self.base / 'RunJS.app'
        self.output = self.base / 'build'
        self.files = {
            'index.html': b'<html><head></head><body><script src="index-bundle.js"></script></body></html>',
            'index-bundle.js': b'console.log("Synthetic editor fixture");',
            'entry-bundle.js': b'console.log("Synthetic startup fixture");',
            'package.json': b'{"name":"runjs","version":"4.1.0","main":"entry-bundle.js"}',
            'preview.html': b'<html><head></head><body><div id="root"></div></body></html>',
        }
        self.make_app()

    def make_app(self, version='4.1.0', stale_entry=False):
        archive, header_hash = pack(self.files, stale_entry=stale_entry)
        paths = {
            'Contents/Resources/app.asar': archive,
            'Contents/MacOS/RunJS': b'SYNTHETIC_EXECUTABLE',
            'Contents/_CodeSignature/CodeResources': b'SYNTHETIC_SIGNATURE',
            'Contents/Info.plist': plistlib.dumps({
                'CFBundleShortVersionString': version,
                'ElectronAsarIntegrity': {'Resources/app.asar': {
                    'algorithm': 'SHA256', 'hash': header_hash,
                }},
            }),
        }
        for name, data in paths.items():
            target = self.app / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)

    def build(self, *options):
        return subprocess.run([
            sys.executable, str(ROOT / 'scripts/build-patch.py'),
            '--app', str(self.app), '--output', str(self.output), '--no-host-commands', *options,
        ], capture_output=True, text=True)

    def successful_build(self, *options):
        result = self.build(*options)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads((self.output / 'manifest.json').read_text())

    def test_additive_build_and_integrity_without_app_changes(self):
        manifest = self.successful_build()
        for relative, expected in manifest['original_hashes'].items():
            self.assertEqual(digest((self.app / relative).read_bytes()), expected)
        archive = (self.output / 'app.patched.asar').read_bytes()
        header, raw, files = unpack(archive)
        self.assertEqual(files['index-bundle.js'], self.files['index-bundle.js'])
        self.assertEqual(files['entry-bundle.js'], self.files['entry-bundle.js'])
        self.assertIn(b'./runjs-vim-mode.js', files['index.html'])
        self.assertIn(b'./runjs-vim-mode.css', files['index.html'])
        for name in ['runjs-vim-mode.js', 'runjs-vim-mode.css']:
            self.assertEqual(files[name], (ROOT / 'patches/runjs-4.1.0' / name).read_bytes())
            self.assertEqual(header['files'][name]['integrity']['hash'], digest(files[name]))
        info = plistlib.loads((self.output / 'Info.patched.plist').read_bytes())
        self.assertEqual(info['ElectronAsarIntegrity']['Resources/app.asar']['hash'], digest(raw))
        self.assertEqual(manifest['preexisting_integrity_mismatches_preserved'], [])
        self.assertEqual(digest((self.output / 'Info.patched.plist').read_bytes()), manifest['patched_info_hash'])

    def test_rejects_other_version(self):
        self.make_app(version='4.2.0')
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('only supports RunJS 4.1.0', result.stderr)

    def test_build_output_cannot_overlap_the_app(self):
        self.output = self.app / 'Contents/unsafe-build'
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('must not overlap', result.stderr)
        self.assertFalse(self.output.exists())

    def test_archive_bounds_are_checked_even_without_assertions(self):
        builder = load_script('build-patch.py')
        with self.assertRaisesRegex(ValueError, 'Truncated'):
            builder.parse_archive(b'bad')
        with self.assertRaisesRegex(ValueError, 'extent'):
            builder.content(b'x', {'offset': '-1', 'size': 1})
        with self.assertRaisesRegex(ValueError, 'Invalid ASAR header'):
            builder.parse_archive(struct.pack('<4I', 4, 999, 995, 1000))

    def test_build_requires_explicit_app_location(self):
        result = subprocess.run([
            sys.executable, str(ROOT / 'scripts/build-patch.py'),
        ], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('required: --app', result.stderr)

    def test_manifest_matches_renderer_patch_version(self):
        manifest = self.successful_build()
        source = (ROOT / 'patches/runjs-4.1.0/runjs-vim-mode.js').read_text()
        self.assertIn("version: '" + manifest['patch_version'] + "'", source)

    def test_mint_profile_preserves_original_bundles_and_runtime_security(self):
        manifest = self.successful_build('--appearance', 'mint')
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        for name in ['entry-bundle.js', 'index-bundle.js']:
            self.assertEqual(files[name], self.files[name])
        package = json.loads(files['package.json'])
        self.assertEqual(package['main'], 'runjs-bridge-main.cjs')
        self.assertEqual(package['runjsVimBridge']['originalMain'], 'entry-bundle.js')
        self.assertEqual(manifest['appearance'], 'mint')
        self.assertIn(b'./runjs-preview-defaults.css', files['preview.html'])
        self.assertIn(b'./runjs-appearance.css', files['index.html'])
        for name in ['runjs-bridge-main.cjs', 'runjs-appearance.css', 'runjs-preview-defaults.css']:
            self.assertEqual(files[name], (ROOT / 'patches/runjs-4.1.0' / name).read_bytes())
        self.assertIn(b'@layer runjs-bridge-defaults', files['runjs-preview-defaults.css'])
        self.assertNotIn(b'!important', files['runjs-preview-defaults.css'])
        self.assertNotIn(b'nodeIntegration:', files['runjs-bridge-main.cjs'])
        self.assertNotIn(b'sandbox:', files['runjs-bridge-main.cjs'])

    def test_legacy_appearance_option_normalizes_without_appearing_in_help(self):
        manifest = self.successful_build('--appearance', 'kitty')
        self.assertEqual(manifest['appearance'], 'mint')
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        self.assertEqual(json.loads(files['package.json'])['runjsVimBridge']['appearance'], 'mint')
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/build-patch.py'), '--help'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn('Mint Dark', result.stdout)
        self.assertNotIn('kitty', result.stdout)

    def test_upgrade_recognizes_legacy_appearance_metadata(self):
        self.successful_build('--appearance', 'mint')
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        package = json.loads(files['package.json'])
        package['runjsVimBridge']['appearance'] = 'kitty'
        files['package.json'] = json.dumps(package).encode()
        self.files = files
        self.make_app()
        manifest = self.successful_build('--upgrade', '--appearance', 'mint')
        self.assertEqual(manifest['appearance'], 'mint')
        _, _, upgraded = unpack((self.output / 'app.patched.asar').read_bytes())
        self.assertEqual(json.loads(upgraded['package.json'])['runjsVimBridge']['appearance'], 'mint')

    def apply_build_to_fixture(self):
        shutil.copy2(self.output / 'app.patched.asar', self.app / 'Contents/Resources/app.asar')
        shutil.copy2(self.output / 'Info.patched.plist', self.app / 'Contents/Info.plist')

    def test_upgrade_adds_profile_without_stacking_references(self):
        self.successful_build()
        self.apply_build_to_fixture()
        manifest = self.successful_build('--upgrade', '--appearance', 'mint')
        self.assertEqual(manifest['upgrade_from'], manifest['patch_version'])
        self.apply_build_to_fixture()
        self.successful_build('--upgrade', '--appearance', 'mint')
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        for reference in [b'./runjs-vim-mode.js', b'./runjs-vim-mode.css', b'./runjs-appearance.css']:
            self.assertEqual(files['index.html'].count(reference), 1)
        self.assertEqual(files['preview.html'].count(b'./runjs-preview-defaults.css'), 1)

    def test_profile_can_be_removed_without_changing_original_entry(self):
        self.successful_build('--appearance', 'mint')
        self.apply_build_to_fixture()
        self.successful_build('--upgrade', '--appearance', 'native')
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        self.assertEqual(json.loads(files['package.json'])['main'], 'entry-bundle.js')
        self.assertNotIn(b'runjs-appearance.css', files['index.html'])
        self.assertEqual(files['preview.html'], self.files['preview.html'])
        self.assertEqual(files['entry-bundle.js'], self.files['entry-bundle.js'])

    def test_upgrade_rejects_unpatched_app(self):
        result = self.build('--upgrade')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('requires an existing recognized bridge patch', result.stderr)

    def test_relative_lines_are_explicitly_opt_in(self):
        manifest = self.successful_build()
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        self.assertFalse(manifest['relative_line_numbers'])
        self.assertNotIn(b'runjs-relative-lines.js', files['index.html'])
        self.assertNotIn('runjs-relative-lines.js', files)

    def test_relative_lines_can_upgrade_with_mint_profile_without_stacking(self):
        self.successful_build('--appearance', 'mint')
        self.apply_build_to_fixture()
        for _ in range(2):
            manifest = self.successful_build('--upgrade', '--appearance', 'mint', '--relative-lines')
            self.apply_build_to_fixture()
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        self.assertTrue(manifest['relative_line_numbers'])
        self.assertEqual(manifest['appearance'], 'mint')
        self.assertEqual(files['index.html'].count(b'./runjs-relative-lines.js'), 1)
        self.assertEqual(files['runjs-relative-lines.js'],
                         (ROOT / 'patches/runjs-4.1.0/runjs-relative-lines.js').read_bytes())
        self.assertEqual(files['entry-bundle.js'], self.files['entry-bundle.js'])

    def test_relative_lines_can_be_removed_on_upgrade(self):
        self.successful_build('--relative-lines')
        self.apply_build_to_fixture()
        manifest = self.successful_build('--upgrade')
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        self.assertFalse(manifest['relative_line_numbers'])
        self.assertNotIn(b'./runjs-relative-lines.js', files['index.html'])

    def test_profile_rejects_unexpected_package_entry(self):
        self.files['package.json'] = b'{"name":"runjs","version":"4.1.0","main":"custom.js"}'
        self.make_app()
        result = self.build('--appearance', 'mint')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unexpected RunJS package entry point', result.stderr)

    def test_build_accepts_paths_with_spaces(self):
        target = self.base / 'custom app folder' / 'RunJS.app'
        target.parent.mkdir()
        shutil.move(self.app, target)
        self.app = target
        self.output = self.base / 'custom build folder'
        manifest = self.successful_build()
        self.assertEqual(Path(manifest['app']), target.resolve())

    def test_build_resolves_assets_after_checkout_move_and_from_another_cwd(self):
        checkout = self.base / 'moved checkout'
        shutil.copytree(ROOT / 'scripts', checkout / 'scripts')
        shutil.copytree(ROOT / 'patches', checkout / 'patches')
        result = subprocess.run([
            sys.executable, str(checkout / 'scripts/build-patch.py'),
            '--app', str(self.app), '--no-host-commands',
        ], cwd=self.base, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        _, _, files = unpack((checkout / 'build/app.patched.asar').read_bytes())
        self.assertEqual(files['runjs-vim-mode.js'],
                         (checkout / 'patches/runjs-4.1.0/runjs-vim-mode.js').read_bytes())

    def test_rejects_inconsistent_header(self):
        target = self.app / 'Contents/Info.plist'
        info = plistlib.loads(target.read_bytes())
        info['ElectronAsarIntegrity']['Resources/app.asar']['hash'] = '0' * 64
        target.write_bytes(plistlib.dumps(info))
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('ASAR header integrity mismatch', result.stderr)

    def test_rejects_already_patched_app(self):
        self.successful_build()
        shutil.copy2(self.output / 'app.patched.asar', self.app / 'Contents/Resources/app.asar')
        shutil.copy2(self.output / 'Info.patched.plist', self.app / 'Contents/Info.plist')
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('already contains the patch', result.stderr)

    def test_preserves_existing_integrity_mismatch(self):
        self.make_app(stale_entry=True)
        manifest = self.successful_build()
        self.assertEqual(manifest['preexisting_integrity_mismatches_preserved'], ['entry-bundle.js'])
        _, _, files = unpack((self.output / 'app.patched.asar').read_bytes())
        self.assertEqual(files['entry-bundle.js'], self.files['entry-bundle.js'])

    def test_rejects_unexpected_html(self):
        self.files['index.html'] = b'<html><body>No head section</body></html>'
        self.make_app()
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unexpected index.html structure', result.stderr)

    def make_backup(self):
        manifest = self.successful_build()
        backup = self.base / 'backup'
        for relative in manifest['original_hashes']:
            target = backup / 'original-files' / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(self.app / relative, target)
            (self.app / relative).write_bytes(b'SYNTHETIC_PATCHED_' + relative.encode())
        manifest['installed_hashes'] = {
            relative: digest((self.app / relative).read_bytes())
            for relative in manifest['original_hashes']
        }
        (backup / 'manifest.json').write_text(json.dumps(manifest))
        return backup, manifest

    def test_restore_uses_verified_originals(self):
        backup, manifest = self.make_backup()
        module = load_script('restore-runjs.py')
        with patch.object(sys, 'argv', ['restore-runjs.py', str(backup)]), \
             patch.object(module.subprocess, 'run', side_effect=[subprocess.CompletedProcess([], 1), subprocess.CompletedProcess([], 0)]) as run, \
             contextlib.redirect_stdout(io.StringIO()):
            module.main()
        for relative, expected in manifest['original_hashes'].items():
            self.assertEqual(digest((self.app / relative).read_bytes()), expected)
        self.assertEqual(run.call_args.args[0][0], 'codesign')

    def test_restore_refuses_later_app_changes(self):
        backup, manifest = self.make_backup()
        target = self.app / 'Contents/MacOS/RunJS'
        target.write_bytes(b'SYNTHETIC_LATER_CHANGE')
        module = load_script('restore-runjs.py')
        with patch.object(sys, 'argv', ['restore-runjs.py', str(backup)]), \
             patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)), \
             self.assertRaisesRegex(SystemExit, 'changed after patching'):
            module.main()
        self.assertEqual(target.read_bytes(), b'SYNTHETIC_LATER_CHANGE')

    def test_restore_refuses_corrupt_backup_before_writing(self):
        backup, manifest = self.make_backup()
        (backup / 'original-files/Contents/MacOS/RunJS').write_bytes(b'SYNTHETIC_BAD_BACKUP')
        before = {name: (self.app / name).read_bytes() for name in manifest['installed_hashes']}
        module = load_script('restore-runjs.py')
        with patch.object(sys, 'argv', ['restore-runjs.py', str(backup)]), \
             patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)), \
             self.assertRaisesRegex(SystemExit, 'Backup hash mismatch'):
            module.main()
        for name, data in before.items():
            self.assertEqual((self.app / name).read_bytes(), data)

    def test_installer_refuses_changed_artifacts_before_backup(self):
        self.successful_build()
        (self.output / 'Info.patched.plist').write_bytes(b'SYNTHETIC_CHANGED_ARTIFACT')
        module = load_script('install-patch.py')
        fake_home = self.base / 'home'
        with patch.object(sys, 'argv', ['install-patch.py', '--build-dir', str(self.output)]), \
             patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)), \
             patch.object(module.Path, 'home', return_value=fake_home), \
             self.assertRaisesRegex(SystemExit, 'Built artifact hash mismatch'):
            module.main()
        self.assertFalse(fake_home.exists())

    def host_build(self, *options):
        load_script('build-patch.py')
        from runjs_bridge import build, composition
        pins = {name: digest(self.files[name]) for name in composition.PINNED_BUNDLES}
        with patch.dict(composition.PINNED_BUNDLES, pins), \
             patch.object(sys, 'argv', ['build-patch.py', '--app', str(self.app), '--output', str(self.output), *options]), \
             contextlib.redirect_stdout(io.StringIO()):
            build.main()
        return json.loads((self.output / 'manifest.json').read_text())

    def test_host_adapter_is_default_but_refuses_unknown_bundle_fingerprints(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/build-patch.py'),
                                 '--app', str(self.app), '--output', str(self.output)],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unsupported native bundle fingerprint', result.stderr)

    def test_host_build_adds_nested_modules_and_preserves_native_bundles(self):
        manifest = self.host_build('--appearance', 'mint', '--relative-lines')
        builder = load_script('build-patch.py')
        header, raw, payload = builder.parse_archive((self.output / 'app.patched.asar').read_bytes())
        entries = dict(builder.packed_files(header['files']))
        self.assertTrue(manifest['host_commands'])
        for name in ['bridge-host/main.cjs', 'bridge-host/commands.cjs', 'bridge-host/renderer.cjs',
                     'bridge-host/native-save.cjs', 'bridge-host/save-tracker.cjs']:
            self.assertEqual(builder.content(payload, entries[name]), (ROOT / 'patches/runjs-4.1.0' / name).read_bytes())
        for name in ['index-bundle.js', 'entry-bundle.js']:
            self.assertEqual(builder.content(payload, entries[name]), self.files[name])
        package = json.loads(builder.content(payload, entries['package.json']))
        self.assertTrue(package['runjsVimBridge']['hostCommands'])
        self.assertEqual(package['runjsVimBridge']['appearance'], 'mint')
        self.assertEqual(builder.content(payload, entries['index.html']).count(b'./runjs-ex-commands.js'), 1)

    def test_host_upgrade_can_remove_visuals_without_disabling_commands(self):
        self.host_build('--appearance', 'mint'); self.apply_build_to_fixture()
        self.host_build('--upgrade'); self.apply_build_to_fixture()
        self.host_build('--upgrade')
        builder = load_script('build-patch.py')
        header, _, payload = builder.parse_archive((self.output / 'app.patched.asar').read_bytes())
        entries = dict(builder.packed_files(header['files']))
        package = json.loads(builder.content(payload, entries['package.json']))
        self.assertEqual(package['main'], 'runjs-bridge-main.cjs')
        self.assertTrue(package['runjsVimBridge']['hostCommands'])
        self.assertEqual(package['runjsVimBridge']['appearance'], 'native')
        self.assertEqual(builder.content(payload, entries['index.html']).count(b'./runjs-ex-commands.js'), 1)

    def test_backup_keeps_relocatable_restore_modules_and_checks_original_hashes(self):
        load_script('build-patch.py')
        from runjs_bridge.backup import create
        manifest = self.successful_build()
        backup = self.base / 'portable backup'
        with patch('runjs_bridge.backup.subprocess.run'):
            create(ROOT, self.output, backup, manifest, self.app)
        self.assertTrue((backup / 'runjs_bridge/restore.py').is_file())
        self.assertTrue((backup / 'runjs_bridge/archive.py').is_file())
        self.assertFalse((backup / 'runjs_bridge/__pycache__').exists())
        child = subprocess.run([sys.executable, '-c',
            'import sys, runpy, subprocess; '
            'subprocess.run=lambda *a, **k: subprocess.CompletedProcess([], 1 if a[0][0]=="pgrep" else 0); '
            'sys.argv=["restore-runjs.py"]; sys.path.insert(0, "."); '
            'runpy.run_path("restore-runjs.py", run_name="__main__")'],
            cwd=backup, capture_output=True, text=True)
        self.assertEqual(child.returncode, 0, child.stderr)
        self.assertIn('Pre-install RunJS restored', child.stdout)
        (self.app / 'Contents/MacOS/RunJS').write_bytes(b'CHANGED_DURING_BACKUP')
        with patch('runjs_bridge.backup.subprocess.run'), \
             self.assertRaisesRegex(SystemExit, 'Backup hash mismatch'):
            create(ROOT, self.output, self.base / 'corrupt backup', manifest, self.app)


if __name__ == '__main__':
    unittest.main()

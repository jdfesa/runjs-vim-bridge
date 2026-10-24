"""Audit tooling/evidence guards; no installed app or Neovim process required."""

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / 'tests/vim-audit/cases.json'
REPORT = ROOT / 'docs/command-audit-results.json'


def load_preparer():
    spec = importlib.util.spec_from_file_location('prepare_vim_audit', ROOT / 'scripts/prepare-vim-audit.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class VimAuditTests(unittest.TestCase):
    def test_pinned_module_extraction_and_missing_module_refusal(self):
        module = load_preparer()
        source = '12(e,t,n){e.exports="synthetic";},34(e){e.exports=1;}'
        self.assertEqual(module.extract_module(source, 12), 'function(e,t,n){e.exports="synthetic";}')
        with self.assertRaisesRegex(ValueError, 'Missing pinned editor module'):
            module.extract_module(source, 99)

    def test_extractor_refuses_unrecognized_boundary(self):
        with self.assertRaisesRegex(ValueError, 'Unrecognized editor module boundary'):
            load_preparer().extract_module('12(e){e.exports=1;}', 12)

    def test_generated_proprietary_assets_cannot_target_checkout(self):
        result = subprocess.run([
            sys.executable, str(ROOT / 'scripts/prepare-vim-audit.py'),
            '--app', 'nonexistent.app', '--output', str(ROOT / 'audit-artifacts'),
        ], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('outside this checkout', result.stderr)
        self.assertFalse((ROOT / 'audit-artifacts').exists())

    def test_audit_output_cannot_modify_the_app_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / 'Synthetic.app'
            app.mkdir()
            result = subprocess.run([
                sys.executable, str(ROOT / 'scripts/prepare-vim-audit.py'),
                '--app', str(app), '--output', str(app / 'audit'),
            ], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('must not overlap the application bundle', result.stderr)
            self.assertFalse((app / 'audit').exists())

    def test_snapshot_matches_current_fixture_set_and_fingerprint(self):
        cases = json.loads(CASES.read_text())
        report = json.loads(REPORT.read_text())
        ids = [case['id'] for case in cases]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(ids, [case['id'] for case in report['cases']])
        self.assertEqual(report['metadata']['cases_sha256'], hashlib.sha256(CASES.read_bytes()).hexdigest())
        self.assertEqual(report['metadata']['bundle_sha256'], load_preparer().SUPPORTED_BUNDLE_SHA256)
        self.assertNotIn('private_output', report['metadata'])

    def test_guide_basics_have_named_fixtures_and_documented_meanings(self):
        cases = json.loads(CASES.read_text())
        guide = {c['id'] for c in cases if c['source'] == 'visual-guide'}
        required = {'insert-before', 'motion-h', 'motion-j', 'motion-k', 'motion-l',
                    'motion-w', 'motion-b', 'motion-bol', 'motion-eol', 'append',
                    'open-below', 'delete-char', 'delete-line', 'undo', 'redo',
                    'host-w', 'host-q', 'host-wq'}
        self.assertTrue(required <= guide)
        doc = (ROOT / 'docs/keybindings.md').read_text()
        for case in cases:
            with self.subTest(case=case['id']):
                self.assertIn('`' + case['id'] + '`', doc)
                self.assertIn(case['meaning'], doc)

    def test_file_commands_are_host_boundaries_not_reference_edits(self):
        cases = json.loads(CASES.read_text())
        host = [c for c in cases if c['kind'] == 'host-boundary']
        self.assertEqual([c['actions'] for c in host], [[{'ex': 'w'}], [{'ex': 'q'}], [{'ex': 'wq'}]])
        reference = (ROOT / 'tests/vim-audit/reference.lua').read_text()
        self.assertIn("case.kind == 'compare'", reference)
        self.assertIn("'-u'", (ROOT / 'scripts/prepare-vim-audit.py').read_text())
        self.assertIn("'-i'", (ROOT / 'scripts/prepare-vim-audit.py').read_text())

    def test_snapshot_summary_and_exact_results_are_consistent(self):
        report = json.loads(REPORT.read_text())
        totals = {status: sum(c['status'] == status for c in report['cases'])
                  for status in ['pass', 'difference', 'host-boundary']}
        self.assertEqual(report['summary'], totals)
        for case in report['cases']:
            if case['status'] == 'pass':
                for key in ['text', 'cursor', 'mode', 'error']:
                    self.assertEqual(case['actual'][key], case['expected'][key], (case['id'], key))

    def test_known_differences_are_cursor_only_and_host_messages_are_captured(self):
        report = json.loads(REPORT.read_text())
        differences = {c['id']: c for c in report['cases'] if c['status'] == 'difference'}
        self.assertEqual(set(differences), {'delete-line', 'first-line', 'indent',
                                          'last-line-from-column', 'unindent-from-column'})
        for case in differences.values():
            self.assertEqual(case['actual']['text'], case['expected']['text'])
            self.assertNotEqual(case['actual']['cursor'], case['expected']['cursor'])
        cases = {c['id']: c for c in report['cases']}
        self.assertIn('Not an editor command', cases['host-q']['notifications'][0])
        self.assertIn('Not an editor command', cases['host-wq']['notifications'][0])
        self.assertEqual(report['metadata']['save_hook_in_engine'], 'undefined')

    def test_host_parser_snapshot_matches_source_hashes_without_claiming_native_io(self):
        report = json.loads((ROOT / 'docs/host-command-audit-results.json').read_text())
        self.assertEqual(report['cases'], 32)
        self.assertEqual(report['passed'], 32)
        self.assertTrue(all(case['pass'] for case in report['results']))
        self.assertIn('synthetic host', report['scope'])
        self.assertIn('unverified', report['scope'])
        for name, expected in report['metadata']['source_sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), expected)
        self.assertEqual(report['metadata']['bundle_sha256'], load_preparer().SUPPORTED_BUNDLE_SHA256)


if __name__ == '__main__':
    unittest.main()

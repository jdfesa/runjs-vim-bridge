"""Guard the small CI contract without downloading a YAML parser or app assets."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/ci.yml'


class ContinuousIntegrationTests(unittest.TestCase):
    def test_ci_runs_the_standard_entry_on_push_pr_and_manual_dispatch(self):
        source = WORKFLOW.read_text()
        for event in ['push', 'pull_request', 'workflow_dispatch']:
            self.assertRegex(source, re.compile(r'^  ' + event + r':\s*$', re.M))
        self.assertIn('run: npm test', source)
        self.assertIn('run: npm ci --ignore-scripts --no-audit --no-fund', source)
        self.assertIn('timeout-minutes: 10', source)
        self.assertIn('cancel-in-progress: true', source)

    def test_ci_covers_linux_and_macos_without_claiming_native_app_tests(self):
        source = WORKFLOW.read_text()
        for platform in ['ubuntu-latest', 'macos-latest']:
            self.assertIn('os: ' + platform, source)
        self.assertNotIn('--app', source)
        self.assertNotIn('install-patch.py', source)
        self.assertNotIn('prepare-vim-audit.py', source)
        self.assertNotIn('prepare-host-audit.py', source)

    def test_ci_keeps_read_only_permissions_and_verified_action_pins(self):
        source = WORKFLOW.read_text()
        self.assertIn('permissions:\n  contents: read', source)
        self.assertIn('persist-credentials: false', source)
        self.assertNotIn('pull_request_target:', source)
        self.assertNotIn('secrets.', source)
        self.assertNotRegex(source, r'\b(?:contents|actions|packages|id-token):\s*write\b')
        actions = re.findall(r'uses: ([^\s]+)', source)
        self.assertEqual(len(actions), 3)
        for action in actions:
            self.assertRegex(action, r'^actions/(checkout|setup-node|setup-python)@[0-9a-f]{40}$')

    def test_readme_badge_points_to_the_actual_main_workflow(self):
        readme = (ROOT / 'README.md').read_text()
        base = 'https://github.com/jdfesa/runjs-vim-bridge/actions/workflows/ci.yml'
        self.assertIn(f'[![CI]({base}/badge.svg?branch=main)]({base})', readme)


if __name__ == '__main__':
    unittest.main()

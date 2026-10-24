"""Guard public documentation conventions without inspecting local app data."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PublicDocsTests(unittest.TestCase):
    def test_readme_stays_an_entry_point(self):
        text = (ROOT / 'README.md').read_text()
        self.assertLessEqual(len(text.splitlines()), 80)
        for guide in ['installation', 'keybindings', 'roadmap', 'development', 'screenshots']:
            self.assertIn(f'docs/{guide}.md', text)
            self.assertTrue((ROOT / 'docs' / f'{guide}.md').is_file())

    def test_readme_showcase_describes_features_and_links_the_runnable_demo(self):
        readme = (ROOT / 'README.md').read_text()
        for feature in ['NORMAL', 'INSERT', 'Mint Dark', 'relative line numbers']:
            self.assertIn(feature, readme)
        self.assertIn('examples/readme-demo.js', readme)
        demo = ROOT / 'examples/readme-demo.js'
        self.assertTrue(demo.is_file())
        guide = (ROOT / 'docs/screenshots.md').read_text()
        self.assertIn('../examples/readme-demo.js', guide)
        self.assertIn('real RunJS window', guide)

    def test_relative_documentation_links_resolve(self):
        documents = [ROOT / 'README.md', ROOT / 'AGENTS.md', *sorted((ROOT / 'docs').glob('*.md'))]
        for document in documents:
            for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', document.read_text()):
                if '://' in target or target.startswith('#'):
                    continue
                target = target.split('#', 1)[0]
                with self.subTest(document=document.name, target=target):
                    self.assertTrue((document.parent / target).is_file())

    def test_public_sources_do_not_embed_machine_specific_locations(self):
        # Keep this pattern generic so the guard does not match its own source.
        local_path = re.compile(
            r'/(?:Users|home)/[^\s]+|[A-Za-z]:\\Users\\[^\s]+|'
            r'/(?:Applications|opt)/[^\s\'"`]*RunJS\.app'
        )
        for folder in ['examples', 'scripts', 'patches', 'tests', 'docs', '.github']:
            for source in (ROOT / folder).rglob('*'):
                if source.suffix not in {'.py', '.js', '.cjs', '.css', '.md', '.json', '.yml', '.yaml'}:
                    continue
                with self.subTest(source=str(source.relative_to(ROOT))):
                    self.assertIsNone(local_path.search(source.read_text()))
        for name in ['README.md', 'AGENTS.md', '.gitignore', 'package.json', 'package-lock.json']:
            with self.subTest(source=name):
                self.assertIsNone(local_path.search((ROOT / name).read_text()))

    def test_platform_status_separates_native_validation_from_synthetic_ci(self):
        readme = (ROOT / 'README.md').read_text()
        self.assertIn('Verified app target: **RunJS 4.1.0 on macOS**', readme)
        self.assertIn('Linux and Windows has not been tested yet', readme)
        self.assertNotIn('other versions/platforms are unsupported', readme)
        development = ' '.join((ROOT / 'docs/development.md').read_text().split())
        self.assertIn('Synthetic Linux CI does not validate a native Linux installation.', development)
        self.assertIn('current installer handles macOS app bundles', development)

    def test_development_guide_focuses_on_contribution_and_source_hygiene(self):
        development = (ROOT / 'docs/development.md').read_text()
        self.assertIn('## Contribution Workflow', development)
        self.assertIn('## Source Hygiene', development)
        self.assertNotIn('## Publication Review', development)

    def test_appearance_docs_name_the_implemented_palette_without_terminal_branding(self):
        appearance = (ROOT / 'docs/appearance.md').read_text()
        self.assertIn('# Mint Dark Appearance', appearance)
        self.assertIn('--appearance mint', appearance)
        self.assertIn('0.85', appearance)
        for document in [ROOT / 'README.md', ROOT / 'AGENTS.md', *(ROOT / 'docs').glob('*.md')]:
            self.assertNotIn('kitty', document.read_text().lower(), document.name)


if __name__ == '__main__':
    unittest.main()

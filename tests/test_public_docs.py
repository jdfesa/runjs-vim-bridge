"""Guard public documentation conventions without inspecting local app data."""

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PublicDocsTests(unittest.TestCase):
    def test_readme_stays_an_entry_point(self):
        text = (ROOT / 'README.md').read_text()
        self.assertLessEqual(len(text.splitlines()), 80)
        for guide in ['installation', 'keybindings', 'roadmap', 'development']:
            self.assertIn(f'docs/{guide}.md', text)
            self.assertTrue((ROOT / 'docs' / f'{guide}.md').is_file())

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
        for folder in ['scripts', 'patches', 'tests', 'docs']:
            for source in (ROOT / folder).rglob('*'):
                if source.suffix not in {'.py', '.js', '.cjs', '.css', '.md'}:
                    continue
                with self.subTest(source=str(source.relative_to(ROOT))):
                    self.assertIsNone(local_path.search(source.read_text()))
        for name in ['README.md', 'AGENTS.md', '.gitignore']:
            with self.subTest(source=name):
                self.assertIsNone(local_path.search((ROOT / name).read_text()))


if __name__ == '__main__':
    unittest.main()

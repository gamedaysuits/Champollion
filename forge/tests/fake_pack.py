"""A minimal loadable language pack, for pack-discovery tests.

Shaped like an external pack (e.g. crk-translate's nmt_forge_crk): a module
exposing ``get_pack(**kwargs)`` that forge loads via the
``"module.path:get_pack"`` spec form.
"""

from nmt_forge.guards.coverage_map import ChecklistItem
from nmt_forge.synthesis.analyzer import TableAnalyzer
from nmt_forge.synthesis.packs import LanguagePack
from nmt_forge.synthesis.templates import Candidate, Punct, Template, Unit


class FakePack(LanguagePack):
    code = "zzt"
    name = "Toylang"
    version = "0.0.1"

    def analyzer(self):
        return TableAnalyzer({"zon+V+3Sg": "zonâw"})

    def dictionary(self):
        return []

    def templates(self):
        def realize(ctx):
            yield Candidate(source="She zons.",
                            target=(Unit("zon+V+3Sg"), Punct(".")))

        return [Template(kind="verbs", citation="Toygrammar 2020",
                         phenomena=("verbing",), realize=realize)]

    def checklist(self):
        return [ChecklistItem("verbing", "verbs verb", "Toygrammar 2020",
                              required=True)]

    def context(self, *, seed=42):
        return None


def get_pack(**kwargs) -> FakePack:
    return FakePack(**kwargs)

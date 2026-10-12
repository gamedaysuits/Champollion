"""The wizard's menus must speak the validators' vocabulary.

The method-card wizard once offered "fine-tuned" as a method class — a value
no validator accepts (config.VALID_METHOD_CLASSES has no such member), so a
card created through the interactive path could fail at use time, or ride
unvalidated into a run card. These pins make any future menu/validator drift
a test failure instead of a latent UX trap.
"""

from mt_eval_harness.config import VALID_METHOD_CLASSES, VALID_PARADIGMS
from mt_eval_harness.method_card_wizard import METHOD_CLASSES, PARADIGMS


def test_wizard_method_classes_are_all_valid():
    offered = {key for key, _ in METHOD_CLASSES}
    invalid = offered - VALID_METHOD_CLASSES
    assert not invalid, (
        f"wizard offers method class(es) no validator accepts: {sorted(invalid)} "
        f"(valid: {sorted(VALID_METHOD_CLASSES)})"
    )


def test_wizard_offers_custom_plugin():
    # The plugin port is the harness's own extension mechanism; the wizard
    # must be able to describe a method that uses it.
    assert "custom-plugin" in {key for key, _ in METHOD_CLASSES}


def test_wizard_paradigms_are_all_valid():
    offered = {key for key, _ in PARADIGMS}
    invalid = offered - VALID_PARADIGMS
    assert not invalid, (
        f"wizard offers paradigm(s) no validator accepts: {sorted(invalid)} "
        f"(valid: {sorted(VALID_PARADIGMS)})"
    )


def test_no_duplicate_menu_keys():
    for menu in (METHOD_CLASSES, PARADIGMS):
        keys = [key for key, _ in menu]
        assert len(keys) == len(set(keys)), f"duplicate menu keys: {keys}"

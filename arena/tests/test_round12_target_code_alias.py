"""Round 12 (hospital persona): one documented spelling for the target's code.

`champollion network register-corpus` printed `--target-code` while every doc
page uses `--target-lang-code`, and `mt-eval run` accepted both as two flags
filling two fields (the code MT systems are sent, and the code the eval
standard is chosen for). `--target-lang-code` is now the documented flag and
`--target-code` its alias: either spelling sets both fields, and `--help`
says which is the alias.
"""

import re

from mt_eval_harness.cli import args_to_config, build_parser


def _run(*extra):
    return build_parser().parse_args(["run", "--corpus", "x.json", *extra])


def test_both_spellings_fill_the_same_flag():
    assert _run("--target-lang-code", "crk").target_lang_code == "crk"
    assert _run("--target-code", "crk").target_lang_code == "crk"
    assert not hasattr(_run("--target-code", "crk"), "target_code"), "one flag, not two"


def test_the_code_reaches_both_fields_of_the_run():
    for flag in ("--target-lang-code", "--target-code"):
        cfg = args_to_config(_run(flag, "crk"))
        assert cfg.target_code == "crk", flag
        assert cfg.target_lang_code == "crk", flag


def test_no_code_given_leaves_both_empty():
    cfg = args_to_config(_run())
    assert cfg.target_code == ""
    assert cfg.target_lang_code == ""


def test_help_names_the_documented_flag_and_its_alias():
    sub = next(a for a in build_parser()._actions if a.dest == "command")
    text = " ".join(sub.choices["run"].format_help().split())
    # 3.12 prints the metavar after each spelling, 3.13+ once at the end.
    assert re.search(r"--target-lang-code( TARGET_LANG_CODE)?, --target-code TARGET_LANG_CODE", text), text
    assert "--target-code is an alias." in text

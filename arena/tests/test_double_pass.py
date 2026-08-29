import pytest
from mt_eval_harness.plugins.double_pass_compliance import DoublePassCompliancePlugin

def test_double_pass_variables():
    card = {
        "name": "Plains Cree",
        "rules": {
            "variables": {
                "format": "curly"
            }
        }
    }
    plugin = DoublePassCompliancePlugin(card)
    
    # Correct variable preservation
    entry = {
        "source": "Hello {user}!",
        "raw_predicted": "tawâw {user}!",
        "predicted": "tawâw {user}!"
    }
    res = plugin.compute(entry)
    assert res["raw_var_integrity"] == 1.0
    assert res["final_var_integrity"] == 1.0
    assert res["repair_delta_vars"] == 0.0
    assert res["repaired"] is False

    # Variable missing in raw, but corrected in final
    entry = {
        "source": "Hello {user}!",
        "raw_predicted": "tawâw!",
        "predicted": "tawâw {user}!"
    }
    res = plugin.compute(entry)
    assert res["raw_var_integrity"] == 0.0
    assert res["final_var_integrity"] == 1.0
    assert res["repair_delta_vars"] == 1.0
    assert res["repaired"] is True

def test_double_pass_quotes():
    card = {
        "name": "Plains Cree",
        "rules": {
            "typography": {
                "quoteStart": "“",
                "quoteEnd": "”"
            }
        }
    }
    plugin = DoublePassCompliancePlugin(card)
    
    # Quotes check
    entry = {
        "source": 'He said "Hello".',
        "raw_predicted": "itwêw Hello.",
        "predicted": "itwêw “Hello”."
    }
    res = plugin.compute(entry)
    assert res["raw_quote_compliance"] == 0.0
    assert res["final_quote_compliance"] == 1.0
    assert res["repair_delta_quotes"] == 1.0
    assert res["repaired"] is True

def test_double_pass_casing():
    card = {
        "name": "Japanese",
        "rules": {
            "capitalization": {
                "hasCase": False
            }
        }
    }
    plugin = DoublePassCompliancePlugin(card)
    
    # Source has no Latin letters, prediction has Latin letters -> leak!
    entry = {
        "source": "これは本です。",
        "raw_predicted": "This is a book.",
        "predicted": "これは本です。"
    }
    res = plugin.compute(entry)
    assert res["raw_casing_compliance"] == 0.5
    assert res["final_casing_compliance"] == 1.0
    assert res["repair_delta_casing"] == 0.5
    assert res["repaired"] is True

    # Source has Latin letters, prediction has Latin letters -> ok!
    entry = {
        "source": "Googleで検索する。",
        "raw_predicted": "Googleで検索する。",
        "predicted": "Googleで検索する。"
    }
    res = plugin.compute(entry)
    assert res["raw_casing_compliance"] == 1.0
    assert res["final_casing_compliance"] == 1.0

def test_double_pass_aggregate():
    card = {
        "name": "Plains Cree",
        "rules": {
            "variables": {},
            "typography": {
                "quoteStart": "“",
                "quoteEnd": "”"
            }
        }
    }
    plugin = DoublePassCompliancePlugin(card)
    results = [
        # Correct all the way
        {
            "raw_var_integrity": 1.0, "raw_quote_compliance": 1.0, "raw_casing_compliance": 1.0, "raw_compliance_index": 1.0,
            "final_var_integrity": 1.0, "final_quote_compliance": 1.0, "final_casing_compliance": 1.0, "final_compliance_index": 1.0,
            "repair_delta_vars": 0.0, "repair_delta_quotes": 0.0, "repair_delta_casing": 0.0, "repaired": False
        },
        # Repaired variables
        {
            "raw_var_integrity": 0.0, "raw_quote_compliance": 1.0, "raw_casing_compliance": 1.0, "raw_compliance_index": 0.4,
            "final_var_integrity": 1.0, "final_quote_compliance": 1.0, "final_casing_compliance": 1.0, "final_compliance_index": 1.0,
            "repair_delta_vars": 1.0, "repair_delta_quotes": 0.0, "repair_delta_casing": 0.0, "repaired": True
        }
    ]
    agg = plugin.aggregate(results)
    assert agg["raw_avg_variable_integrity"] == 0.5
    assert agg["final_avg_variable_integrity"] == 1.0
    assert agg["repaired_variables"] == 1
    assert agg["total_repaired_segments"] == 1
    assert agg["repair_effectiveness_rate"] == 0.5

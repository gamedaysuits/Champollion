"""
Example: Exporting a TestReport as a champollion method plugin.

This script demonstrates the full workflow:
    1. Point at a completed TestReport (from 'gds-mt-eval test')
    2. Configure the export (name, type, locales, coaching data)
    3. Generate a champollion-compatible plugin directory

The output can be dropped directly into:
    <project>/.champollion/methods/<name>/

Then referenced in champollion.config.json:
    "pairs": { "en→crk": { "methodPlugin": "crk-coached-v1" } }

CLI equivalent:
    gds-mt-eval export \
        --report eval/logs/harness/my_report.json \
        --name crk-coached-v1 \
        --type llm-coached \
        --locales crk \
        --description "Plains Cree with grammar coaching and FST validation" \
        --register "Standard written register (SRO)" \
        --coaching-dir .champollion/coaching \
        --output-dir ./exported_plugins \
        --version 1.0.0
"""

from pathlib import Path

from mt_eval_harness import ExportConfig, export_plugin


def main():
    # --- 1. Configure the export ---
    config = ExportConfig(
        # Required: what to call this plugin in champollion
        name="crk-coached-v1",

        # Required: champollion method type — determines which translation
        # engine champollion uses. 'llm-coached' adds grammar/dictionary
        # injection to the LLM prompt.
        method_type="llm-coached",

        # Required: which locales this method covers
        locales=["crk"],

        # Optional: human-readable description
        description="Plains Cree with grammar coaching and FST validation",

        # Optional: the language register/tone to use in translations
        register="Standard written register (SRO)",

        # Optional: bundle coaching data into the plugin.
        # These are the grammar rules and dictionaries that the
        # llm-coached method injects into the LLM prompt.
        coaching_dir=".champollion/coaching",

        # Optional: where to write the plugin output
        output_dir="./exported_plugins",

        # Optional: semver version for the plugin
        version="1.0.0",
    )

    # --- 2. Point at the TestReport ---
    # This is the output of 'gds-mt-eval test <runlog>'
    report_path = Path("eval/logs/harness/my_test_report.json")

    # --- 3. Export ---
    # This will:
    #   a) Load and validate the TestReport
    #   b) Build the method.json manifest
    #   c) Validate against champollion's contract
    #   d) Copy coaching files (if any)
    #   e) Print a summary with install instructions
    try:
        plugin_dir = export_plugin(report_path, config)
        print(f"\nPlugin ready at: {plugin_dir}")

    except FileNotFoundError as e:
        print(f"Report not found: {e}")
    except ValueError as e:
        print(f"Validation error: {e}")


if __name__ == "__main__":
    main()

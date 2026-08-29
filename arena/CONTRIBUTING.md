# Contributing to mt-eval (the MT eval harness)

Thank you for your interest in contributing! This project exists to give
researchers and developers a reliable, language-agnostic framework for
evaluating machine translation pipelines. Contributions of all kinds are
welcome — from bug fixes and documentation improvements to new metric
plugins and evaluation strategies.

## Quick Links

| Resource | Path |
|---|---|
| Architecture & usage guide | [`GUIDE.md`](GUIDE.md) |
| Plugin protocol definitions | [`mt_eval_harness/plugins/`](mt_eval_harness/plugins/) |
| Example: basic run | [`examples/basic_run/`](examples/basic_run/) |
| Example: custom pipeline | [`examples/custom_pipeline/`](examples/custom_pipeline/) |

---

## Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/gamedaysuits/Champollion.git
cd Champollion/arena

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# 3. Install in editable mode with all optional dependencies
pip install -e ".[metrics]"

# 4. Set up your API key (required for run harness only)
cp .env.example .env
# Edit .env to add your OPENROUTER_API_KEY
```

---

## Project Structure

```
mt_eval_harness/
├── __init__.py          # Public API exports
├── __main__.py          # python -m entry point
├── config.py            # RunConfig dataclass
├── runner.py            # Run harness (translation execution)
├── tester.py            # Test harness (offline evaluation)
├── compare.py           # Multi-run comparison
├── dashboard.py         # HTML dashboard generator
├── api.py               # OpenRouter API client
├── cache.py             # Deterministic result caching
├── cli.py               # CLI subcommands
└── plugins/
    ├── metrics.py       # MetricPlugin protocol
    ├── prompts.py       # PromptProvider protocol
    ├── hooks.py         # PostTranslationHook protocol
    └── tools.py         # ToolProvider protocol
```

---

## Code Standards

### Style

- **Python 3.10+** required.
- Follow PEP 8 with a 100-character line limit.
- Use `from __future__ import annotations` in every module.
- Type hints on all public function signatures.

### Comments

- Explain *why*, not *what*. The code should be self-documenting for *what*.
- Every module must have a docstring explaining its purpose and design decisions.

### No Silent Fallbacks

Never swallow exceptions silently. If a function encounters a problem, it
should either raise an exception or return a clear error indicator. This is
critical for evaluation code where silent failures can produce misleading
benchmark results.

```python
# BAD — hides the real problem
try:
    result = compute_metric(entry)
except Exception:
    result = 0.0

# GOOD — preserves diagnostic information
try:
    result = compute_metric(entry)
except Exception as e:
    logger.warning("Metric computation failed for entry %s: %s", entry_id, e)
    result = {"error": str(e)}
```

### Dependencies

The core harness has minimal dependencies (`aiohttp`, `python-dotenv`).
**Do not add new core dependencies** without discussion. Language-specific
dependencies belong in plugins, not in the core package.

---

## Plugin Development

Plugins are the primary extension mechanism. See [`GUIDE.md`](GUIDE.md)
for full protocol documentation. Here's a summary:

### MetricPlugin

Adds custom evaluation metrics (e.g., FST validity, semantic overlap).

```python
from mt_eval_harness import MetricPlugin

class MyMetric:
    name = "my_metric"

    def compute(self, entry: dict) -> dict:
        """Per-entry metric computation."""
        return {"my_score": 0.95}

    def aggregate(self, entry_results: list[dict]) -> dict:
        """Corpus-level aggregation."""
        scores = [r["my_score"] for r in entry_results]
        return {"avg_my_score": sum(scores) / max(len(scores), 1)}
```

### PromptProvider

Supplies system prompts for translation.

### PostTranslationHook

Post-processes translations (e.g., FST corrective loops).

### ToolProvider

Supplies LLM tool-calling schemas and execution logic.

---

## Contributing a Plugin

If your plugin is **language-specific** (e.g., Plains Cree FST tools), it
belongs in your consuming project, not in this repository. The harness is
language-agnostic by design.

If your plugin is **generally useful** (e.g., a new string similarity
metric, a caching strategy, a cost estimator), it may belong in the core.
Open an issue first to discuss.

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`.
2. **Write tests** for any new functionality. Place them in `tests/`.
3. **Update documentation** if your change affects the public API or
   configuration options.
4. **Run the linter** before submitting:
   ```bash
   python -m py_compile mt_eval_harness/your_file.py
   ```
5. **Open a PR** with a clear description of what changed and why.

### PR Checklist

- [ ] Code follows the style guidelines above
- [ ] No new core dependencies added without prior discussion
- [ ] All public functions have type hints and docstrings
- [ ] No hardcoded language-specific logic in core modules
- [ ] Documentation updated if needed

---

## Reporting Issues

When opening an issue, include:

1. **What you expected** to happen.
2. **What actually happened** (with error output if applicable).
3. **Your environment**: Python version, OS, package version.
4. **Minimal reproduction steps**.

---

## License

By contributing, you agree that your contributions will be licensed under
the [Apache License 2.0](LICENSE).

"""docent_eval — evaluate the champollion.dev site docent with the project's
own methodology (deterministic grounding + refusal metrics; LLM-judge quality
outside the composite). See runner.py for the entrypoint and README.md for how
the founder runs the real multi-model, multi-locale matrix."""

from docent_eval.metrics import DocentGroundingMetric, DocentRefusalMetric

__all__ = ["DocentGroundingMetric", "DocentRefusalMetric"]

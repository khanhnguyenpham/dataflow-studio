"""Reproducible, small curated evaluation; never described as broad ML accuracy."""

import argparse
import hashlib
import json
from pathlib import Path
from .schema_match import MIN_MARGIN, MIN_SCORE, normalize, suggest


def evaluate(cases, method):
    fields = correct = suggested = correct_suggestions = abstained = 0
    mistakes = []
    for case in cases:
        if method == "rules_and_similarity":
            decisions = {
                item["target"]: item["suggested_source"] for item in suggest(case["source"], case["targets"])["items"]
            }
        else:
            decisions = {}
            for target in case["targets"]:
                matching = [
                    source
                    for source in case["source"]
                    if normalize(source).replace(" ", "") == normalize(target).replace(" ", "")
                ]
                decisions[target] = matching[0] if len(matching) == 1 else None
        for target, expected in case["expected"].items():
            fields += 1
            actual = decisions[target]
            correct += actual == expected
            if actual is None:
                abstained += 1
            else:
                suggested += 1
                correct_suggestions += actual == expected
            if actual != expected:
                mistakes.append({"case": case["id"], "target": target, "expected": expected, "actual": actual})
    return {
        "fields": fields,
        "correct_decisions": correct,
        "suggestions": suggested,
        "correct_suggestions": correct_suggestions,
        "abstentions": abstained,
        "suggestion_precision": correct_suggestions / suggested if suggested else None,
        "suggestion_coverage": suggested / fields if fields else None,
        "mistakes": mistakes,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    fixture = Path(__file__).resolve().parents[2] / "sample_data/schema-cases.json"
    content = fixture.read_bytes().replace(b"\r\n", b"\n")
    cases = json.loads(content)
    result = {
        "scope": "Small manually labelled synthetic header fixtures; not general ML performance.",
        "fixture_sha256": hashlib.sha256(content).hexdigest(),
        "min_score": MIN_SCORE,
        "min_margin": MIN_MARGIN,
        "splits": {
            split: {
                method: evaluate([case for case in cases if case["split"] == split], method)
                for method in ["normalized_name_only", "rules_and_similarity"]
            }
            for split in ["validation", "test"]
        },
    }
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8", newline="\n")
    print(text)


if __name__ == "__main__":
    main()

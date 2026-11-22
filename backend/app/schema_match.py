"""Explainable header suggestions. Scores are similarities, never probabilities."""

import re
import unicodedata

GROUPS = [
    ["sku", "product code", "item code", "ma hang", "ma san pham", "ma sp"],
    ["quantity", "qty", "so luong", "so luong ban"],
    ["order id", "order number", "order no", "ma don", "ma don hang"],
    ["order date", "sales date", "ngay dat", "ngay dat hang", "ngay ban"],
    ["unit price", "price per unit", "don gia"],
    ["total amount", "revenue", "sales amount", "doanh thu", "thanh tien"],
    ["product name", "item name", "ten hang", "ten san pham"],
    ["customer id", "customer code", "ma khach hang", "ma kh"],
    ["email", "email address", "e mail"],
    ["invoice number", "invoice no", "so hoa don"],
]
MIN_SCORE, MIN_MARGIN = 0.78, 0.12


def normalize(value):
    value = re.sub(r"([a-z])([A-Z])", r"\1 \2", value).casefold().replace("đ", "d")
    value = "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c))
    return " ".join(re.findall(r"[a-z0-9]+", value))


ALIASES = {normalize(name).replace(" ", ""): index for index, names in enumerate(GROUPS) for name in names}


def similarity(source, target):
    a, b = normalize(source), normalize(target)
    ac, bc = a.replace(" ", ""), b.replace(" ", "")
    if ac and ac == bc:
        return 1.0, "normalized_name"
    if ac in ALIASES and bc in ALIASES and ALIASES[ac] == ALIASES[bc]:
        return 0.97, "alias_rule"

    def pairs(value):
        return {value[i : i + 2] for i in range(len(value) - 1)}

    ap, bp = pairs(ac), pairs(bc)
    dice = 2 * len(ap & bp) / (len(ap) + len(bp)) if ap and bp else 0
    at, bt = set(a.split()), set(b.split())
    tokens = len(at & bt) / len(at | bt) if at or bt else 0
    return round(max(dice, 0.7 * dice + 0.3 * tokens), 4), "text_similarity"


def suggest(source_columns, targets):
    items = []
    for target in targets:
        candidates = sorted(
            [
                {"source": source, "score": similarity(source, target)[0], "reason": similarity(source, target)[1]}
                for source in source_columns
            ],
            key=lambda row: (-row["score"], row["source"]),
        )[:3]
        best = candidates[0] if candidates else None
        margin = best["score"] - candidates[1]["score"] if len(candidates) > 1 else 1
        unique_exact = best and best["reason"] == "normalized_name" and sum(c["score"] == 1 for c in candidates) == 1
        accepted = best and best["score"] >= MIN_SCORE and (unique_exact or margin >= MIN_MARGIN)
        items.append(
            {
                "target": target,
                "suggested_source": best["source"] if accepted else None,
                "status": "suggested" if accepted else "review",
                "candidates": candidates,
            }
        )
    # Resolve competing targets without giving priority to their input order.
    assignments = {}
    for item in items:
        if item["suggested_source"]:
            assignments.setdefault(item["suggested_source"], []).append(item)
    for values in assignments.values():
        if len(values) < 2:
            continue
        exact = [item for item in values if item["candidates"][0]["reason"] == "normalized_name"]
        for item in values:
            if len(exact) == 1 and item is exact[0]:
                continue
            item["suggested_source"], item["status"] = None, "review"
    used = {item["suggested_source"] for item in items if item["suggested_source"]}
    return {
        "items": items,
        "unused_sources": [c for c in source_columns if c not in used],
        "method": "header names, explicit bilingual aliases and bigram/token similarity",
        "min_score": MIN_SCORE,
        "min_margin": MIN_MARGIN,
        "requires_confirmation": True,
        "scores_are_probabilities": False,
    }

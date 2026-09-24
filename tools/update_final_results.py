#!/usr/bin/env python3
"""Copy the published paper figure counts into the static site's script data."""

import argparse
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASR_PATH = "paper-results/plots/combined-harness-asr/data.json"
PERMISSIONS_PATH = "paper-results/plots/combined-permissions-comparison/data-expanded.json"
TRIALS_PATH = "paper-results/trials.json"
OUTPUT = ROOT / "results" / "data.js"


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args])


def source_json(repo, ref, path):
    return json.loads(git(repo, "show", f"{ref}:{path}"))


def build(repo, ref):
    commit = git(repo, "rev-parse", ref).decode().strip()
    asr = source_json(repo, commit, ASR_PATH)
    permissions = source_json(repo, commit, PERMISSIONS_PATH)
    trials = source_json(repo, commit, TRIALS_PATH)

    assert asr["reporting_rule"] == "observed-loss"
    assert len(asr["cells"]) == 99
    assert len(permissions["rows"]) == 80
    assert len(trials) == 1590

    order = permissions["model_order"]
    full = {}
    for cell in asr["cells"]:
        key = f'{cell["setting"]}:{cell["client"]}'
        assert key not in full
        assert cell["client"] in order
        full[key] = [cell["successes"], cell["trials"],
                     len(cell.get("observed_loss_positive_ids", []))]

    auto = {}
    for row in permissions["rows"]:
        if row["permission"] != "Auto Mode":
            continue
        key = f'{row["setting"]}:{row["harness_model"]}'
        assert key not in auto
        auto[key] = [row["successes"], row["denominator"],
                     row["inconclusive"], row["baseline_blocked"],
                     row["approval_waits"]]
    assert len(auto) == 40
    assert len(full) == 99

    result = {
        "sourceCommit": commit,
        "selectedTrials": len(trials),
        "modelOrder": order,
        "full": full,
        "auto": auto,
    }
    return "window.TPC_FINAL_RESULTS = " + json.dumps(
        result, ensure_ascii=False, separators=(",", ":")) + ";\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True,
                        help="checkout of the kamikaze-agent evidence repository")
    parser.add_argument("--ref", default="origin/reward-hacking")
    parser.add_argument("--check", action="store_true",
                        help="fail if results/data.js differs from the source")
    args = parser.parse_args()
    content = build(args.repo, args.ref)
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            parser.exit(1, f"{OUTPUT} is out of date\n")
        print(f"{OUTPUT} matches {args.ref}")
    else:
        OUTPUT.parent.mkdir(exist_ok=True)
        OUTPUT.write_text(content)
        print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()

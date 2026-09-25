# The Perfect Crime — results site

Static site for *LLM Agents Can Easily Tamper With Their Own Traces* ([arXiv:2609.30266v1](https://arxiv.org/abs/2609.30266v1)). No build step,
no dependencies: serve the folder and it works.

```
index.html              the paper summary and bar charts from Figures 2, 3, 6, 7, 8
assets/paper-figure-*.svg  vector charts and trace figure cropped from the v1 PDF
assets/paper-figure-5.png  raster fallback for the trace figure
results/data.js         archived selected, adjudicated figure counts (generated)
traces/index.html       catalog of selected paper trials, filters, run tables
traces/run.html         one run: event timeline, trace evidence, grading
traces/assets/          styles.css, common.js, catalog.js, run.js
traces/data/            index.js + one <run_id>.js per run (generated)
tools/build_traces.py   normalizes native harness trace streams
tools/build_paper_traces.py   selects and builds the published paper trials
tools/extract_paper_figures.py   crops the paper's bar charts
tools/update_final_results.py   copies the paper's selected figure counts
```

## Running it locally

Open `index.html` in a browser. No server needed: the run data is delivered as
`<script>` tags calling `TPC.receive(...)` rather than as `fetch()`ed JSON,
because a browser refuses `fetch()` on a `file://` page. Serving the folder
over HTTP works identically:

```sh
python3 -m http.server 8777 && open http://127.0.0.1:8777/
```

## Updating the paper figures

The homepage embeds vector versions of the bar charts on pages 4, 5, 7, 9 and
10 of the supplied v1 PDF. To regenerate them from that PDF, install Poppler
and `pdfcrop`, then run:

```sh
python3 tools/extract_paper_figures.py /path/to/2609.30266v1.pdf
```

The crop boxes are specific to v1. Check every figure if a later PDF changes
the page layout. The captions link to the matching pages of the paper.

## Updating the archived result counts

The chart assets come directly from the paper. `results/data.js` separately
preserves the selected trial counts from the
[kamikaze-agent evidence package](https://github.com/davidsmts/kamikaze-agent/tree/reward-hacking/paper-results).
They report ten model–harness pairs, including auto-mode direct prompting.
`results/data.js` records the source commit and is generated from
`paper-results/plots/combined-harness-asr/data.json`,
`paper-results/plots/combined-permissions-comparison/data-expanded.json`, and
`paper-results/trials.json` on `reward-hacking`:

```sh
git -C ~/Documents/kamikaze-agent fetch origin reward-hacking
python3 tools/update_final_results.py --repo ~/Documents/kamikaze-agent
python3 tools/update_final_results.py --repo ~/Documents/kamikaze-agent --check
```

The full-access count snapshot follows the paper's observed-loss reporting rule. Four
OpenCode/Qwen trials are positive because native-session content disappeared,
though the responsible agent action was not captured. The source package also
provides verified-only figures. In auto mode, three inconclusive ZCode reset
trials are excluded from that cell's denominator; all-blocked tool-call
baselines show `B`. The 1,590 selected trials include supporting series not
shown in the paper figures.

The interactive browser uses the selected paper-results population; the
homepage bar charts show the main figure conditions within that package.

## Regenerating the selected trace browser

The browser is generated **only** from the 1,590 selected trial rows in
`paper-results/trials.json` at source commit
`39c4efca051a4f0fe3e4223fdaba0b98d117fe81`. The published package
contains 1,050 full-access and 540 auto-mode trials. These include supporting
series beyond the five homepage figures; smoke tests, superseded Gemini CLI
runs, discarded attempts, and older auto-mode skill trials are excluded.

The paper package stores its raw evidence in compressed archives. From a checkout
of `kamikaze-agent` with the `reward-hacking` branch fetched, extract and unpack
it in a temporary directory (about 25 GB of free space is useful):

```sh
mkdir -p /tmp/tpc-paper-package
git -C ~/Documents/kamikaze-agent archive origin/reward-hacking paper-results \
  | tar -xf - -C /tmp/tpc-paper-package
python3 /tmp/tpc-paper-package/paper-results/unpack.py
```

Build the browser data into an **empty** directory:

```sh
python3 tools/build_paper_traces.py \
  --package /tmp/tpc-paper-package/paper-results \
  --out /tmp/tpc-paper-site-data
```

Check the generated `index.js` against the selection before replacing
`traces/data/`. The builder requires all 1,590 selected runs, uses the manifest's
adjudicated outcomes, and fails if a selected run is missing. It writes one
`TPC.receive(...)` script per run plus the catalog index, so the browser also
works when opened as a local file. This version is about 278 MB. `build_traces.py`
provides the native stream normalizers, including ZCode and Kimi Code.

The browser labels baseline-blocked trials as inconclusive rather than model
refusals. Four OpenCode/Qwen trials follow the paper's observed-loss convention:
content disappeared, but the agent action was not captured. Every run page
shows its source batch, trial key, permission condition, selected outcome, and
available trace or observer evidence. Long tool output is clipped for the
browser; the published raw evidence is authoritative.

/* Catalog page: the attack × harness matrix, the filter dock, and the run
   tables under it. Filter state lives in the query string so any view is a
   link (the landing page's result table links straight into it). */

(function () {
  var RUNS = [];
  var GROUP_ORDER = [];
  var HARNESSES = ['Codex', 'Claude Code', 'Gemini CLI', 'OpenCode'];

  var el = {
    matrix: document.getElementById('matrix'),
    legend: document.getElementById('matrix-legend'),
    stats: document.getElementById('hero-stats'),
    runs: document.getElementById('runs'),
    empty: document.getElementById('empty'),
    loading: document.getElementById('loading'),
    count: document.getElementById('count'),
    reset: document.getElementById('reset'),
    groupBy: document.getElementById('group-by'),
    sort: document.getElementById('sort'),
    q: document.getElementById('q')
  };

  var FILTERS = {
    group: document.getElementById('f-group'),
    condition: document.getElementById('f-condition'),
    harness: document.getElementById('f-harness'),
    model: document.getElementById('f-model'),
    verdict: document.getElementById('f-verdict')
  };

  // ---------------------------------------------------------------- state

  function readUrl() {
    var params = new URLSearchParams(location.search);
    Object.keys(FILTERS).forEach(function (key) {
      FILTERS[key].value = params.get(key) || '';
    });
    el.q.value = params.get('q') || '';
    el.groupBy.value = params.get('by') || 'condition';
    el.sort.value = params.get('sort') || 'verdict';
  }

  function writeUrl() {
    var params = new URLSearchParams();
    Object.keys(FILTERS).forEach(function (key) {
      if (FILTERS[key].value) params.set(key, FILTERS[key].value);
    });
    if (el.q.value) params.set('q', el.q.value);
    if (el.groupBy.value !== 'condition') params.set('by', el.groupBy.value);
    if (el.sort.value !== 'verdict') params.set('sort', el.sort.value);
    var qs = params.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function anyFilter() {
    return el.q.value || Object.keys(FILTERS).some(function (k) {
      return FILTERS[k].value;
    });
  }

  // --------------------------------------------------------------- matrix

  function rateFor(rows) {
    var decided = rows.filter(function (r) { return r.verdict !== 'inconclusive'; });
    if (!decided.length) return null;
    return decided.filter(function (r) { return r.verdict === 'tampered'; }).length
      / decided.length;
  }

  function shade(rate) {
    // A single-hue ramp toward the "tampered" red. A cell with no tampering
    // and a cell with nothing to report both stay neutral, so neither reads
    // as a result it is not.
    if (rate === null || rate === 0) return 'var(--sunk)';
    return 'color-mix(in srgb, var(--yes) ' + Math.round((0.14 + rate * 0.56) * 100) +
      '%, var(--sunk))';
  }

  function buildMatrix() {
    var labels = [];
    var seen = {};
    RUNS.forEach(function (r) {
      if (r.group === 'Other') return;
      var key = r.group + '\u0000' + r.label;
      if (!seen[key]) { seen[key] = true; labels.push([r.group, r.label, r.condition]); }
    });
    labels.sort(function (a, b) {
      var d = GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]);
      return d || a[1].localeCompare(b[1]);
    });

    var html = '<thead><tr><th></th>' + HARNESSES.map(function (h) {
      return '<th>' + TPC.escapeHtml(h) + '</th>';
    }).join('') + '</tr></thead><tbody>';

    var lastGroup = null;
    labels.forEach(function (entry) {
      var group = entry[0], label = entry[1], condition = entry[2];
      if (group !== lastGroup) {
        lastGroup = group;
        html += '<tr class="matrix-group"><th class="row-head" colspan="' +
          (HARNESSES.length + 1) + '" style="text-align:left">' +
          '<span class="group-kicker">' + TPC.escapeHtml(group) + '</span></th></tr>';
      }
      html += '<tr><th class="row-head">' + TPC.escapeHtml(label) + '</th>';
      HARNESSES.forEach(function (harness) {
        var cell = RUNS.filter(function (r) {
          return r.condition === condition && r.harness === harness;
        });
        if (!cell.length) {
          html += '<td><span class="matrix-cell" data-empty>·</span></td>';
          return;
        }
        var rate = rateFor(cell);
        var tampered = cell.filter(function (r) { return r.verdict === 'tampered'; }).length;
        var undecided = cell.length - cell.filter(function (r) {
          return r.verdict !== 'inconclusive';
        }).length;
        html += '<td><button class="matrix-cell" style="background:' + shade(rate) + '"' +
          ' data-condition="' + TPC.escapeHtml(condition) + '"' +
          ' data-harness="' + TPC.escapeHtml(harness) + '"' +
          ' title="' + tampered + ' of ' + cell.length + ' runs tampered' +
          (undecided ? '; ' + undecided + ' inconclusive' : '') + '">' +
          '<span class="cell-rate">' + tampered + '/' + cell.length + '</span>' +
          (undecided ? ' <span class="cell-n">+' + undecided + '?</span>' : '') +
          '</button></td>';
      });
      html += '</tr>';
    });

    el.matrix.innerHTML = html + '</tbody>';
    el.matrix.addEventListener('click', function (event) {
      var cell = event.target.closest('.matrix-cell[data-condition]');
      if (!cell) return;
      FILTERS.group.value = '';
      FILTERS.condition.value = cell.dataset.condition;
      FILTERS.harness.value = cell.dataset.harness;
      apply();
      el.runs.scrollIntoView({ block: 'start' });
    });

    el.legend.innerHTML = 'runs that tampered / runs observed &nbsp;' +
      [0, 0.25, 0.5, 0.75, 1].map(function (r) {
        return '<span class="legend-swatch" style="background:' + shade(r) + '"></span>';
      }).join('') + '&nbsp; none → all &nbsp;·&nbsp; +n? = inconclusive';
  }

  function buildStats() {
    var tampered = RUNS.filter(function (r) { return r.verdict === 'tampered'; }).length;
    var conditions = {}, models = {};
    RUNS.forEach(function (r) { conditions[r.condition] = 1; models[r.model] = 1; });
    var stats = [
      [TPC.number(RUNS.length), 'runs'],
      [String(Object.keys(conditions).length), 'settings'],
      ['4', 'harnesses'],
      [String(Object.keys(models).length), 'models'],
      [TPC.number(tampered), 'tampered']
    ];
    el.stats.innerHTML = stats.map(function (s) {
      return '<div class="hero-stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
    }).join('');
  }

  // -------------------------------------------------------------- filters

  function fillSelect(select, values) {
    var keep = select.value;
    var first = select.querySelector('option').outerHTML;
    select.innerHTML = first + values.map(function (v) {
      return '<option value="' + TPC.escapeHtml(v[0]) + '">' +
        TPC.escapeHtml(v[1]) + '</option>';
    }).join('');
    select.value = keep;
  }

  function buildFilters() {
    fillSelect(FILTERS.group, GROUP_ORDER.filter(function (g) {
      return RUNS.some(function (r) { return r.group === g; });
    }).map(function (g) { return [g, g]; }));

    var conditions = [];
    var seen = {};
    RUNS.forEach(function (r) {
      if (seen[r.condition]) return;
      seen[r.condition] = 1;
      conditions.push([r.condition, r.label, r.group]);
    });
    conditions.sort(function (a, b) {
      return (GROUP_ORDER.indexOf(a[2]) - GROUP_ORDER.indexOf(b[2]))
        || a[1].localeCompare(b[1]);
    });
    fillSelect(FILTERS.condition, conditions.map(function (c) {
      return [c[0], c[1]];
    }));

    fillSelect(FILTERS.harness, HARNESSES.filter(function (h) {
      return RUNS.some(function (r) { return r.harness === h; });
    }).map(function (h) { return [h, h]; }));

    var models = [];
    RUNS.forEach(function (r) {
      if (models.indexOf(r.model) < 0) models.push(r.model);
    });
    models.sort();
    fillSelect(FILTERS.model, models.map(function (m) { return [m, m]; }));
  }

  function matches(run) {
    if (FILTERS.group.value && run.group !== FILTERS.group.value) return false;
    if (FILTERS.condition.value && run.condition !== FILTERS.condition.value) return false;
    if (FILTERS.harness.value && run.harness !== FILTERS.harness.value) return false;
    if (FILTERS.model.value && run.model !== FILTERS.model.value) return false;
    if (FILTERS.verdict.value && run.verdict !== FILTERS.verdict.value) return false;
    var q = el.q.value.trim().toLowerCase();
    if (!q) return true;
    return [run.run_id, run.label, run.condition, run.harness, run.model,
      run.headline, run.verdict].join(' ').toLowerCase().indexOf(q) >= 0;
  }

  var SORTS = {
    verdict: function (a, b) {
      var rank = { tampered: 0, clean: 1, inconclusive: 2 };
      return (rank[a.verdict] - rank[b.verdict]) || (b.events - a.events);
    },
    'events-desc': function (a, b) { return b.events - a.events; },
    'events-asc': function (a, b) { return a.events - b.events; },
    'cost-desc': function (a, b) { return (b.cost_usd || 0) - (a.cost_usd || 0); },
    'started-desc': function (a, b) {
      return String(b.started_at || '').localeCompare(String(a.started_at || ''));
    }
  };

  // --------------------------------------------------------------- render

  function runRow(run) {
    var flags = '';
    if (run.permission_denied) {
      flags += ' <span class="chip chip-alert" title="The harness blocked at least one tool call">denied</span>';
    }
    if (run.model_fallback) {
      flags += ' <span class="chip chip-warn" title="The model refused and the harness retried on a fallback model">fallback</span>';
    }
    if (run.status !== 'finished') {
      flags += ' <span class="chip" title="The harness did not exit cleanly">' +
        TPC.escapeHtml(run.status || 'unknown') + '</span>';
    }

    return '<tr data-id="' + TPC.escapeHtml(run.run_id) + '">' +
      '<td><span class="verdict verdict-' + run.verdict + '" title="' +
        TPC.escapeHtml(TPC.verdictTitle(run.verdict)) + '">' +
        TPC.verdictLabel(run.verdict) + '</span>' + flags + '</td>' +
      '<td>' + TPC.escapeHtml(run.label) +
        '<div class="run-model">' + TPC.escapeHtml(run.harness) + ' · ' +
        TPC.escapeHtml(run.model) + '</div></td>' +
      '<td class="muted optional">' + TPC.escapeHtml(run.headline || '') + '</td>' +
      '<td class="num optional">' + TPC.number(run.events) + '</td>' +
      '<td class="num optional">' + TPC.number(run.tool_calls) + '</td>' +
      '<td class="num optional">' + TPC.duration(run.elapsed_seconds) + '</td>' +
      '<td class="num optional">' + TPC.money(run.cost_usd) + '</td>' +
      '</tr>';
  }

  function table(rows) {
    return '<table class="runs"><thead><tr>' +
      '<th>outcome</th><th>setting</th><th class="optional">grader note</th>' +
      '<th class="num optional">events</th><th class="num optional">tools</th>' +
      '<th class="num optional">duration</th><th class="num optional">cost</th>' +
      '</tr></thead><tbody>' + rows.map(runRow).join('') + '</tbody></table>';
  }

  function render(rows) {
    var by = el.groupBy.value;
    var sorter = SORTS[el.sort.value] || SORTS.verdict;

    if (by === 'none') {
      el.runs.innerHTML = '<div class="group"><div class="group-body">' +
        table(rows.slice().sort(sorter)) + '</div></div>';
      return;
    }

    var keys = [];
    var buckets = {};
    rows.forEach(function (run) {
      var key = by === 'group' ? run.group
        : by === 'harness' ? run.harness
          : run.label;
      if (!buckets[key]) { buckets[key] = []; keys.push(key); }
      buckets[key].push(run);
    });

    if (by === 'condition') {
      keys.sort(function (a, b) {
        var ga = buckets[a][0].group, gb = buckets[b][0].group;
        return (GROUP_ORDER.indexOf(ga) - GROUP_ORDER.indexOf(gb)) || a.localeCompare(b);
      });
    } else if (by === 'group') {
      keys.sort(function (a, b) {
        return GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b);
      });
    } else {
      keys.sort();
    }

    el.runs.innerHTML = keys.map(function (key) {
      var bucket = buckets[key].slice().sort(sorter);
      var tampered = bucket.filter(function (r) { return r.verdict === 'tampered'; }).length;
      var kicker = by === 'condition'
        ? '<span class="group-kicker">' + TPC.escapeHtml(bucket[0].group) + '</span>' : '';
      return '<section class="group"><header class="group-head">' +
        '<span class="group-caret">▾</span>' + kicker +
        '<h2>' + TPC.escapeHtml(key) + '</h2>' +
        '<span class="group-meta">' + bucket.length + ' run' +
        (bucket.length === 1 ? '' : 's') + ' · ' + tampered + ' tampered</span>' +
        '</header><div class="group-body">' + table(bucket) + '</div></section>';
    }).join('');
  }

  function apply() {
    var rows = RUNS.filter(matches);
    el.empty.classList.toggle('hidden', rows.length > 0);
    el.runs.classList.toggle('hidden', rows.length === 0);
    el.count.textContent = rows.length === RUNS.length
      ? RUNS.length + ' runs'
      : rows.length + ' of ' + RUNS.length + ' runs';
    el.reset.classList.toggle('hidden', !anyFilter());
    if (rows.length) render(rows);
    writeUrl();
  }

  // ----------------------------------------------------------------- wire

  Object.keys(FILTERS).forEach(function (key) {
    FILTERS[key].addEventListener('change', function () {
      // Picking a specific setting makes its attack class redundant.
      if (key === 'condition' && FILTERS.condition.value) FILTERS.group.value = '';
      if (key === 'group' && FILTERS.group.value) FILTERS.condition.value = '';
      apply();
    });
  });

  var searchTimer;
  el.q.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(apply, 120);
  });

  el.groupBy.addEventListener('change', apply);
  el.sort.addEventListener('change', apply);

  el.reset.addEventListener('click', function () {
    Object.keys(FILTERS).forEach(function (k) { FILTERS[k].value = ''; });
    el.q.value = '';
    apply();
  });

  el.runs.addEventListener('click', function (event) {
    var head = event.target.closest('.group-head');
    if (head) {
      head.parentElement.toggleAttribute('data-collapsed');
      return;
    }
    var row = event.target.closest('tr[data-id]');
    if (row) {
      location.href = 'run.html?id=' + encodeURIComponent(row.dataset.id) +
        '&back=' + encodeURIComponent(location.search.slice(1));
    }
  });

  readUrl();
  TPC.loadIndex().then(function (data) {
    RUNS = data.runs;
    GROUP_ORDER = data.group_order;
    el.loading.classList.add('hidden');
    buildMatrix();
    buildStats();
    buildFilters();
    readUrl();
    apply();
  }).catch(function (err) {
    el.loading.innerHTML = '<p class="muted">Could not load the run index (' +
      TPC.escapeHtml(err.message) + '). If you are opening this file directly, ' +
      'serve the folder over HTTP instead — <code>python3 -m http.server</code>.</p>';
  });
})();

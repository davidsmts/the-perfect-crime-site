/* Shared by the catalog and the run page: theme, data loading, formatting. */

(function () {
  var stored;
  try { stored = localStorage.getItem('theme'); } catch (e) { /* private mode */ }
  if (!stored) {
    stored = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', stored);

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('theme-toggle');
    if (!button) return;
    button.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
    });
  });
})();

var TPC = (function () {
  var DATA_BASE = './data/';
  var indexPromise = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(DATA_BASE + 'index.json').then(function (r) {
        if (!r.ok) throw new Error('index.json: HTTP ' + r.status);
        return r.json();
      });
    }
    return indexPromise;
  }

  function loadRun(id) {
    return fetch(DATA_BASE + encodeURIComponent(id) + '.json').then(function (r) {
      if (!r.ok) throw new Error('run ' + id + ': HTTP ' + r.status);
      return r.json();
    });
  }

  var VERDICTS = {
    tampered: { label: 'tampered', title: 'The agent deleted, edited or fabricated trace content.' },
    clean: { label: 'no tampering', title: 'The run completed and the graders found no trace tampering.' },
    inconclusive: { label: 'inconclusive', title: 'The run failed or observation was incomplete.' }
  };

  function verdictLabel(v) { return (VERDICTS[v] || {}).label || v; }
  function verdictTitle(v) { return (VERDICTS[v] || {}).title || ''; }

  function duration(seconds) {
    if (seconds === null || seconds === undefined) return '—';
    var s = Math.round(seconds);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    return Math.floor(s / 3600) + 'h ' + Math.round((s % 3600) / 60) + 'm';
  }

  function money(v) {
    return (v === null || v === undefined) ? '—' : '$' + v.toFixed(2);
  }

  function number(v) {
    return (v === null || v === undefined) ? '—' : v.toLocaleString('en-US');
  }

  function clockTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d)) return '';
    return d.toISOString().slice(11, 19);
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Just enough markdown for agent prose: fenced code, inline code, bold,
     italics, headings, lists. Everything is escaped first, so this can never
     inject markup from trace content. */
  function markdown(src) {
    var text = escapeHtml(src || '');
    var blocks = [];
    text = text.replace(/```([\w+-]*)\n([\s\S]*?)```/g, function (_, lang, body) {
      blocks.push('<pre><code>' + body.replace(/\n$/, '') + '</code></pre>');
      return '\u0000' + (blocks.length - 1) + '\u0000';
    });
    text = text.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    var out = text.split(/\n{2,}/).map(function (para) {
      if (/^\u0000\d+\u0000$/.test(para.trim())) return para.trim();
      var heading = para.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        var level = Math.min(heading[1].length + 2, 6);
        return '<h' + level + '>' + heading[2] + '</h' + level + '>';
      }
      var lines = para.split('\n');
      if (lines.every(function (l) { return /^\s*[-*]\s+/.test(l); })) {
        return '<ul>' + lines.map(function (l) {
          return '<li>' + l.replace(/^\s*[-*]\s+/, '') + '</li>';
        }).join('') + '</ul>';
      }
      if (lines.every(function (l) { return /^\s*\d+[.)]\s+/.test(l); })) {
        return '<ol>' + lines.map(function (l) {
          return '<li>' + l.replace(/^\s*\d+[.)]\s+/, '') + '</li>';
        }).join('') + '</ol>';
      }
      return '<p>' + lines.join('<br>') + '</p>';
    }).join('');

    return out.replace(/\u0000(\d+)\u0000/g, function (_, i) { return blocks[i]; });
  }

  return {
    loadIndex: loadIndex,
    loadRun: loadRun,
    verdictLabel: verdictLabel,
    verdictTitle: verdictTitle,
    duration: duration,
    money: money,
    number: number,
    clockTime: clockTime,
    escapeHtml: escapeHtml,
    markdown: markdown
  };
})();

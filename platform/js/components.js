(function () {
  function copy() {
    return window.COPY[window.STATE.getLocale()] || window.COPY.ru;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function money(value) {
    return "$" + Number(value || 0).toLocaleString("en-US");
  }

  function pct(value) {
    return Number(value || 0).toLocaleString("en-US") + "%";
  }

  function manager(id) {
    return window.MOCK.managers.find(function (item) { return item.id === id; }) || window.MOCK.managers[0];
  }

  function call(id) {
    return window.MOCK.calls.find(function (item) { return item.id === id; }) || window.MOCK.calls[0];
  }

  function badge(status, label) {
    var text = label || copy().statuses[status] || copy().verdicts[status] || status;
    return '<span class="badge badge--' + escapeHtml(status) + '">' + escapeHtml(text) + '</span>';
  }

  function metricCard(opts) {
    var cls = "metric-card";
    if (opts.state) cls += " metric-card--" + opts.state;
    if (opts.action) cls += " clickable";
    return [
      '<article class="' + cls + '"' + (opts.action ? ' data-action="' + escapeHtml(opts.action) + '"' : "") + ">",
      '<div class="metric-label">' + escapeHtml(opts.label) + "</div>",
      '<div class="metric-value ' + (opts.display ? "metric-value--display" : "") + '">' + escapeHtml(opts.value) + "</div>",
      opts.trend ? '<div class="trend trend--' + escapeHtml(opts.trendState || "neutral") + '">' + escapeHtml(opts.trend) + "</div>" : "",
      "</article>"
    ].join("");
  }

  function riskCard(risk) {
    return [
      '<article class="risk-card clickable" data-action="route:owner/value-at-risk/' + escapeHtml(risk.id) + '">',
      '<div class="risk-label">' + escapeHtml(risk.label) + "</div>",
      '<div class="metric-value">' + money(risk.value) + "</div>",
      '<div class="risk-meta"><span>' + risk.calls + ' звонков</span><span>' + risk.managers.length + " менеджера</span></div>",
      "</article>"
    ].join("");
  }

  function avatar(initials) {
    return '<span class="avatar-sm">' + escapeHtml(initials) + "</span>";
  }

  function managerTable(managers, variant) {
    var rows = managers.map(function (item) {
      return [
        '<tr class="clickable" data-action="manager-calls:' + item.id + '">',
        '<td><div class="row-title">' + escapeHtml(item.name) + '</div><div class="row-sub">' + escapeHtml(item.role) + "</div></td>",
        '<td class="num">' + item.calls + "</td>",
        '<td class="num">' + item.score.toFixed(1) + ' <span class="' + (item.trend >= 0 ? "trend--good" : "trend--bad") + '">' + (item.trend >= 0 ? "+" : "") + item.trend.toFixed(1) + "</span></td>",
        variant === "full" ? '<td class="num">' + pct(item.conversion) + "</td>" : "",
        variant === "full" ? '<td class="num">' + money(item.avgDeal) + "</td>" : "",
        '<td class="num">' + money(item.risk) + "</td>",
        variant === "full" ? '<td class="num trend--good">' + money(item.saved) + "</td>" : "",
        variant === "full" ? '<td>' + escapeHtml(item.weakness) + "</td>" : "",
        '<td>' + badge(item.status) + "</td>",
        "</tr>"
      ].join("");
    }).join("");

    return [
      '<table class="table">',
      "<thead><tr>",
      "<th>Менеджер</th><th>Calls</th><th>Quality</th>",
      variant === "full" ? "<th>Conv.</th><th>Avg deal</th>" : "",
      "<th>Money at risk</th>",
      variant === "full" ? "<th>Saved</th><th>Weakness</th>" : "",
      "<th>Status</th>",
      "</tr></thead>",
      "<tbody>" + rows + "</tbody>",
      "</table>"
    ].join("");
  }

  function callRows(calls) {
    return calls.map(function (item) {
      var m = manager(item.managerId);
      return [
        '<article class="call-row clickable" data-action="open-call:' + escapeHtml(item.id) + '">',
        avatar(m.avatar),
        '<div><div class="row-title">' + escapeHtml(item.client) + ' · ' + escapeHtml(m.name) + '</div>',
        '<div class="row-sub">' + escapeHtml(item.date) + " · " + escapeHtml(item.duration) + " · " + escapeHtml(item.summary) + "</div>",
        '<div class="row-sub">' + item.tags.map(function (tag) { return "#" + escapeHtml(tag); }).join(" ") + "</div></div>",
        '<div><div class="metric-value" style="font-size:20px">' + money(item.risk) + '</div><div class="row-sub">score <span class="num">' + item.score.toFixed(1) + "</span></div></div>",
        "</article>"
      ].join("");
    }).join("");
  }

  function pageHead(eyebrow, title, subtitle, right) {
    return [
      '<div class="page-head"><div>',
      '<div class="eyebrow">' + escapeHtml(eyebrow) + "</div>",
      '<h1 class="page-title">' + escapeHtml(title) + "</h1>",
      subtitle ? '<p class="page-subtitle">' + escapeHtml(subtitle) + "</p>" : "",
      "</div>",
      right || "",
      "</div>"
    ].join("");
  }

  function renderSidebar() {
    var role = window.STATE.getRole();
    var c = copy();
    var items = role === "owner"
      ? [
        ["owner/dashboard", c.nav.ownerDashboard],
        ["owner/value-at-risk", c.nav.valueAtRisk],
        ["owner/marketing-vs-sales", c.nav.marketingVsSales],
        ["owner/calls", c.nav.calls],
        ["gold-calls", c.nav.goldCalls]
      ]
      : role === "rop"
        ? [
          ["rop/today", c.nav.ropToday],
          ["rop/calls", c.nav.calls],
          ["rop/managers", c.nav.managers],
          ["gold-calls", c.nav.goldCalls]
        ]
        : [
          ["manager/dashboard", "Мой прогресс"],
          ["manager/calls", "Мои звонки"],
          ["gold-calls", c.nav.goldCalls]
        ];

    return [
      '<div class="brand"><div class="brand__name">CallControl AI</div><div class="brand__tag">Platform demo · Phase 1</div></div>',
      '<nav class="nav-group">',
      items.map(function (item) {
        return '<a class="nav-link" href="#' + item[0] + '" data-route="' + item[0] + '"><span>' + escapeHtml(item[1]) + '</span><span>›</span></a>';
      }).join(""),
      "</nav>",
      '<div class="sidebar-bottom">Static product demo · no real auth<br>Role: ' + escapeHtml(c.roles[role]) + '<br><a href="/">Landing</a> · <a href="/client.html">Client MVP</a></div>'
    ].join("");
  }

  function renderTopbar() {
    var role = window.STATE.getRole();
    var locale = window.STATE.getLocale();
    var period = window.STATE.getPeriod();
    var c = copy();
    return [
      '<div class="workspace-pill"><span>VortexSales LLC</span><span class="muted">30d</span></div>',
      '<div class="period-picker">',
      ["7d", "30d", "90d"].map(function (item) {
        return '<button class="seg-btn ' + (period === item ? "active" : "") + '" data-action="period:' + item + '">' + item + "</button>";
      }).join(""),
      "</div>",
      '<div class="topbar-spacer"></div>',
      '<nav class="demo-links" aria-label="Demo routes">',
      '<a class="demo-link" href="/">Landing</a>',
      '<a class="demo-link" href="/client.html">Client</a>',
      '<a class="demo-link" href="/admin.html">Admin</a>',
      '<a class="demo-link demo-link--accent" href="/#request">Request audit</a>',
      "</nav>",
      '<div class="locale-switcher">',
      ["ru", "ua", "en"].map(function (item) {
        return '<button class="seg-btn ' + (locale === item ? "active" : "") + '" data-action="locale:' + item + '">' + item.toUpperCase() + "</button>";
      }).join(""),
      "</div>",
      '<div class="role-switcher">',
      ["owner", "rop", "manager"].map(function (item) {
        return '<button class="seg-btn ' + (role === item ? "active" : "") + '" data-action="role:' + item + '">' + escapeHtml(c.roles[item]) + "</button>";
      }).join(""),
      "</div>",
      '<div class="avatar">AM</div>'
    ].join("");
  }

  function toast(message) {
    var container = document.getElementById("toast-container");
    if (!container) return;
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  window.UI = {
    copy: copy,
    escapeHtml: escapeHtml,
    money: money,
    pct: pct,
    manager: manager,
    call: call,
    badge: badge,
    metricCard: metricCard,
    riskCard: riskCard,
    avatar: avatar,
    managerTable: managerTable,
    callRows: callRows,
    pageHead: pageHead,
    renderSidebar: renderSidebar,
    renderTopbar: renderTopbar,
    toast: toast
  };
})();

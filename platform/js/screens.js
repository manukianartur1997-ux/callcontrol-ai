(function () {
  function ownerDashboard() {
    var m = window.MOCK.metrics;
    var top = window.MOCK.managers.slice().sort(function (a, b) { return b.saved - a.saved; }).slice(0, 3);
    var bottom = window.MOCK.managers.slice().sort(function (a, b) { return b.risk - a.risk; }).slice(0, 3);
    return [
      UI.pageHead("Owner view", "Финансовая картина", "Первый экран для собственника: сколько денег под риском, где причина и в какие звонки надо провалиться."),
      '<div class="grid owner-hero">',
      UI.metricCard({ label: "Деньги под риском · 30d", value: UI.money(m.valueAtRisk), trend: "+ " + UI.money(m.trend) + " vs прошлый период", trendState: "bad", state: "risk", display: true, action: "route:owner/value-at-risk" }),
      '<article class="metric-card clickable" data-action="route:owner/marketing-vs-sales"><div class="metric-label">Verdict</div><div style="margin-top:16px">' + UI.badge(m.verdict) + '</div><p class="page-subtitle" style="margin-top:16px">' + UI.escapeHtml(m.verdictText) + '</p><div class="trend">confidence ' + m.verdictConfidence + "%</div></article>",
      UI.metricCard({ label: "Звонков проверено", value: String(m.callsAudited), trend: "+" + m.callsTrend + " за период", trendState: "good" }),
      "</div>",
      '<section class="section"><h2 class="section-title">Где теряются деньги</h2><div class="grid grid-4">',
      window.MOCK.risks.map(UI.riskCard).join(""),
      "</div></section>",
      '<section class="section grid grid-2">',
      '<div class="card"><h2 class="section-title">Top performers</h2>' + UI.managerTable(top, "compact") + "</div>",
      '<div class="card"><h2 class="section-title">Critical attention</h2>' + UI.managerTable(bottom, "compact") + "</div>",
      "</section>"
    ].join("");
  }

  function valueAtRisk(riskId) {
    var selected = window.MOCK.risks.find(function (risk) { return risk.id === riskId; }) || window.MOCK.risks[0];
    var rows = window.MOCK.risks.map(function (risk) {
      return [
        '<tr class="clickable" data-action="route:owner/value-at-risk/' + risk.id + '">',
        '<td><div class="row-title">' + UI.escapeHtml(risk.label) + '</div><div class="row-sub">' + UI.escapeHtml(risk.recommendation) + "</div></td>",
        '<td class="num">' + risk.calls + "</td>",
        '<td class="num">' + UI.money(risk.value) + "</td>",
        '<td class="num">' + UI.money(risk.avg) + "</td>",
        '<td>' + UI.badge(risk.severity, risk.severity) + "</td>",
        "</tr>"
      ].join("");
    }).join("");
    var quoteCards = selected.quotes.map(function (id) {
      var call = UI.call(id);
      var manager = UI.manager(call.managerId);
      var firstWeak = call.weaknesses[0] || call.summary;
      return [
        '<article class="quote-card clickable" data-action="open-call:' + call.id + '">',
        "<blockquote>“" + UI.escapeHtml(firstWeak) + "”</blockquote>",
        '<div class="risk-meta"><span>' + UI.escapeHtml(manager.name) + " · " + UI.escapeHtml(call.client) + '</span><span class="num">' + UI.money(call.risk) + "</span></div>",
        "</article>"
      ].join("");
    }).join("");

    return [
      UI.pageHead("Owner drilldown", "Деньги под риском", "Каждый риск связан с деньгами, менеджерами и конкретными цитатами из звонков."),
      '<div class="split-view">',
      '<div><table class="table"><thead><tr><th>Risk type</th><th>Calls</th><th>Value</th><th>Avg</th><th>Severity</th></tr></thead><tbody>' + rows + "</tbody></table></div>",
      '<aside class="panel detail-panel"><div class="eyebrow">Selected risk</div><h2 class="section-title">' + UI.escapeHtml(selected.label) + '</h2><p class="page-subtitle">' + UI.escapeHtml(selected.recommendation) + '</p><div class="grid grid-2" style="margin-top:18px">' + UI.metricCard({ label: "Value at risk", value: UI.money(selected.value), state: "risk" }) + UI.metricCard({ label: "Calls", value: String(selected.calls) }) + '</div><div class="quote-list">' + quoteCards + "</div></aside>",
      "</div>"
    ].join("");
  }

  function ropToday() {
    var risky = window.MOCK.calls.filter(function (item) { return item.risk > 0; }).slice(0, 3);
    var managers = window.MOCK.managers.slice().sort(function (a, b) { return b.risk - a.risk; }).slice(0, 4);
    return [
      UI.pageHead("Head of Sales view", "Сегодня", "Утренний экран РОПа: какие звонки проверить, какие менеджеры требуют внимания и где не ждать конца месяца."),
      '<div class="grid grid-3">',
      UI.metricCard({ label: "Требуют review", value: String(risky.length), trend: "high-value calls", state: "risk" }),
      UI.metricCard({ label: "Avg quality · 7d", value: "7.4", trend: "+0.2 vs week", trendState: "good" }),
      UI.metricCard({ label: "Open disputes", value: "2", trend: "1 needs decision", trendState: "bad" }),
      "</div>",
      '<section class="section grid grid-2">',
      '<div class="card"><h2 class="section-title">Priority queue</h2><div class="priority-list">' + UI.callRows(risky) + "</div></div>",
      '<div class="card"><h2 class="section-title">Team health</h2>' + UI.managerTable(managers, "compact") + '<div class="section"><button class="btn" data-action="route:rop/calls">Открыть очередь риска</button> <button class="btn" data-action="open-digest">Telegram Digest</button></div></div>',
      "</section>"
    ].join("");
  }

  function callsQueue(managerId) {
    var role = window.STATE.getRole();
    var calls = window.MOCK.calls.filter(function (item) {
      return !managerId || item.managerId === managerId;
    });
    return [
      UI.pageHead(role === "manager" ? "Manager view" : "Risk queue", role === "manager" ? "Мои звонки" : "Очередь риска", "Рабочая поверхность для разбора звонков. Phase 1: фильтры статичные, клики ведут в полный разбор."),
      '<div class="queue-layout">',
      '<aside class="card"><h2 class="section-title">Views</h2><div class="filter-list"><button class="filter-btn active"><span>All</span><span>' + calls.length + '</span></button><button class="filter-btn"><span>Critical</span><span>2</span></button><button class="filter-btn"><span>Reviewed</span><span>1</span></button><button class="filter-btn"><span>Gold</span><span>1</span></button></div></aside>',
      '<div class="call-list">' + UI.callRows(calls) + "</div>",
      "</div>"
    ].join("");
  }

  function callDetail(id) {
    var item = UI.call(id);
    var manager = UI.manager(item.managerId);
    var transcript = item.transcript.map(function (line) {
      var highlight = item.highlights[line[0]];
      var text = UI.escapeHtml(line[2]);
      if (highlight) text = '<span class="highlight highlight--' + highlight + '">' + text + "</span>";
      return '<div class="transcript-line"><span class="ts">' + UI.escapeHtml(line[0]) + '</span><span class="speaker">' + UI.escapeHtml(line[1]) + '</span><span>' + text + "</span></div>";
    }).join("");
    var strengths = item.strengths.map(function (text) { return "<li>" + UI.escapeHtml(text) + "</li>"; }).join("");
    var weaknesses = item.weaknesses.map(function (text) { return "<li>" + UI.escapeHtml(text) + "</li>"; }).join("");
    return [
      '<div class="call-detail">',
      '<div class="card call-strip"><div><div class="eyebrow">Call detail</div><h1 class="page-title">' + UI.escapeHtml(item.client) + ' · ' + UI.escapeHtml(manager.name) + '</h1><p class="page-subtitle">' + UI.escapeHtml(item.date) + " · " + UI.escapeHtml(item.duration) + " · " + UI.escapeHtml(item.stage) + '</p></div><div>' + UI.badge(item.verdict) + '</div><div class="metric-value" style="font-size:28px">' + UI.money(item.risk) + "</div></div>",
      '<div class="call-body">',
      '<section class="card transcript"><h2 class="section-title">Transcript with AI annotations</h2>' + transcript + "</section>",
      '<aside class="card"><div class="analysis-section"><div class="eyebrow">Quality score</div><div class="metric-value">' + item.score.toFixed(1) + '/10</div><p class="page-subtitle">' + UI.escapeHtml(item.summary) + '</p></div><div class="analysis-section"><h3>Strengths</h3><ul class="analysis-list">' + strengths + '</ul></div><div class="analysis-section"><h3>Weaknesses</h3><ul class="analysis-list">' + weaknesses + '</ul></div><div class="analysis-section action-strip"><button class="btn" data-action="mark-gold">Mark as Gold</button><button class="btn btn--danger" data-action="open-dispute:' + item.id + '">Dispute AI Score</button><button class="btn" data-action="send-crm">Send to CRM</button></div></aside>',
      "</div>",
      "</div>"
    ].join("");
  }

  function marketingVsSales() {
    return [
      UI.pageHead("Owner verdict", "Маркетинг vs Продажи", "Показываем собственнику, где источник потерь: в качестве лидов или в обработке целевых лидов отделом продаж."),
      '<div class="grid grid-3">',
      UI.metricCard({ label: "Sales-side losses", value: "67%", trend: UI.money(98700) + " under sales control", state: "risk" }),
      UI.metricCard({ label: "Marketing-side losses", value: "33%", trend: UI.money(48700) + " bad-fit or weak source", state: "default" }),
      UI.metricCard({ label: "Verdict confidence", value: "84%", trend: "based on 247 calls", trendState: "good" }),
      "</div>",
      '<section class="section verdict-layout">',
      '<div class="card verdict-column"><h2 class="section-title">Sales execution</h2><p class="page-subtitle">Лид был целевым, боль и бюджет были подтверждены, но менеджер не довёл звонок до следующего шага.</p><div class="bar-row"><span>Price objection</span><div class="bar-track"><div class="bar-fill" style="width:72%"></div></div><span class="num">$54.2k</span></div><div class="bar-row"><span>No next step</span><div class="bar-track"><div class="bar-fill" style="width:58%"></div></div><span class="num">$28.4k</span></div><div class="quote-card clickable" data-action="open-call:c001"><blockquote>“Ну тогда подумайте, наберёте если что.”</blockquote><div class="risk-meta"><span>Целевой лид · бюджет обсуждался</span><span class="num">$12.4k</span></div></div></div>',
      '<div class="card verdict-column"><h2 class="section-title">Marketing quality</h2><p class="page-subtitle">Часть потерь приходит из источников, где лид не подходит по размеру, timing или ожиданиям от продукта.</p><div class="bar-row"><span>Bad-fit source</span><div class="bar-track"><div class="bar-fill" style="width:44%;background:var(--status-warning)"></div></div><span class="num">$26.8k</span></div><div class="bar-row"><span>Offer mismatch</span><div class="bar-track"><div class="bar-fill" style="width:32%;background:var(--status-warning)"></div></div><span class="num">$21.9k</span></div><div class="quote-card clickable" data-action="open-call:c003"><blockquote>“Мы бюджет вообще ещё не обсуждали.”</blockquote><div class="risk-meta"><span>Google Ads · квалификация сломалась</span><span class="num">$4.8k</span></div></div></div>',
      "</section>"
    ].join("");
  }

  function managerRanking() {
    return UI.pageHead("Phase 2", "Команда", "Пока показываем таблицу уже готовыми компонентами; полный manager ranking с сортировкой докрутим во второй фазе.") + '<div class="card">' + UI.managerTable(window.MOCK.managers, "full") + "</div>";
  }

  function goldCalls() {
    var gold = window.MOCK.calls.filter(function (item) { return item.tags.indexOf("gold-call") >= 0; });
    var fallback = gold.length ? gold : [window.MOCK.calls[1]];
    var cards = fallback.map(function (item) {
      var m = UI.manager(item.managerId);
      return [
        '<article class="gold-card clickable" data-action="open-call:' + item.id + '">',
        '<div class="eyebrow">Gold call</div>',
        '<h2 class="section-title">' + UI.escapeHtml(m.name) + '</h2>',
        '<p class="page-subtitle">' + UI.escapeHtml(item.client) + " · " + UI.escapeHtml(item.summary) + "</p>",
        '<div class="risk-meta"><span>' + UI.escapeHtml(item.duration) + '</span><span>used in 4 sessions</span></div>',
        "</article>"
      ].join("");
    }).join("");
    return UI.pageHead("Team library", "Gold-звонки", "Библиотека лучших звонков: РОП назначает их менеджерам как эталонные примеры.") + '<div class="gold-grid">' + cards + cards + cards + "</div>";
  }

  function managerDashboard() {
    var myCalls = window.MOCK.calls.filter(function (item) { return item.managerId === "m2"; });
    return [
      UI.pageHead("Manager view", "Мой прогресс", "Менеджер видит рост и конкретные подсказки, а не публичный рейтинг. Это снижает сопротивление продукту."),
      '<div class="grid grid-3">',
      UI.metricCard({ label: "Мой score · 7d", value: "7.6", trend: "+0.3 vs моя прошлая неделя", trendState: "good" }),
      UI.metricCard({ label: "Звонков", value: "14", trend: "4 reviewed by РОП" }),
      UI.metricCard({ label: "Gold calls", value: "1", trend: "earned this week", trendState: "good" }),
      "</div>",
      '<section class="section manager-growth">',
      '<div class="card"><h2 class="section-title">Что получается</h2><ul class="analysis-list"><li>Discovery стал глубже: клиент чаще называет конкретную операционную боль.</li><li>Тон разговора стабильный, без давления и защитной позиции.</li><li>Сильная презентация после выявления контекста.</li></ul></div>',
      '<div class="card"><h2 class="section-title">Точки роста</h2><ul class="analysis-list"><li>Next step иногда звучит мягко. Нужны дата, время и ответственность.</li><li>Послушать gold call Сергея на 12:34 по “я подумаю”.</li></ul><button class="btn" data-action="route:gold-calls">Открыть Gold calls</button></div>',
      "</section>",
      '<section class="section"><h2 class="section-title">Мои последние звонки</h2><div class="call-list">' + UI.callRows(myCalls) + "</div></section>"
    ].join("");
  }

  function notFound(path) {
    return '<div class="not-found"><div><h1>Экран не найден</h1><p class="page-subtitle">Hash route: ' + UI.escapeHtml(path || "") + '</p><p><button class="btn btn--primary" data-action="route:owner/dashboard">На главную</button></p></div></div>';
  }

  window.SCREENS = {
    ownerDashboard: ownerDashboard,
    valueAtRisk: valueAtRisk,
    ropToday: ropToday,
    callsQueue: callsQueue,
    callDetail: callDetail,
    marketingVsSales: marketingVsSales,
    managerRanking: managerRanking,
    goldCalls: goldCalls,
    managerDashboard: managerDashboard,
    notFound: notFound
  };
})();

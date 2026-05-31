(function () {
  function openModal(html) {
    var modal = document.getElementById("demo-modal");
    modal.innerHTML = html;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "open");
  }

  function closeModal() {
    var modal = document.getElementById("demo-modal");
    if (modal.open && typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }

  function dispute(callId) {
    var call = window.UI.call(callId);
    openModal([
      '<div class="modal-body">',
      '<div class="modal-head"><div><div class="eyebrow">Manager adoption</div><h2 class="modal-title">Оспорить AI-оценку</h2></div><button class="modal-close" data-action="close-modal">×</button></div>',
      '<div class="card" style="padding:14px"><div class="risk-meta"><span>Текущий score</span><span class="num">' + call.score.toFixed(1) + '/10</span></div><p class="page-subtitle">' + window.UI.escapeHtml(call.weaknesses[0] || call.summary) + '</p></div>',
      '<label class="field">Почему вы не согласны?<textarea required placeholder="Опишите конкретно, какой контекст AI пропустил"></textarea></label>',
      '<label class="field">Какой score правильный?<input type="range" min="0" max="10" step="0.1" value="' + Math.min(10, call.score + 1).toFixed(1) + '"></label>',
      '<label class="field">Timestamp доказательства<input placeholder="Например: 20:14"></label>',
      '<div class="modal-footer"><button class="btn" data-action="close-modal">Отмена</button><button class="btn btn--primary" data-action="submit-dispute">Подать dispute</button></div>',
      "</div>"
    ].join(""));
  }

  function digest() {
    openModal([
      '<div class="modal-body">',
      '<div class="modal-head"><div><div class="eyebrow">Retention hook</div><h2 class="modal-title">Telegram Digest</h2></div><button class="modal-close" data-action="close-modal">×</button></div>',
      '<div class="telegram-bubble">CallControl AI · Утренний отчёт\\n27 мая · вторник\\n\\nВчера: 23 звонка проверено\\n\\nТребует внимания:\\n1. Алексей · ABC Corp · потенциал $12.4k\\n   Не назначен следующий шаг\\n\\n2. Мария · RetailPro · потенциал $2.4k\\n   Next step сформулирован слишком мягко\\n\\nGold Call найден:\\nСергей развернул “я подумаю” через возврат к боли\\n\\nЗа 7 дней:\\nAvg score: 7.4 → 7.6\\nMoney at risk: -$12k</div>',
      '<p class="page-subtitle">Доставка: 09:00 каждый рабочий день. В реальном MVP РОП сможет настраивать пороги риска и список получателей.</p>',
      '<div class="modal-footer"><button class="btn btn--primary" data-action="close-modal">Понятно</button></div>',
      "</div>"
    ].join(""));
  }

  window.MODALS = {
    dispute: dispute,
    digest: digest,
    close: closeModal
  };
})();

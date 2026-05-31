(function () {
  document.body.addEventListener("click", function (event) {
    var target = event.target.closest("[data-action]");
    if (!target) return;
    var action = target.dataset.action || "";
    var parts = action.split(":");
    var type = parts[0];
    var value = parts.slice(1).join(":");
    var c = window.UI.copy();

    if (type === "route") {
      window.location.hash = value;
      return;
    }
    if (type === "open-call") {
      var role = window.STATE.getRole();
      var prefix = role === "owner" ? "owner" : role === "manager" ? "manager" : "rop";
      window.location.hash = prefix + "/calls/" + value;
      return;
    }
    if (type === "role") {
      window.STATE.setRole(value);
      return;
    }
    if (type === "locale") {
      window.STATE.setLocale(value);
      return;
    }
    if (type === "period") {
      window.STATE.setPeriod(value);
      window.UI.toast("Период переключен: " + value);
      return;
    }
    if (type === "manager-calls") {
      window.location.hash = "rop/calls/manager/" + value;
      return;
    }
    if (type === "mark-gold") {
      window.UI.toast(c.actions.markedGold);
      return;
    }
    if (type === "send-crm") {
      window.UI.toast(c.actions.sentCrm);
      return;
    }
    if (type === "open-dispute") {
      window.MODALS.dispute(value);
      return;
    }
    if (type === "open-digest") {
      window.MODALS.digest();
      return;
    }
    if (type === "close-modal") {
      window.MODALS.close();
      return;
    }
    if (type === "submit-dispute") {
      window.MODALS.close();
      window.UI.toast("Dispute подан. РОП получит уведомление в Telegram.");
      return;
    }
    if (type === "toast") {
      window.UI.toast(value || c.actions.phaseTwo);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && window.MODALS) window.MODALS.close();
  });
})();

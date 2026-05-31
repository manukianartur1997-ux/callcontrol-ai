(function () {
  function defaultRoute() {
    var role = window.STATE.getRole();
    return role === "owner" ? "owner/dashboard" : role === "rop" ? "rop/today" : "manager/dashboard";
  }

  function currentPath() {
    return window.location.hash.replace(/^#/, "") || defaultRoute();
  }

  function render() {
    var path = currentPath();
    if (!window.location.hash) {
      window.location.hash = path;
      return;
    }
    var html;
    var parts = path.split("/");

    if (path === "owner/dashboard") html = window.SCREENS.ownerDashboard();
    else if (parts[0] === "owner" && parts[1] === "value-at-risk") html = window.SCREENS.valueAtRisk(parts[2]);
    else if (path === "owner/marketing-vs-sales") html = window.SCREENS.marketingVsSales();
    else if (path === "owner/calls") html = window.SCREENS.callsQueue();
    else if (parts[0] === "owner" && parts[1] === "calls") html = window.SCREENS.callDetail(parts[2]);
    else if (path === "rop/today") html = window.SCREENS.ropToday();
    else if (path === "rop/managers") html = window.SCREENS.managerRanking();
    else if (path === "rop/calls") html = window.SCREENS.callsQueue();
    else if (parts[0] === "rop" && parts[1] === "calls" && parts[2] === "manager") html = window.SCREENS.callsQueue(parts[3]);
    else if (parts[0] === "rop" && parts[1] === "calls") html = window.SCREENS.callDetail(parts[2]);
    else if (path === "manager/dashboard") html = window.SCREENS.managerDashboard();
    else if (path === "manager/calls") html = window.SCREENS.callsQueue(window.MOCK.managers[1].id);
    else if (parts[0] === "manager" && parts[1] === "calls") html = window.SCREENS.callDetail(parts[2]);
    else if (path === "gold-calls") html = window.SCREENS.goldCalls();
    else html = window.SCREENS.notFound(path);

    document.getElementById("main-content").innerHTML = html;
    highlightActive(path);
  }

  function highlightActive(path) {
    document.querySelectorAll("#sidebar [data-route]").forEach(function (item) {
      item.classList.toggle("active", path === item.dataset.route || path.indexOf(item.dataset.route + "/") === 0);
    });
  }

  window.router = render;
  window.addEventListener("hashchange", render);
})();

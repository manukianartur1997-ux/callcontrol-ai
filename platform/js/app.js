(function () {
  window.renderAppShell = function () {
    document.getElementById("sidebar").innerHTML = window.UI.renderSidebar();
    document.getElementById("topbar").innerHTML = window.UI.renderTopbar();
  };

  window.addEventListener("load", function () {
    window.renderAppShell();
    window.router();
  });
})();

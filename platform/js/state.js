(function () {
  function safeGet(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Demo remains usable without storage.
    }
  }

  window.STATE = {
    getRole: function () {
      return safeGet("cc:role", "owner");
    },
    setRole: function (role) {
      safeSet("cc:role", role);
      window.location.hash = role === "owner" ? "owner/dashboard" : role === "rop" ? "rop/today" : "manager/dashboard";
      window.renderAppShell();
    },
    getLocale: function () {
      return safeGet("cc:locale", "ru");
    },
    setLocale: function (locale) {
      safeSet("cc:locale", locale);
      window.renderAppShell();
      window.router();
    },
    getPeriod: function () {
      return safeGet("cc:period", "30d");
    },
    setPeriod: function (period) {
      safeSet("cc:period", period);
      window.router();
      window.renderAppShell();
    }
  };
})();

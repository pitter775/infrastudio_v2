(function () {
  var existing = window.InfraChat || {};
  var runtime = {
    bridgeScriptId: null,
    widgetSlug: null,
  };

  function getCurrentScript() {
    if (document.currentScript) {
      return document.currentScript;
    }

    var scripts = document.querySelectorAll("script[src]");
    for (var index = scripts.length - 1; index >= 0; index -= 1) {
      var candidate = scripts[index];
      var src = candidate.getAttribute("src") || "";
      if (src.indexOf("/chat.js") !== -1) {
        return candidate;
      }
    }

    return null;
  }

  function removeBridgeScript() {
    if (!runtime.bridgeScriptId) {
      return;
    }

    var current = document.getElementById(runtime.bridgeScriptId);
    if (current && current.parentNode) {
      current.parentNode.removeChild(current);
    }

    runtime.bridgeScriptId = null;
  }

  function destroyLegacy(slug) {
    var requestedSlug = String(slug || runtime.widgetSlug || "").trim();

    if (window.InfraChatWidget) {
      if (requestedSlug && typeof window.InfraChatWidget.destroy === "function") {
        window.InfraChatWidget.destroy(requestedSlug);
      } else if (typeof window.InfraChatWidget.destroyAll === "function") {
        window.InfraChatWidget.destroyAll();
      }
    }

    removeBridgeScript();
    runtime.widgetSlug = null;
    return true;
  }

  async function resolveConfig(script) {
    var widgetSlug = script.getAttribute("data-widget") || "";
    var projeto = script.getAttribute("data-projeto") || "";
    var agente = script.getAttribute("data-agente") || "";
    var apiBase = script.getAttribute("data-api-base") || new URL(script.src, window.location.href).origin;

    if (widgetSlug.trim()) {
      return {
        widgetSlug: widgetSlug.trim(),
        title: script.getAttribute("data-title") || "",
        theme: script.getAttribute("data-theme") || "",
        accent: script.getAttribute("data-accent") || "",
        transparent: script.getAttribute("data-transparent"),
        apiBase: apiBase,
      };
    }

    if (!projeto.trim() || !agente.trim()) {
      throw new Error("Informe `data-widget` ou o par `data-projeto` + `data-agente`.");
    }

    var params = new URLSearchParams({
      projeto: projeto.trim(),
      agente: agente.trim(),
    });
    var response = await fetch(apiBase + "/api/chat/config?" + params.toString(), {
      method: "GET",
      credentials: "omit",
    });
    var payload = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(payload.error || "Nao foi possivel resolver a configuracao do chat.");
    }

    if (!payload.widget || !payload.widget.slug) {
      throw new Error("Nenhum widget valido foi encontrado para este projeto.");
    }

    return {
      widgetSlug: payload.widget.slug,
      title: payload.ui && payload.ui.title ? payload.ui.title : "",
      theme: payload.ui && payload.ui.theme ? payload.ui.theme : "",
      accent: payload.ui && payload.ui.accent ? payload.ui.accent : "",
      transparent:
        payload.ui && typeof payload.ui.transparent === "boolean"
          ? String(payload.ui.transparent)
          : null,
      apiBase: apiBase,
    };
  }

  function injectWidgetScript(config) {
    destroyLegacy(config.widgetSlug);

    var script = document.createElement("script");
    runtime.bridgeScriptId = "infrastudio-chat-bridge-" + config.widgetSlug;
    runtime.widgetSlug = config.widgetSlug;
    script.id = runtime.bridgeScriptId;
    script.src = config.apiBase.replace(/\/$/, "") + "/chat-widget.js";
    script.defer = true;
    script.setAttribute("data-widget", config.widgetSlug);
    script.setAttribute("data-api-base", config.apiBase);

    if (config.title) {
      script.setAttribute("data-title", config.title);
    }
    if (config.theme) {
      script.setAttribute("data-theme", config.theme);
    }
    if (config.accent) {
      script.setAttribute("data-accent", config.accent);
    }
    if (config.transparent === "true" || config.transparent === "false") {
      script.setAttribute("data-transparent", config.transparent);
    }

    document.body.appendChild(script);
  }

  async function boot() {
    var script = getCurrentScript();
    if (!script) {
      return;
    }

    try {
      var config = await resolveConfig(script);
      injectWidgetScript(config);
    } catch (error) {
      console.error("[InfraStudio Chat] compat bridge failed", error);
    }
  }

  window.InfraChat = {
    ...existing,
    destroy: destroyLegacy,
    destroyAll: function () {
      return destroyLegacy("");
    },
  };

  boot();
})();

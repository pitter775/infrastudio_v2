(function () {
  var existing = window.InfraChat;
  var queue = existing && Array.isArray(existing.__queue) ? existing.__queue : [];
  var runtime = {
    instance: null,
    logs: [],
    blockedReason: null,
    strictHostControl: true,
  };

  function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) {
      return value.map(clone);
    }

    if (isRecord(value)) {
      var output = {};
      for (var key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          output[key] = clone(value[key]);
        }
      }
      return output;
    }

    return value;
  }

  function mergeDeep(base, patch) {
    var output = isRecord(base) ? clone(base) : {};
    if (!isRecord(patch)) {
      return output;
    }

    for (var key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) {
        continue;
      }

      if (isRecord(output[key]) && isRecord(patch[key])) {
        output[key] = mergeDeep(output[key], patch[key]);
      } else {
        output[key] = clone(patch[key]);
      }
    }

    return output;
  }

  function getValueByPath(source, path) {
    return String(path || "").split(".").reduce(function (current, segment) {
      if (!isRecord(current)) {
        return null;
      }

      return Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : null;
    }, source);
  }

  function readScriptDefaults() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.querySelectorAll("script[src]");
      for (var index = scripts.length - 1; index >= 0; index -= 1) {
        var candidate = scripts[index];
        var src = candidate.getAttribute("src") || "";
        if (src.indexOf("/chat.js") !== -1) {
          script = candidate;
          break;
        }
      }
    }

    if (!script) {
      return {};
    }

    return {
      projeto: (script.getAttribute("data-projeto") || "").trim() || null,
      agente: (script.getAttribute("data-agente") || "").trim() || null,
      apiBase: (script.getAttribute("data-api-base") || new URL(script.src, window.location.href).origin).trim(),
    };
  }

  var defaults = readScriptDefaults();

  function emitLifecycle(eventName, payload) {
    var entry = {
      event: eventName,
      timestamp: new Date().toISOString(),
      payload: payload ? clone(payload) : {},
    };

    runtime.logs.push(entry);
    if (runtime.logs.length > 40) {
      runtime.logs.shift();
    }

    try {
      console.info("[InfraStudio Chat]", eventName, entry.payload);
    } catch (error) {
      console.log("[InfraStudio Chat]", eventName);
    }
  }

  function getCurrentRoute(config, context) {
    return getValueByPath(context, "route.path")
      || getValueByPath(context, "rota.path")
      || getValueByPath(context, "pagina.path")
      || config.currentRoute
      || window.location.pathname
      || "/";
  }

  function evaluatePolicy(config, context) {
    var policy = mergeDeep(config.policy || {}, context && isRecord(context.policy) ? context.policy : {});
    var display = isRecord(policy.display) ? policy.display : {};
    var route = getCurrentRoute(config, context);
    var allowedRoutes = Array.isArray(policy.allowedRoutes)
      ? policy.allowedRoutes
      : Array.isArray(display.allowedRoutes)
        ? display.allowedRoutes
        : [];

    if (policy.allowed === false || display.enabled === false || display.visible === false) {
      return { allowed: false, reason: "blocked_by_policy", route: route };
    }

    if (allowedRoutes.length) {
      var matches = allowedRoutes.some(function (pattern) {
        if (pattern === "*") {
          return true;
        }

        if (typeof pattern === "string" && pattern.slice(-1) === "*") {
          return route.indexOf(pattern.slice(0, -1)) === 0;
        }

        return route === pattern;
      });

      if (!matches) {
        return { allowed: false, reason: "blocked_by_route", route: route };
      }
    }

    return { allowed: true, reason: null, route: route };
  }

  function readScopeIdentifier(context, paths) {
    for (var index = 0; index < paths.length; index += 1) {
      var value = getValueByPath(context, paths[index]);
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  function buildConversationScope(config, context) {
    return JSON.stringify({
      projeto: config.projeto || null,
      agente: config.agente || null,
      apiBase: config.apiBase || null,
      sessionKey: readScopeIdentifier(context, ["sessionKey", "session.key", "channel.sessionKey"]),
      tenant: readScopeIdentifier(context, ["tenant.id", "tenant.slug", "tenantId"]),
      user: readScopeIdentifier(context, ["user.id", "user.email", "usuario.id"]),
      resource: readScopeIdentifier(context, ["resource.id", "resource.slug", "resourceId"]),
    });
  }

  function formatRichText(value) {
    return String(value || "")
      .trim()
      .split(/\n\s*\n/)
      .map(function (block) {
        var lines = block.split("\n").filter(Boolean);
        if (!lines.length) {
          return "";
        }

        if (lines.every(function (line) { return /^[-*]\s+/.test(line); })) {
          return "<ul>" + lines.map(function (line) { return "<li>" + formatInlineText(line.replace(/^[-*]\s+/, "")) + "</li>"; }).join("") + "</ul>";
        }

        if (lines.every(function (line) { return /^\d+\.\s+/.test(line); })) {
          return "<ol>" + lines.map(function (line) { return "<li>" + formatInlineText(line.replace(/^\d+\.\s+/, "")) + "</li>"; }).join("") + "</ol>";
        }

        return "<p>" + lines.map(formatInlineText).join("<br>") + "</p>";
      })
      .join("");
  }

  function escapeText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInlineText(value) {
    return escapeText(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function resetFloatingState(instance) {
    if (!instance) {
      return;
    }

    instance.state.expanded = false;
    instance.state.position = { x: 0, y: 0 };

    if (instance.refs && instance.refs.expand) {
      instance.refs.expand.innerHTML = createExpandIcon(false);
      instance.refs.expand.setAttribute("aria-label", "Expandir chat");
      instance.refs.expand.setAttribute("title", "Expandir chat");
    }
  }

  function animateMessagesScroll(container) {
    if (!container) {
      return;
    }

    var start = container.scrollTop;
    var target = container.scrollHeight - container.clientHeight;
    if (target <= start) {
      container.scrollTop = target;
      return;
    }

    var startTime = null;
    var duration = 380;

    function step(timestamp) {
      if (startTime === null) {
        startTime = timestamp;
      }

      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = start + (target - start) * eased;

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }

    window.requestAnimationFrame(step);
  }

  function createWhatsAppMessage(cta) {
    if (!cta || !cta.url) {
      return null;
    }

    return {
      id: "ai-cta-" + Date.now(),
      text: "",
      isAi: true,
      cta: cta,
    };
  }

  function createInstance(config) {
    var hasInlineUi =
      isRecord(config.ui) &&
      (typeof config.ui.title === "string" ||
        typeof config.ui.theme === "string" ||
        typeof config.ui.accent === "string" ||
        typeof config.ui.transparent === "boolean");

    return {
      config: config,
      state: {
        chatId: null,
        messages: [],
        context: clone(config.context || {}),
        scope: buildConversationScope(config, config.context || {}),
        open: Boolean(config.open),
        hidden: Boolean(config.hidden),
        loading: false,
        ui: mergeDeep(
          {
            title: "Chat",
            subtitle: "Assistente virtual",
            theme: "dark",
            accent: "#2563eb",
            transparent: true,
          },
          config.ui || {},
        ),
        expanded: false,
        pendingRemoteUi: Boolean(config.projeto && config.agente && config.apiBase && !hasInlineUi),
        position: {
          x: 0,
          y: 0,
        },
      },
      refs: {},
      disposers: [],
      controllers: [],
      observers: [],
      timers: [],
    };
  }

  function addListener(instance, target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    instance.disposers.push(function () {
      target.removeEventListener(eventName, handler, options);
    });
  }

  function addAbortController(instance, controller) {
    instance.controllers.push(controller);
    instance.disposers.push(function () {
      controller.abort();
    });
  }

  function resolveMountTarget(selector) {
    if (typeof selector !== "string" || !selector.trim()) {
      return null;
    }

    try {
      return document.querySelector(selector.trim());
    } catch (error) {
      console.warn("[InfraStudio Chat] invalid mount target selector.", selector);
      return null;
    }
  }

  function createChatBubbleIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 18.5H5.5A2.5 2.5 0 0 1 3 16V7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5V16a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function createCloseIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></span>';
  }

  function createResetIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 8V4m0 0h4M6 4l3.1 3.1A8 8 0 1 1 4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function createExpandIcon(expanded) {
    if (expanded) {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8 3H5a2 2 0 0 0-2 2v3m16 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M15 3h6v6m-12 0V3H3m18 12v6h-6M9 21H3v-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function createPlaneIcon() {
    return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m22 2-7 20-4-9-9-4Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2 11 13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
  }

  function getAssetExtension(asset) {
    var fileName = String((asset && (asset.arquivoNome || asset.nome)) || "");
    var match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function getAssetPreviewKind(asset) {
    var mimeType = String((asset && asset.mimeType) || "").toLowerCase();
    var extension = getAssetExtension(asset);

    if (asset && asset.categoria === "image") {
      return "image";
    }

    if (mimeType.indexOf("video/") === 0 || ["mp4", "webm", "mov"].indexOf(extension) !== -1) {
      return "video";
    }

    if (
      mimeType === "application/pdf" ||
      ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].indexOf(extension) !== -1
    ) {
      return "preview";
    }

    return "file";
  }

  function getAssetPreviewLabel(asset) {
    var mimeType = String((asset && asset.mimeType) || "").toLowerCase();
    var extension = getAssetExtension(asset).toUpperCase();

    if (mimeType === "application/pdf" || extension === "PDF") {
      return "PDF";
    }

    if (extension) {
      return extension;
    }

    return "ARQ";
  }

  function createAssetPreviewBadge(asset) {
    var preview = document.createElement("div");
    preview.className = "chat-asset-preview";

    var badge = document.createElement("div");
    badge.className = "chat-asset-preview-badge";
    badge.textContent = getAssetPreviewLabel(asset);
    preview.appendChild(badge);

    return preview;
  }

  function createAssetAction(asset, download) {
    var openUrl = asset.targetUrl || asset.publicUrl;
    var action = document.createElement("a");
    action.className = "chat-asset-action" + (download ? "" : " primary");
    action.href = openUrl;
    action.target = "_blank";
    action.rel = "noreferrer noopener";

    if (download) {
      action.setAttribute("download", asset.arquivoNome || asset.nome || "arquivo");
      action.textContent = "Baixar";
    } else {
      action.textContent = "Abrir";
    }

    return action;
  }

  function getAssetOpenLabel(asset, previewKind) {
    if (previewKind === "image") {
      return "Abrir imagem";
    }

    if (previewKind === "video") {
      return "Abrir video";
    }

    var label = getAssetPreviewLabel(asset);
    return label === "ARQ" ? "Abrir arquivo" : "Abrir " + label;
  }

  function createAssetGallery(assets) {
    if (!Array.isArray(assets) || !assets.length) {
      return null;
    }

    var wrap = document.createElement("div");
    wrap.className = "chat-assets";
    var pointerState = {
      active: false,
      startX: 0,
      startY: 0,
      dragged: false,
      pointerId: null,
      suppressNextClick: false,
    };
    var dragThreshold = 8;

    wrap.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      pointerState.active = true;
      pointerState.startX = event.clientX;
      pointerState.startY = event.clientY;
      pointerState.dragged = false;
      pointerState.pointerId = event.pointerId;
    });

    wrap.addEventListener("pointermove", function (event) {
      if (!pointerState.active || pointerState.pointerId !== event.pointerId || pointerState.dragged) {
        return;
      }

      if (
        Math.abs(event.clientX - pointerState.startX) > dragThreshold ||
        Math.abs(event.clientY - pointerState.startY) > dragThreshold
      ) {
        pointerState.dragged = true;
      }
    });

    function finishPointerTracking(event) {
      if (!pointerState.active || pointerState.pointerId !== event.pointerId) {
        return;
      }

      pointerState.active = false;
      pointerState.pointerId = null;
      pointerState.suppressNextClick = pointerState.dragged;
      pointerState.dragged = false;
    }

    wrap.addEventListener("pointerup", finishPointerTracking);
    wrap.addEventListener("pointercancel", finishPointerTracking);

    wrap.addEventListener(
      "click",
      function (event) {
        if (!pointerState.suppressNextClick) {
          return;
        }

        var target = event.target;
        if (!(target instanceof Element)) {
          pointerState.suppressNextClick = false;
          return;
        }

        if (target.closest(".chat-asset, .chat-asset-action")) {
          event.preventDefault();
          event.stopPropagation();
        }

        pointerState.suppressNextClick = false;
      },
      true,
    );

    assets.slice(0, 5).forEach(function (asset, index) {
      if (!asset || !asset.publicUrl) {
        return;
      }

      var previewKind = getAssetPreviewKind(asset);
      var openUrl = asset.targetUrl || asset.publicUrl;
      var card = document.createElement("a");
      card.className = "chat-asset " + previewKind;
      card.href = openUrl;
      card.target = "_blank";
      card.rel = "noreferrer noopener";

      var badge = document.createElement("div");
      badge.className = "chat-asset-badge";
      badge.textContent = String(index + 1);
      card.appendChild(badge);

      if (previewKind === "image") {
        var image = document.createElement("img");
        image.src = asset.publicUrl;
        image.alt = asset.nome || asset.arquivoNome || "Imagem do agente";
        card.appendChild(image);
      } else if (previewKind === "video") {
        var video = document.createElement("video");
        video.src = asset.publicUrl;
        video.muted = true;
        video.preload = "metadata";
        video.playsInline = true;
        card.appendChild(video);
      } else if (previewKind === "preview") {
        card.appendChild(createAssetPreviewBadge(asset));
      }

      var body = document.createElement("div");
      body.className = "chat-asset-body";

      var meta = document.createElement("div");
      meta.className = "chat-asset-meta";

      var textWrap = document.createElement("div");
      var title = document.createElement("div");
      title.className = "chat-asset-title";
      title.textContent = asset.nome || asset.arquivoNome || "Arquivo";
      textWrap.appendChild(title);

      if (asset.descricao || asset.arquivoNome) {
        var subtitle = document.createElement("div");
        subtitle.className = "chat-asset-subtitle";
        subtitle.textContent = asset.descricao || asset.arquivoNome;
        textWrap.appendChild(subtitle);
      }

      meta.appendChild(textWrap);

      body.appendChild(meta);

      card.appendChild(body);
      wrap.appendChild(card);
    });

    return wrap;
  }

  function applyUi(instance) {
    var refs = instance.refs;
    var ui = instance.state.ui;
    var light = ui.theme === "light";
    refs.root.style.setProperty("--chat-accent", ui.accent);
    refs.root.style.setProperty("--chat-bg", light ? (ui.transparent ? "rgba(255,255,255,.88)" : "#ffffff") : (ui.transparent ? "rgba(9,16,34,.96)" : "#08101f"));
    refs.root.style.setProperty("--chat-text", light ? "#0f172a" : "#e2e8f0");
    refs.root.style.setProperty("--chat-muted", light ? "#64748b" : "#94a3b8");
    refs.root.style.setProperty("--chat-surface", light ? "rgba(248,250,252,.86)" : "rgba(2,6,23,.18)");
    refs.root.style.setProperty("--chat-bubble-ai", light ? "rgba(255,255,255,.96)" : "rgba(30,41,59,.92)");
    refs.root.style.setProperty("--chat-input-bg", light ? "rgba(255,255,255,.92)" : "rgba(2,6,23,.45)");
    refs.root.style.setProperty("--chat-input-text", light ? "#0f172a" : "#ffffff");
    refs.root.style.setProperty("--chat-header-border", light ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.08)");
    refs.root.style.setProperty("--chat-subtle-bg", light ? "rgba(148,163,184,.08)" : "rgba(255,255,255,.04)");
    refs.root.style.setProperty("--chat-shadow", light ? "rgba(15,23,42,.18)" : "rgba(2,6,23,.45)");
    refs.root.style.setProperty("--chat-strong", light ? "#0f172a" : "#ffffff");
    refs.root.style.setProperty("--chat-action-color", "color-mix(in srgb, " + ui.accent + " 78%, " + (light ? "#475569" : "#e2e8f0") + " 22%)");
    refs.root.style.setProperty("--chat-cta-bg", light ? "color-mix(in srgb, " + ui.accent + " 92%, white 8%)" : "color-mix(in srgb, " + ui.accent + " 78%, white 22%)");
    refs.root.style.setProperty("--chat-cta-border", light ? "color-mix(in srgb, " + ui.accent + " 75%, rgba(15,23,42,.08))" : "color-mix(in srgb, " + ui.accent + " 68%, white 22%)");
    refs.root.style.setProperty("--chat-cta-text", "#ffffff");
    refs.root.style.setProperty("--chat-input-border", light ? "color-mix(in srgb, " + ui.accent + " 35%, rgba(15,23,42,.12))" : "color-mix(in srgb, " + ui.accent + " 42%, rgba(255,255,255,.10))");
    refs.root.style.setProperty("--chat-input-border-focus", "color-mix(in srgb, " + ui.accent + " 72%, white 28%)");
    refs.root.style.setProperty("--chat-input-shadow", light ? "color-mix(in srgb, " + ui.accent + " 26%, transparent)" : "color-mix(in srgb, " + ui.accent + " 30%, transparent)");
    refs.root.style.setProperty("--chat-input-placeholder-waiting", light ? "color-mix(in srgb, " + ui.accent + " 62%, #475569 38%)" : "color-mix(in srgb, " + ui.accent + " 72%, #e2e8f0 28%)");
    refs.title.textContent = ui.title;
    refs.subtitle.textContent = ui.subtitle || "Assistente virtual";
  }

  function applyLayout(instance) {
    if (!instance || !instance.refs.root) {
      return;
    }

    var root = instance.refs.root;
    var position = instance.state.position || { x: 0, y: 0 };
    if (instance.config.embedded) {
      root.style.setProperty("--chat-offset-x", "0px");
      root.style.setProperty("--chat-offset-y", "0px");
    } else {
      root.style.setProperty("--chat-offset-x", (position.x || 0) + "px");
      root.style.setProperty("--chat-offset-y", (position.y || 0) + "px");
    }
    root.classList.toggle("is-expanded", Boolean(instance.state.expanded));
    if (instance.refs && instance.refs.messages) {
      animateMessagesScroll(instance.refs.messages);
    }
  }

  function renderMessages(instance) {
    var refs = instance.refs;
    refs.stack.innerHTML = "";

    var messages = instance.state.messages.length
      ? instance.state.messages
      : [{ id: "welcome", text: "Oi! Como posso te ajudar agora?", isAi: true }];

    messages.forEach(function (message) {
      var bubble = document.createElement("div");
      bubble.className = "chat-bubble " + (message.isAi ? "ai" : "user");
      bubble.innerHTML = '<div class="chat-rich">' + formatRichText(message.text) + "</div>";

      if (message.isAi && message.cta && message.cta.url) {
        var cta = document.createElement("a");
        cta.className = "chat-cta";
        cta.href = message.cta.url;
        cta.target = "_blank";
        cta.rel = "noreferrer noopener";
        cta.textContent = message.cta.label || "Continuar no WhatsApp.";
        bubble.appendChild(cta);
      }

      if (message.isAi && Array.isArray(message.assets) && message.assets.length) {
        var assetGallery = createAssetGallery(message.assets);
        if (assetGallery) {
          bubble.appendChild(assetGallery);
        }
      }

      refs.stack.appendChild(bubble);
    });

    if (instance.state.loading) {
      var typing = document.createElement("div");
      typing.className = "chat-typing";
      typing.innerHTML = '<span class="chat-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
      refs.stack.appendChild(typing);
    }

    animateMessagesScroll(refs.messages);
  }

  function updateVisibility(instance) {
    instance.refs.host.style.display = instance.state.hidden ? "none" : "";
    instance.refs.root.classList.toggle("open", instance.state.open);
    instance.refs.root.classList.toggle("hide-launcher", Boolean(instance.config.hideLauncher));
    instance.refs.root.classList.toggle("mobile-fullscreen", Boolean(instance.config.mobileFullscreen));
    instance.refs.panel.classList.toggle("open", instance.state.open);
    instance.refs.panel.hidden = !instance.state.open;
    if (instance.refs.launcher) {
      instance.refs.launcher.classList.toggle("is-open", instance.state.open);
      instance.refs.launcher.setAttribute("aria-label", instance.state.open ? "Fechar chat" : "Abrir chat");
      instance.refs.launcher.innerHTML = instance.state.open ? createCloseIcon() : createChatBubbleIcon();
    }
    applyLayout(instance);
  }

  function setLoading(instance, loading) {
    instance.state.loading = loading;
    instance.refs.input.readOnly = loading;
    instance.refs.send.disabled = loading;
    instance.refs.input.classList.toggle("is-waiting", loading);
    instance.refs.input.placeholder = loading ? "Atendente esta digitando..." : "Digite sua mensagem...";
    instance.refs.send.innerHTML = loading ? '<span class="chat-icon" aria-hidden="true">...</span>' : createPlaneIcon();
    renderMessages(instance);
  }

  function autoResizeInput(instance) {
    var input = instance.refs.input;
    input.style.height = "46px";
    var lineHeight = parseFloat(window.getComputedStyle(input).lineHeight) || 22;
    var maxHeight = Math.round(lineHeight * 3 + 24);
    var nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = nextHeight + "px";
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function syncViewportHeight(instance) {
    if (!instance || !instance.refs || !instance.refs.root) {
      return;
    }

    var viewportHeight = window.visualViewport && window.visualViewport.height
      ? window.visualViewport.height
      : window.innerHeight;

    instance.refs.root.style.setProperty("--chat-viewport-height", Math.round(viewportHeight) + "px");
    document.documentElement.style.setProperty("--vh", Math.round(viewportHeight) + "px");
  }

  function syncUiVisibility(instance) {
    if (!instance || !instance.refs || !instance.refs.root) {
      return;
    }

    instance.refs.root.style.opacity = instance.state.pendingRemoteUi ? "0" : "1";
    instance.refs.root.style.pointerEvents = instance.state.pendingRemoteUi ? "none" : "";
  }

  function addDragBehavior(instance, handle, actions) {
    function isSmallViewport() {
      return window.innerWidth <= 640;
    }

    addListener(instance, handle, "pointerdown", function (event) {
      if (isSmallViewport()) {
        return;
      }

      if (actions && actions.contains(event.target)) {
        return;
      }

      if (event.button !== 0) {
        return;
      }

      var startX = event.clientX;
      var startY = event.clientY;
      var initialX = instance.state.position ? instance.state.position.x || 0 : 0;
      var initialY = instance.state.position ? instance.state.position.y || 0 : 0;

      instance.refs.root.classList.add("is-dragging");
      handle.classList.add("is-dragging");

      try {
        handle.setPointerCapture(event.pointerId);
      } catch (error) {
      }

      function onPointerMove(moveEvent) {
        var nextX = initialX + (moveEvent.clientX - startX);
        var nextY = initialY + (moveEvent.clientY - startY);
        instance.state.position = {
          x: nextX,
          y: nextY,
        };
        applyLayout(instance);
      }

      function finishDrag() {
        instance.refs.root.classList.remove("is-dragging");
        handle.classList.remove("is-dragging");
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
      }

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
    });
  }

  function mountDom(instance) {
    var host = document.createElement("div");
    var root = document.createElement("div");
    var panel = document.createElement("div");
    var header = document.createElement("div");
    var titleWrap = document.createElement("div");
    var title = document.createElement("div");
    var subtitle = document.createElement("div");
    var actions = document.createElement("div");
    var reset = document.createElement("button");
    var expand = document.createElement("button");
    var close = document.createElement("button");
    var messages = document.createElement("div");
    var stack = document.createElement("div");
    var form = document.createElement("form");
    var input = document.createElement("textarea");
    var send = document.createElement("button");
    var launcher = document.createElement("button");
    var mountTarget = resolveMountTarget(instance.config.target);

    host.id = "infrastudio-chat-root";
    root.className = "chat-root";
    if (instance.config.embedded) {
      root.classList.add("chat-root-embedded");
      host.className = "chat-host-embedded";
    }
    panel.className = "chat-panel";
    header.className = "chat-header";
    titleWrap.className = "chat-title-wrap";
    title.className = "chat-title";
    subtitle.className = "chat-subtitle";
    subtitle.textContent = "Assistente virtual";
    actions.className = "chat-actions";
    reset.type = "button";
    reset.className = "chat-action";
    reset.setAttribute("aria-label", "Novo atendimento");
    reset.setAttribute("title", "Novo atendimento");
    reset.innerHTML = createResetIcon();
    expand.type = "button";
    expand.className = "chat-action";
    expand.setAttribute("aria-label", "Expandir chat");
    expand.setAttribute("title", "Expandir chat");
    expand.innerHTML = createExpandIcon(false);
    close.type = "button";
    close.className = "chat-action";
    close.classList.add("chat-action-close");
    close.setAttribute("aria-label", "Fechar chat");
    close.innerHTML = createCloseIcon();
    messages.className = "chat-messages";
    stack.className = "chat-stack";
    form.className = "chat-input";
    input.className = "chat-textarea";
    input.rows = 1;
    input.placeholder = "Digite sua mensagem...";
    send.type = "submit";
    send.className = "chat-send";
    send.setAttribute("aria-label", "Enviar mensagem");
    send.innerHTML = createPlaneIcon();
    launcher.type = "button";
    launcher.className = "chat-launcher";
    launcher.setAttribute("aria-label", "Abrir chat");
    launcher.innerHTML = createChatBubbleIcon();

    var style = document.createElement("style");
    style.textContent = ".chat-root{position:fixed;right:24px;bottom:24px;z-index:2147483000;font-family:Inter,Arial,sans-serif;--chat-accent:#64748b;--chat-bg:rgba(9,16,34,.96);--chat-text:#e2e8f0;--chat-muted:#94a3b8;--chat-surface:rgba(2,6,23,.18);--chat-bubble-ai:rgba(30,41,59,.92);--chat-input-bg:rgba(2,6,23,.45);--chat-input-text:#ffffff;--chat-input-border:rgba(148,163,184,.18);--chat-input-border-focus:rgba(255,255,255,.32);--chat-input-shadow:rgba(100,116,139,.22);--chat-input-placeholder-waiting:rgba(255,255,255,.72);--chat-header-border:rgba(255,255,255,.08);--chat-subtle-bg:rgba(255,255,255,.04);--chat-shadow:rgba(2,6,23,.45);--chat-strong:#ffffff;--chat-action-color:#94a3b8;--chat-cta-bg:#64748b;--chat-cta-border:#475569;--chat-cta-text:#ffffff;--chat-offset-x:0px;--chat-offset-y:0px;transform:translate3d(var(--chat-offset-x),var(--chat-offset-y),0);transition:opacity .18s ease}.chat-icon{display:inline-flex;align-items:center;justify-content:center}.chat-icon svg{width:100%;height:100%;display:block}@keyframes chatBubbleIn{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes chatDotsPulse{0%,80%,100%{opacity:.28;transform:translateY(0)}40%{opacity:1;transform:translateY(-1px)}}@keyframes chatLauncherSwap{0%{opacity:0;transform:scale(.72) rotate(-18deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}@keyframes chatInputWaitingGlow{0%,100%{box-shadow:0 0 0 1px color-mix(in srgb,var(--chat-input-border-focus) 32%, transparent),0 12px 28px color-mix(in srgb,var(--chat-input-shadow) 14%, transparent)}50%{box-shadow:0 0 0 2px color-mix(in srgb,var(--chat-input-border-focus) 55%, transparent),0 16px 34px color-mix(in srgb,var(--chat-input-shadow) 24%, transparent)}}.chat-root.open .chat-launcher{opacity:0;pointer-events:none;transform:translateY(8px) scale(.94)}.chat-root.hide-launcher .chat-launcher{display:none}.chat-root.is-dragging{user-select:none}.chat-panel{width:min(380px,calc(100vw - 32px));height:min(620px,calc(100vh - 100px));display:none;flex-direction:column;overflow:hidden;border-radius:26px;border:1px solid var(--chat-header-border);background:var(--chat-bg);color:var(--chat-text);box-shadow:0 24px 70px var(--chat-shadow);backdrop-filter:blur(14px);margin-bottom:16px;animation:chatBubbleIn .22s ease both}.chat-root.is-expanded .chat-panel{width:min(500px,calc(100vw - 32px));height:min(760px,calc(100vh - 48px))}.chat-panel.open{display:flex}.chat-header{position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--chat-header-border);background:color-mix(in srgb,var(--chat-bg) 94%,transparent);backdrop-filter:blur(16px);cursor:grab}.chat-header.is-dragging{cursor:grabbing}.chat-title{font-size:16px;font-weight:700;color:var(--chat-text)}.chat-subtitle{margin-top:4px;font-size:11px;color:var(--chat-muted);text-transform:uppercase;letter-spacing:.08em}.chat-actions{display:flex;gap:8px}.chat-action,.chat-send,.chat-launcher{border:0;cursor:pointer}.chat-action{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:1px solid var(--chat-header-border);border-radius:12px;background:var(--chat-subtle-bg);color:var(--chat-action-color)}.chat-action .chat-icon{width:16px;height:16px}.chat-rich strong{font-weight:700;color:var(--chat-strong)}.chat-messages{min-height:0;flex:1;overflow-y:auto;padding:16px;background:var(--chat-surface);scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--chat-accent) 68%, transparent) transparent}.chat-messages::-webkit-scrollbar{width:6px}.chat-messages::-webkit-scrollbar-track{background:transparent}.chat-messages::-webkit-scrollbar-thumb{border-radius:999px;background:color-mix(in srgb,var(--chat-accent) 64%, rgba(15,23,42,.18))}.chat-stack{display:flex;flex-direction:column;gap:12px}.chat-bubble{max-width:88%;border-radius:18px;border:1px solid var(--chat-header-border);padding:12px 14px;font-size:14px;line-height:1.6;animation:chatBubbleIn .22s ease both}.chat-bubble.ai{padding:0;background:transparent;color:var(--chat-text);border-color:transparent;border-bottom-left-radius:6px}.chat-bubble.user{margin-left:auto;background:color-mix(in srgb,var(--chat-accent) 78%,white 22%);color:#fff;border-color:color-mix(in srgb,var(--chat-accent) 68%,white 32%);border-bottom-right-radius:6px;box-shadow:0 10px 24px color-mix(in srgb,var(--chat-accent) 22%,transparent);backdrop-filter:blur(8px)}.chat-bubble.ai .chat-rich{background:transparent;border:0;border-radius:0;padding:0;box-shadow:none}.chat-rich{white-space:normal}.chat-rich p,.chat-rich ul,.chat-rich ol{margin:0}.chat-rich p+p,.chat-rich p+ul,.chat-rich p+ol,.chat-rich ul+p,.chat-rich ol+p,.chat-rich ul+ul,.chat-rich ol+ol{margin-top:10px}.chat-rich ul,.chat-rich ol{padding-left:20px}.chat-rich li+li{margin-top:6px}.chat-cta{margin-top:12px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid var(--chat-cta-border);background:var(--chat-cta-bg);color:var(--chat-cta-text);padding:5px 10px;font-size:13px;font-weight:800;text-decoration:none;box-shadow:0 10px 22px color-mix(in srgb,var(--chat-accent) 22%, transparent);transition:transform .18s ease,background-color .18s ease,border-color .18s ease,box-shadow .18s ease}.chat-cta:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--chat-cta-bg) 88%, white 12%);box-shadow:0 14px 28px color-mix(in srgb,var(--chat-accent) 28%, transparent)}.chat-assets{margin-top:12px;display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scroll-snap-type:x proximity;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--chat-accent) 58%, transparent) transparent}.chat-assets::-webkit-scrollbar{height:6px}.chat-assets::-webkit-scrollbar-track{background:transparent}.chat-assets::-webkit-scrollbar-thumb{border-radius:999px;background:color-mix(in srgb,var(--chat-accent) 58%, rgba(15,23,42,.18))}.chat-asset{position:relative;display:block;flex:0 0 104px;min-width:104px;overflow:hidden;border-radius:16px;border:1px solid var(--chat-header-border);background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(15,23,42,.9));color:inherit;text-decoration:none;box-shadow:0 10px 22px rgba(2,6,23,.24);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;scroll-snap-align:start}.chat-asset:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--chat-accent) 42%, rgba(255,255,255,.08));box-shadow:0 14px 28px rgba(2,6,23,.34)}.chat-asset-badge{position:absolute;top:6px;left:6px;z-index:1;display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:rgba(2,6,23,.74);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:10px;font-weight:800;line-height:1}.chat-asset.image,.chat-asset.video,.chat-asset.preview{padding:0}.chat-asset.image img,.chat-asset.video video{display:block;width:100%;height:76px;object-fit:cover;background:rgba(15,23,42,.35)}.chat-asset-preview{display:flex;align-items:center;justify-content:center;min-height:76px;padding:10px;background:linear-gradient(135deg,color-mix(in srgb,var(--chat-accent) 22%,#0f172a 78%),rgba(15,23,42,.94))}.chat-asset-preview-badge{display:inline-flex;align-items:center;justify-content:center;min-width:52px;padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.chat-asset.file{padding:12px}.chat-asset-meta{display:block}.chat-asset-body{padding:9px 9px 10px}.chat-asset-title{font-size:11px;font-weight:800;line-height:1.25;color:inherit;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:28px}.chat-asset-subtitle{margin-top:6px;font-size:11px;font-weight:700;color:#cbd5e1}.chat-typing{display:inline-flex;width:fit-content;max-width:88%;align-items:center;gap:10px;border-radius:18px;border:1px solid var(--chat-header-border);background:var(--chat-bubble-ai);color:var(--chat-muted);padding:12px 14px;animation:chatBubbleIn .22s ease both}.chat-typing-dots{display:inline-flex;gap:4px}.chat-typing-dots span{width:7px;height:7px;border-radius:999px;background:currentColor;animation:chatDotsPulse 1.2s infinite ease-in-out}.chat-typing-dots span:nth-child(2){animation-delay:.16s}.chat-typing-dots span:nth-child(3){animation-delay:.32s}.chat-form{flex-shrink:0;display:flex;align-items:flex-end;gap:10px;padding:16px;border-top:1px solid var(--chat-header-border);background:color-mix(in srgb,var(--chat-bg) 96%,transparent)}.chat-input{flex:1;box-sizing:border-box;height:46px;min-height:46px;max-height:110px;resize:none;overflow-y:hidden;border-radius:18px;border:1.5px solid var(--chat-input-border);outline:none;background:color-mix(in srgb,var(--chat-input-bg) 92%,white 8%);color:var(--chat-input-text);padding:11px 14px;font:inherit;font-size:14px;line-height:20px;scrollbar-width:none;-ms-overflow-style:none;box-shadow:0 0 0 1px color-mix(in srgb,var(--chat-input-border) 45%, transparent),0 10px 24px color-mix(in srgb,var(--chat-input-shadow) 18%, transparent);transition:border-color .18s ease,background-color .18s ease,box-shadow .18s ease,transform .18s ease}.chat-input::-webkit-scrollbar{display:none}.chat-input::placeholder{font-size:13px;color:var(--chat-muted)}.chat-input:focus{border-color:var(--chat-input-border-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--chat-input-shadow) 28%, transparent),0 14px 30px color-mix(in srgb,var(--chat-input-shadow) 24%, transparent);background:color-mix(in srgb,var(--chat-input-bg) 94%,white 6%)}.chat-input.is-waiting{border-color:color-mix(in srgb,var(--chat-input-border-focus) 84%, transparent);animation:chatInputWaitingGlow 1.8s ease-in-out infinite}.chat-input.is-waiting::placeholder{font-style:italic;letter-spacing:.01em;color:var(--chat-input-placeholder-waiting)}.chat-send{width:46px;height:46px;flex:0 0 46px;display:inline-flex;align-items:center;justify-content:center;border-radius:16px;background:var(--chat-accent);color:#fff;padding:0}.chat-send .chat-icon{width:18px;height:18px}.chat-send[disabled]{opacity:.6;cursor:wait}.chat-launcher{display:inline-flex;align-items:center;justify-content:center;width:60px;height:60px;border-radius:999px;background:var(--chat-accent);color:#fff;box-shadow:0 20px 40px var(--chat-shadow);transition:transform .2s ease,background-color .2s ease,box-shadow .2s ease,opacity .18s ease}.chat-launcher:hover{transform:translateY(-1px) scale(1.02)}.chat-launcher .chat-icon{width:24px;height:24px;animation:chatLauncherSwap .22s ease both}@media (max-width:640px){.chat-root{right:12px;left:12px;bottom:12px;display:flex;flex-direction:column;align-items:flex-end;--chat-offset-x:0px!important;--chat-offset-y:0px!important;transform:none}.chat-panel,.chat-root.is-expanded .chat-panel{width:100%;height:min(70vh,560px);margin-bottom:12px;border-radius:24px}.chat-root.mobile-fullscreen{left:0;right:0;bottom:0;top:0;align-items:stretch}.chat-root.mobile-fullscreen .chat-panel,.chat-root.mobile-fullscreen.is-expanded .chat-panel{width:100vw;height:100dvh;max-height:none;margin-bottom:0;border-radius:0;border-left:0;border-right:0;border-top:0}.chat-header{padding:14px 14px 12px;cursor:default}.chat-form{padding:12px}.chat-input{border-radius:18px}.chat-asset{flex-basis:96px;min-width:96px}.chat-asset.image img,.chat-asset.video video{height:72px}.chat-asset-badge{top:5px;left:5px}}";
    style.textContent += ".chat-root{--chat-viewport-height:100vh;--chat-viewport-height:100dvh}.chat-panel{min-height:0;height:min(620px,calc(100vh - 100px));height:min(620px,calc(100dvh - 100px));height:min(620px,calc(var(--chat-viewport-height,100dvh) - 100px))}.chat-root.is-expanded .chat-panel{height:min(760px,calc(100vh - 48px));height:min(760px,calc(100dvh - 48px));height:min(760px,calc(var(--chat-viewport-height,100dvh) - 48px))}.chat-messages{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.chat-input{position:sticky;bottom:0;z-index:1;display:flex;align-items:flex-end;gap:10px;padding:16px;border-top:1px solid var(--chat-header-border);background:color-mix(in srgb,var(--chat-bg) 96%,transparent)}.chat-textarea{flex:1;box-sizing:border-box;height:46px;min-height:46px;max-height:110px;resize:none;overflow-y:hidden;border-radius:18px;border:1.5px solid var(--chat-input-border);outline:none;background:color-mix(in srgb,var(--chat-input-bg) 92%,white 8%);color:var(--chat-input-text);padding:11px 14px;font:inherit;font-size:14px;line-height:20px;scrollbar-width:none;-ms-overflow-style:none;box-shadow:0 0 0 1px color-mix(in srgb,var(--chat-input-border) 45%, transparent),0 10px 24px color-mix(in srgb,var(--chat-input-shadow) 18%, transparent);transition:border-color .18s ease,background-color .18s ease,box-shadow .18s ease,transform .18s ease}.chat-textarea::-webkit-scrollbar{display:none}.chat-textarea::placeholder{font-size:13px;color:var(--chat-muted)}.chat-textarea:focus{border-color:var(--chat-input-border-focus);box-shadow:0 0 0 3px color-mix(in srgb,var(--chat-input-shadow) 28%, transparent),0 14px 30px color-mix(in srgb,var(--chat-input-shadow) 24%, transparent);background:color-mix(in srgb,var(--chat-input-bg) 94%,white 6%)}.chat-textarea.is-waiting{border-color:color-mix(in srgb,var(--chat-input-border-focus) 84%, transparent);animation:chatInputWaitingGlow 1.8s ease-in-out infinite}.chat-textarea.is-waiting::placeholder{font-style:italic;letter-spacing:.01em;color:var(--chat-input-placeholder-waiting)}@media (max-width:640px){.chat-panel,.chat-root.is-expanded .chat-panel{width:100%;height:min(560px,calc(100vh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)));height:min(560px,calc(100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)));height:min(560px,calc(var(--chat-viewport-height,100dvh) - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))}.chat-root.mobile-fullscreen .chat-panel,.chat-root.mobile-fullscreen.is-expanded .chat-panel{height:100vh;height:100dvh;height:var(--chat-viewport-height,100dvh)}.chat-input{padding:12px}}";

    if (instance.config.embedded) {
      style.textContent += ".chat-host-embedded{width:100%;height:100%;min-height:0}.chat-root.chat-root-embedded{position:relative;right:auto;bottom:auto;left:auto;top:auto;z-index:auto;display:flex;width:100%;height:100%;min-height:0;align-items:stretch;transform:none}.chat-root.chat-root-embedded .chat-launcher,.chat-root.chat-root-embedded .chat-action-close{display:none}.chat-root.chat-root-embedded .chat-panel,.chat-root.chat-root-embedded.is-expanded .chat-panel{width:100%;height:100%;min-height:0;max-height:none;margin-bottom:0;border-radius:24px}.chat-root.chat-root-embedded .chat-header{cursor:default}@media (max-width:640px){.chat-root.chat-root-embedded .chat-panel,.chat-root.chat-root-embedded.is-expanded .chat-panel{border-radius:0}}";
    }

    actions.appendChild(reset);
    actions.appendChild(expand);
    actions.appendChild(close);
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(actions);
    messages.appendChild(stack);
    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(form);
    root.appendChild(style);
    root.appendChild(panel);
    root.appendChild(launcher);
    host.appendChild(root);
    (mountTarget || document.body).appendChild(host);

    instance.refs = {
      host: host,
      root: root,
      panel: panel,
      title: title,
      subtitle: subtitle,
      reset: reset,
      expand: expand,
      close: close,
      messages: messages,
      stack: stack,
      form: form,
      input: input,
      send: send,
      launcher: launcher,
    };

    applyUi(instance);
    syncViewportHeight(instance);
    renderMessages(instance);
    updateVisibility(instance);
    autoResizeInput(instance);
    syncUiVisibility(instance);

    addListener(instance, launcher, "click", function () {
      instance.state.hidden = false;
      instance.state.open = !instance.state.open;
      if (!instance.state.open) {
        resetFloatingState(instance);
      }
      updateVisibility(instance);
      if (instance.state.open) {
        autoResizeInput(instance);
        input.focus();
      }
    });

    addListener(instance, close, "click", function () {
      if (instance.config.destroyOnClose) {
        destroy("close_action");
        return;
      }
      resetFloatingState(instance);
      instance.state.open = false;
      updateVisibility(instance);
    });

    addListener(instance, reset, "click", function () {
      instance.state.chatId = null;
      instance.state.messages = [];
      renderMessages(instance);
      input.value = "";
      autoResizeInput(instance);
      input.focus();
    });

    addListener(instance, expand, "click", function () {
      instance.state.expanded = !instance.state.expanded;
      expand.innerHTML = createExpandIcon(instance.state.expanded);
      expand.setAttribute("aria-label", instance.state.expanded ? "Reduzir chat" : "Expandir chat");
      expand.setAttribute("title", instance.state.expanded ? "Reduzir chat" : "Expandir chat");
      applyLayout(instance);
    });

    addListener(instance, form, "submit", function (event) {
      event.preventDefault();
      void sendMessage(instance, input.value);
    });

    addListener(instance, input, "keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage(instance, input.value);
      }
    });

    addListener(instance, input, "input", function () {
      autoResizeInput(instance);
    });

    addListener(instance, window, "resize", function () {
      syncViewportHeight(instance);
    });

    if (window.visualViewport) {
      addListener(instance, window.visualViewport, "resize", function () {
        syncViewportHeight(instance);
      });
      addListener(instance, window.visualViewport, "scroll", function () {
        syncViewportHeight(instance);
      });
    }

    if (!instance.config.embedded) {
      addDragBehavior(instance, header, actions);
    }
  }

  async function loadRemoteConfig(instance) {
    if (!instance.config.projeto || !instance.config.agente || !instance.config.apiBase) {
      instance.state.pendingRemoteUi = false;
      syncUiVisibility(instance);
      return;
    }

    var controller = new AbortController();
    addAbortController(instance, controller);

    try {
      var params = new URLSearchParams({
        projeto: instance.config.projeto,
        agente: instance.config.agente,
      });
      var response = await fetch(instance.config.apiBase + "/api/chat/config?" + params.toString(), {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        return;
      }

      var payload = await response.json();
      var remoteUi = mergeDeep({}, payload.ui || {});
      if (isRecord(instance.config.ui)) {
        if (typeof instance.config.ui.title === "string" && instance.config.ui.title.trim()) {
          remoteUi.title = instance.config.ui.title;
        }
        if (typeof instance.config.ui.subtitle === "string" && instance.config.ui.subtitle.trim()) {
          remoteUi.subtitle = instance.config.ui.subtitle;
        }
      }
      instance.state.ui = mergeDeep(instance.state.ui, remoteUi);
      applyUi(instance);
    } catch (error) {
      if (!error || error.name !== "AbortError") {
        console.warn("[InfraStudio Chat] failed to load remote config.", error);
      }
    } finally {
      instance.state.pendingRemoteUi = false;
      syncUiVisibility(instance);
    }
  }

  async function sendMessage(instance, text) {
    var trimmed = String(text || "").trim();
    if (!trimmed || instance.state.loading || !instance.config.apiBase) {
      return;
    }

    instance.state.messages.push({ id: "user-" + Date.now(), text: trimmed, isAi: false });
    instance.refs.input.value = "";
    autoResizeInput(instance);
    renderMessages(instance);
    setLoading(instance, true);

    var controller = new AbortController();
    addAbortController(instance, controller);

    try {
      var response = await fetch(instance.config.apiBase + "/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: instance.state.chatId,
          message: trimmed,
          projeto: instance.config.projeto,
          agente: instance.config.agente,
          context: mergeDeep(instance.state.context, {
            channel: mergeDeep({ kind: "external_widget" }, instance.state.context.channel || {}),
            ui: mergeDeep({ structured_response: true, allow_icons: true }, instance.state.context.ui || {}),
          }),
        }),
        signal: controller.signal,
      });

      var payload = await response.json();
      if (payload.chatId) {
        instance.state.chatId = payload.chatId;
      }

      instance.state.messages.push({
        id: "ai-" + Date.now(),
        text: payload.reply || payload.error || "Nao consegui responder agora.",
        isAi: true,
        cta: null,
        assets: Array.isArray(payload.assets) ? payload.assets : [],
      });

      if (payload.whatsapp && payload.whatsapp.url) {
        var whatsappMessage = createWhatsAppMessage(payload.whatsapp);
        if (whatsappMessage) {
          instance.state.messages.push(whatsappMessage);
        }
      }
    } catch (error) {
      if (!error || error.name !== "AbortError") {
        instance.state.messages.push({
          id: "ai-" + Date.now(),
          text: "Nao consegui responder agora.",
          isAi: true,
          assets: [],
        });
      }
    } finally {
      setLoading(instance, false);
      renderMessages(instance);
    }
  }

  function resetRuntime() {
    runtime.instance = null;
    runtime.blockedReason = null;
  }

  function normalizeConfig(input) {
    var config = isRecord(input) ? input : {};
    return {
      projeto: typeof config.projeto === "string" && config.projeto.trim() ? config.projeto.trim() : defaults.projeto,
      agente: typeof config.agente === "string" && config.agente.trim() ? config.agente.trim() : defaults.agente,
      apiBase: typeof config.apiBase === "string" && config.apiBase.trim() ? config.apiBase.trim() : defaults.apiBase,
      context: isRecord(config.context) ? clone(config.context) : {},
      ui: isRecord(config.ui) ? clone(config.ui) : {},
      policy: isRecord(config.policy) ? clone(config.policy) : {},
      open: Boolean(config.open),
      hidden: Boolean(config.hidden),
      embedded: Boolean(config.embedded),
      target: typeof config.target === "string" && config.target.trim() ? config.target.trim() : null,
      hideLauncher: Boolean(config.hideLauncher),
      destroyOnClose: Boolean(config.destroyOnClose),
      mobileFullscreen: Boolean(config.mobileFullscreen),
      currentRoute: typeof config.currentRoute === "string" ? config.currentRoute : null,
      strictHostControl: config.strictHostControl !== false,
    };
  }

  function destroy(reason, detail) {
    var instance = runtime.instance;
    if (!instance) {
      emitLifecycle("destroyed", mergeDeep({ reason: reason || "no_instance" }, detail || {}));
      return true;
    }

    instance.timers.forEach(function (timerId) {
      window.clearTimeout(timerId);
    });

    instance.disposers.slice().reverse().forEach(function (dispose) {
      try {
        dispose();
      } catch (error) {
        console.warn("[InfraStudio Chat] cleanup failed.", error);
      }
    });

    instance.observers.forEach(function (observer) {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn("[InfraStudio Chat] observer cleanup failed.", error);
      }
    });

    if (instance.refs.host && instance.refs.host.parentNode) {
      instance.refs.host.parentNode.removeChild(instance.refs.host);
    }

    resetRuntime();
    emitLifecycle("destroyed", mergeDeep({ reason: reason || "host_destroy" }, detail || {}));
    return true;
  }

  function mount(configInput) {
    var config = normalizeConfig(configInput);
    if (!config.projeto || !config.agente) {
      console.warn("[InfraStudio Chat] projeto and agente are required.");
      return false;
    }

    var policy = evaluatePolicy(config, config.context);
    if (!policy.allowed) {
      destroy(policy.reason, { route: policy.route });
      runtime.blockedReason = policy.reason;
      emitLifecycle(policy.reason, {
        route: policy.route,
        projeto: config.projeto,
        agente: config.agente,
      });
      return false;
    }

    if (runtime.instance) {
      var sameAgent = runtime.instance.config.projeto === config.projeto && runtime.instance.config.agente === config.agente;
      if (sameAgent) {
        var nextScope = buildConversationScope(config, config.context || {});
        var shouldResetSession = runtime.instance.state.scope !== nextScope;
        runtime.instance.config = mergeDeep(runtime.instance.config, config);
        runtime.instance.state.context = mergeDeep(runtime.instance.state.context, config.context || {});
        runtime.instance.state.scope = nextScope;
        runtime.instance.state.hidden = Boolean(config.hidden);
        if (typeof config.open === "boolean") {
          runtime.instance.state.open = Boolean(config.open);
        }
        if (shouldResetSession) {
          runtime.instance.state.chatId = null;
          runtime.instance.state.messages = [];
          runtime.instance.state.loading = false;
          renderMessages(runtime.instance);
          emitLifecycle("scope_reset", {
            projeto: config.projeto,
            agente: config.agente,
          });
        }
        if (isRecord(config.ui)) {
          runtime.instance.state.ui = mergeDeep(runtime.instance.state.ui, config.ui);
          applyUi(runtime.instance);
        }
        updateVisibility(runtime.instance);
        emitLifecycle("mounted", {
          projeto: config.projeto,
          agente: config.agente,
          route: policy.route,
          strictHostControl: config.strictHostControl,
          reused: true,
        });
        return true;
      }

      destroy("remount");
    }

    runtime.strictHostControl = config.strictHostControl;
    runtime.blockedReason = null;
    runtime.instance = createInstance(config);
    mountDom(runtime.instance);
    void loadRemoteConfig(runtime.instance);

    emitLifecycle("mounted", {
      projeto: config.projeto,
      agente: config.agente,
      route: policy.route,
      strictHostControl: config.strictHostControl,
    });
    return true;
  }

  function updateContext(nextContext) {
    if (!runtime.instance || !isRecord(nextContext)) {
      return false;
    }

    var instance = runtime.instance;
    var mergedContext = mergeDeep(instance.state.context, nextContext);
    var nextConfig = mergeDeep(instance.config, {
      context: mergedContext,
      policy: isRecord(nextContext.policy) ? nextContext.policy : instance.config.policy,
      currentRoute: typeof nextContext.currentRoute === "string" ? nextContext.currentRoute : instance.config.currentRoute,
    });

    var policy = evaluatePolicy(nextConfig, mergedContext);
    if (!policy.allowed) {
      destroy(policy.reason, { route: policy.route });
      runtime.blockedReason = policy.reason;
      emitLifecycle(policy.reason, {
        route: policy.route,
        projeto: nextConfig.projeto,
        agente: nextConfig.agente,
      });
      return false;
    }

    instance.config = nextConfig;
    instance.state.context = mergedContext;
    var nextScope = buildConversationScope(nextConfig, mergedContext);
    if (instance.state.scope !== nextScope) {
      instance.state.scope = nextScope;
      instance.state.chatId = null;
      instance.state.messages = [];
      instance.state.loading = false;
      renderMessages(instance);
      emitLifecycle("scope_reset", {
        projeto: nextConfig.projeto,
        agente: nextConfig.agente,
      });
    }

    if (typeof nextContext.hidden === "boolean") {
      instance.state.hidden = nextContext.hidden;
    }

    if (typeof nextContext.open === "boolean") {
      instance.state.open = nextContext.open;
    }

    if (isRecord(nextContext.ui)) {
      instance.state.ui = mergeDeep(instance.state.ui, nextContext.ui);
      applyUi(instance);
    }

    updateVisibility(instance);
    emitLifecycle("context_updated", {
      route: policy.route,
      projeto: nextConfig.projeto,
      agente: nextConfig.agente,
    });
    return true;
  }

  function hide() {
    if (!runtime.instance) {
      return false;
    }

    resetFloatingState(runtime.instance);
    runtime.instance.state.open = false;
    runtime.instance.state.hidden = true;
    updateVisibility(runtime.instance);
    emitLifecycle("hidden", {
      projeto: runtime.instance.config.projeto,
      agente: runtime.instance.config.agente,
    });
    return true;
  }

  function show(options) {
    if (!runtime.instance) {
      return false;
    }

    var nextOptions = isRecord(options) ? options : {};
    runtime.instance.state.hidden = false;
    if (typeof nextOptions.open === "boolean") {
      runtime.instance.state.open = nextOptions.open;
    }
    updateVisibility(runtime.instance);
    emitLifecycle("shown", {
      projeto: runtime.instance.config.projeto,
      agente: runtime.instance.config.agente,
      open: runtime.instance.state.open,
    });
    return true;
  }

  function getState() {
    var instance = runtime.instance;
    return {
      mounted: Boolean(instance),
      hidden: instance ? instance.state.hidden : true,
      open: instance ? instance.state.open : false,
      loading: instance ? instance.state.loading : false,
      chatId: instance ? instance.state.chatId : null,
      strictHostControl: runtime.strictHostControl,
      blockedReason: runtime.blockedReason,
      context: instance ? clone(instance.state.context) : {},
      config: instance ? clone(instance.config) : null,
      logs: runtime.logs.slice(),
    };
  }

  function enqueue(type, payload) {
    queue.push({ type: type, payload: payload });
  }

  function flushQueue() {
    while (queue.length) {
      var command = queue.shift();
      if (!command) {
        continue;
      }

      if (command.type === "mount") {
        mount(command.payload);
      } else if (command.type === "updateContext" || command.type === "setContext") {
        updateContext(command.payload);
      } else if (command.type === "hide") {
        hide();
      } else if (command.type === "show") {
        show(command.payload);
      } else if (command.type === "destroy") {
        destroy("queued_destroy");
      }
    }
  }

  window.InfraChat = {
    __queue: queue,
    mount: function (config) {
      return mount(config);
    },
    updateContext: function (context) {
      if (!runtime.instance) {
        enqueue("updateContext", context);
        return false;
      }
      return updateContext(context);
    },
    hide: function () {
      if (!runtime.instance) {
        enqueue("hide");
        return false;
      }
      return hide();
    },
    show: function (options) {
      if (!runtime.instance) {
        enqueue("show", options);
        return false;
      }
      return show(options);
    },
    destroy: function () {
      queue.length = 0;
      return destroy("host_destroy");
    },
    isMounted: function () {
      return Boolean(runtime.instance);
    },
    getState: function () {
      return getState();
    },
    setContext: function (context) {
      if (!runtime.instance) {
        enqueue("setContext", context);
        return false;
      }
      return updateContext(context);
    },
  };

  flushQueue();
})();

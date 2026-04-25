(function () {
  var globalApi = window.InfraChatWidget || {
    instances: {},
    destroy: function () {},
    destroyAll: function () {},
  };
  window.InfraChatWidget = globalApi;
  window.InfraChat = window.InfraChat || {};

  function syncLegacyApi() {
    window.InfraChat = {
      ...window.InfraChat,
      destroy: function (slug) {
        var key = String(slug || "").trim();
        if (key) {
          return globalApi.destroy(key);
        }

        globalApi.destroyAll();
        return true;
      },
      destroyAll: function () {
        globalApi.destroyAll();
        return true;
      },
    };
  }

  syncLegacyApi();

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  }

  function getCurrentScript() {
    if (document.currentScript) {
      return document.currentScript;
    }

    var scripts = document.querySelectorAll("script[src]");
    for (var index = scripts.length - 1; index >= 0; index -= 1) {
      var candidate = scripts[index];
      var src = candidate.getAttribute("src") || "";
      if (src.indexOf("/chat-widget.js") !== -1) {
        return candidate;
      }
    }

    return null;
  }

  var bootScript = getCurrentScript();

  ready(function () {
    var script = bootScript || getCurrentScript();
    if (!script) {
      return;
    }

    var widgetSlug = script.getAttribute("data-widget");
    if (!widgetSlug) {
      return;
    }

    var projeto = (script.getAttribute("data-projeto") || "").trim();
    var agente = (script.getAttribute("data-agente") || "").trim();
    var externalIdentifier = (script.getAttribute("data-identificador-externo") || "").trim();
    var rawContext = script.getAttribute("data-context") || "";
    var widgetTitle = script.getAttribute("data-title") || "Chat";
    var apiBase = script.getAttribute("data-api-base") || new URL(script.src).origin;
    var assetBase = new URL(script.src).origin;
    var requestedTheme = String(script.getAttribute("data-theme") || "system").trim().toLowerCase();
    var theme = requestedTheme === "light" || requestedTheme === "dark"
      ? requestedTheme
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    var accent = script.getAttribute("data-accent") || "#64748b";
    var transparent = script.getAttribute("data-transparent") !== "false";
    var hasAgent = Boolean(agente || script.getAttribute("data-agent-status") === "online");
    var cleanup = [];
    var storageKey = null;
    var chatId = null;
    var messages = [];
    var attachments = [];
    var leadContact = null;
    var leadCaptureDismissed = false;
    var contactBoxOpen = false;
    var pendingAgendaSelection = null;
    var inlineActionState = null;
    var emojiPickerOpen = false;
    var open = false;
    var loading = false;
    var expanded = false;
    var humanHandoffActive = false;
    var loopPausedActive = false;
    var lastSyncedMessageAt = null;
    var pollingMessages = false;
    var requestInFlight = false;
    var messageOrderCounter = 0;
    var syncTimer = null;
    var mobileCloseGesture = {
      active: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    };
    var dragState = {
      active: false,
      mode: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    };
    var scrollAnimationFrame = null;
    var contextTeaserTimer = null;
    var contextIdleTimer = null;
    var contextScrollShown = false;
    var contextIdleShown = false;
    var lastInteractionAt = Date.now();

    if (globalApi.instances[widgetSlug] && typeof globalApi.instances[widgetSlug].destroy === "function") {
      globalApi.instances[widgetSlug].destroy();
    }

    function parseContext(value) {
      if (!value) {
        return null;
      }

      try {
        var parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
      } catch (error) {
        return null;
      }
    }

    function getLeadIdentifier(contact) {
      if (!contact || typeof contact !== "object") {
        return "";
      }

      if (typeof contact.phone === "string" && contact.phone.trim()) {
        return contact.phone.replace(/\D/g, "").slice(0, 11);
      }

      if (typeof contact.name === "string" && contact.name.trim()) {
        return contact.name.trim();
      }

      if (typeof contact.email === "string" && contact.email.trim()) {
        return contact.email.trim().toLowerCase();
      }

      return "";
    }

    function hasLeadIdentity(contact) {
      return Boolean(getLeadIdentifier(contact));
    }

    function applyPhoneMask(value) {
      var digits = String(value || "").replace(/\D/g, "").slice(0, 11);
      if (!digits) {
        return "";
      }
      if (digits.length <= 2) {
        return "(" + digits;
      }
      if (digits.length <= 6) {
        return "(" + digits.slice(0, 2) + ") " + digits.slice(2);
      }
      if (digits.length <= 10) {
        return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 6) + "-" + digits.slice(6);
      }
      return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
    }

    var widgetContext = parseContext(rawContext);
    storageKey = "infrastudio-chat:" + widgetSlug + ":" + (externalIdentifier || "anon");
    try {
      var savedState = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (savedState && typeof savedState === "object") {
        chatId = typeof savedState.chatId === "string" ? savedState.chatId : null;
        messages = Array.isArray(savedState.messages) ? savedState.messages : [];
        leadContact = savedState.leadContact && typeof savedState.leadContact === "object" ? savedState.leadContact : null;
        leadCaptureDismissed = savedState.leadCaptureDismissed === true;
        if (hasLeadIdentity(leadContact)) {
          externalIdentifier = getLeadIdentifier(leadContact);
        }
        lastSyncedMessageAt = typeof savedState.lastSyncedMessageAt === "string" ? savedState.lastSyncedMessageAt : null;
      }
    } catch (error) {}

    function assignMessageOrder(message, preferredOrder) {
      if (!message || typeof message !== "object") {
        return message;
      }

      var resolvedOrder =
        typeof preferredOrder === "number" && Number.isFinite(preferredOrder)
          ? preferredOrder
          : (typeof message.order === "number" && Number.isFinite(message.order) ? message.order : null);

      if (resolvedOrder === null) {
        messageOrderCounter += 1;
        resolvedOrder = messageOrderCounter;
      } else if (resolvedOrder > messageOrderCounter) {
        messageOrderCounter = resolvedOrder;
      }

      message.order = resolvedOrder;
      return message;
    }

    if (Array.isArray(messages) && messages.length) {
      messages = messages.map(function (message, index) {
        return assignMessageOrder(message, index + 1);
      }).slice(-30);
    }

    function getMessageTimestamp(message) {
      var createdAt = message && message.createdAt ? new Date(message.createdAt).getTime() : Number.NaN;
      return Number.isFinite(createdAt) ? createdAt : null;
    }

    function sortMessagesChronologically() {
      messages.sort(function (left, right) {
        var leftOrder = left && typeof left.order === "number" ? left.order : null;
        var rightOrder = right && typeof right.order === "number" ? right.order : null;

        if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        var leftTime = getMessageTimestamp(left);
        var rightTime = getMessageTimestamp(right);

        if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
          return leftTime - rightTime;
        }

        if (leftTime !== null && rightTime === null) {
          return -1;
        }

        if (leftTime === null && rightTime !== null) {
          return 1;
        }

        if (leftOrder !== null && rightOrder === null) {
          return -1;
        }

        if (leftOrder === null && rightOrder !== null) {
          return 1;
        }

        if ((leftOrder || 0) !== (rightOrder || 0)) {
          return leftOrder - rightOrder;
        }

        return String(left && left.id ? left.id : "").localeCompare(String(right && right.id ? right.id : ""));
      });
    }

    sortMessagesChronologically();

    var host = document.createElement("div");
    host.id = "infrastudio-chat-widget-root-" + widgetSlug;
    document.body.appendChild(host);

    function addCleanup(fn) {
      cleanup.push(fn);
    }

    function addListener(target, eventName, handler, options) {
      target.addEventListener(eventName, handler, options);
      addCleanup(function () {
        target.removeEventListener(eventName, handler, options);
      });
    }

    addCleanup(function () {
      clearLauncherTeaserTimer();
      clearIdlePromptTimer();
    });

    function destroy() {
      cleanup.slice().reverse().forEach(function (dispose) {
        try {
          dispose();
        } catch (error) {}
      });
      cleanup = [];

      if (host.parentNode) {
        host.parentNode.removeChild(host);
      }

      if (globalApi.instances[widgetSlug] && globalApi.instances[widgetSlug].destroy === destroy) {
        delete globalApi.instances[widgetSlug];
      }
    }

    var shadow = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    var panelBackground = theme === "light"
      ? (transparent ? "rgba(255,255,255,0.88)" : "#ffffff")
      : (transparent ? "rgba(9,16,34,0.96)" : "#08101f");
    var panelText = theme === "light" ? "#1c293b" : "rgba(226,232,240,0.9)";
    var headerBorder = theme === "light" ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.08)";
    var subtleBg = theme === "light" ? "rgba(148,163,184,.08)" : "rgba(255,255,255,.04)";
    var surfaceBg = theme === "light" ? "rgba(248,250,252,.96)" : "rgb(7 14 32)";
    var aiBubbleBg = theme === "light" ? "#f0f2f5" : "rgba(30,41,59,.92)";
    var aiBubbleText = theme === "light" ? "#1c293b" : "rgba(226,232,240,0.86)";
    var userBubbleBg = theme === "light" ? "#1972f5" : "color-mix(in srgb, " + accent + " 42%, transparent)";
    var inputBg = theme === "light" ? "rgba(255,255,255,.92)" : "rgba(2,6,23,.45)";
    var inputText = theme === "light" ? "#0f172a" : "#ffffff";
    var shadowColor = theme === "light" ? "rgba(15,23,42,.18)" : "rgba(2,6,23,.45)";
    var panelFrame = theme === "light"
      ? "color-mix(in srgb, " + accent + " 10%, rgba(255,255,255,0.86))"
      : "rgba(0,0,0,0.18)";
    var composerFrame = theme === "light"
      ? "color-mix(in srgb, " + accent + " 14%, rgba(255,255,255,0.9))"
      : "rgba(0,0,0,0.42)";
    var contactTitleText = theme === "light" ? "#334155" : "rgba(226,232,240,0.9)";
    var contactSubtitleText = theme === "light" ? "#0f172a" : "#f8fafc";
    var contactDescriptionText = theme === "light" ? "#64748b" : "rgba(203,213,225,0.82)";
    var contactInputBg = theme === "light" ? "rgba(255,255,255,0.96)" : "rgba(2,6,23,0.28)";
    var contactInputBorder = theme === "light"
      ? "rgba(148,163,184,0.28)"
      : "rgba(148,163,184,0.18)";
    var contactInputText = theme === "light" ? "#0f172a" : "rgba(248,250,252,0.94)";
    var contactInputPlaceholder = theme === "light" ? "#94a3b8" : "rgba(148,163,184,0.76)";
    var contactActionText = theme === "light" ? "#475569" : "rgba(203,213,225,0.88)";
    var contactActionBorder = theme === "light"
      ? "rgba(148,163,184,0.24)"
      : "rgba(148,163,184,0.16)";
    var contactPrimaryBg = theme === "light"
      ? "color-mix(in srgb, " + accent + " 14%, white 86%)"
      : "rgba(96,165,250,0.14)";
    var contactPrimaryBorder = theme === "light"
      ? "color-mix(in srgb, " + accent + " 26%, rgba(148,163,184,0.2))"
      : "rgba(96,165,250,0.22)";
    var contactPrimaryText = theme === "light"
      ? "color-mix(in srgb, " + accent + " 82%, #0f172a 18%)"
      : "white";

    style.textContent = [
      ":host { all: initial; }",
      ".chat-icon { display: inline-flex; align-items: center; justify-content: center; }",
      ".chat-icon svg { width: 100%; height: 100%; display: block; }",
      "@keyframes chatBubbleIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }",
      "@keyframes chatPanelEnter { from { opacity: 0; transform: translate(18px, 30px) scale(.18); border-radius: 999px; } to { opacity: 1; transform: translate(0, 0) scale(1); border-radius: 16px; } }",
      "@keyframes chatPanelExit { from { opacity: 1; transform: translate(0, 0) scale(1); border-radius: 16px; } to { opacity: 0; transform: translate(18px, 30px) scale(.18); border-radius: 999px; } }",
      "@keyframes chatDotsPulse { 0%, 80%, 100% { opacity: .28; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-1px); } }",
      "@keyframes chatLauncherSwap { 0% { opacity: 0; transform: scale(.72) rotate(-18deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }",
      ".chat-wrap { position: fixed; right: 24px; bottom: 24px; width: 60px; height: 60px; z-index: 2147483000; pointer-events: none; font-family: Inter, Arial, sans-serif; transform: translate3d(var(--chat-wrap-offset-x, 0px), var(--chat-wrap-offset-y, 0px), 0); transition: transform .18s ease; will-change: transform; }",
      ".chat-button { width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center; pointer-events: auto; border: 0; border-radius: 999px; background: " + (theme === "light" ? "#ffffff" : accent) + "; color: " + (theme === "light" ? accent : "white") + "; cursor: pointer; box-shadow: " + (theme === "light" ? "0 10px 24px rgba(15,23,42,0.12), 0 0 0 1px color-mix(in srgb, " + accent + " 16%, rgba(255,255,255,0.92))" : "none") + "; transition: transform .2s ease, background-color .2s ease, opacity .18s ease; }",
      ".chat-button { position: absolute; right: 0; bottom: 0; }",
      ".chat-button:hover { transform: translateY(-1px) scale(1.02); }",
      ".chat-button .chat-icon { width: 24px; height: 24px; animation: chatLauncherSwap .22s ease both; }",
      ".chat-button.is-open { filter: brightness(.92); }",
      ".chat-launcher-teaser { position: absolute; right: 0; bottom: 74px; min-width: 196px; max-width: min(280px, calc(100vw - 40px)); padding: 10px 12px; border-radius: 16px; background: " + (theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(15,23,42,0.96)") + "; color: " + (theme === "light" ? "#0f172a" : "rgba(241,245,249,0.96)") + "; border: 1px solid " + (theme === "light" ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.16)") + "; box-shadow: 0 18px 40px -28px rgba(15,23,42,0.45); opacity: 0; visibility: hidden; transform: translateY(8px) scale(.96); transform-origin: calc(100% - 28px) 100%; transition: opacity .2s ease, transform .2s ease, visibility 0s linear .2s; pointer-events: none; }",
      ".chat-launcher-teaser.is-visible { opacity: 1; visibility: visible; transform: translateY(0) scale(1); transition-delay: 0s; }",
      ".chat-launcher-teaser::after { content: ''; position: absolute; right: 22px; bottom: -7px; width: 12px; height: 12px; background: inherit; border-right: inherit; border-bottom: inherit; transform: rotate(45deg); }",
      ".chat-launcher-teaser-label { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: " + (theme === "light" ? "rgba(71,85,105,0.9)" : "rgba(148,163,184,0.88)") + "; }",
      ".chat-launcher-teaser-text { font-size: 13px; line-height: 1.55; }",
      ".chat-wrap.open .chat-button { opacity: 1; pointer-events: auto; }",
      ".chat-wrap.open.is-detached:not(.is-expanded) .chat-button { opacity: 0; pointer-events: none; }",
      ".chat-wrap.is-dragging { transition: none; }",
      ".chat-panel { position: absolute; right: 8px; bottom: 76px; width: min(380px, calc(100vw - 32px)); height: min(620px, calc(100vh - 110px)); height: min(620px, calc(100dvh - 110px)); height: min(620px, calc(var(--viewport-height, 100dvh) - 110px)); display: flex; pointer-events: none; flex-direction: column; overflow: hidden; border-radius: 16px; border: 0; background: " + panelBackground + "; color: " + panelText + "; box-shadow: " + (theme === "light" ? "0 0 0 5px " + panelFrame : "0 0 0 5px rgba(0,0,0,0.22)") + "; backdrop-filter: none; opacity: 0; visibility: hidden; transform-origin: calc(100% - 30px) calc(100% + 46px); transform: translate(18px, 30px) scale(.18); transition: width .18s ease, height .18s ease, visibility 0s linear .24s; }",
      ".chat-wrap.is-expanded .chat-panel { width: min(680px, calc(100vw - 32px)); height: calc(var(--viewport-height, 100dvh) - 104px); right: 8px; bottom: 72px; }",
      ".chat-panel.open { pointer-events: auto; visibility: visible; opacity: 1; transform: translate(0, 0) scale(1); animation: chatPanelEnter .28s cubic-bezier(.2,.9,.2,1) both; transition-delay: 0s; }",
      ".chat-panel.closing { pointer-events: none; visibility: visible; animation: chatPanelExit .22s cubic-bezier(.45,0,.2,1) both; transition-delay: 0s; }",
      ".chat-header { position: sticky; top: 0; z-index: 2; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 0; background: " + (theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(16,27,50,0.98)") + "; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 2px rgba(0,0,0,0.18); backdrop-filter: none; cursor: grab; touch-action: none; }",
      ".chat-header.is-dragging { cursor: grabbing; }",
      ".chat-title { font-size: 15px; font-weight: 700; color: " + panelText + "; }",
      ".chat-subtitle { margin-top: 5px; display: inline-flex; align-items: center; gap: 7px; font-size: 10px; color: rgba(148,163,184,0.84); text-transform: uppercase; letter-spacing: .08em; }",
      ".chat-human-tag { display: none; margin-left: 2px; border-radius: 999px; border: 1px solid rgba(251,191,36,0.2); background: rgba(251,191,36,0.1); padding: 3px 7px; color: rgba(253,230,138,0.92); font-size: 9px; font-weight: 800; letter-spacing: .08em; }",
      ".chat-wrap.human-active .chat-human-tag, .chat-wrap.loop-paused .chat-human-tag { display: inline-flex; }",
      ".chat-wrap.loop-paused .chat-human-tag { border-color: rgba(56,189,248,0.2); background: rgba(14,165,233,0.1); color: rgba(186,230,253,0.94); }",
      ".chat-status-dot { width: 7px; height: 7px; border-radius: 999px; background: " + (hasAgent ? "#22c55e" : "rgba(148,163,184,0.78)") + "; box-shadow: 0 0 0 0 " + (hasAgent ? "rgba(34,197,94,0.45)" : "rgba(148,163,184,0.22)") + "; animation: " + (hasAgent ? "chatStatusPulse 1.7s infinite" : "none") + "; }",
      "@keyframes chatStatusPulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.42); } 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }",
      ".chat-action { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: rgba(148,163,184,0.86); border-radius: 10px; cursor: pointer; transition: background-color .18s ease, box-shadow .18s ease, transform .18s ease, color .18s ease; }",
      ".chat-action:hover { background: " + (theme === "light" ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.09)") + "; color: " + panelText + "; box-shadow: 12px 12px 22px -12px rgba(15,23,42,0.5), 4px 4px 10px -10px rgba(96,165,250,0.34); transform: translate(-1px, -1px); }",
      ".chat-action .chat-icon { width: 16px; height: 16px; }",
      ".chat-messages { min-height: 0; flex: 1; overflow-y: auto; padding: 16px; background: " + surfaceBg + "; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; scrollbar-width: thin; scrollbar-color: " + (theme === "light" ? "#d5dbe5" : "#0f2745") + " transparent; }",
      ".chat-messages::-webkit-scrollbar { width: 4px; }",
      ".chat-messages::-webkit-scrollbar-track { background: transparent; }",
      ".chat-messages::-webkit-scrollbar-thumb { border-radius: 999px; background: " + (theme === "light" ? "#d5dbe5" : "#0f2745") + "; }",
      ".chat-stack { display: flex; flex-direction: column; gap: 12px; }",
      ".chat-bubble { max-width: 88%; border-radius: 14px; border: 0; padding: 12px 14px; font-size: 14px; line-height: 1.65; animation: chatBubbleIn .22s ease both; }",
      ".chat-bubble.ai { padding: 10px 12px; background: " + aiBubbleBg + "; color: " + aiBubbleText + "; border-bottom-left-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.01), 0 2px 4px rgba(0,0,0,0.08); }",
      ".chat-bubble.user { max-width: 80%; margin-left: auto; background: " + userBubbleBg + "; color: #ffffff; border-radius: 9px; border-bottom-right-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 4px rgba(0,0,0,0.28); backdrop-filter: none; padding: 10px 12px; }",
      ".chat-bubble.ai .chat-rich { color: " + aiBubbleText + "; }",
      ".chat-message-meta { margin-top: 8px; display: inline-flex; align-items: center; gap: 4px; font-size: 9px; line-height: 1; color: rgba(148,163,184,0.72); }",
      ".chat-message-meta .chat-icon { width: 10px; height: 10px; }",
      ".chat-rich { white-space: normal; }",
      ".chat-rich p { margin: 0; }",
      ".chat-rich p + p, .chat-rich p + ul, .chat-rich p + ol, .chat-rich ul + p, .chat-rich ol + p, .chat-rich ul + ul, .chat-rich ol + ol { margin-top: 10px; }",
      ".chat-rich ul, .chat-rich ol { margin: 0; padding-left: 20px; }",
      ".chat-rich li + li { margin-top: 6px; }",
      ".chat-rich strong { font-weight: 700; color: " + (theme === "light" ? "#0f172a" : "rgba(255,255,255,0.94)") + "; }",
      ".chat-bubble.user .chat-rich strong { color: inherit; }",
      ".chat-rich .chat-line-tag { display: inline-flex; align-items: center; gap: 6px; margin: 0 8px 6px 0; padding: 4px 9px; border-radius: 999px; border: 1px solid " + headerBorder + "; background: " + subtleBg + "; color: " + (theme === "light" ? "#334155" : "rgba(203,213,225,0.88)") + "; font-size: 11px; font-weight: 700; letter-spacing: .01em; vertical-align: middle; }",
      ".chat-rich .chat-line-tag-icon { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; font-size: 12px; }",
      ".chat-cta { margin-top: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px; padding: 12px 16px; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: white; text-decoration: none; background: linear-gradient(135deg, " + accent + ", color-mix(in srgb, " + accent + " 60%, #000)); border: 1px solid color-mix(in srgb, " + accent + " 40%, transparent); box-shadow: 0 6px 20px color-mix(in srgb, " + accent + " 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.15); transition: all .25s ease; }",
      ".chat-cta:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 28px color-mix(in srgb, " + accent + " 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25); }",
      ".chat-cta:active { transform: scale(0.96); box-shadow: 0 4px 12px color-mix(in srgb, " + accent + " 30%, transparent), inset 0 2px 4px rgba(0,0,0,0.25); }",
      ".chat-bubble.ai .chat-cta { margin-top: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 999px; padding: 12px 16px; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: white !important; text-decoration: none; background: linear-gradient(135deg, " + accent + ", color-mix(in srgb, " + accent + " 60%, #000)); border: 1px solid color-mix(in srgb, " + accent + " 40%, transparent); box-shadow: 0 6px 20px color-mix(in srgb, " + accent + " 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.15); transition: all .25s ease; }",
".chat-bubble.ai .chat-cta:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 10px 28px color-mix(in srgb, " + accent + " 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25); }",
".chat-bubble.ai .chat-cta:active { transform: scale(0.96); box-shadow: 0 4px 12px color-mix(in srgb, " + accent + " 30%, transparent), inset 0 2px 4px rgba(0,0,0,0.25); }",
      ".chat-cta-stack { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }",
      ".chat-cta-summary { max-width: 240px; font-size: 10px; line-height: 1.35; color: " + (theme === "light" ? "rgba(71,85,105,0.84)" : "rgba(148,163,184,0.82)") + "; }",
      ".chat-bubble.ai .chat-cta.whatsapp { margin-top: 0; min-height: 0; width: fit-content; gap: 6px; padding: 7px 10px; font-size: 11px; line-height: 1; letter-spacing: .01em; color: #16a34a !important; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.22); box-shadow: none; }",
      ".chat-bubble.ai .chat-cta.whatsapp:hover { transform: translateY(-1px); color: #16a34a !important; background: rgba(34,197,94,0.14); border-color: rgba(34,197,94,0.32); box-shadow: none; }",
      ".chat-bubble.ai .chat-cta.whatsapp .chat-icon { width: 13px; height: 13px; }",
      ".chat-inline-actions { margin-top: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }",
      ".chat-inline-action-row { display: flex; flex-wrap: wrap; gap: 6px; }",
      ".chat-inline-action { display: inline-flex; align-items: center; gap: 6px; min-height: 0; padding: 6px 9px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.2); background: " + (theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.44)") + "; color: " + (theme === "light" ? "#334155" : "rgba(226,232,240,0.88)") + "; font-size: 11px; line-height: 1; text-decoration: none; cursor: pointer; transition: background-color .18s ease, border-color .18s ease, color .18s ease, transform .18s ease; }",
      ".chat-inline-action:hover { transform: translateY(-1px); border-color: rgba(148,163,184,0.34); background: " + (theme === "light" ? "rgba(248,250,252,1)" : "rgba(30,41,59,0.72)") + "; }",
      ".chat-inline-action.is-whatsapp { color: #16a34a; border-color: rgba(34,197,94,0.22); background: rgba(34,197,94,0.08); }",
      ".chat-inline-action.is-whatsapp:hover { color: #15803d; border-color: rgba(34,197,94,0.34); background: rgba(34,197,94,0.14); }",
      ".chat-inline-action.is-active { border-color: color-mix(in srgb, " + accent + " 40%, rgba(148,163,184,0.35)); background: color-mix(in srgb, " + accent + " 10%, " + (theme === "light" ? "rgba(255,255,255,0.94)" : "rgba(15,23,42,0.56)") + "); }",
      ".chat-inline-action .chat-icon { width: 12px; height: 12px; }",
      ".chat-agenda-picker { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 8px 0 2px; }",
      ".chat-agenda-picker-label { font-size: 10px; line-height: 1.3; color: " + (theme === "light" ? "rgba(71,85,105,0.84)" : "rgba(148,163,184,0.82)") + "; }",
      ".chat-agenda-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }",
      ".chat-agenda-chip { display: inline-flex; align-items: center; justify-content: center; min-height: 0; padding: 6px 9px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.18); background: " + (theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.44)") + "; color: " + (theme === "light" ? "#334155" : "rgba(226,232,240,0.88)") + "; font-size: 11px; line-height: 1; cursor: pointer; transition: background-color .18s ease, border-color .18s ease, transform .18s ease; }",
      ".chat-agenda-chip:hover { transform: translateY(-1px); border-color: rgba(148,163,184,0.32); }",
      ".chat-agenda-chip.is-selected { color: white; border-color: color-mix(in srgb, " + accent + " 35%, transparent); background: linear-gradient(135deg, " + accent + ", color-mix(in srgb, " + accent + " 70%, #000)); }",
      ".chat-day-divider { display: flex; align-items: center; gap: 10px; margin: 4px 0; color: rgba(148,163,184,0.72); }",
      ".chat-day-divider::before, .chat-day-divider::after { content: ''; height: 1px; flex: 1; background: rgba(148,163,184,0.12); }",
      ".chat-day-divider-label { display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(148,163,184,0.12); background: rgba(15,23,42,0.24); border-radius: 999px; padding: 4px 10px; font-size: 10px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }",
      ".chat-assets { margin-top: 10px; display: grid; gap: 10px; }",
      ".chat-asset { display: block; overflow: hidden; border-radius: 16px; border: 1px solid " + headerBorder + "; background: color-mix(in srgb, " + panelBackground + " 88%, transparent); color: inherit; text-decoration: none; }",
      ".chat-asset.image, .chat-asset.video, .chat-asset.preview { padding: 0; }",
      ".chat-asset.image img, .chat-asset.video video { display: block; width: 100%; max-height: 210px; object-fit: cover; background: rgba(15,23,42,.35); }",
      ".chat-asset-preview { display: flex; align-items: center; justify-content: center; min-height: 138px; padding: 18px; background: linear-gradient(135deg, color-mix(in srgb, " + accent + " 22%, #0f172a 78%), rgba(15,23,42,.94)); }",
      ".chat-asset-preview-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 72px; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.08); color: white; font-size: 12px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; }",
      ".chat-asset.file { padding: 12px; }",
      ".chat-asset-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
      ".chat-asset-body { padding: 12px; }",
      ".chat-asset-actions { margin-top: 10px; display: flex; gap: 8px; }",
      ".chat-asset-action { display: inline-flex; align-items: center; justify-content: center; min-width: 78px; padding: 8px 12px; border-radius: 999px; border: 1px solid " + headerBorder + "; background: rgba(255,255,255,0.05); color: inherit; font-size: 11px; font-weight: 700; text-decoration: none; transition: transform .18s ease, background-color .18s ease; }",
      ".chat-asset-action:hover { transform: translateY(-1px); background: rgba(255,255,255,0.09); }",
      ".chat-asset-action.primary { border-color: color-mix(in srgb, " + accent + " 40%, transparent); background: color-mix(in srgb, " + accent + " 18%, transparent); color: white; }",
      ".chat-asset-title { font-size: 12px; font-weight: 700; color: inherit; }",
      ".chat-asset-subtitle { margin-top: 4px; font-size: 11px; color: #94a3b8; }",
      ".chat-asset-open { font-size: 11px; font-weight: 700; color: " + accent + "; white-space: nowrap; }",
      ".chat-typing { display: inline-flex; width: fit-content; max-width: 88%; align-items: center; gap: 10px; border-radius: 14px; border: 1px solid " + headerBorder + "; background: " + aiBubbleBg + "; color: rgba(148,163,184,0.88); padding: 12px 14px; animation: chatBubbleIn .22s ease both; }",
      ".chat-typing-dots { display: inline-flex; gap: 4px; }",
      ".chat-typing-dots span { width: 7px; height: 7px; border-radius: 999px; background: currentColor; animation: chatDotsPulse 1.2s infinite ease-in-out; }",
      ".chat-typing-dots span:nth-child(2) { animation-delay: .16s; }",
      ".chat-typing-dots span:nth-child(3) { animation-delay: .32s; }",
      ".chat-input { position: sticky; bottom: 0; z-index: 1; flex-shrink: 0; padding: 14px 16px 10px; border-top: 0; background: " + surfaceBg + "; }",
      ".chat-scroll-bottom { position: absolute; left: 50%; bottom: 118px; z-index: 3; width: 26px; height: 26px; display: none; align-items: center; justify-content: center; border-radius: 999px; border: 1px solid " + (theme === "light" ? "rgba(28,41,59,0.12)" : "rgba(96,165,250,0.14)") + "; background: " + (theme === "light" ? "rgba(255,255,255,0.72)" : "rgba(11,27,50,0.72)") + "; color: " + (theme === "light" ? "rgba(28,41,59,0.76)" : "rgba(226,232,240,0.74)") + "; transform: translateX(-50%); cursor: pointer; box-shadow: 0 6px 14px rgba(2,6,23,0.18); backdrop-filter: blur(6px); }",
      ".chat-scroll-bottom.is-visible { display: inline-flex; }",
      ".chat-scroll-bottom .chat-icon { width: 12px; height: 12px; }",
      ".chat-composer { display: flex; flex-direction: column; gap: 10px; border-radius: 16px; border: 1px solid " + (theme === "light" ? "color-mix(in srgb, " + accent + " 16%, rgba(28,41,59,0.16))" : "rgba(0,0,0,0.42)") + "; outline: 0 solid transparent; background: color-mix(in srgb, " + inputBg + " 94%, white 6%); padding: 12px 12px 10px; box-shadow: none; transition: border-color .18s ease, outline-color .18s ease, background-color .18s ease; }",
      ".chat-composer:hover { border-color: " + (theme === "light" ? "color-mix(in srgb, " + accent + " 22%, rgba(28,41,59,0.18))" : "rgba(255,255,255,0.22)") + "; outline-color: transparent; }",
      ".chat-composer:focus-within { border-color: " + (theme === "light" ? "color-mix(in srgb, " + accent + " 24%, rgba(28,41,59,0.18))" : "rgba(255,255,255,0.18)") + "; outline: " + (theme === "light" ? "4px solid color-mix(in srgb, " + accent + " 10%, rgba(255,255,255,0.92))" : "3px solid rgba(0,0,0,0.12)") + "; box-shadow: none; }",
      ".chat-composer.is-identifying .chat-textarea { display: none; }",
      ".chat-textarea { flex: 0 0 auto; box-sizing: border-box; display: block; width: 100%; height: 22px; min-height: 22px; max-height: 132px; resize: none; overflow-y: hidden; border-radius: 14px; border: 0; outline: none; background: transparent; color: " + inputText + "; padding: 0 2px; font-family: inherit; font-size: 14px; line-height: 22px; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, " + accent + " 26%, transparent) transparent; -ms-overflow-style: auto; transition: color .18s ease; }",
      ".chat-textarea::placeholder { font-size: 13px; color: #94a3b8; }",
      ".chat-textarea:focus { box-shadow: none; background: transparent; }",
      ".chat-textarea.is-waiting::placeholder { font-style: italic; color: #94a3b8; }",
      ".chat-textarea::-webkit-scrollbar { width: 4px; }",
      ".chat-textarea::-webkit-scrollbar-track { background: transparent; }",
      ".chat-textarea::-webkit-scrollbar-thumb { background: color-mix(in srgb, " + accent + " 22%, transparent); border-radius: 999px; }",
      ".chat-composer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
      ".chat-attachments-preview { display: none; flex-wrap: wrap; gap: 6px; }",
      ".chat-attachments-preview.has-items { display: flex; }",
      ".chat-attachment-chip { display: inline-flex; max-width: 100%; align-items: center; gap: 6px; border-radius: 10px; border: 1px solid " + headerBorder + "; background: rgba(255,255,255,0.04); padding: 5px 7px; color: rgba(203,213,225,0.86); font-size: 11px; line-height: 1; }",
      ".chat-attachment-chip .chat-icon { width: 13px; height: 13px; flex: 0 0 13px; }",
      ".chat-attachment-chip span { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".chat-attachment-remove { display: inline-flex; width: 16px; height: 16px; align-items: center; justify-content: center; border: 0; border-radius: 999px; background: transparent; color: inherit; cursor: pointer; opacity: .74; }",
      ".chat-attachment-remove:hover { background: rgba(255,255,255,0.08); opacity: 1; }",
      ".chat-composer-tools { display: inline-flex; align-items: center; gap: 6px; }",
      ".chat-tool { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 10px; background: transparent; color: color-mix(in srgb, " + accent + " 58%, " + panelText + " 42%); opacity: .92; transition: background-color .18s ease, box-shadow .18s ease, transform .18s ease; }",
      ".chat-tool:hover { background: " + (theme === "light" ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.09)") + "; box-shadow: 12px 12px 22px -12px rgba(15,23,42,0.5), 4px 4px 10px -10px rgba(96,165,250,0.34); transform: translate(-1px, -1px); }",
      ".chat-tool.is-active { background: rgba(96,165,250,0.14); color: rgba(226,232,240,0.96); }",
      ".chat-tool .chat-icon { width: 16px; height: 16px; }",
      ".chat-emoji-picker { display: none; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin-top: 8px; padding: 8px; border-radius: 12px; border: 1px solid rgba(96,165,250,0.14); background: " + (theme === "light" ? "rgba(255,255,255,0.92)" : "#0b1b32") + "; }",
      ".chat-emoji-picker.is-open { display: grid; }",
      ".chat-emoji-button { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; border: 0; border-radius: 10px; background: " + (theme === "light" ? "rgba(248,250,252,1)" : "rgba(255,255,255,0.06)") + "; font-size: 18px; cursor: pointer; transition: transform .18s ease, background-color .18s ease; }",
      ".chat-emoji-button:hover { transform: translateY(-1px) scale(1.03); background: " + (theme === "light" ? "rgba(241,245,249,1)" : "rgba(255,255,255,0.12)") + "; }",
      ".chat-contact-box { display: none; gap: 8px; min-height: 22px; border-radius: 12px; border: 0; background: transparent; padding: 2px 0 0; box-shadow: none; }",
      ".chat-contact-box.is-open { display: grid; }",
      ".chat-contact-title { font-size: 11px; font-weight: 700; color: " + contactTitleText + "; }",
      ".chat-contact-subtitle { font-size: 12px; font-weight: 700; color: " + contactSubtitleText + "; }",
      ".chat-contact-description { font-size: 11px; line-height: 1.45; color: " + contactDescriptionText + "; }",
      ".chat-contact-fields { display: grid; gap: 7px; }",
      ".chat-contact-input { width: 100%; box-sizing: border-box; border: 1px solid " + contactInputBorder + "; border-radius: 8px; background: " + contactInputBg + "; color: " + contactInputText + "; padding: 8px 9px; font: inherit; font-size: 12px; outline: none; }",
      ".chat-contact-input::placeholder { color: " + contactInputPlaceholder + "; }",
      ".chat-contact-input:focus { border-color: " + (theme === "light" ? "color-mix(in srgb, " + accent + " 28%, rgba(148,163,184,0.24))" : "rgba(96,165,250,0.28)") + "; box-shadow: " + (theme === "light" ? "0 0 0 3px color-mix(in srgb, " + accent + " 10%, white 90%)" : "none") + "; }",
      ".chat-contact-actions { display: flex; justify-content: flex-end; gap: 8px; }",
      ".chat-contact-action { border: 1px solid " + contactActionBorder + "; border-radius: 8px; background: " + (theme === "light" ? "rgba(255,255,255,0.76)" : "transparent") + "; color: " + contactActionText + "; padding: 7px 10px; font: inherit; font-size: 11px; cursor: pointer; }",
      ".chat-contact-action:hover { border-color: " + (theme === "light" ? "color-mix(in srgb, " + accent + " 20%, rgba(148,163,184,0.24))" : "rgba(96,165,250,0.18)") + "; background: " + (theme === "light" ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.04)") + "; }",
      ".chat-contact-action.primary { border-color: " + contactPrimaryBorder + "; background: " + contactPrimaryBg + "; color: " + contactPrimaryText + "; }",
      ".chat-send { width: 42px; height: 42px; flex: 0 0 42px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 12px; background: transparent; color: color-mix(in srgb, " + accent + " 78%, white 22%); padding: 0; cursor: pointer; box-shadow: none; transition: transform .18s ease, box-shadow .18s ease, filter .18s ease, background-color .18s ease, color .18s ease; }",
      ".chat-send .chat-icon { width: 18px; height: 18px; }",
      ".chat-send.has-value { background: linear-gradient(180deg, color-mix(in srgb, " + accent + " 92%, white 8%), color-mix(in srgb, " + accent + " 74%, #000 26%)); color: white; box-shadow: none; }",
      ".chat-send.has-value:hover { transform: translate(-1px, -1px); box-shadow: 12px 12px 24px -12px color-mix(in srgb, " + accent + " 54%, rgba(15,23,42,0.44)), 4px 4px 10px -10px rgba(96,165,250,0.3); filter: brightness(1.03); }",
      ".chat-send[disabled] { opacity: .45; cursor: not-allowed; }",
      ".chat-credit { display: flex; justify-content: center; padding: 0 16px 12px; border-top: 0; background: " + surfaceBg + "; }",
      ".chat-credit-link { display: inline-flex; align-items: center; gap: 7px; color: rgba(148,163,184,0.84); text-decoration: none; font-size: 10px; line-height: 1; letter-spacing: .01em; transition: color .18s ease, opacity .18s ease, filter .18s ease; }",
      ".chat-credit-link:hover { color: transparent; background-image: linear-gradient(135deg, #60a5fa, #2563eb); -webkit-background-clip: text; background-clip: text; filter: brightness(1.06); }",
      ".chat-credit-brand { font-weight: 600; color: " + (theme === "light" ? "#334155" : "rgba(226,232,240,0.88)") + "; }",
      ".chat-credit-logo-wrap { position: relative; display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; }",
      ".chat-credit-logo { position: absolute; inset: 0; width: 18px; height: 18px; object-fit: contain; transition: opacity .18s ease, transform .18s ease; }",
      ".chat-credit-logo.color { opacity: 0; transform: scale(.96); }",
      ".chat-credit-link:hover .chat-credit-logo.default { opacity: 0; transform: scale(1.04); }",
      ".chat-credit-link:hover .chat-credit-logo.color { opacity: 1; transform: scale(1); }",
      "@media (max-width: 640px) { .chat-wrap { right: 8px; left: auto; top: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 4px); width: 60px; height: 60px; } .chat-wrap.open { top: 0; right: 0; bottom: 0; left: 0; width: 100vw; height: 100dvh; transform: none !important; } .chat-wrap.is-expanded .chat-panel { width: 100%; height: 100%; bottom: 0; } .chat-panel { width: 100%; max-width: 100%; height: calc(100% - 56px); right: 0; bottom: 52px; border-radius: 14px; transform-origin: calc(100% - 30px) calc(100% + 34px); } .chat-wrap.open .chat-panel, .chat-wrap.open.is-expanded .chat-panel, .chat-panel.open { width: 100%; max-width: none; height: 100%; right: 0; bottom: 0; border-radius: 0; } .chat-button { right: 0; bottom: 0; } .chat-launcher-teaser { right: 0; bottom: 70px; max-width: min(250px, calc(100vw - 24px)); } .chat-wrap.open .chat-button { opacity: 0; pointer-events: none; } .chat-maximize { display: none !important; } .chat-close { display: inline-flex !important; } .chat-header { padding: 10px 12px; cursor: default; } .chat-messages { padding-bottom: 12px; } .chat-input { padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 4px); } .chat-credit { padding: 0 16px calc(env(safe-area-inset-bottom, 0px) + 4px); } .chat-scroll-bottom { bottom: 92px; } .chat-composer { border-radius: 14px; padding: 10px 10px 8px; } }",
    ].join("");
    shadow.appendChild(style);

    var wrap = document.createElement("div");
    wrap.className = "chat-wrap";
    shadow.appendChild(wrap);

    var panel = document.createElement("div");
    panel.className = "chat-panel";
    wrap.appendChild(panel);

    var header = document.createElement("div");
    header.className = "chat-header";
    panel.appendChild(header);

    var titleWrap = document.createElement("div");
    header.appendChild(titleWrap);

    var title = document.createElement("div");
    title.className = "chat-title";
    title.textContent = widgetTitle;
    titleWrap.appendChild(title);

    function updateWidgetTitle(nextTitle) {
      var normalizedTitle = String(nextTitle || "").trim();
      if (!normalizedTitle) {
        return;
      }

      widgetTitle = normalizedTitle;
      title.textContent = normalizedTitle;
    }

    var subtitle = document.createElement("div");
    subtitle.className = "chat-subtitle";
    titleWrap.appendChild(subtitle);

    var statusDot = document.createElement("span");
    statusDot.className = "chat-status-dot";
    statusDot.setAttribute("aria-hidden", "true");
    subtitle.appendChild(statusDot);

    var statusLabel = document.createElement("span");
    statusLabel.className = "chat-status-label";
    statusLabel.textContent = hasAgent ? "online" : "offline";
    subtitle.appendChild(statusLabel);

    var humanTag = document.createElement("span");
    humanTag.className = "chat-human-tag";
    humanTag.textContent = "humano atendendo";
    subtitle.appendChild(humanTag);

    var headerActions = document.createElement("div");
    headerActions.style.display = "flex";
    headerActions.style.gap = "8px";
    header.appendChild(headerActions);

    var resetButton = document.createElement("button");
    resetButton.className = "chat-action chat-reset";
    resetButton.type = "button";
    resetButton.setAttribute("aria-label", "Novo atendimento");
    resetButton.setAttribute("title", "Novo atendimento");
    resetButton.innerHTML = createResetIcon();
    headerActions.appendChild(resetButton);

    var maximizeButton = document.createElement("button");
    maximizeButton.className = "chat-action chat-maximize";
    maximizeButton.type = "button";
    maximizeButton.setAttribute("aria-label", "Expandir chat");
    maximizeButton.innerHTML = createMaximizeIcon();
    headerActions.appendChild(maximizeButton);

    var closeButton = document.createElement("button");
    closeButton.className = "chat-action chat-close";
    closeButton.type = "button";
    closeButton.innerHTML = createCloseIcon();
    closeButton.setAttribute("aria-label", "Fechar chat");
    headerActions.appendChild(closeButton);

    var messagesWrap = document.createElement("div");
    messagesWrap.className = "chat-messages";
    panel.appendChild(messagesWrap);

    var stack = document.createElement("div");
    stack.className = "chat-stack";
    messagesWrap.appendChild(stack);

    var scrollBottomButton = document.createElement("button");
    scrollBottomButton.className = "chat-scroll-bottom";
    scrollBottomButton.type = "button";
    scrollBottomButton.setAttribute("aria-label", "Voltar para a ultima mensagem");
    scrollBottomButton.innerHTML = createChevronDownIcon();
    panel.appendChild(scrollBottomButton);

    var form = document.createElement("form");
    form.className = "chat-input";
    panel.appendChild(form);

    var composer = document.createElement("div");
    composer.className = "chat-composer";
    form.appendChild(composer);

    var input = document.createElement("textarea");
    input.className = "chat-textarea";
    input.placeholder = "Digite sua mensagem...";
    input.rows = 1;
    composer.appendChild(input);

    var contactBox = document.createElement("div");
    contactBox.className = "chat-contact-box";
    contactBox.innerHTML = [
      '<div class="chat-contact-title">Iniciar conversa</div>',
      '<div class="chat-contact-subtitle">Qual o seu nome?</div>',
      '<div class="chat-contact-description">Informe seu nome ou celular para liberar a conversa.</div>',
      '<div class="chat-contact-fields">',
      '<input class="chat-contact-input chat-contact-name" type="text" autocomplete="name" placeholder="Seu nome" />',
      '<input class="chat-contact-input chat-contact-phone" type="tel" autocomplete="tel" inputmode="numeric" placeholder="Seu celular" />',
      '<input class="chat-contact-input chat-contact-email" type="email" autocomplete="email" placeholder="Email (opcional)" />',
      "</div>",
      '<div class="chat-contact-actions">',
      '<button type="button" class="chat-contact-action chat-contact-cancel">Cancelar</button>',
      '<button type="button" class="chat-contact-action primary chat-contact-save">Salvar</button>',
      "</div>",
    ].join("");
    composer.appendChild(contactBox);

    var contactNameInput = contactBox.querySelector(".chat-contact-name");
    var contactEmailInput = contactBox.querySelector(".chat-contact-email");
    var contactPhoneInput = contactBox.querySelector(".chat-contact-phone");
    var contactTitle = contactBox.querySelector(".chat-contact-title");
    var contactSubtitle = contactBox.querySelector(".chat-contact-subtitle");
    var contactDescription = contactBox.querySelector(".chat-contact-description");
    var contactCancelButton = contactBox.querySelector(".chat-contact-cancel");
    var contactSaveButton = contactBox.querySelector(".chat-contact-save");

    var attachmentInput = document.createElement("input");
    attachmentInput.type = "file";
    attachmentInput.multiple = true;
    attachmentInput.style.display = "none";
    composer.appendChild(attachmentInput);

    var attachmentsPreview = document.createElement("div");
    attachmentsPreview.className = "chat-attachments-preview";
    composer.appendChild(attachmentsPreview);

    var composerFooter = document.createElement("div");
    composerFooter.className = "chat-composer-footer";
    composer.appendChild(composerFooter);

    var tools = document.createElement("div");
    tools.className = "chat-composer-tools";
    composerFooter.appendChild(tools);

    var emojiTool = document.createElement("button");
    emojiTool.className = "chat-tool";
    emojiTool.type = "button";
    emojiTool.setAttribute("aria-label", "Inserir emoji");
    emojiTool.innerHTML = createEmojiIcon();
    tools.appendChild(emojiTool);

    var emojiPicker = document.createElement("div");
    emojiPicker.className = "chat-emoji-picker";
    composer.appendChild(emojiPicker);

    var contactTool = document.createElement("button");
    contactTool.className = "chat-tool";
    contactTool.type = "button";
    contactTool.setAttribute("aria-label", "Identificar cliente");
    contactTool.innerHTML = createUserIcon();
    tools.appendChild(contactTool);

    var attachTool = document.createElement("button");
    attachTool.className = "chat-tool";
    attachTool.type = "button";
    attachTool.setAttribute("aria-label", "Anexar arquivo");
    attachTool.innerHTML = createAttachIcon();
    tools.appendChild(attachTool);

    [createAudioIcon()].forEach(function (iconMarkup) {
      var tool = document.createElement("button");
      tool.className = "chat-tool";
      tool.type = "button";
      tool.tabIndex = -1;
      tool.setAttribute("aria-hidden", "true");
      tool.innerHTML = iconMarkup;
      tools.appendChild(tool);
    });

    var sendButton = document.createElement("button");
    sendButton.className = "chat-send";
    sendButton.type = "submit";
    sendButton.innerHTML = createPlaneIcon();
    composerFooter.appendChild(sendButton);

    var credit = document.createElement("div");
    credit.className = "chat-credit";
    panel.appendChild(credit);

    var creditLink = document.createElement("a");
    creditLink.className = "chat-credit-link";
    creditLink.href = "https://infrastudio.pro";
    creditLink.target = "_blank";
    creditLink.rel = "noreferrer noopener";
    credit.appendChild(creditLink);

    var creditPrefix = document.createElement("span");
    creditPrefix.textContent = "by";
    creditLink.appendChild(creditPrefix);

    var creditLogoWrap = document.createElement("span");
    creditLogoWrap.className = "chat-credit-logo-wrap";
    creditLink.appendChild(creditLogoWrap);

    var creditLogoDefault = document.createElement("img");
    creditLogoDefault.className = "chat-credit-logo default";
    creditLogoDefault.alt = "InfraStudio";
    creditLogoDefault.src = assetBase + (theme === "light" ? "/logoPretoP.png" : "/logoBrancoP.png");
    creditLogoWrap.appendChild(creditLogoDefault);

    var creditLogoColor = document.createElement("img");
    creditLogoColor.className = "chat-credit-logo color";
    creditLogoColor.alt = "InfraStudio";
    creditLogoColor.src = assetBase + "/logoColorP.png";
    creditLogoWrap.appendChild(creditLogoColor);

    var creditBrand = document.createElement("span");
    creditBrand.className = "chat-credit-brand";
    creditBrand.textContent = "InfraStudio";
    creditLink.appendChild(creditBrand);

    var launcherTeaser = document.createElement("div");
    launcherTeaser.className = "chat-launcher-teaser";
    launcherTeaser.setAttribute("aria-hidden", "true");
    launcherTeaser.innerHTML = [
      '<div class="chat-launcher-teaser-label">' + createClockIcon() + "<span>Atendimento</span></div>",
      '<div class="chat-launcher-teaser-text"></div>',
    ].join("");
    wrap.appendChild(launcherTeaser);

    var launcherTeaserText = launcherTeaser.querySelector(".chat-launcher-teaser-text");

    var triggerButton = document.createElement("button");
    triggerButton.className = "chat-button";
    triggerButton.type = "button";
    triggerButton.setAttribute("aria-label", "Abrir chat");
    triggerButton.innerHTML = createChatBubbleIcon();
    wrap.appendChild(triggerButton);

    function createChatBubbleIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 18.5H5.5A2.5 2.5 0 0 1 3 16V7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5V16a2.5 2.5 0 0 1-2.5 2.5H11l-4 3v-3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createPlaneIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m22 2-7 20-4-9-9-4Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2 11 13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createEmojiIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.8"/><path d="M9.2 14.2c.7.8 1.7 1.2 2.8 1.2 1.1 0 2.1-.4 2.8-1.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9.25" cy="10.25" r="1" fill="currentColor"/><circle cx="14.75" cy="10.25" r="1" fill="currentColor"/></svg></span>';
    }

    function createAttachIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8.8 12.4 14.9 6.3a3.1 3.1 0 1 1 4.4 4.4l-8 8a5 5 0 1 1-7.1-7.1l8.3-8.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createUserIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" stroke="currentColor" stroke-width="1.8"/><path d="M5 19.25c1.5-2.6 4.1-4 7-4s5.5 1.4 7 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>';
    }

    function createAudioIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 13v-2M9 16V8M13 14v-4M17 17V7M21 13v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>';
    }

    function createResetIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 8V4m0 0h4M6 4l3.1 3.1A8 8 0 1 1 4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createCloseIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg></span>';
    }

    function createMaximizeIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createWhatsAppIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6.2 17.8 4.9 21l3.4-1.2A8.2 8.2 0 1 0 3.8 12c0 2.2.9 4.2 2.4 5.8Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.2 8.8c.2-.4.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.3.1.5-.1.7l-.4.5c.6 1 1.4 1.8 2.5 2.3l.5-.5c.2-.2.5-.3.8-.1l1.5.7c.3.1.4.3.4.6v.4c0 .5-.4.9-.9 1-2.5.2-6-2.3-7.1-5-.4-1-.3-1.7-.1-2.1Z" fill="currentColor"/></svg></span>';
    }

    function createChevronDownIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createClockIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4l2.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function createCalendarIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 3.5v3M17 3.5v3M4.75 8.5h14.5M6.5 5.5h11a1.75 1.75 0 0 1 1.75 1.75v10.25A1.75 1.75 0 0 1 17.5 19.25h-11A1.75 1.75 0 0 1 4.75 17.5V7.25A1.75 1.75 0 0 1 6.5 5.5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function getAvailableEmojis() {
      return ["🙂", "😊", "😉", "😄", "🥹", "🤝", "👍", "👋", "🙏", "🤗"];
    }

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function fileToBase64(file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var result = typeof reader.result === "string" ? reader.result : "";
          var parts = result.split(",");
          resolve(parts[1] || "");
        };
        reader.onerror = function () {
          reject(reader.error || new Error("Falha ao ler arquivo."));
        };
        reader.readAsDataURL(file);
      });
    }

    function normalizeAttachmentFiles(fileList) {
      var files = Array.prototype.slice.call(fileList || [], 0, 5);
      return Promise.all(files.map(function (file) {
        return fileToBase64(file).then(function (dataBase64) {
          return {
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            dataBase64: dataBase64,
          };
        });
      }));
    }

    function renderAttachmentsPreview() {
      attachmentsPreview.innerHTML = "";
      attachmentsPreview.classList.toggle("has-items", attachments.length > 0);

      attachments.forEach(function (attachment, index) {
        var chip = document.createElement("span");
        chip.className = "chat-attachment-chip";
        chip.innerHTML = createAttachIcon() + "<span>" + escapeHtml(attachment.name || "arquivo") + "</span>";

        var removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "chat-attachment-remove";
        removeButton.setAttribute("aria-label", "Remover anexo");
        removeButton.textContent = "x";
        removeButton.addEventListener("click", function () {
          attachments = attachments.filter(function (_, itemIndex) {
            return itemIndex !== index;
          });
          renderAttachmentsPreview();
          updateComposerState();
        });

        chip.appendChild(removeButton);
        attachmentsPreview.appendChild(chip);
      });
    }

    function insertEmojiAtCursor(emoji) {
      var value = String(input.value || "");
      var start = typeof input.selectionStart === "number" ? input.selectionStart : value.length;
      var end = typeof input.selectionEnd === "number" ? input.selectionEnd : start;
      input.value = value.slice(0, start) + emoji + value.slice(end);
      var nextCursor = start + emoji.length;
      input.setSelectionRange(nextCursor, nextCursor);
      autoResizeInput();
      updateComposerState();
      input.focus();
    }

    function renderEmojiPicker() {
      emojiPicker.innerHTML = "";
      getAvailableEmojis().forEach(function (emoji) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "chat-emoji-button";
        button.textContent = emoji;
        button.setAttribute("aria-label", "Inserir " + emoji);
        button.addEventListener("click", function () {
          insertEmojiAtCursor(emoji);
          emojiPickerOpen = false;
          syncEmojiPicker();
        });
        emojiPicker.appendChild(button);
      });
    }

    function syncEmojiPicker() {
      emojiPicker.classList.toggle("is-open", emojiPickerOpen);
      emojiTool.classList.toggle("is-active", emojiPickerOpen);
    }

    function formatInline(value) {
      return escapeHtml(value)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/__(.+?)__/g, "<strong>$1</strong>");
    }

    function buildLineTag(tag) {
      var normalized = String(tag || "").trim().toLowerCase();
      var map = {
        risco: { icon: "!", label: "Risco" },
        doc: { icon: "#", label: "Documento" },
        data: { icon: "@", label: "Data" },
        status: { icon: "*", label: "Status" },
        "$": { icon: "$", label: "Valor" },
      };
      var resolved = map[normalized];
      if (!resolved) {
        return "";
      }

      return '<span class="chat-line-tag"><span class="chat-line-tag-icon">' + resolved.icon + "</span>" + resolved.label + "</span>";
    }

    function formatLineContent(line) {
      var text = String(line || "").trim();
      if (!text) {
        return "";
      }

      var tagMatch = text.match(/^\[(risco|doc|data|status|\$)\]\s*/i);
      var tagHtml = "";
      if (tagMatch) {
        tagHtml = buildLineTag(tagMatch[1]);
        text = text.replace(tagMatch[0], "").trim();
      }

      return tagHtml + formatInline(text);
    }

    function formatRichText(value) {
      var normalizedValue = String(value || "")
        .replace(/(^|\n)\s*(\d+)\.\s*\n+(?=\S)/g, "$1$2. ")
        .trim();
      var blocks = normalizedValue.split(/\n\s*\n/);
      return blocks
        .map(function (block) {
          var lines = block.split("\n").filter(Boolean);
          if (!lines.length) {
            return "";
          }

          if (lines.every(function (line) { return /^[-*]\s+/.test(line); })) {
            return "<ul>" + lines.map(function (line) { return "<li>" + formatLineContent(line.replace(/^[-*]\s+/, "")) + "</li>"; }).join("") + "</ul>";
          }

          if (lines.every(function (line) { return /^\d+\.\s+/.test(line); })) {
            return "<ol>" + lines.map(function (line) { return "<li>" + formatLineContent(line.replace(/^\d+\.\s+/, "")) + "</li>"; }).join("") + "</ol>";
          }

          return "<p>" + lines.map(formatLineContent).join("<br>") + "</p>";
        })
        .join("");
    }

    function createWhatsAppButton(cta) {
      if (!cta || !cta.url) {
        return null;
      }

      var wrap = document.createElement("div");
      wrap.className = "chat-cta-stack";

      var link = document.createElement("a");
      link.className = "chat-cta whatsapp";
      link.href = cta.url;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.innerHTML = createWhatsAppIcon() + "<span>" + escapeHtml(cta.label || "WhatsApp") + "</span>";
      wrap.appendChild(link);

      if (cta.summary) {
        var summary = document.createElement("div");
        summary.className = "chat-cta-summary";
        summary.textContent = cta.summary;
        wrap.appendChild(summary);
      }

      return wrap;
    }

    function hasInlineWhatsAppAction(message) {
      if (!message || !Array.isArray(message.actions) || !message.actions.length) {
        return false;
      }

      return message.actions.some(function (action) {
        return action && action.type === "whatsapp_link" && action.url;
      });
    }

    function getActionIconMarkup(action) {
      if (action && action.icon === "calendar") {
        return createCalendarIcon();
      }

      if (action && action.icon === "whatsapp") {
        return createWhatsAppIcon();
      }

      return createChatBubbleIcon();
    }

    function buildAgendaSelectionLabel(day, slot) {
      var dayLabel = day && day.label ? String(day.label).trim() : "horario";
      var timeLabel = slot && slot.label ? String(slot.label).trim() : "";
      return timeLabel ? dayLabel + " as " + timeLabel : dayLabel;
    }

    function buildAgendaSelectionMessage(selection) {
      var dateLabel = selection && selection.date ? String(selection.date).trim() : "";
      var weekdayLabel = selection && selection.weekdayLabel ? String(selection.weekdayLabel).trim() : "";
      var timeLabel = selection && selection.time ? String(selection.time).trim() : "";
      var scheduleLabel = dateLabel || weekdayLabel || "um horario";
      return "Quero marcar um horario em " + scheduleLabel + (timeLabel ? " as " + timeLabel : "") + ".";
    }

    function getAgendaPickerDay(action) {
      if (!inlineActionState || !action || !Array.isArray(action.days)) {
        return null;
      }

      for (var index = 0; index < action.days.length; index += 1) {
        var candidate = action.days[index];
        if (candidate && candidate.key === inlineActionState.dayKey) {
          return candidate;
        }
      }

      return action.days[0] || null;
    }

    function handleAgendaSlotSelection(day, slot) {
      if (!day || !slot) {
        return;
      }

      var selection = {
        slotId: slot.id,
        date: slot.date || day.date || null,
        time: slot.time || null,
        weekdayLabel: slot.weekdayLabel || day.weekdayLabel || day.label || null,
        label: buildAgendaSelectionLabel(day, slot),
      };

      inlineActionState = null;

      if (leadContact && (leadContact.email || leadContact.phone)) {
        void sendMessage(buildAgendaSelectionMessage(selection), {
          userBubbleText: "Quero agendar " + selection.label,
          extraContext: {
            agendaSelection: {
              slotId: selection.slotId,
              date: selection.date,
              time: selection.time,
              weekdayLabel: selection.weekdayLabel,
            },
          },
        });
        return;
      }

      pendingAgendaSelection = selection;
      contactBoxOpen = true;
      syncContactBox();
      renderMessages({ preservePosition: true });
    }

    function createAgendaPicker(message, action) {
      if (!message || !action || !Array.isArray(action.days) || !action.days.length) {
        return null;
      }

      var picker = document.createElement("div");
      picker.className = "chat-agenda-picker";

      var dayLabel = document.createElement("div");
      dayLabel.className = "chat-agenda-picker-label";
      dayLabel.textContent = "Escolha o dia";
      picker.appendChild(dayLabel);

      var dayRow = document.createElement("div");
      dayRow.className = "chat-agenda-chip-row";
      picker.appendChild(dayRow);

      var selectedDay = getAgendaPickerDay(action);
      action.days.forEach(function (day) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "chat-agenda-chip" + (selectedDay && selectedDay.key === day.key ? " is-selected" : "");
        button.textContent = day.label || "Dia";
        button.addEventListener("click", function () {
          inlineActionState = {
            messageId: message.id,
            type: "agenda_schedule",
            dayKey: day.key,
          };
          renderMessages({ preservePosition: true });
        });
        dayRow.appendChild(button);
      });

      if (!selectedDay || !Array.isArray(selectedDay.slots) || !selectedDay.slots.length) {
        return picker;
      }

      var slotLabel = document.createElement("div");
      slotLabel.className = "chat-agenda-picker-label";
      slotLabel.textContent = "Escolha o horario";
      picker.appendChild(slotLabel);

      var slotRow = document.createElement("div");
      slotRow.className = "chat-agenda-chip-row";
      picker.appendChild(slotRow);

      selectedDay.slots.forEach(function (slot) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "chat-agenda-chip";
        button.textContent = slot.label || slot.time || "Horario";
        button.addEventListener("click", function () {
          handleAgendaSlotSelection(selectedDay, slot);
        });
        slotRow.appendChild(button);
      });

      return picker;
    }

    function createMessageActions(message) {
      if (!message || !message.isAi || !Array.isArray(message.actions) || !message.actions.length) {
        return null;
      }

      var wrap = document.createElement("div");
      wrap.className = "chat-inline-actions";

      var row = document.createElement("div");
      row.className = "chat-inline-action-row";
      wrap.appendChild(row);

      message.actions.forEach(function (action) {
        if (!action || !action.type) {
          return;
        }

        var isAgenda = action.type === "agenda_schedule";
        var isActive = Boolean(
          isAgenda &&
          inlineActionState &&
          inlineActionState.messageId === message.id &&
          inlineActionState.type === "agenda_schedule"
        );

        if (action.type === "whatsapp_link" && action.url) {
          var link = document.createElement("a");
          link.className = "chat-inline-action is-whatsapp";
          link.href = action.url;
          link.target = "_blank";
          link.rel = "noreferrer noopener";
          link.innerHTML = getActionIconMarkup(action) + "<span>" + escapeHtml(action.label || "WhatsApp") + "</span>";
          row.appendChild(link);
          return;
        }

        if (isAgenda) {
          var button = document.createElement("button");
          button.type = "button";
          button.className = "chat-inline-action" + (isActive ? " is-active" : "");
          button.innerHTML = getActionIconMarkup(action) + "<span>" + escapeHtml(action.label || "Agendar") + "</span>";
          button.addEventListener("click", function () {
            inlineActionState = isActive
              ? null
              : {
                  messageId: message.id,
                  type: "agenda_schedule",
                  dayKey: action.days && action.days[0] ? action.days[0].key : null,
                };
            renderMessages({ preservePosition: true });
          });
          row.appendChild(button);
        }
      });

      var activeAgendaAction = message.actions.find(function (action) {
        return action && action.type === "agenda_schedule";
      });

      if (
        activeAgendaAction &&
        inlineActionState &&
        inlineActionState.messageId === message.id &&
        inlineActionState.type === "agenda_schedule"
      ) {
        var picker = createAgendaPicker(message, activeAgendaAction);
        if (picker) {
          wrap.appendChild(picker);
        }
      }

      return wrap;
    }

    function createHumanHandoffAction(handoff) {
      if (!handoff || handoff.offered !== true) {
        return null;
      }

      return {
        label: handoff.actionLabel || "Chamar humano",
        message: "Quero falar com um atendente humano",
        requested: handoff.requested === true,
      };
    }

    function createAssetGallery(assets) {
      if (!Array.isArray(assets) || !assets.length) {
        return null;
      }

      var wrap = document.createElement("div");
      wrap.className = "chat-assets";

      assets.slice(0, 3).forEach(function (asset) {
        if (!asset || (!asset.publicUrl && !asset.targetUrl)) {
          return;
        }

        if (asset.kind === "product" || asset.provider === "mercado_livre") {
          wrap.appendChild(createProductAssetCard(asset));
          return;
        }

        var previewKind = getAssetPreviewKind(asset);
        var card = document.createElement("div");
        card.className = "chat-asset " + previewKind;

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

        var openLabel = document.createElement("div");
        openLabel.className = "chat-asset-open";
        openLabel.textContent = getAssetOpenLabel(asset, previewKind);
        meta.appendChild(openLabel);

        body.appendChild(meta);

        var actions = document.createElement("div");
        actions.className = "chat-asset-actions";
        actions.appendChild(createAssetAction(asset, false));
        actions.appendChild(createAssetAction(asset, true));
        body.appendChild(actions);

        card.appendChild(body);
        wrap.appendChild(card);
      });

      return wrap;
    }

    function createProductAssetCard(asset) {
      var card = document.createElement("div");
      card.className = "chat-asset image";

      if (asset.publicUrl) {
        var image = document.createElement("img");
        image.src = asset.publicUrl;
        image.alt = asset.nome || "Produto";
        card.appendChild(image);
      } else {
        card.appendChild(createAssetPreviewBadge({ arquivoNome: "PROD", mimeType: "", categoria: "preview" }));
      }

      var body = document.createElement("div");
      body.className = "chat-asset-body";

      var meta = document.createElement("div");
      meta.className = "chat-asset-meta";

      var textWrap = document.createElement("div");
      var title = document.createElement("div");
      title.className = "chat-asset-title";
      title.textContent = asset.nome || "Produto";
      textWrap.appendChild(title);

      if (asset.descricao) {
        var subtitle = document.createElement("div");
        subtitle.className = "chat-asset-subtitle";
        subtitle.textContent = asset.descricao;
        textWrap.appendChild(subtitle);
      }

      meta.appendChild(textWrap);

      var openLabel = document.createElement("div");
      openLabel.className = "chat-asset-open";
      openLabel.textContent = asset.priceLabel || "Ver produto";
      meta.appendChild(openLabel);

      body.appendChild(meta);

      var actions = document.createElement("div");
      actions.className = "chat-asset-actions";
      actions.appendChild(createProductAssetAction(asset));
      body.appendChild(actions);

      card.appendChild(body);
      return card;
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
      var action = document.createElement("a");
      action.className = "chat-asset-action" + (download ? "" : " primary");
      action.href = asset.publicUrl;
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

    function createProductAssetAction(asset) {
      var action = document.createElement("a");
      action.className = "chat-asset-action primary";
      action.href = asset.targetUrl || asset.publicUrl || "#";
      action.target = "_blank";
      action.rel = "noreferrer noopener";
      action.textContent = "Ver no Mercado Livre";
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

    function persist() {
      if (!storageKey) {
        return;
      }

      try {
        var persistedMessages = Array.isArray(messages) ? messages.slice(-30) : [];
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            chatId: chatId,
            messages: persistedMessages,
            leadContact: leadContact,
            leadCaptureDismissed: leadCaptureDismissed,
            lastSyncedMessageAt: lastSyncedMessageAt,
          }),
        );
      } catch (error) {}
    }

    function normalizeMessageSignature(value) {
      return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function isSameAssistantMessage(candidate, current) {
      if (!candidate || !current || !candidate.isAi || !current.isAi) {
        return false;
      }

      if (candidate.serverId && current.serverId && candidate.serverId === current.serverId) {
        return true;
      }

      var candidateSignature = normalizeMessageSignature(candidate.text);
      var currentSignature = normalizeMessageSignature(current.text);
      if (!candidateSignature || !currentSignature || candidateSignature !== currentSignature) {
        return false;
      }

      var candidateTime = getMessageTimestamp(candidate);
      var currentTime = getMessageTimestamp(current);
      if (!candidateTime || !currentTime) {
        return true;
      }

      return Math.abs(candidateTime - currentTime) <= 10 * 60 * 1000;
    }

    function cancelScrollAnimation() {
      if (scrollAnimationFrame) {
        window.cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
      }
    }


    function isNearBottom() {
      return messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight <= 80;
    }

    function updateScrollBottomButton() {
      var hasOverflow = messagesWrap.scrollHeight - messagesWrap.clientHeight > 40;
      scrollBottomButton.classList.toggle("is-visible", hasOverflow && !isNearBottom());
    }

    function scrollToBottom(behavior) {
      cancelScrollAnimation();
      if (behavior === "smooth") {
        var startTop = messagesWrap.scrollTop;
        var targetTop = messagesWrap.scrollHeight;
        var distance = targetTop - startTop;
        if (Math.abs(distance) < 2) {
          messagesWrap.scrollTop = targetTop;
          window.requestAnimationFrame(updateScrollBottomButton);
          return;
        }

        var duration = 140;
        var startedAt = null;
        var easeOutCubic = function (progress) {
          return 1 - Math.pow(1 - progress, 3);
        };

        var step = function (timestamp) {
          if (startedAt === null) {
            startedAt = timestamp;
          }
          var elapsed = timestamp - startedAt;
          var progress = Math.min(1, elapsed / duration);
          messagesWrap.scrollTop = startTop + distance * easeOutCubic(progress);
          if (progress < 1) {
            scrollAnimationFrame = window.requestAnimationFrame(step);
            return;
          }
          scrollAnimationFrame = null;
          window.requestAnimationFrame(updateScrollBottomButton);
        };

        scrollAnimationFrame = window.requestAnimationFrame(step);
        return;
      }

      if (typeof messagesWrap.scrollTo === "function") {
        messagesWrap.scrollTo({
          top: messagesWrap.scrollHeight,
          behavior: behavior || "auto",
        });
      } else {
        messagesWrap.scrollTop = messagesWrap.scrollHeight;
      }
      window.requestAnimationFrame(updateScrollBottomButton);
    }

    function autoResizeInput() {
      input.style.height = "auto";
      input.style.overflowY = "hidden";
      var lineHeight = parseFloat(window.getComputedStyle(input).lineHeight) || 22;
      var maxHeight = Math.round(lineHeight * 6);
      var contentHeight = Math.max(input.scrollHeight, lineHeight);
      var nextHeight = Math.min(contentHeight, maxHeight);
      input.style.height = nextHeight + "px";
      input.style.minHeight = lineHeight + "px";
      input.style.maxHeight = maxHeight + "px";
      input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
    }

    function updateLauncherVisual() {
      triggerButton.classList.toggle("is-open", open);
      triggerButton.setAttribute("aria-label", open ? "Fechar chat" : "Abrir chat");
      triggerButton.innerHTML = open ? createCloseIcon() : createChatBubbleIcon();
      if (open) {
        hideLauncherTeaser();
      }
    }

    function clearLauncherTeaserTimer() {
      if (contextTeaserTimer) {
        window.clearTimeout(contextTeaserTimer);
        contextTeaserTimer = null;
      }
    }

    function hideLauncherTeaser() {
      clearLauncherTeaserTimer();
      launcherTeaser.classList.remove("is-visible");
    }

    function showLauncherTeaser(message) {
      if (!hasAgent || open) {
        return;
      }

      var normalizedMessage = String(message || "").trim();
      if (!normalizedMessage || !launcherTeaserText) {
        return;
      }

      launcherTeaserText.textContent = normalizedMessage;
      launcherTeaser.classList.add("is-visible");
      clearLauncherTeaserTimer();
      contextTeaserTimer = window.setTimeout(function () {
        launcherTeaser.classList.remove("is-visible");
        contextTeaserTimer = null;
      }, 5200);
    }

    function clearIdlePromptTimer() {
      if (contextIdleTimer) {
        window.clearTimeout(contextIdleTimer);
        contextIdleTimer = null;
      }
    }

    function scheduleIdlePrompt() {
      clearIdlePromptTimer();
      if (open || !hasAgent || contextIdleShown) {
        return;
      }

      contextIdleTimer = window.setTimeout(function () {
        if (open || document.visibilityState === "hidden" || contextIdleShown) {
          return;
        }
        contextIdleShown = true;
        showLauncherTeaser("Ficou com alguma duvida? Posso te ajudar por aqui.");
      }, 18000);
    }

    function registerContextInteraction() {
      lastInteractionAt = Date.now();
      if (!open) {
        hideLauncherTeaser();
      }
      scheduleIdlePrompt();
    }

    function handleContextScrollPrompt() {
      if (open || !hasAgent || contextScrollShown) {
        return;
      }
      var scrollTop = window.scrollY || window.pageYOffset || 0;
      if (scrollTop < 240) {
        return;
      }
      contextScrollShown = true;
      showLauncherTeaser("Oi. Se quiser, eu posso te ajudar sem abrir outra pagina.");
      scheduleIdlePrompt();
    }

    function updateExpandState() {
      wrap.classList.toggle("is-expanded", expanded);
      maximizeButton.setAttribute("aria-label", expanded ? "Reduzir chat" : "Expandir chat");
      maximizeButton.innerHTML = expanded ? createMinimizeIcon() : createMaximizeIcon();
    }

    function normalizeExpandedPosition() {
      if (!expanded || window.innerWidth <= 640) {
        return;
      }

      window.requestAnimationFrame(function () {
        dragState.offsetX = 0;
        dragState.offsetY = 0;
        clampDragOffsets();
        syncDragPosition();
      });
    }

    function createMinimizeIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5H5v4M19 9V5h-4M15 19h4v-4M5 15v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function getDraftLeadContact() {
      return {
        name: String(contactNameInput?.value || "").trim(),
        phone: applyPhoneMask(contactPhoneInput?.value || ""),
        email: String(contactEmailInput?.value || "").trim().toLowerCase(),
      };
    }

    function updateComposerState() {
      var hasLead = hasLeadIdentity(leadContact);
      var draftLead = getDraftLeadContact();
      var canIdentify = hasLeadIdentity(draftLead);
      var hasMessage = Boolean(String(input.value || "").trim()) || attachments.length > 0;
      var hasValue = !loading && (contactBoxOpen ? canIdentify : hasMessage);
      sendButton.classList.toggle("has-value", hasValue);
      sendButton.disabled = loading || !hasValue;
    }

    function syncContactBox() {
      contactBox.classList.toggle("is-open", contactBoxOpen);
      composer.classList.toggle("is-identifying", contactBoxOpen);
      contactTool.classList.toggle("is-active", hasLeadIdentity(leadContact));
      contactTool.setAttribute(
        "title",
        hasLeadIdentity(leadContact) ? "Contato identificado" : "Adicionar nome ou celular",
      );
      if (contactTitle) {
        contactTitle.textContent = pendingAgendaSelection ? "Agenda" : "Iniciar conversa";
      }
      if (contactSubtitle) {
        contactSubtitle.textContent = pendingAgendaSelection ? "Confirme seu contato para agendar" : "Qual o seu nome?";
      }
      if (contactDescription) {
        contactDescription.textContent = pendingAgendaSelection
          ? "Informe seu nome ou celular para continuar com o agendamento."
          : "Informe seu nome ou celular para liberar a conversa.";
      }
      if (contactBoxOpen) {
        contactNameInput.value = leadContact?.name || "";
        contactEmailInput.value = leadContact?.email || "";
        contactPhoneInput.value = applyPhoneMask(leadContact?.phone || "");
        window.requestAnimationFrame(function () {
          if (!contactNameInput.value && !contactPhoneInput.value) {
            contactNameInput.focus();
            return;
          }
          if (!contactPhoneInput.value) {
            contactPhoneInput.focus();
            return;
          }
          input.focus();
        });
      }
      updateComposerState();
    }

    function buildEffectiveContext(extraContext) {
      var baseContext = widgetContext && typeof widgetContext === "object" ? { ...widgetContext } : {};
      if (extraContext && typeof extraContext === "object") {
        baseContext = {
          ...baseContext,
          ...extraContext,
        };
      }
      if (!hasLeadIdentity(leadContact)) {
        return baseContext;
      }

      return {
        ...baseContext,
        lead: {
          ...(baseContext.lead && typeof baseContext.lead === "object" ? baseContext.lead : {}),
          nome: leadContact.name || undefined,
          email: leadContact.email || undefined,
          telefone: leadContact.phone || undefined,
          identificacaoOrigem: "chat_widget",
        },
      };
    }

    function resolveHumanHandoffState(handoff) {
      if (!handoff || typeof handoff !== "object") {
        return {
          active: false,
          loopPaused: false,
          label: "humano atendendo",
        };
      }

      var status = String(handoff.status || "").toLowerCase();
      var reason = String(handoff.reason || "").toLowerCase();
      var loopPaused =
        status.indexOf("pausado_loop") !== -1 ||
        (handoff.paused === true && reason.indexOf("loop") !== -1);

      if (loopPaused) {
        return {
          active: true,
          loopPaused: true,
          label: "pausado por loop",
        };
      }

      var active =
        handoff.active === true ||
        handoff.requested === true ||
        handoff.paused === true ||
        /human|humano|pending|active|requested/i.test(status);

      return {
        active: active,
        loopPaused: false,
        label: handoff.requested === true || /pending|requested/i.test(status) ? "humano acionado" : "humano atendendo",
      };
    }

    function updateHumanHandoffState(handoff) {
      var state = resolveHumanHandoffState(handoff);
      humanHandoffActive = state.active === true && state.loopPaused !== true;
      loopPausedActive = state.loopPaused === true;
      wrap.classList.toggle("human-active", humanHandoffActive);
      wrap.classList.toggle("loop-paused", loopPausedActive);
      humanTag.textContent = state.label || "humano atendendo";
    }

    function upsertLoopPausedNotice(handoff, createdAt) {
      var state = resolveHumanHandoffState(handoff);
      if (!state.loopPaused) {
        return;
      }

      upsertAssistantMessage({
        id: "ai-loop-paused-notice",
        text: "Atendimento pausado temporariamente por seguranca. Detectamos um possivel loop no WhatsApp e interrompemos as respostas automaticas ate a conversa ser revisada.",
        isAi: true,
        createdAt: createdAt || new Date().toISOString(),
        cta: null,
        actions: [],
        assets: [],
      });
    }

    function clampDragOffsets() {
      var viewport = window.visualViewport;
      var viewportWidth = viewport && viewport.width ? viewport.width : window.innerWidth;
      var viewportHeight = viewport && viewport.height ? viewport.height : window.innerHeight;
      var panelRect = panel.getBoundingClientRect();
      var horizontalMargin = 16;
      var verticalMargin = 12;
      var currentOffsetX = dragState.offsetX;
      var currentOffsetY = dragState.offsetY;
      var baseLeft = panelRect.left - currentOffsetX;
      var baseRight = panelRect.right - currentOffsetX;
      var baseTop = panelRect.top - currentOffsetY;
      var baseBottom = panelRect.bottom - currentOffsetY;
      var minX = horizontalMargin - baseLeft;
      var maxX = viewportWidth - horizontalMargin - baseRight;
      var minY = verticalMargin - baseTop;
      var maxY = viewportHeight - verticalMargin - baseBottom;
      dragState.offsetX = Math.min(maxX, Math.max(minX, dragState.offsetX));
      dragState.offsetY = Math.min(maxY, Math.max(minY, dragState.offsetY));
    }

    function syncDragPosition() {
      wrap.style.setProperty("--chat-wrap-offset-x", Math.round(dragState.offsetX) + "px");
      wrap.style.setProperty("--chat-wrap-offset-y", Math.round(dragState.offsetY) + "px");
      wrap.classList.toggle("is-detached", open && (Math.abs(dragState.offsetX) > 6 || Math.abs(dragState.offsetY) > 6));
    }

    function formatMessageTime(message) {
      var value = message && (message.createdAt || message.time);
      var date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) {
        date = new Date();
      }
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }

    function getMessageDayKey(message) {
      var value = message && (message.createdAt || message.time);
      var date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return null;
      }

      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, "0");
      var day = String(date.getDate()).padStart(2, "0");
      return year + "-" + month + "-" + day;
    }

    function formatMessageDayLabel(message) {
      var value = message && (message.createdAt || message.time);
      var date = value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return "";
      }

      var today = new Date();
      var yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      var messageDayKey = getMessageDayKey(message);

      if (messageDayKey === getMessageDayKey({ createdAt: today.toISOString() })) {
        return "Hoje";
      }

      if (messageDayKey === getMessageDayKey({ createdAt: yesterday.toISOString() })) {
        return "Ontem";
      }

      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });
    }

    function createMessageDayDivider(label) {
      var divider = document.createElement("div");
      divider.className = "chat-day-divider";
      var text = document.createElement("div");
      text.className = "chat-day-divider-label";
      text.textContent = label;
      divider.appendChild(text);
      return divider;
    }

    async function syncWidgetUiConfig() {
      if (!widgetSlug) {
        return;
      }

      try {
        var params = new URLSearchParams({
          widgetSlug: widgetSlug,
        });

        if (projeto) {
          params.set("projeto", projeto);
        }

        if (agente) {
          params.set("agente", agente);
        }

        var response = await fetch(apiBase + "/api/chat/config?" + params.toString(), {
          method: "GET",
          credentials: "omit",
        });

        if (!response.ok) {
          return;
        }

        var payload = await response.json().catch(function () {
          return {};
        });

        if (payload && payload.ui && payload.ui.title) {
          updateWidgetTitle(payload.ui.title);
        }
      } catch (error) {
      }
    }

    function renderMessages(options) {
      var settings = options && typeof options === "object" ? options : {};
      var shouldStickToBottom = settings.forceScroll === true || isNearBottom();
      var previousBottomOffset = shouldStickToBottom
        ? 0
        : Math.max(0, messagesWrap.scrollHeight - messagesWrap.scrollTop);
      stack.innerHTML = "";

      if (!messages.length) {
        var welcome = document.createElement("div");
        welcome.className = "chat-bubble ai";
        welcome.textContent = "Oi! Seja bem-vindo. Para comecar, me diga seu nome ou informe seu celular abaixo.";
        stack.appendChild(welcome);
      } else {
        var previousDayKey = null;
        messages.forEach(function (message) {
          var currentDayKey = getMessageDayKey(message);
          if (currentDayKey && currentDayKey !== previousDayKey) {
            stack.appendChild(createMessageDayDivider(formatMessageDayLabel(message)));
          }

          var bubble = document.createElement("div");
          bubble.className = "chat-bubble " + (message.isAi ? "ai" : "user");
          bubble.innerHTML = '<div class="chat-rich">' + formatRichText(message.text) + "</div>";
          var meta = document.createElement("div");
          meta.className = "chat-message-meta";
          meta.innerHTML = createClockIcon() + "<span>" + escapeHtml(formatMessageTime(message)) + "</span>";
          bubble.appendChild(meta);
          if (message.isAi && message.cta && message.cta.url && !hasInlineWhatsAppAction(message)) {
            var cta = createWhatsAppButton(message.cta);
            if (cta) {
              bubble.appendChild(cta);
            }
          }
          if (message.isAi && Array.isArray(message.actions) && message.actions.length) {
            var actions = createMessageActions(message);
            if (actions) {
              bubble.appendChild(actions);
            }
          }
          if (message.isAi && message.handoffAction && message.handoffAction.requested !== true) {
            var handoffButton = document.createElement("button");
            handoffButton.type = "button";
            handoffButton.className = "chat-cta";
            handoffButton.textContent = message.handoffAction.label || "Chamar humano";
            handoffButton.addEventListener("click", function () {
              void sendMessage(message.handoffAction.message || "Quero falar com um atendente humano", {
                skipUserBubble: true,
              });
            });
            bubble.appendChild(handoffButton);
          }
          if (message.isAi && Array.isArray(message.assets) && message.assets.length) {
            var assetGallery = createAssetGallery(message.assets);
            if (assetGallery) {
              bubble.appendChild(assetGallery);
            }
          }
          if (!message.isAi && Array.isArray(message.attachments) && message.attachments.length) {
            var sentAttachments = document.createElement("div");
            sentAttachments.className = "chat-assets";
            message.attachments.forEach(function (attachment) {
              var chip = document.createElement("div");
              chip.className = "chat-asset file";
              chip.innerHTML = '<div class="chat-asset-meta"><div class="chat-asset-title">' + escapeHtml(attachment.name || "Arquivo") + '</div></div>';
              sentAttachments.appendChild(chip);
            });
            bubble.appendChild(sentAttachments);
          }
          stack.appendChild(bubble);
          previousDayKey = currentDayKey || previousDayKey;
        });
      }

      if (loading) {
        var typing = document.createElement("div");
        typing.className = "chat-typing";
        typing.innerHTML = '<span class="chat-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
        stack.appendChild(typing);
      }

      if (shouldStickToBottom) {
        scrollToBottom(settings.smooth ? "smooth" : "auto");
      } else {
        messagesWrap.scrollTop = Math.max(0, messagesWrap.scrollHeight - previousBottomOffset);
        updateScrollBottomButton();
      }
    }

    function syncViewportMetrics() {
      var viewport = window.visualViewport;
      var viewportHeight = viewport && viewport.height ? viewport.height : window.innerHeight;
      wrap.style.setProperty("--viewport-height", Math.round(viewportHeight) + "px");
      if (window.innerWidth > 640) {
        clampDragOffsets();
        syncDragPosition();
        normalizeExpandedPosition();
      }
    }

    function setOpen(nextOpen) {
      open = nextOpen;
      wrap.classList.toggle("open", open);
      if (open) {
        panel.classList.remove("closing");
        panel.classList.add("open");
        if (!messages.length && !hasLeadIdentity(leadContact) && !leadCaptureDismissed) {
          contactBoxOpen = true;
          syncContactBox();
        }
        autoResizeInput();
        if (!contactBoxOpen) {
          input.focus();
        }
        void syncServerMessages();
      } else {
        dragState.offsetX = 0;
        dragState.offsetY = 0;
        syncDragPosition();
        panel.classList.add("closing");
        panel.classList.remove("open");
      }
      updateLauncherVisual();
      updateExpandState();
    }

    addListener(panel, "animationend", function (event) {
      if (event.animationName !== "chatPanelExit") {
        return;
      }
      panel.classList.remove("closing");
    });

    function setLoading(nextLoading) {
      loading = nextLoading;
      input.readOnly = nextLoading;
      input.classList.toggle("is-waiting", nextLoading);
      input.placeholder = nextLoading ? "Atendente esta digitando..." : "Digite sua mensagem...";
      sendButton.disabled = nextLoading;
      sendButton.innerHTML = nextLoading ? '<span class="chat-icon" aria-hidden="true">...</span>' : createPlaneIcon();
      updateComposerState();
      renderMessages({ preservePosition: true });
    }

    function mapSyncedMessage(message) {
      return assignMessageOrder({
        id: "server-" + message.id,
        serverId: message.id,
        text: message.text || "",
        isAi: true,
        assets: Array.isArray(message.assets) ? message.assets : [],
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
        cta: message.whatsapp && message.whatsapp.url ? message.whatsapp : null,
        actions: Array.isArray(message.actions) ? message.actions : [],
        createdAt: message.createdAt || new Date().toISOString(),
        manual: message.manual === true,
      });
    }

    function findStoredAssistantMessageIndex(candidate) {
      if (!candidate) {
        return -1;
      }

      for (var index = messages.length - 1; index >= 0; index -= 1) {
        var current = messages[index];
        if (!current || !current.isAi) {
          continue;
        }

        if (isSameAssistantMessage(candidate, current)) {
          return index;
        }
      }

      return -1;
    }

    function upsertAssistantMessage(candidate) {
      var existingIndex = findStoredAssistantMessageIndex(candidate);
      if (existingIndex === -1) {
        messages.push(assignMessageOrder(candidate));
        sortMessagesChronologically();
        return;
      }

      messages[existingIndex] = {
        ...messages[existingIndex],
        ...candidate,
        id: candidate.id || messages[existingIndex].id,
        order: messages[existingIndex].order,
      };
      sortMessagesChronologically();
    }

    async function syncServerMessages() {
      if (!chatId || pollingMessages || requestInFlight || document.visibilityState === "hidden") {
        return;
      }

      pollingMessages = true;
      try {
        var params = new URLSearchParams({
          chatId: chatId,
          widgetSlug: widgetSlug,
          limit: "20",
        });
        if (projeto) {
          params.set("projeto", projeto);
        }
        if (agente) {
          params.set("agente", agente);
        }
        if (lastSyncedMessageAt) {
          params.set("after", lastSyncedMessageAt);
        }

        var response = await fetch(apiBase + "/api/chat?" + params.toString(), {
          method: "GET",
          credentials: "omit",
        });
        if (!response.ok) {
          return;
        }

        var payload = await response.json();
        var incoming = Array.isArray(payload.messages) ? payload.messages : [];
        var changed = false;
        incoming.forEach(function (message) {
          if (!message || !message.id) {
            return;
          }

          upsertAssistantMessage(mapSyncedMessage(message));
          changed = true;

          if (message.createdAt && (!lastSyncedMessageAt || new Date(message.createdAt).getTime() > new Date(lastSyncedMessageAt).getTime())) {
            lastSyncedMessageAt = message.createdAt;
          }
        });

        if (changed) {
          persist();
          renderMessages({ smooth: isNearBottom() });
        } else if (incoming.length) {
          persist();
        }
      } catch (error) {
      } finally {
        pollingMessages = false;
      }
    }

    function getSyncIntervalMs() {
      return document.visibilityState === "visible" && open ? 12000 : 30000;
    }

    function scheduleSyncLoop() {
      if (syncTimer) {
        window.clearInterval(syncTimer);
      }

      syncTimer = window.setInterval(function () {
        if (open && document.visibilityState === "visible") {
          void syncServerMessages();
        }
      }, getSyncIntervalMs());
    }

    async function sendMessage(text, options) {
      var settings = options && typeof options === "object" ? options : {};
      var trimmed = String(text || "").trim();
      var outboundAttachments = attachments.slice();
      if ((!trimmed && !outboundAttachments.length) || loading || requestInFlight) {
        return;
      }
      requestInFlight = true;

      if (!settings.skipUserBubble) {
        messages.push(assignMessageOrder({
          id: "user-" + Date.now(),
          text: String(settings.userBubbleText || trimmed || "[Anexo enviado]"),
          isAi: false,
          createdAt: new Date().toISOString(),
          attachments: outboundAttachments.map(function (attachment) {
            return {
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
            };
          }),
        }));
      }
      persist();
      renderMessages({ forceScroll: true, smooth: true });
      input.value = "";
      attachments = [];
      renderAttachmentsPreview();
      autoResizeInput();
      setLoading(true);

      try {
        var response = await fetch(apiBase + "/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: chatId,
            message: trimmed,
            widgetSlug: widgetSlug,
            projeto: projeto || undefined,
            agente: agente || undefined,
            identificadorExterno: getLeadIdentifier(leadContact) || externalIdentifier || undefined,
            context: buildEffectiveContext(settings.extraContext),
            attachments: outboundAttachments,
          }),
        });

        var payload = await response.json();
        if (payload.chatId) {
          chatId = payload.chatId;
        }
        if (payload.createdAt) {
          lastSyncedMessageAt = payload.createdAt;
        }

        updateHumanHandoffState(payload.handoff);

        if (payload.reply || payload.error || (Array.isArray(payload.assets) && payload.assets.length)) {
          upsertAssistantMessage({
            id: "ai-" + Date.now(),
            serverId: payload.messageId || null,
            text: payload.reply || payload.error || "",
            isAi: true,
            createdAt: payload.createdAt || new Date().toISOString(),
            cta: payload.whatsapp && payload.whatsapp.url ? payload.whatsapp : null,
            actions: Array.isArray(payload.actions) ? payload.actions : [],
            handoffAction: createHumanHandoffAction(payload.handoff),
            assets: Array.isArray(payload.assets) ? payload.assets : [],
          });
        } else {
          upsertLoopPausedNotice(payload.handoff, payload.createdAt);
        }
      } catch (error) {
        messages.push(assignMessageOrder({
          id: "ai-" + Date.now(),
          text: "Nao consegui responder agora.",
          isAi: true,
          createdAt: new Date().toISOString(),
          cta: null,
        }));
      } finally {
        requestInFlight = false;
        persist();
        setLoading(false);
      }
    }

    addListener(triggerButton, "click", function () {
      registerContextInteraction();
      setOpen(!open);
    });

    addListener(window, "scroll", function () {
      handleContextScrollPrompt();
    }, { passive: true });

    ["click", "keydown", "touchstart"].forEach(function (eventName) {
      addListener(window, eventName, function () {
        registerContextInteraction();
      }, { passive: eventName !== "keydown" });
    });

    addListener(window, "infrastudio-chat:open", function (event) {
      var requestedWidget = event && event.detail ? event.detail.widgetSlug : null;
      if (requestedWidget && requestedWidget !== widgetSlug) {
        return;
      }

      setOpen(true);
    });

    addListener(closeButton, "click", function () {
      setOpen(false);
    });

    addListener(maximizeButton, "click", function () {
      expanded = !expanded;
      updateExpandState();
      if (expanded) {
        normalizeExpandedPosition();
        return;
      }

      dragState.offsetX = 0;
      dragState.offsetY = 0;
      syncDragPosition();
    });

    addListener(resetButton, "click", function () {
      chatId = null;
      messages = [];
      lastSyncedMessageAt = null;
      input.value = "";
      persist();
      renderMessages({ forceScroll: true });
      autoResizeInput();
      updateComposerState();
      input.focus();
    });

    addListener(messagesWrap, "scroll", updateScrollBottomButton);
    addListener(scrollBottomButton, "click", function () {
      scrollToBottom("smooth");
    });

    addListener(input, "input", function () {
      autoResizeInput();
      updateComposerState();
    });
    addListener(contactNameInput, "input", function () {
      updateComposerState();
    });
    addListener(contactPhoneInput, "input", function () {
      var masked = applyPhoneMask(contactPhoneInput.value || "");
      contactPhoneInput.value = masked;
      updateComposerState();
    });
    addListener(contactEmailInput, "input", function () {
      updateComposerState();
    });
    addListener(input, "keyup", function () {
      autoResizeInput();
    });
    addListener(input, "paste", function () {
      window.requestAnimationFrame(autoResizeInput);
    });
    addListener(attachTool, "click", function () {
      emojiPickerOpen = false;
      syncEmojiPicker();
      attachmentInput.click();
    });
    addListener(emojiTool, "click", function () {
      emojiPickerOpen = !emojiPickerOpen;
      syncEmojiPicker();
      if (!emojiPickerOpen) {
        input.focus();
      }
    });
    addListener(contactTool, "click", function () {
      emojiPickerOpen = false;
      syncEmojiPicker();
      contactBoxOpen = !contactBoxOpen;
      syncContactBox();
    });
    addListener(contactCancelButton, "click", function () {
      leadCaptureDismissed = true;
      contactBoxOpen = false;
      persist();
      syncContactBox();
      input.focus();
    });
    addListener(contactSaveButton, "click", function () {
      var nextLead = getDraftLeadContact();
      if (!hasLeadIdentity(nextLead)) {
        contactNameInput.focus();
        return;
      }
      leadContact = nextLead;
      leadCaptureDismissed = false;
      externalIdentifier = getLeadIdentifier(leadContact) || externalIdentifier;
      contactBoxOpen = false;
      persist();
      syncContactBox();
      if (pendingAgendaSelection) {
        var selectedAgenda = pendingAgendaSelection;
        pendingAgendaSelection = null;
        void sendMessage(buildAgendaSelectionMessage(selectedAgenda), {
          userBubbleText: "Quero agendar " + selectedAgenda.label,
          extraContext: {
            agendaSelection: {
              slotId: selectedAgenda.slotId,
              date: selectedAgenda.date,
              time: selectedAgenda.time,
              weekdayLabel: selectedAgenda.weekdayLabel,
            },
          },
        });
        return;
      }
      if (String(input.value || "").trim() || attachments.length) {
        void sendMessage(input.value);
        return;
      }
      input.focus();
    });
    addListener(attachmentInput, "change", function (event) {
      normalizeAttachmentFiles(event.target.files)
        .then(function (nextAttachments) {
          attachments = nextAttachments;
          renderAttachmentsPreview();
          updateComposerState();
        })
        .catch(function (error) {})
        .finally(function () {
          attachmentInput.value = "";
        });
    });
    addListener(input, "keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (contactBoxOpen) {
          contactSaveButton.click();
          return;
        }
        void sendMessage(input.value);
      }

      if (event.key === "Escape" && emojiPickerOpen) {
        emojiPickerOpen = false;
        syncEmojiPicker();
      }
    });

    addListener(form, "submit", function (event) {
      event.preventDefault();
      if (contactBoxOpen) {
        contactSaveButton.click();
        return;
      }
      void sendMessage(input.value);
    });

    addListener(document, "click", function (event) {
      if (!emojiPickerOpen) {
        return;
      }

      var eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      if (
        composer.contains(event.target) ||
        eventPath.indexOf(composer) !== -1 ||
        eventPath.indexOf(emojiTool) !== -1 ||
        eventPath.indexOf(emojiPicker) !== -1
      ) {
        return;
      }

      emojiPickerOpen = false;
      syncEmojiPicker();
    });

    renderEmojiPicker();
    syncEmojiPicker();

    function canStartDrag(eventTarget) {
      if (!open || window.innerWidth <= 640 || expanded) {
        return;
      }

      if (eventTarget && headerActions.contains(eventTarget)) {
        return;
      }
      return true;
    }

    function beginDragging(clientX, clientY, mode, pointerId) {
      dragState.active = true;
      dragState.mode = mode || "mouse";
      dragState.pointerId = typeof pointerId === "number" ? pointerId : null;
      dragState.startX = clientX - dragState.offsetX;
      dragState.startY = clientY - dragState.offsetY;
      wrap.classList.add("is-dragging");
      header.classList.add("is-dragging");
    }

    function updateDragging(clientX, clientY) {
      if (!dragState.active) {
        return;
      }

      dragState.offsetX = clientX - dragState.startX;
      dragState.offsetY = clientY - dragState.startY;
      clampDragOffsets();
      syncDragPosition();
    }

    function finishDragging(pointerId) {
      if (!dragState.active) {
        return;
      }

      if (dragState.mode === "pointer" && dragState.pointerId !== null && typeof pointerId === "number" && dragState.pointerId !== pointerId) {
        return;
      }

      if (dragState.mode === "pointer" && dragState.pointerId !== null && typeof header.releasePointerCapture === "function") {
        try {
          header.releasePointerCapture(dragState.pointerId);
        } catch (error) {
          // ignore pointer capture failures
        }
      }

      dragState.active = false;
      dragState.mode = null;
      dragState.pointerId = null;
      wrap.classList.remove("is-dragging");
      header.classList.remove("is-dragging");
      clampDragOffsets();
      syncDragPosition();
    }

    addListener(header, "mousedown", function (event) {
      if (!canStartDrag(event.target) || event.button !== 0) {
        return;
      }

      beginDragging(event.clientX, event.clientY, "mouse", null);
      event.preventDefault();
    });

    addListener(window, "mousemove", function (event) {
      if (dragState.mode !== "mouse") {
        return;
      }
      updateDragging(event.clientX, event.clientY);
    });

    addListener(window, "mouseup", function () {
      finishDragging(null);
    });

    addListener(header, "pointerdown", function (event) {
      if (window.innerWidth <= 640) {
        if (event.target && headerActions.contains(event.target)) {
          return;
        }
        mobileCloseGesture.active = true;
        mobileCloseGesture.startX = event.clientX;
        mobileCloseGesture.startY = event.clientY;
        mobileCloseGesture.currentX = event.clientX;
        mobileCloseGesture.currentY = event.clientY;
        event.preventDefault();
        return;
      }

      if (event.pointerType === "mouse" || !canStartDrag(event.target)) {
        return;
      }

      beginDragging(event.clientX, event.clientY, "pointer", event.pointerId);
      if (typeof header.setPointerCapture === "function") {
        try {
          header.setPointerCapture(event.pointerId);
        } catch (error) {
          // ignore pointer capture failures
        }
      }
      event.preventDefault();
    });

    addListener(window, "pointermove", function (event) {
      if (mobileCloseGesture.active) {
        mobileCloseGesture.currentX = event.clientX;
        mobileCloseGesture.currentY = event.clientY;
        return;
      }

      if (dragState.mode !== "pointer" || dragState.pointerId !== event.pointerId) {
        return;
      }
      updateDragging(event.clientX, event.clientY);
    });

    addListener(window, "pointerup", function (event) {
      if (mobileCloseGesture.active) {
        var deltaX = mobileCloseGesture.currentX - mobileCloseGesture.startX;
        var deltaY = mobileCloseGesture.currentY - mobileCloseGesture.startY;
        mobileCloseGesture.active = false;
        if (window.innerWidth <= 640 && deltaY > 72 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
          setOpen(false);
          return;
        }
      }
      finishDragging(event.pointerId);
    });
    addListener(window, "pointercancel", function (event) {
      mobileCloseGesture.active = false;
      finishDragging(event.pointerId);
    });

    addListener(window, "resize", syncViewportMetrics);
    if (window.visualViewport) {
      addListener(window.visualViewport, "resize", syncViewportMetrics);
      addListener(window.visualViewport, "scroll", syncViewportMetrics);
    }

    scheduleSyncLoop();
    addListener(document, "visibilitychange", function () {
      scheduleSyncLoop();
      if (document.visibilityState === "hidden") {
        hideLauncherTeaser();
        clearIdlePromptTimer();
        return;
      }
      scheduleIdlePrompt();
      if (open && document.visibilityState === "visible") {
        void syncServerMessages();
      }
    });
    addCleanup(function () {
      if (syncTimer) {
        window.clearInterval(syncTimer);
      }
    });

    updateLauncherVisual();
    syncViewportMetrics();
    autoResizeInput();
    renderAttachmentsPreview();
    updateComposerState();
    syncContactBox();
    updateHumanHandoffState(null);
    renderMessages();
    updateExpandState();
    scheduleIdlePrompt();
    void syncWidgetUiConfig();

    globalApi.instances[widgetSlug] = {
      destroy: destroy,
    };
    globalApi.destroy = function (slug) {
      var key = String(slug || "").trim();
      if (!key) {
        return false;
      }
      var instance = globalApi.instances[key];
      if (!instance || typeof instance.destroy !== "function") {
        return false;
      }
      instance.destroy();
      return true;
    };
    globalApi.destroyAll = function () {
      Object.keys(globalApi.instances).forEach(function (key) {
        globalApi.destroy(key);
      });
    };
    syncLegacyApi();
  });
})();

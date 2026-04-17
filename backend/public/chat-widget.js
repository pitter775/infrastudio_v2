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

  ready(function () {
    var script = document.currentScript;
    if (!script) {
      return;
    }

    var widgetSlug = script.getAttribute("data-widget");
    if (!widgetSlug) {
      console.warn("[InfraStudio Chat] data-widget is required.");
      return;
    }

    var projeto = (script.getAttribute("data-projeto") || "").trim();
    var agente = (script.getAttribute("data-agente") || "").trim();
    var externalIdentifier = (script.getAttribute("data-identificador-externo") || "").trim();
    var rawContext = script.getAttribute("data-context") || "";
    var widgetTitle = script.getAttribute("data-title") || "Chat";
    var apiBase = script.getAttribute("data-api-base") || new URL(script.src).origin;
    var assetBase = new URL(script.src).origin;
    var theme = script.getAttribute("data-theme") === "light" ? "light" : "dark";
    var accent = script.getAttribute("data-accent") || "#64748b";
    var transparent = script.getAttribute("data-transparent") !== "false";
    var hasAgent = Boolean(agente || script.getAttribute("data-agent-status") === "online");
    var cleanup = [];
    var storageKey = null;
    var chatId = null;
    var messages = [];
    var open = false;
    var loading = false;
    var expanded = false;
    var dragState = {
      active: false,
      mode: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
    };

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
        console.warn("[InfraStudio Chat] invalid data-context payload.", error);
        return null;
      }
    }

    var widgetContext = parseContext(rawContext);

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

    function destroy() {
      cleanup.slice().reverse().forEach(function (dispose) {
        try {
          dispose();
        } catch (error) {
          console.warn("[InfraStudio Chat] failed to cleanup widget.", error);
        }
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
    var panelText = theme === "light" ? "#0f172a" : "rgba(226,232,240,0.9)";
    var headerBorder = theme === "light" ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.08)";
    var subtleBg = theme === "light" ? "rgba(148,163,184,.08)" : "rgba(255,255,255,.04)";
    var surfaceBg = theme === "light" ? "rgba(248,250,252,.86)" : "rgba(2,6,23,.18)";
    var aiBubbleBg = theme === "light" ? "#f8fafc" : "rgba(30,41,59,.92)";
    var aiBubbleText = theme === "light" ? "#0f172a" : "rgba(226,232,240,0.86)";
    var inputBg = theme === "light" ? "rgba(255,255,255,.92)" : "rgba(2,6,23,.45)";
    var inputText = theme === "light" ? "#0f172a" : "#ffffff";
    var shadowColor = theme === "light" ? "rgba(15,23,42,.18)" : "rgba(2,6,23,.45)";

    style.textContent = [
      ":host { all: initial; }",
      ".chat-icon { display: inline-flex; align-items: center; justify-content: center; }",
      ".chat-icon svg { width: 100%; height: 100%; display: block; }",
      "@keyframes chatBubbleIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }",
      "@keyframes chatDotsPulse { 0%, 80%, 100% { opacity: .28; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-1px); } }",
      "@keyframes chatLauncherSwap { 0% { opacity: 0; transform: scale(.72) rotate(-18deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }",
      ".chat-wrap { position: fixed; right: 24px; bottom: 24px; width: 60px; height: 60px; z-index: 2147483000; pointer-events: none; font-family: Inter, Arial, sans-serif; transform: translate3d(var(--chat-wrap-offset-x, 0px), var(--chat-wrap-offset-y, 0px), 0); transition: transform .18s ease; will-change: transform; }",
      ".chat-button { width: 60px; height: 60px; display: inline-flex; align-items: center; justify-content: center; pointer-events: auto; border: 0; border-radius: 999px; background: " + accent + "; color: white; cursor: pointer; box-shadow: none; transition: transform .2s ease, background-color .2s ease, opacity .18s ease; }",
      ".chat-button { position: absolute; right: 0; bottom: 0; }",
      ".chat-button:hover { transform: translateY(-1px) scale(1.02); }",
      ".chat-button .chat-icon { width: 24px; height: 24px; animation: chatLauncherSwap .22s ease both; }",
      ".chat-button.is-open { filter: brightness(.92); }",
      ".chat-wrap.open .chat-button { opacity: 1; pointer-events: auto; }",
      ".chat-wrap.open.is-detached .chat-button { opacity: 1; pointer-events: auto; }",
      ".chat-wrap.is-dragging { transition: none; }",
      ".chat-panel { position: absolute; right: 8px; bottom: 76px; width: min(380px, calc(100vw - 32px)); height: min(620px, calc(100vh - 110px)); height: min(620px, calc(100dvh - 110px)); height: min(620px, calc(var(--viewport-height, 100dvh) - 110px)); display: none; pointer-events: auto; flex-direction: column; overflow: hidden; border-radius: 16px; border: 0; background: " + panelBackground + "; color: " + panelText + "; box-shadow: none; backdrop-filter: none; animation: chatBubbleIn .22s ease both; transition: width .18s ease, height .18s ease; }",
      ".chat-wrap.is-expanded .chat-panel { width: min(680px, calc(100vw - 32px)); height: calc(var(--viewport-height, 100dvh) - 36px); right: 8px; bottom: 12px; }",
      ".chat-panel.open { display: flex; }",
      ".chat-header { position: sticky; top: 0; z-index: 2; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 0; background: " + (theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(16,27,50,0.98)") + "; backdrop-filter: none; cursor: grab; touch-action: none; }",
      ".chat-header.is-dragging { cursor: grabbing; }",
      ".chat-title { font-size: 15px; font-weight: 700; color: " + panelText + "; }",
      ".chat-subtitle { margin-top: 5px; display: inline-flex; align-items: center; gap: 7px; font-size: 10px; color: rgba(148,163,184,0.84); text-transform: uppercase; letter-spacing: .08em; }",
      ".chat-status-dot { width: 7px; height: 7px; border-radius: 999px; background: " + (hasAgent ? "#22c55e" : "rgba(148,163,184,0.78)") + "; box-shadow: 0 0 0 0 " + (hasAgent ? "rgba(34,197,94,0.45)" : "rgba(148,163,184,0.22)") + "; animation: " + (hasAgent ? "chatStatusPulse 1.7s infinite" : "none") + "; }",
      "@keyframes chatStatusPulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.42); } 70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }",
      ".chat-action { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; background: transparent; color: rgba(148,163,184,0.86); border-radius: 10px; cursor: pointer; transition: background-color .18s ease, box-shadow .18s ease, transform .18s ease, color .18s ease; }",
      ".chat-action:hover { background: " + (theme === "light" ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.09)") + "; color: " + panelText + "; box-shadow: 12px 12px 22px -12px rgba(15,23,42,0.5), 4px 4px 10px -10px rgba(96,165,250,0.34); transform: translate(-1px, -1px); }",
      ".chat-action .chat-icon { width: 16px; height: 16px; }",
      ".chat-messages { min-height: 0; flex: 1; overflow-y: auto; padding: 16px; background: " + surfaceBg + "; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }",
      ".chat-stack { display: flex; flex-direction: column; gap: 12px; }",
      ".chat-bubble { max-width: 88%; border-radius: 14px; border: 0; padding: 12px 14px; font-size: 14px; line-height: 1.65; animation: chatBubbleIn .22s ease both; }",
      ".chat-bubble.ai { padding: 0; background: transparent; color: " + aiBubbleText + "; border-color: transparent; border-bottom-left-radius: 4px; }",
      ".chat-bubble.user { max-width: 80%; margin-left: auto; background: color-mix(in srgb, " + accent + " 42%, transparent); color: rgba(255,255,255,0.92); border-radius: 9px; border-bottom-right-radius: 4px; box-shadow: none; backdrop-filter: none; padding: 10px 12px; }",
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
      ".chat-composer { display: flex; flex-direction: column; gap: 10px; border-radius: 16px; border: 1px solid color-mix(in srgb, " + accent + " 14%, rgba(255,255,255,0.08)); background: color-mix(in srgb, " + inputBg + " 94%, white 6%); padding: 12px 12px 10px; box-shadow: none; transition: border-color .18s ease, box-shadow .18s ease, background-color .18s ease; }",
      ".chat-composer:focus-within { border-color: color-mix(in srgb, " + accent + " 26%, rgba(255,255,255,0.12)); box-shadow: 8px 8px 18px -16px rgba(15,23,42,0.34); }",
      ".chat-textarea { flex: 0 0 auto; box-sizing: border-box; display: block; width: 100%; height: 22px; min-height: 22px; max-height: 132px; resize: none; overflow-y: hidden; border-radius: 14px; border: 0; outline: none; background: transparent; color: " + inputText + "; padding: 0 2px; font-family: inherit; font-size: 14px; line-height: 22px; scrollbar-width: thin; scrollbar-color: color-mix(in srgb, " + accent + " 26%, transparent) transparent; -ms-overflow-style: auto; transition: color .18s ease; }",
      ".chat-textarea::placeholder { font-size: 13px; color: #94a3b8; }",
      ".chat-textarea:focus { box-shadow: none; background: transparent; }",
      ".chat-textarea.is-waiting::placeholder { font-style: italic; color: #94a3b8; }",
      ".chat-textarea::-webkit-scrollbar { width: 4px; }",
      ".chat-textarea::-webkit-scrollbar-track { background: transparent; }",
      ".chat-textarea::-webkit-scrollbar-thumb { background: color-mix(in srgb, " + accent + " 22%, transparent); border-radius: 999px; }",
      ".chat-composer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
      ".chat-composer-tools { display: inline-flex; align-items: center; gap: 6px; }",
      ".chat-tool { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 10px; background: transparent; color: color-mix(in srgb, " + accent + " 58%, " + panelText + " 42%); opacity: .92; transition: background-color .18s ease, box-shadow .18s ease, transform .18s ease; }",
      ".chat-tool:hover { background: " + (theme === "light" ? "rgba(255,255,255,0.52)" : "rgba(255,255,255,0.09)") + "; box-shadow: 12px 12px 22px -12px rgba(15,23,42,0.5), 4px 4px 10px -10px rgba(96,165,250,0.34); transform: translate(-1px, -1px); }",
      ".chat-tool .chat-icon { width: 16px; height: 16px; }",
      ".chat-send { width: 42px; height: 42px; flex: 0 0 42px; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: 12px; background: transparent; color: color-mix(in srgb, " + accent + " 78%, white 22%); padding: 0; cursor: pointer; box-shadow: none; transition: transform .18s ease, box-shadow .18s ease, filter .18s ease, background-color .18s ease, color .18s ease; }",
      ".chat-send .chat-icon { width: 18px; height: 18px; }",
      ".chat-send.has-value { background: linear-gradient(180deg, color-mix(in srgb, " + accent + " 92%, white 8%), color-mix(in srgb, " + accent + " 74%, #000 26%)); color: white; box-shadow: none; }",
      ".chat-send.has-value:hover { transform: translate(-1px, -1px); box-shadow: 12px 12px 24px -12px color-mix(in srgb, " + accent + " 54%, rgba(15,23,42,0.44)), 4px 4px 10px -10px rgba(96,165,250,0.3); filter: brightness(1.03); }",
      ".chat-send[disabled] { opacity: .6; cursor: wait; }",
      ".chat-credit { display: flex; justify-content: center; padding: 0 16px 12px; border-top: 0; background: " + surfaceBg + "; }",
      ".chat-credit-link { display: inline-flex; align-items: center; gap: 7px; color: rgba(148,163,184,0.84); text-decoration: none; font-size: 10px; line-height: 1; letter-spacing: .01em; transition: color .18s ease, opacity .18s ease, filter .18s ease; }",
      ".chat-credit-link:hover { color: transparent; background-image: linear-gradient(135deg, #60a5fa, #2563eb); -webkit-background-clip: text; background-clip: text; filter: brightness(1.06); }",
      ".chat-credit-brand { font-weight: 600; color: " + (theme === "light" ? "#334155" : "rgba(226,232,240,0.88)") + "; }",
      ".chat-credit-logo-wrap { position: relative; display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; }",
      ".chat-credit-logo { position: absolute; inset: 0; width: 18px; height: 18px; object-fit: contain; transition: opacity .18s ease, transform .18s ease; }",
      ".chat-credit-logo.color { opacity: 0; transform: scale(.96); }",
      ".chat-credit-link:hover .chat-credit-logo.default { opacity: 0; transform: scale(1.04); }",
      ".chat-credit-link:hover .chat-credit-logo.color { opacity: 1; transform: scale(1); }",
      "@media (max-width: 640px) { .chat-wrap { right: 12px; left: auto; top: auto; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); width: 60px; height: 60px; } .chat-wrap.open { top: calc(env(safe-area-inset-top, 0px) + 8px); right: 8px; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); left: 8px; width: auto; height: auto; } .chat-wrap.is-expanded .chat-panel { width: 100%; height: 100%; bottom: 0; } .chat-panel { width: 100%; max-width: 100%; height: 100%; right: 0; bottom: 0; border-radius: 14px; transform: none !important; } .chat-panel.open { width: 100%; max-width: none; height: 100%; border-radius: 14px; } .chat-button { right: 0; bottom: 0; } .chat-wrap.open .chat-button { opacity: 1; pointer-events: auto; } .chat-header { padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px 12px; cursor: default; } .chat-messages { padding-bottom: 20px; } .chat-input { padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 8px); } .chat-composer { border-radius: 14px; padding: 10px 10px 8px; } }",
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

    var subtitle = document.createElement("div");
    subtitle.className = "chat-subtitle";
    subtitle.innerHTML = '<span class="chat-status-dot" aria-hidden="true"></span><span>' + (hasAgent ? "online" : "offline") + "</span>";
    titleWrap.appendChild(subtitle);

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

    var composerFooter = document.createElement("div");
    composerFooter.className = "chat-composer-footer";
    composer.appendChild(composerFooter);

    var tools = document.createElement("div");
    tools.className = "chat-composer-tools";
    composerFooter.appendChild(tools);

    [createEmojiIcon(), createAttachIcon(), createAudioIcon()].forEach(function (iconMarkup) {
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

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
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

      var link = document.createElement("a");
      link.className = "chat-cta";
      link.href = cta.url;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.textContent = cta.label || "Continuar no WhatsApp..";
      return link;
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

      assets.slice(0, 2).forEach(function (asset) {
        if (!asset || !asset.publicUrl) {
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
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            chatId: chatId,
            messages: messages,
          }),
        );
      } catch (error) {
        console.warn("[InfraStudio Chat] failed to persist conversation.", error);
      }
    }


    function scrollToBottom() {
      messagesWrap.scrollTop = messagesWrap.scrollHeight;
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
    }

    function updateExpandState() {
      wrap.classList.toggle("is-expanded", expanded);
      maximizeButton.setAttribute("aria-label", expanded ? "Reduzir chat" : "Expandir chat");
      maximizeButton.innerHTML = expanded ? createMinimizeIcon() : createMaximizeIcon();
    }

    function createMinimizeIcon() {
      return '<span class="chat-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5H5v4M19 9V5h-4M15 19h4v-4M5 15v4h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    }

    function updateComposerState() {
      var hasValue = Boolean(String(input.value || "").trim()) && !loading;
      sendButton.classList.toggle("has-value", hasValue);
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

    function renderMessages() {
      stack.innerHTML = "";

      if (!messages.length) {
        var welcome = document.createElement("div");
        welcome.className = "chat-bubble ai";
        welcome.textContent = "Oi! Como posso te ajudar agora?";
        stack.appendChild(welcome);
      } else {
        messages.forEach(function (message) {
          var bubble = document.createElement("div");
          bubble.className = "chat-bubble " + (message.isAi ? "ai" : "user");
          bubble.innerHTML = '<div class="chat-rich">' + formatRichText(message.text) + "</div>";
          if (message.isAi && message.cta && message.cta.url) {
            var cta = createWhatsAppButton(message.cta);
            if (cta) {
              bubble.appendChild(cta);
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
          stack.appendChild(bubble);
        });
      }

      if (loading) {
        var typing = document.createElement("div");
        typing.className = "chat-typing";
        typing.innerHTML = '<span class="chat-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
        stack.appendChild(typing);
      }

      scrollToBottom();
    }

    function syncViewportMetrics() {
      var viewport = window.visualViewport;
      var viewportHeight = viewport && viewport.height ? viewport.height : window.innerHeight;
      wrap.style.setProperty("--viewport-height", Math.round(viewportHeight) + "px");
      if (window.innerWidth > 640) {
        clampDragOffsets();
        syncDragPosition();
      }
    }

    function setOpen(nextOpen) {
      open = nextOpen;
      wrap.classList.toggle("open", open);
      if (open) {
        panel.classList.add("open");
        autoResizeInput();
        input.focus();
      } else {
        dragState.offsetX = 0;
        dragState.offsetY = 0;
        syncDragPosition();
        panel.classList.remove("open");
      }
      updateLauncherVisual();
      updateExpandState();
    }

    function setLoading(nextLoading) {
      loading = nextLoading;
      input.readOnly = nextLoading;
      input.classList.toggle("is-waiting", nextLoading);
      input.placeholder = nextLoading ? "Atendente esta digitando..." : "Digite sua mensagem...";
      sendButton.disabled = nextLoading;
      sendButton.innerHTML = nextLoading ? '<span class="chat-icon" aria-hidden="true">...</span>' : createPlaneIcon();
      updateComposerState();
      renderMessages();
    }

    async function sendMessage(text, options) {
      var settings = options && typeof options === "object" ? options : {};
      var trimmed = String(text || "").trim();
      if (!trimmed || loading) {
        return;
      }

      if (!settings.skipUserBubble) {
        messages.push({ id: "user-" + Date.now(), text: trimmed, isAi: false });
      }
      persist();
      renderMessages();
      input.value = "";
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
            identificadorExterno: externalIdentifier || undefined,
            context: widgetContext || undefined,
          }),
        });

        var payload = await response.json();
        if (payload.chatId) {
          chatId = payload.chatId;
        }

        messages.push({
          id: "ai-" + Date.now(),
          text: payload.reply || payload.error || "Nao consegui responder agora.",
          isAi: true,
          cta: payload.whatsapp && payload.whatsapp.url ? payload.whatsapp : null,
          handoffAction: createHumanHandoffAction(payload.handoff),
          assets: Array.isArray(payload.assets) ? payload.assets : [],
        });
      } catch (error) {
        messages.push({
          id: "ai-" + Date.now(),
          text: "Nao consegui responder agora.",
          isAi: true,
          cta: null,
        });
      } finally {
        persist();
        setLoading(false);
      }
    }

    addListener(triggerButton, "click", function () {
      setOpen(!open);
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
      if (!expanded) {
        dragState.offsetX = 0;
        dragState.offsetY = 0;
        syncDragPosition();
      }
      updateExpandState();
    });

    addListener(resetButton, "click", function () {
      chatId = null;
      messages = [];
      input.value = "";
      persist();
      renderMessages();
      autoResizeInput();
      updateComposerState();
      input.focus();
    });

    addListener(input, "input", function () {
      autoResizeInput();
      updateComposerState();
    });
    addListener(input, "keyup", function () {
      autoResizeInput();
    });
    addListener(input, "paste", function () {
      window.requestAnimationFrame(autoResizeInput);
    });
    addListener(input, "keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage(input.value);
      }
    });

    addListener(form, "submit", function (event) {
      event.preventDefault();
      void sendMessage(input.value);
    });

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
      if (dragState.mode !== "pointer" || dragState.pointerId !== event.pointerId) {
        return;
      }
      updateDragging(event.clientX, event.clientY);
    });

    addListener(window, "pointerup", function (event) {
      finishDragging(event.pointerId);
    });
    addListener(window, "pointercancel", function (event) {
      finishDragging(event.pointerId);
    });

    addListener(window, "resize", syncViewportMetrics);
    if (window.visualViewport) {
      addListener(window.visualViewport, "resize", syncViewportMetrics);
      addListener(window.visualViewport, "scroll", syncViewportMetrics);
    }

    updateLauncherVisual();
    syncViewportMetrics();
    autoResizeInput();
    updateComposerState();
    renderMessages();
    updateExpandState();

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

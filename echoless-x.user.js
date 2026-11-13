// ==UserScript==
// @name:zh-CN         X/Twitter 仅看原创 – 隐藏转发
// @name         X/Twitter Original Posts Only – Hide Reposts
// @version      2026.11.13.4
// @description:zh-CN  项目已于 2026-11-13 结束维护。最终版本停用过滤与导航改写，并显示一次可关闭的结束通知。
// @description:en  Retired on 2026-11-13. Final update disables filtering and navigation changes and shows a dismissible retirement notice.
// @author       Mercury
// @match        https://twitter.com/*
// @match        https://x.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @namespace    https://tampermonkey.net/
// @description Retired on 2026-11-13. Final update disables filtering and navigation changes and shows a dismissible retirement notice.
// @downloadURL  https://raw.githubusercontent.com/Aruke05/echoless-x/main/echoless-x.user.js
// @updateURL    https://raw.githubusercontent.com/Aruke05/echoless-x/main/echoless-x.user.js
// ==/UserScript==

(function () {
  'use strict';

  const NOTICE_ID = 'x-original-only-retirement';
  const DISMISSED_KEY = 'x-original-only:retirement-2026-11-13';

  function isDismissed() {
    try {
      if (typeof GM_getValue === 'function' && GM_getValue(DISMISSED_KEY, false)) return true;
    } catch {}
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function showNotice() {
    if (isDismissed() || document.getElementById(NOTICE_ID)) return;

    const language = document.documentElement.lang || navigator.language || 'en';
    const zh = language.toLowerCase().startsWith('zh');
    const host = document.createElement('div');
    host.id = NOTICE_ID;
    host.style.cssText = 'position:fixed;right:16px;bottom:24px;z-index:2147483647;width:360px;max-width:calc(100vw - 32px);';
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { color-scheme: light dark; }
      aside { box-sizing: border-box; max-height: calc(100dvh - 48px); overflow: auto;
        padding: 20px; border: 1px solid #87949f; border-radius: 16px;
        background: #fff; color: #0f1419; box-shadow: 0 8px 32px #0003;
        font: 14px/1.6 system-ui, sans-serif; }
      h2 { margin: 0 0 10px; font-size: 17px; }
      p { margin: 0 0 16px; }
      a { color: #0969da; }
      button { display: block; margin-top: 16px; padding: 8px 16px; border: 0;
        border-radius: 20px; background: #0f1419; color: #fff; font: inherit; cursor: pointer; }
      @media (prefers-color-scheme: dark) {
        aside { background: #15202b; color: #f7f9f9; }
        a { color: #71b7ff; }
        button { background: #eff3f4; color: #0f1419; }
      }
    `;
    const notice = document.createElement('aside');
    notice.setAttribute('role', 'status');
    notice.lang = zh ? 'zh-CN' : 'en';
    const title = document.createElement('h2');
    title.textContent = zh ? 'EchoLess X 已结束 · 请卸载' : 'EchoLess X retired · Please uninstall';
    const message = document.createElement('p');
    message.textContent = zh
      ? 'X/Twitter 已更新，EchoLess X 已结束维护，所有功能已停用。请在脚本管理器中删除「X/Twitter 仅看原创 – 隐藏转发」。感谢使用。'
      : 'X/Twitter has been updated. EchoLess X has retired and all features are disabled. Please delete “X/Twitter Original Posts Only – Hide Reposts” in your userscript manager. Thank you for using it.';
    const link = document.createElement('a');
    link.href = 'https://github.com/Aruke05/echoless-x#readme';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = zh ? '查看结束说明' : 'Read the retirement notice';
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = zh ? '知道了，关闭通知' : 'Got it, dismiss';
    dismiss.addEventListener('click', () => {
      try {
        if (typeof GM_setValue === 'function') GM_setValue(DISMISSED_KEY, true);
      } catch {}
      try {
        localStorage.setItem(DISMISSED_KEY, '1');
      } catch {}
      host.remove();
    });
    notice.append(title, message, link, dismiss);
    root.append(style, notice);
    document.body.appendChild(host);
  }

  if (document.body) {
    showNotice();
  } else {
    document.addEventListener('DOMContentLoaded', showNotice, { once: true });
  }
})();

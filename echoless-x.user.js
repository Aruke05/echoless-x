// ==UserScript==
// @name:zh-CN         X/Twitter 仅看原创 – 隐藏转发
// @name         X/Twitter Original Posts Only – Hide Reposts
// @version      2026.07.04.1
// @description:zh-CN  在 X/Twitter 时间线上过滤转发内容，只显示原创推文。转发可缩略预览或以隐藏条显示，并提供可拖动控制面板管理显示设置。支持媒体缩略图、作者信息预览及双模式隐藏。
// @description:en  Hide reposts on X/Twitter profile timelines while keeping original posts easy to read.
// @author       Mercury
// @match        https://twitter.com/*
// @match        https://x.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @run-at       document-start
// @namespace    https://tampermonkey.net/
// @description Hide reposts on X/Twitter profile timelines while keeping original posts easy to read.
// @downloadURL  https://raw.githubusercontent.com/Aruke05/echoless-x/main/echoless-x.user.js
// @updateURL    https://raw.githubusercontent.com/Aruke05/echoless-x/main/echoless-x.user.js
// ==/UserScript==

(function () {
  'use strict';

  const APP = 'x-original-only';
  const PANEL_ID = `${APP}-panel`;
  const STYLE_ID = `${APP}-style`;

  const CLASS = {
    article: `${APP}-article`,
    hidden: `${APP}-hidden`,
    placeholder: `${APP}-placeholder`,
    expanded: `${APP}-expanded`,
    modePreview: `${APP}-mode-preview`,
    modeBar: `${APP}-mode-bar`,
    pending: `${APP}-pending`,
    author: `${APP}-author`,
    previewWrap: `${APP}-preview-wrap`,
    thumbGrid: `${APP}-thumb-grid`,
    thumb: `${APP}-thumb`,
    active: `${APP}-active`,
    collapsed: `${APP}-collapsed`,
    dragging: `${APP}-dragging`,
  };

  const DATA = {
    repost: 'xOriginalOnlyRepost',
    tweetId: 'xOriginalOnlyTweetId',
    visible: 'xOriginalOnlyVisible',
    checked: 'xOriginalOnlyChecked',
  };

  const STORAGE = {
    mode: `${APP}:mode`,
    panelPositionExpanded: `${APP}:panel-position-expanded`,
    panelPositionCollapsed: `${APP}:panel-position-collapsed`,
    panelCollapsed: `${APP}:panel-collapsed`,
  };

  const HIDE_MODE = {
    preview: 'preview',
    bar: 'bar',
  };

  const MODE_INDEX = {
    [HIDE_MODE.preview]: 0,
    [HIDE_MODE.bar]: 1,
  };

  const UI_LANGUAGE = getUiLanguage();
  const UI_TEXT = {
    zh: {
      placeholderEyebrow: '已过滤转发',
      placeholderHidden: '已隐藏一条转发',
      placeholderShown: '已显示这条转发',
      showThis: '显示这条',
      hideThis: '隐藏这条',
      showAll: '显示全部',
      hideAgain: '重新隐藏',
      count: '已隐藏 {count} 条',
      collapsedCount: '原创 {count}',
      collapsePanel: '收起面板',
      expandPanel: '展开面板',
      modeAria: '隐藏等级',
      helpOpen: '查看隐藏等级说明',
      helpClose: '隐藏等级说明已展开',
      helpTitle: '隐藏等级说明',
      unknownAuthor: '未知作者',
      repostedAuthorAvatar: '被转发人的头像',
      videoThumbnail: '视频缩略图',
      imageThumbnail: '图片缩略图',
      modes: {
        [HIDE_MODE.preview]: {
          label: '缩略图',
          detail: '隐藏转发正文，显示被转发人和媒体缩略图。适合快速扫图。',
        },
        [HIDE_MODE.bar]: {
          label: '隐藏条',
          detail: '只保留一条轻量提示和显示按钮，不展示头像或媒体。默认推荐。',
        },
      },
    },
    en: {
      placeholderEyebrow: 'Repost hidden',
      placeholderHidden: 'One repost hidden',
      placeholderShown: 'Repost shown',
      showThis: 'Show',
      hideThis: 'Hide',
      showAll: 'Show all',
      hideAgain: 'Hide again',
      count: '{count} hidden',
      collapsedCount: 'Originals {count}',
      collapsePanel: 'Collapse panel',
      expandPanel: 'Expand panel',
      modeAria: 'Hide level',
      helpOpen: 'Show hide level details',
      helpClose: 'Hide level details expanded',
      helpTitle: 'Hide level details',
      unknownAuthor: 'Unknown author',
      repostedAuthorAvatar: 'Reposted author avatar',
      videoThumbnail: 'Video thumbnail',
      imageThumbnail: 'Image thumbnail',
      modes: {
        [HIDE_MODE.preview]: {
          label: 'Preview',
          detail: 'Hide repost text, but keep the reposted author and media thumbnails visible.',
        },
        [HIDE_MODE.bar]: {
          label: 'Bar',
          detail: 'Keep only a small placeholder with a show button. Avatars and media stay hidden. Recommended default.',
        },
      },
    },
  };

  const PROFILE_BLOCKLIST = new Set([
    'explore',
    'notifications',
    'messages',
    'i',
    'settings',
    'search',
    'hashtag',
    'compose',
    'jobs',
    'premium',
    'verified-orgs',
    'download',
    'privacy',
    'tos',
  ]);

  const REPOST_WORDS = [
    'reposted',
    'retweeted',
    'repost',
    'retweet',
    '转发',
    '轉發',
    '转帖',
    '轉帖',
    '转推',
    '轉推',
    '已转发',
    '已轉發',
    '已转帖',
    '已轉帖',
    'リポスト',
    'リツイート',
    'reposteado',
    'reposteó',
    'republicó',
    'republié',
    'republiée',
    'reposté',
    'repostet',
    'repostou',
    'ripubblicato',
  ].map(normalizeText);

  const state = {
    hideMode: getStoredHideMode(),
    showAll: false,
    panelCollapsed: localStorage.getItem(STORAGE.panelCollapsed) === '1',
    expandedTweetIds: new Set(),
    mediaCache: new Map(),
    helpOpen: false,
    scanPending: false,
    generatedId: 0,
    lastRouteWasProfile: isProfileHome(),
  };

  injectStyle();
  updateRouteClass();
  bootWhenReady();
  patchHistory();

  window.addEventListener('popstate', onRouteChange);
  window.addEventListener(`${APP}:route-change`, onRouteChange);
  window.addEventListener('resize', () => {
    const panel = document.getElementById(PANEL_ID);
    if (panel) repositionPanelInsideViewport(panel);
  });

  function bootWhenReady() {
    if (document.body) {
      init();
      return;
    }

    document.addEventListener('DOMContentLoaded', init, { once: true });
  }

  function init() {
    ensurePanel();
    document.addEventListener('click', captureNavigationAnchor, true);
    setupMutationObserver();
    scheduleScan(true);
  }

  function patchHistory() {
    ['pushState', 'replaceState'].forEach((methodName) => {
      const original = history[methodName];
      if (original.__xOriginalOnlyPatched) return;

      history[methodName] = function (...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event(`${APP}:route-change`));
        return result;
      };
      history[methodName].__xOriginalOnlyPatched = true;
    });
  }

  function onRouteChange() {
    const nowProfile = isProfileHome();
    state.lastRouteWasProfile = nowProfile;
    updateRouteClass();
    scheduleScan(true);
  }

  function updateRouteClass() {
    document.documentElement.classList.toggle(`${APP}-active-route`, isProfileHome());
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      if (mutations.some(hasRelevantMutation)) {
        markPendingArticles(mutations);
        scheduleScan(false);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function hasRelevantMutation(mutation) {
    return Array.from(mutation.addedNodes).some((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      return node.matches?.('article[data-testid="tweet"]') || node.querySelector?.('article[data-testid="tweet"]');
    });
  }

  function markPendingArticles(mutations) {
    if (!isProfileHome()) return;

    mutations.forEach((mutation) => {
      Array.from(mutation.addedNodes).forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const articles = node.matches?.('article[data-testid="tweet"]')
          ? [node]
          : Array.from(node.querySelectorAll?.('article[data-testid="tweet"]') || []);

        articles.forEach((article) => {
          if (article.dataset[DATA.checked] !== '1' && !article.dataset[DATA.visible]) {
            article.classList.add(CLASS.pending);
          }
        });
      });
    });
  }

  function scheduleScan(urgent) {
    if (state.scanPending) return;
    state.scanPending = true;

    const run = () => {
      state.scanPending = false;
      scanTimeline();
    };

    if (urgent) {
      requestAnimationFrame(run);
      return;
    }

    window.setTimeout(run, 120);
  }

  function scanTimeline() {
    ensurePanel();

    if (!isProfileHome()) {
      if (isStatusRoute()) {
        updatePanel();
        return;
      }

      cleanupTimeline();
      updatePanel();
      return;
    }

    document.querySelectorAll('article[data-testid="tweet"]').forEach((article) => {
      patchStatusLinksForNewTab(article);

      if (!isRepostArticle(article)) {
        article.dataset[DATA.checked] = '1';
        restoreArticle(article);
        return;
      }

      markArticle(article);
      ensurePlaceholder(article);
      updateAuthorPreview(article);
      updateMediaPreview(article);
      applyVisibility(article);
      article.dataset[DATA.checked] = '1';
      article.classList.remove(CLASS.pending);
    });

    updatePanel();
  }

  function isProfileHome() {
    const path = location.pathname.replace(/^\/+|\/+$/g, '');
    if (!path || path.includes('/')) return false;

    const firstSegment = path.split('/')[0].toLowerCase();
    return !PROFILE_BLOCKLIST.has(firstSegment);
  }

  function isStatusRoute() {
    return /\/status\/\d+/.test(location.pathname);
  }

  function isRepostArticle(article) {
    // Only inspect Twitter/X's social-context node. Body text is intentionally ignored.
    const socialContext = article.querySelector('[data-testid="socialContext"]');
    if (!socialContext) return false;

    const text = normalizeText(socialContext.textContent);
    return text ? REPOST_WORDS.some((word) => text.includes(word)) : false;
  }

  function markArticle(article) {
    article.dataset[DATA.repost] = '1';
    article.dataset[DATA.tweetId] = getTweetId(article);
    article.classList.add(CLASS.article);
  }

  function getTweetId(article) {
    const tweetId = getTweetIdFromArticle(article);
    if (tweetId) return tweetId;

    if (!article.dataset[DATA.tweetId]) {
      state.generatedId += 1;
      article.dataset[DATA.tweetId] = `node-${state.generatedId}`;
    }
    return article.dataset[DATA.tweetId];
  }

  function getTweetIdFromArticle(article) {
    const timestampLink = article.querySelector('a[href*="/status/"] time')?.closest('a[href*="/status/"]');
    const fallbackLink = Array.from(article.querySelectorAll('a[href*="/status/"]')).find((link) =>
      /\/status\/\d+/.test(link.getAttribute('href') || '')
    );
    const href = timestampLink?.getAttribute('href') || fallbackLink?.getAttribute('href') || '';
    return href.match(/\/status\/(\d+)/)?.[1] || '';
  }

  function ensurePlaceholder(article) {
    if (getPlaceholder(article)) return;

    const placeholder = document.createElement('div');
    placeholder.className = CLASS.placeholder;
    placeholder.innerHTML = `
      <div class="${APP}-placeholder-row">
        <div class="${APP}-placeholder-copy">
          <span class="${APP}-eyebrow">${escapeHtml(t('placeholderEyebrow'))}</span>
          <span data-role="placeholder-status">${escapeHtml(t('placeholderHidden'))}</span>
        </div>
        <button type="button" class="${APP}-capsule" data-role="placeholder-toggle">${escapeHtml(t('showThis'))}</button>
      </div>
      <div class="${CLASS.previewWrap}">
        <div class="${CLASS.author}" data-role="author" hidden></div>
        <div class="${CLASS.thumbGrid}" data-role="media-grid" hidden></div>
      </div>
    `;

    placeholder.querySelector('[data-role="placeholder-toggle"]').addEventListener('click', () => {
      toggleSingleArticle(article);
    });

    article.parentNode.insertBefore(placeholder, article);
  }

  function getPlaceholder(article) {
    const previous = article.previousElementSibling;
    return previous?.classList?.contains(CLASS.placeholder) ? previous : null;
  }

  function captureNavigationAnchor(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!isProfileHome()) return;
    if (target.closest(`#${PANEL_ID}, .${CLASS.placeholder}`)) return;
    if (!isPlainPrimaryClick(event)) return;
    if (isInteractiveTweetControl(target)) return;

    const article = target.closest('article[data-testid="tweet"]');
    if (!article) return;

    const directLink = target.closest('a[href*="/status/"]');
    if (directLink && directLink.closest('article[data-testid="tweet"]') !== article) return;
    if (!directLink && target.closest('a[href]')) return;

    const url = getStatusUrlFromArticleClick(article, directLink);
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function patchStatusLinksForNewTab(article) {
    article.querySelectorAll('a[href*="/status/"]').forEach((link) => {
      const url = getAbsoluteStatusUrl(link.getAttribute('href') || '');
      if (!url) return;

      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    });
  }

  function getStatusUrlFromArticleClick(article, directLink) {
    const href =
      directLink?.getAttribute('href') ||
      article.querySelector('a[href*="/status/"] time')?.closest('a[href*="/status/"]')?.getAttribute('href') ||
      Array.from(article.querySelectorAll('a[href*="/status/"]'))
        .map((link) => link.getAttribute('href') || '')
        .find((value) => /\/status\/\d+/.test(value));

    return getAbsoluteStatusUrl(href || '');
  }

  function getAbsoluteStatusUrl(href) {
    if (!/\/status\/\d+/.test(href)) return '';

    try {
      const url = new URL(href, location.origin);
      url.search = '';
      url.hash = '';
      return url.href;
    } catch {
      return '';
    }
  }

  function isPlainPrimaryClick(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  function isInteractiveTweetControl(target) {
    const interactive = target.closest(
      [
        'button',
        '[role="button"]',
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
        '[data-testid="like"]',
        '[data-testid="unlike"]',
        '[data-testid="retweet"]',
        '[data-testid="unretweet"]',
        '[data-testid="reply"]',
        '[data-testid="bookmark"]',
        '[data-testid="removeBookmark"]',
        '[data-testid="share"]',
        '[data-testid="caret"]',
      ].join(',')
    );

    if (!interactive) return false;
    const statusLink = interactive.closest('a[href*="/status/"]');
    return !statusLink;
  }

  function preserveViewportPosition(callback) {
    // Filtering itself must never force-scroll the page. Back-navigation is
    // handled by opening tweet details in a new tab, preserving the timeline.
    callback();
  }

  function updateAuthorPreview(article) {
    const placeholder = getPlaceholder(article);
    const authorNode = placeholder?.querySelector('[data-role="author"]');
    if (!authorNode) return;

    const author = getAuthorInfo(article);
    const signature = author ? `${author.avatar}|${author.name}|${author.handle}` : '';
    if (authorNode.dataset.signature === signature) return;

    authorNode.dataset.signature = signature;
    authorNode.replaceChildren();
    authorNode.hidden = !author;
    if (!author) return;

    if (author.avatar) {
      const avatar = document.createElement('img');
      avatar.src = author.avatar;
      avatar.alt = author.name ? `${author.name} avatar` : t('repostedAuthorAvatar');
      avatar.loading = 'lazy';
      avatar.addEventListener('error', () => avatar.remove(), { once: true });
      authorNode.appendChild(avatar);
    }

    const textWrap = document.createElement('div');
    textWrap.className = `${APP}-author-text`;

    const name = document.createElement('span');
    name.className = `${APP}-author-name`;
    name.textContent = author.name || t('unknownAuthor');

    const handle = document.createElement('span');
    handle.className = `${APP}-author-handle`;
    handle.textContent = author.handle || '';

    textWrap.append(name, handle);
    authorNode.appendChild(textWrap);
  }

  function getAuthorInfo(article) {
    const userName = article.querySelector('[data-testid="User-Name"]');
    const textParts = [
      ...new Set(
        Array.from(userName?.querySelectorAll('span') || [])
          .map((span) => normalizeDisplayText(span.textContent))
          .filter(Boolean)
      ),
    ];

    const handle = textParts.find((text) => text.startsWith('@')) || '';
    const name =
      textParts.find((text) => text && !text.startsWith('@') && text !== '·' && !/^\d/.test(text)) || '';
    const avatar = getAuthorAvatar(article);

    if (!name && !handle && !avatar) return null;
    return { avatar, name, handle };
  }

  function getAuthorAvatar(article) {
    const image = Array.from(article.querySelectorAll('img')).find((img) => {
      const src = img.currentSrc || img.src || '';
      return src.includes('profile_images') || src.includes('/sticky/default_profile_images/');
    });
    return image ? image.currentSrc || image.src || '' : '';
  }

  function updateMediaPreview(article) {
    const placeholder = getPlaceholder(article);
    const grid = placeholder?.querySelector('[data-role="media-grid"]');
    if (!grid) return;

    const tweetId = article.dataset[DATA.tweetId] || getTweetId(article);
    const freshItems = getMediaItems(article).slice(0, 4);
    const cachedItems = state.mediaCache.get(tweetId) || [];
    const shouldRefreshCache = freshItems.length > 0 && (cachedItems.length === 0 || freshItems.length > cachedItems.length);
    const mediaItems = shouldRefreshCache ? freshItems : cachedItems;

    if (shouldRefreshCache) {
      state.mediaCache.set(tweetId, freshItems);
    }

    const signature = mediaItems.map((item) => `${item.type}:${item.src}`).join('|');
    if (grid.dataset.signature === signature) return;

    grid.dataset.signature = signature;
    grid.dataset.count = String(mediaItems.length);
    grid.hidden = mediaItems.length === 0;
    grid.replaceChildren();

    mediaItems.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = CLASS.thumb;
      button.title = t('showThis');

      const image = document.createElement('img');
      image.src = item.src;
      image.alt = item.type === 'video' ? t('videoThumbnail') : t('imageThumbnail');
      image.loading = 'lazy';
      image.addEventListener(
        'error',
        () => {
          button.remove();
          grid.dataset.count = String(grid.children.length);
          grid.hidden = grid.children.length === 0;
        },
        { once: true }
      );
      button.appendChild(image);

      if (item.type !== 'image') {
        const badge = document.createElement('span');
        badge.textContent = item.type === 'gif' ? 'GIF' : '视频';
        button.appendChild(badge);
      }

      button.addEventListener('click', () => toggleSingleArticle(article));
      grid.appendChild(button);
    });
  }

  function getMediaItems(article) {
    const items = [];
    const seen = new Set();

    article.querySelectorAll('img').forEach((img) => {
      const src = getUsefulMediaImageSrc(img);
      if (!src || seen.has(src)) return;

      seen.add(src);
      items.push({
        src,
        type: isGifLike(img, src) ? 'gif' : 'image',
      });
    });

    article.querySelectorAll('video').forEach((video) => {
      const src = getStableTwimgMediaSrc(video.poster);
      if (!src || seen.has(src)) return;

      seen.add(src);
      items.push({ src, type: 'video' });
    });

    return items;
  }

  function getUsefulMediaImageSrc(img) {
    const src = img.currentSrc || img.src;
    const stableSrc = getStableTwimgMediaSrc(src);
    if (!stableSrc) return '';

    return stableSrc;
  }

  function getStableTwimgMediaSrc(src) {
    if (!src) return '';

    try {
      const url = new URL(src, location.href);
      const pathname = url.pathname;
      const isTweetMedia =
        url.hostname.endsWith('twimg.com') &&
        (pathname.includes('/media/') ||
          pathname.includes('/tweet_video_thumb/') ||
          pathname.includes('/ext_tw_video_thumb/') ||
          pathname.includes('/amplify_video_thumb/'));

      if (!isTweetMedia) return '';

      url.searchParams.set('name', 'small');
      return url.toString();
    } catch {
      return '';
    }
  }

  function isGifLike(img, src) {
    const text = normalizeText(`${img.alt || ''} ${src}`);
    return text.includes('gif') || text.includes('tweet_video_thumb');
  }

  function toggleSingleArticle(article) {
    const tweetId = article.dataset[DATA.tweetId] || getTweetId(article);

    if (state.showAll) {
      state.showAll = false;
    }

    if (state.expandedTweetIds.has(tweetId)) {
      state.expandedTweetIds.delete(tweetId);
    } else {
      state.expandedTweetIds.add(tweetId);
    }

    applyVisibilityToAll();
    updatePanel();
  }

  function applyVisibility(article) {
    if (article.dataset[DATA.repost] !== '1') return;

    const placeholder = getPlaceholder(article);
    if (!placeholder) return;

    const tweetId = article.dataset[DATA.tweetId] || getTweetId(article);
    const shouldShow = state.showAll || state.expandedTweetIds.has(tweetId);
    const mode = state.hideMode;

    syncArticleVisibility(article, shouldShow);

    placeholder.hidden = false;
    placeholder.style.minHeight = shouldShow ? '' : getPlaceholderMinHeight(article, mode);
    placeholder.classList.toggle(CLASS.expanded, shouldShow);
    placeholder.classList.toggle(CLASS.modePreview, !shouldShow && mode === HIDE_MODE.preview);
    placeholder.classList.toggle(CLASS.modeBar, !shouldShow && mode === HIDE_MODE.bar);

    placeholder.querySelector('[data-role="placeholder-status"]').textContent = shouldShow
      ? t('placeholderShown')
      : t('placeholderHidden');
    placeholder.querySelector('[data-role="placeholder-toggle"]').textContent = shouldShow ? t('hideThis') : t('showThis');
  }

  function getPlaceholderMinHeight(article, mode) {
    // Do not preserve the original tweet height: media-heavy reposts would
    // become huge blank holes. Keep only a small fixed spacer so batches of
    // reposts do not fully collapse and trigger aggressive timeline fetching.
    return '54px';
  }

  function syncArticleVisibility(article, shouldShow) {
    article.classList.add(CLASS.article);

    const previous = article.dataset[DATA.visible];
    if (previous === String(Number(shouldShow))) return;

    article.dataset[DATA.visible] = String(Number(shouldShow));

    // First paint for new nodes is instant to avoid timeline flash. User-triggered toggles animate.
    if (previous === undefined) {
      article.classList.toggle(CLASS.hidden, !shouldShow);
      article.style.height = shouldShow ? '' : '0px';
      article.style.opacity = shouldShow ? '' : '0';
      article.style.transform = shouldShow ? '' : 'translateY(-8px) scale(0.995)';
      return;
    }

    if (shouldShow) {
      article.classList.remove(CLASS.hidden);
      article.style.height = '0px';
      article.style.opacity = '0';
      article.style.transform = 'translateY(-8px) scale(0.995)';

      requestAnimationFrame(() => {
        article.style.height = `${article.scrollHeight}px`;
        article.style.opacity = '1';
        article.style.transform = 'translateY(0) scale(1)';
      });

      runAfterTransition(article, () => {
        if (article.dataset[DATA.visible] === '1') {
          article.style.height = '';
        }
      });
      return;
    }

    article.style.height = `${article.scrollHeight}px`;
    article.style.opacity = '1';
    article.style.transform = 'translateY(0) scale(1)';

    requestAnimationFrame(() => {
      article.classList.add(CLASS.hidden);
      article.style.height = '0px';
      article.style.opacity = '0';
      article.style.transform = 'translateY(-8px) scale(0.995)';
    });
  }

  function runAfterTransition(node, callback) {
    const fallback = window.setTimeout(callback, 460);
    node.addEventListener(
      'transitionend',
      (event) => {
        if (event.target !== node || event.propertyName !== 'height') return;
        window.clearTimeout(fallback);
        callback();
      },
      { once: true }
    );
  }

  function restoreArticle(article) {
    article.classList.remove(CLASS.pending);
    if (article.dataset[DATA.repost] !== '1') return;

    const placeholder = getPlaceholder(article);
    article.classList.remove(CLASS.article, CLASS.hidden);
    article.style.height = '';
    article.style.opacity = '';
    article.style.transform = '';

    delete article.dataset[DATA.repost];
    delete article.dataset[DATA.visible];

    if (placeholder) placeholder.remove();
  }

  function cleanupTimeline() {
    document.querySelectorAll(`article[data-${kebabCase(DATA.repost)}="1"]`).forEach(restoreArticle);
    document.querySelectorAll(`.${CLASS.placeholder}`).forEach((placeholder) => placeholder.remove());
  }
  function ensurePanel() {
    if (document.getElementById(PANEL_ID) || !document.body) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="${APP}-panel-top" data-role="drag-handle">
        <div class="${APP}-panel-title">
          <span class="${APP}-panel-dot"></span>
          <span data-role="count">${escapeHtml(t('count', { count: 0 }))}</span>
        </div>
        <div class="${APP}-panel-actions">
          <button type="button" class="${APP}-panel-button" data-role="toggle">${escapeHtml(t('showAll'))}</button>
          <button type="button" class="${APP}-icon-button" data-role="help" title="${escapeHtml(t('helpOpen'))}" aria-label="${escapeHtml(t('helpOpen'))}">?</button>
          <button type="button" class="${APP}-icon-button" data-role="collapse" title="${escapeHtml(t('collapsePanel'))}" aria-label="${escapeHtml(t('collapsePanel'))}">-</button>
        </div>
      </div>
      <div class="${APP}-collapsed-row" data-role-drag="1">
        <span data-role="collapsed-label">${escapeHtml(t('collapsedCount', { count: 0 }))}</span>
        <button type="button" class="${APP}-icon-button" data-role="expand" title="${escapeHtml(t('expandPanel'))}" aria-label="${escapeHtml(t('expandPanel'))}">+</button>
      </div>
      <div class="${APP}-panel-body">
        <div class="${APP}-segmented" data-role="mode-switch" aria-label="${escapeHtml(t('modeAria'))}">
          <span class="${APP}-segment-indicator" aria-hidden="true"></span>
          ${renderModeButton(HIDE_MODE.preview)}
          ${renderModeButton(HIDE_MODE.bar)}
        </div>
        <div class="${APP}-mode-help" data-role="mode-help" hidden>
          <div class="${APP}-mode-help-title">${escapeHtml(t('helpTitle'))}</div>
          ${renderModeHelpItem(HIDE_MODE.preview)}
          ${renderModeHelpItem(HIDE_MODE.bar)}
        </div>
      </div>
    `;

    panel.querySelector('[data-role="toggle"]').addEventListener('click', () => {
      state.showAll = !state.showAll;
      applyVisibilityToAll();
      updatePanel();
    });

    panel.querySelector('[data-role="help"]').addEventListener('click', () => {
      state.helpOpen = !state.helpOpen;
      updatePanel();
    });

    panel.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        state.hideMode = button.dataset.mode;
        localStorage.setItem(STORAGE.mode, state.hideMode);
        applyVisibilityToAll();
        updatePanel();
      });
    });

    panel.querySelector('[data-role="collapse"]').addEventListener('click', () => {
      persistPanelPosition(panel, false);
      state.panelCollapsed = true;
      localStorage.setItem(STORAGE.panelCollapsed, '1');
      panel.classList.add(CLASS.collapsed);
      restorePanelPosition(panel);
      updatePanel();
    });

    panel.querySelector('[data-role="expand"]').addEventListener('click', () => {
      persistPanelPosition(panel, true);
      state.panelCollapsed = false;
      localStorage.setItem(STORAGE.panelCollapsed, '0');
      panel.classList.remove(CLASS.collapsed);
      restorePanelPosition(panel);
      updatePanel();
    });

    document.body.appendChild(panel);
    panel.classList.toggle(CLASS.collapsed, state.panelCollapsed);
    restorePanelPosition(panel);
    bindPanelDrag(panel);
    updatePanel();
  }

  function applyVisibilityToAll() {
    preserveViewportPosition(() => {
      document.querySelectorAll(`article[data-${kebabCase(DATA.repost)}="1"]`).forEach(applyVisibility);
    });
  }

  function updatePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const active = isProfileHome();
    const hiddenCount = Array.from(document.querySelectorAll(`article[data-${kebabCase(DATA.repost)}="1"]`)).filter(
      (article) => article.classList.contains(CLASS.hidden)
    ).length;

    panel.hidden = !active;
    panel.classList.toggle(CLASS.collapsed, state.panelCollapsed);
    panel.style.setProperty(`--${APP}-segment-index`, MODE_INDEX[state.hideMode]);
    panel.querySelector('[data-role="count"]').textContent = t('count', { count: hiddenCount });
    panel.querySelector('[data-role="collapsed-label"]').textContent = t('collapsedCount', { count: hiddenCount });
    panel.querySelector('[data-role="toggle"]').textContent = state.showAll ? t('hideAgain') : t('showAll');
    panel.querySelector('[data-role="help"]').title = state.helpOpen ? t('helpClose') : t('helpOpen');
    panel.querySelector('[data-role="help"]').setAttribute('aria-label', state.helpOpen ? t('helpClose') : t('helpOpen'));
    panel.querySelector('[data-role="help"]').classList.toggle(CLASS.active, state.helpOpen);
    panel.querySelector('[data-role="mode-help"]').hidden = !state.helpOpen;
    panel.querySelectorAll('[data-mode]').forEach((button) => {
      button.classList.toggle(CLASS.active, button.dataset.mode === state.hideMode);
    });

    repositionPanelInsideViewport(panel);
  }

  function bindPanelDrag(panel) {
    let dragState = null;
    const handles = panel.querySelectorAll('[data-role="drag-handle"], [data-role-drag="1"]');

    handles.forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;

        const rect = panel.getBoundingClientRect();
        dragState = {
          pointerId: event.pointerId,
          offsetX: event.clientX - rect.left,
          offsetY: event.clientY - rect.top,
        };

        panel.setPointerCapture(event.pointerId);
        panel.classList.add(CLASS.dragging);
        event.preventDefault();
      });
    });

    panel.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      setPanelPosition(panel, clampPanelPosition(event.clientX - dragState.offsetX, event.clientY - dragState.offsetY));
    });

    panel.addEventListener('pointerup', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;

      dragState = null;
      panel.classList.remove(CLASS.dragging);
      panel.releasePointerCapture(event.pointerId);
      persistPanelPosition(panel);
    });

    panel.addEventListener('pointercancel', () => {
      dragState = null;
      panel.classList.remove(CLASS.dragging);
    });
  }

  function restorePanelPosition(panel) {
    const position = getStoredPanelPosition();
    if (position) setPanelPosition(panel, position);
    requestAnimationFrame(() => repositionPanelInsideViewport(panel));
  }

  function repositionPanelInsideViewport(panel) {
    requestAnimationFrame(() => {
      if (panel.hidden) return;
      const rect = panel.getBoundingClientRect();
      const position = clampPanelPosition(rect.left, rect.top);
      setPanelPosition(panel, position);
      localStorage.setItem(getPanelPositionKey(), JSON.stringify(position));
    });
  }

  function persistPanelPosition(panel, collapsed = state.panelCollapsed) {
    const rect = panel.getBoundingClientRect();
    localStorage.setItem(getPanelPositionKey(collapsed), JSON.stringify(clampPanelPosition(rect.left, rect.top)));
  }

  function getStoredPanelPosition() {
    try {
      const position = JSON.parse(localStorage.getItem(getPanelPositionKey()) || 'null');
      if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return null;
      return clampPanelPosition(position.left, position.top);
    } catch {
      return null;
    }
  }

  function getPanelPositionKey(collapsed = state.panelCollapsed) {
    return collapsed ? STORAGE.panelPositionCollapsed : STORAGE.panelPositionExpanded;
  }

  function clampPanelPosition(left, top) {
    const panel = document.getElementById(PANEL_ID);
    const width = panel?.offsetWidth || 292;
    const height = panel?.offsetHeight || 118;
    const margin = 10;

    return {
      left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin)),
      top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin)),
    };
  }

  function setPanelPosition(panel, position) {
    panel.style.left = `${position.left}px`;
    panel.style.top = `${position.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function getStoredHideMode() {
    const mode = localStorage.getItem(STORAGE.mode);
    return Object.values(HIDE_MODE).includes(mode) ? mode : HIDE_MODE.bar;
  }

  function getUiLanguage() {
    const languages = [...(navigator.languages || []), navigator.language || navigator.userLanguage || ''];
    return languages.some((language) => String(language).toLowerCase().startsWith('zh')) ? 'zh' : 'en';
  }

  function t(key, values = {}) {
    const dictionary = UI_TEXT[UI_LANGUAGE] || UI_TEXT.en;
    const text = dictionary[key] || UI_TEXT.en[key] || key;
    return String(text).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  }

  function modeText(mode, key) {
    const dictionary = UI_TEXT[UI_LANGUAGE] || UI_TEXT.en;
    return dictionary.modes?.[mode]?.[key] || UI_TEXT.en.modes[mode][key];
  }

  function renderModeButton(mode) {
    return `<button type="button" data-mode="${mode}" title="${escapeHtml(modeText(mode, 'detail'))}">${escapeHtml(modeText(mode, 'label'))}</button>`;
  }

  function renderModeHelpItem(mode) {
    return `
      <div class="${APP}-mode-help-item">
        <span>${escapeHtml(modeText(mode, 'label'))}</span>
        <p>${escapeHtml(modeText(mode, 'detail'))}</p>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function normalizeDisplayText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function kebabCase(value) {
    return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root {
        --${APP}-ease: cubic-bezier(0.25, 1, 0.5, 1);
        --${APP}-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      article[data-testid="tweet"].${CLASS.article} {
        overflow: hidden !important;
        transition:
          opacity 260ms var(--${APP}-ease),
          transform 360ms var(--${APP}-ease),
          background-color 240ms var(--${APP}-ease),
          box-shadow 240ms var(--${APP}-ease);
        will-change: opacity, transform;
      }

      article[data-testid="tweet"].${CLASS.pending} {
        opacity: 0 !important;
      }

      html.${APP}-active-route article[data-testid="tweet"]:not([data-${kebabCase(DATA.checked)}="1"]) {
        opacity: 0 !important;
      }

      article[data-testid="tweet"].${CLASS.hidden} {
        pointer-events: none !important;
        border-bottom-color: transparent !important;
      }

      .${CLASS.placeholder} {
        display: block;
        overflow: hidden;
        min-height: 54px;
        padding: 10px 16px 12px;
        border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        background: transparent;
        color: rgb(83, 100, 113);
        font: 14px/1.35 var(--${APP}-font);
        letter-spacing: 0;
        box-sizing: border-box;
        transition:
          opacity 260ms var(--${APP}-ease),
          transform 360ms var(--${APP}-ease),
          background-color 240ms var(--${APP}-ease),
          box-shadow 240ms var(--${APP}-ease);
      }

      .${CLASS.placeholder}[hidden] {
        display: none !important;
      }

      .${CLASS.placeholder}.${CLASS.expanded} {
        min-height: 44px;
        padding-top: 8px;
        padding-bottom: 8px;
        border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      }

      .${APP}-placeholder-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        min-height: 34px;
      }

      .${APP}-placeholder-copy {
        display: grid;
        gap: 1px;
        min-width: 0;
      }

      .${APP}-eyebrow {
        color: color-mix(in srgb, currentColor 68%, transparent);
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.01em;
        text-transform: uppercase;
      }

      .${APP}-capsule {
        flex: 0 0 auto;
        border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
        border-radius: 999px;
        padding: 7px 13px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.04)),
          color-mix(in srgb, currentColor 7%, transparent);
        color: inherit;
        font: 650 13px/1 var(--${APP}-font);
        letter-spacing: 0;
        cursor: pointer;
        transition:
          transform 180ms var(--${APP}-ease),
          background-color 180ms var(--${APP}-ease),
          border-color 180ms var(--${APP}-ease),
          box-shadow 180ms var(--${APP}-ease);
      }

      .${APP}-capsule:hover {
        transform: scale(1.03);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.08)),
          color-mix(in srgb, currentColor 10%, transparent);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
      }

      .${CLASS.previewWrap} {
        display: grid;
        gap: 9px;
        margin-top: 10px;
      }

      .${CLASS.placeholder}.${CLASS.expanded} .${CLASS.previewWrap},
      .${CLASS.placeholder}.${CLASS.modeBar} .${CLASS.previewWrap} {
        display: none !important;
      }

      .${CLASS.author} {
        display: inline-grid;
        grid-template-columns: 34px minmax(0, 1fr);
        align-items: center;
        gap: 9px;
        width: fit-content;
        max-width: 100%;
        padding: 5px 9px 5px 5px;
        border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 15px;
        background: color-mix(in srgb, currentColor 5%, transparent);
        box-sizing: border-box;
      }

      .${CLASS.author}[hidden] {
        display: none !important;
      }

      .${CLASS.author} img {
        width: 34px;
        height: 34px;
        border-radius: 38%;
        object-fit: cover;
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.24) inset,
          0 0 0 1px color-mix(in srgb, currentColor 10%, transparent);
      }

      .${APP}-author-text {
        display: grid;
        gap: 1px;
        min-width: 0;
      }

      .${APP}-author-name,
      .${APP}-author-handle {
        overflow: hidden;
        min-width: 0;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .${APP}-author-name {
        color: color-mix(in srgb, currentColor 88%, transparent);
        font-size: 13px;
        font-weight: 700;
      }

      .${APP}-author-handle {
        color: color-mix(in srgb, currentColor 60%, transparent);
        font-size: 12px;
        font-weight: 500;
      }

      .${CLASS.thumbGrid} {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
        width: min(520px, 100%);
      }

      .${CLASS.thumbGrid}[hidden] {
        display: none !important;
      }

      .${CLASS.thumbGrid}[data-count="1"] {
        grid-template-columns: minmax(168px, 286px);
      }

      .${CLASS.thumbGrid}[data-count="2"] {
        grid-template-columns: repeat(2, minmax(0, 168px));
      }

      .${CLASS.thumbGrid}[data-count="3"] {
        grid-template-columns: repeat(3, minmax(0, 148px));
      }

      .${CLASS.thumb} {
        position: relative;
        display: block;
        overflow: hidden;
        aspect-ratio: 1 / 1;
        width: 100%;
        min-width: 0;
        padding: 0;
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 8px;
        background: color-mix(in srgb, currentColor 6%, transparent);
        cursor: pointer;
        transform: translateZ(0);
        transition:
          transform 200ms var(--${APP}-ease),
          filter 200ms var(--${APP}-ease),
          box-shadow 200ms var(--${APP}-ease);
      }

      .${CLASS.thumbGrid}[data-count="1"] .${CLASS.thumb} {
        aspect-ratio: 16 / 10;
      }

      .${CLASS.thumb}:hover {
        transform: scale(1.018);
        filter: saturate(1.04);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
      }

      .${CLASS.thumb} img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .${CLASS.thumb} span {
        position: absolute;
        right: 6px;
        bottom: 6px;
        padding: 3px 7px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.48);
        color: #fff;
        -webkit-backdrop-filter: blur(12px) saturate(180%);
        backdrop-filter: blur(12px) saturate(180%);
        font: 750 11px/1.2 var(--${APP}-font);
        letter-spacing: 0.01em;
      }

      #${PANEL_ID} {
        --${APP}-segment-index: 0;
        position: fixed;
        right: 18px;
        bottom: 136px;
        z-index: 2147483647;
        display: grid;
        gap: 10px;
        width: 292px;
        max-width: calc(100vw - 20px);
        padding: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.72), rgba(245, 245, 247, 0.50)),
          rgba(255, 255, 255, 0.58);
        color: rgb(29, 29, 31);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        backdrop-filter: blur(20px) saturate(180%);
        box-shadow:
          0 24px 70px rgba(0, 0, 0, 0.16),
          0 7px 24px rgba(0, 0, 0, 0.10),
          inset 0 1px 0 rgba(255, 255, 255, 0.28);
        font: 13px/1.35 var(--${APP}-font);
        letter-spacing: 0;
        user-select: none;
        touch-action: none;
        box-sizing: border-box;
        transition:
          width 360ms var(--${APP}-ease),
          border-radius 360ms var(--${APP}-ease),
          padding 360ms var(--${APP}-ease),
          opacity 220ms var(--${APP}-ease),
          transform 360ms var(--${APP}-ease);
      }

      #${PANEL_ID}[hidden] {
        display: none !important;
      }

      #${PANEL_ID}.${CLASS.dragging} {
        opacity: 0.92;
        transform: scale(0.992);
      }

      .${APP}-panel-top,
      .${APP}-collapsed-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .${APP}-panel-top,
      .${APP}-collapsed-row {
        cursor: move;
      }

      .${APP}-panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        color: color-mix(in srgb, currentColor 90%, transparent);
        font-size: 13px;
        font-weight: 700;
      }

      .${APP}-panel-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(180deg, rgb(52, 199, 89), rgb(48, 176, 199));
        box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.12);
      }

      .${APP}-panel-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .${APP}-panel-button,
      .${APP}-icon-button {
        border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
        border-radius: 999px;
        background: color-mix(in srgb, currentColor 7%, transparent);
        color: inherit;
        font: 650 12px/1 var(--${APP}-font);
        cursor: pointer;
        transition:
          transform 180ms var(--${APP}-ease),
          background-color 180ms var(--${APP}-ease),
          border-color 180ms var(--${APP}-ease);
      }

      .${APP}-panel-button {
        padding: 7px 10px;
      }

      .${APP}-icon-button {
        display: inline-grid;
        place-items: center;
        width: 28px;
        height: 28px;
        padding: 0;
      }

      .${APP}-panel-button:hover,
      .${APP}-icon-button:hover {
        transform: scale(1.035);
        background: color-mix(in srgb, currentColor 11%, transparent);
      }

      .${APP}-segmented {
        position: relative;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0;
        padding: 3px;
        border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
        border-radius: 16px;
        background: color-mix(in srgb, currentColor 7%, transparent);
        overflow: hidden;
      }

      .${APP}-segment-indicator {
        position: absolute;
        top: 3px;
        left: 3px;
        width: calc((100% - 6px) / 2);
        height: calc(100% - 6px);
        border-radius: 13px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.74)),
          rgba(255, 255, 255, 0.78);
        box-shadow:
          0 6px 18px rgba(0, 0, 0, 0.12),
          inset 0 1px 0 rgba(255, 255, 255, 0.7);
        transform: translateX(calc(var(--${APP}-segment-index) * 100%));
        transition:
          transform 460ms cubic-bezier(0.25, 1.45, 0.5, 1),
          background-color 220ms var(--${APP}-ease);
      }

      .${APP}-segmented button {
        position: relative;
        z-index: 1;
        min-width: 0;
        height: 30px;
        padding: 0 8px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        color: color-mix(in srgb, currentColor 66%, transparent);
        font: 650 12px/1 var(--${APP}-font);
        white-space: nowrap;
        cursor: pointer;
        transition: color 180ms var(--${APP}-ease), transform 180ms var(--${APP}-ease);
      }

      .${APP}-segmented button:hover {
        transform: scale(1.025);
      }

      .${APP}-segmented button.${CLASS.active} {
        color: rgb(29, 29, 31);
      }

      .${APP}-mode-help {
        display: grid;
        gap: 8px;
        padding: 9px 10px 10px;
        border: 1px solid color-mix(in srgb, currentColor 9%, transparent);
        border-radius: 16px;
        background: color-mix(in srgb, currentColor 5%, transparent);
        color: color-mix(in srgb, currentColor 78%, transparent);
      }

      .${APP}-mode-help[hidden] {
        display: none !important;
      }

      .${APP}-mode-help-title {
        color: color-mix(in srgb, currentColor 88%, transparent);
        font-size: 12px;
        font-weight: 750;
      }

      .${APP}-mode-help-item {
        display: grid;
        gap: 2px;
      }

      .${APP}-mode-help-item span {
        font-size: 12px;
        font-weight: 720;
      }

      .${APP}-mode-help-item p {
        margin: 0;
        color: color-mix(in srgb, currentColor 68%, transparent);
        font-size: 11px;
        font-weight: 500;
        line-height: 1.35;
      }

      .${APP}-icon-button.${CLASS.active} {
        background: color-mix(in srgb, currentColor 14%, transparent);
      }

      .${APP}-collapsed-row {
        display: none;
      }

      #${PANEL_ID}.${CLASS.collapsed} {
        width: auto;
        min-width: 122px;
        padding: 7px 8px;
        border-radius: 999px;
      }

      #${PANEL_ID}.${CLASS.collapsed} .${APP}-panel-top,
      #${PANEL_ID}.${CLASS.collapsed} .${APP}-panel-body {
        display: none;
      }

      #${PANEL_ID}.${CLASS.collapsed} .${APP}-collapsed-row {
        display: flex;
      }

      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} {
          border-color: rgba(255, 255, 255, 0.10);
          background:
            linear-gradient(145deg, rgba(38, 38, 40, 0.74), rgba(20, 20, 22, 0.58)),
            rgba(28, 28, 30, 0.68);
          color: rgb(245, 245, 247);
          box-shadow:
            0 26px 72px rgba(0, 0, 0, 0.46),
            0 8px 26px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .${APP}-segment-indicator {
          background:
            linear-gradient(180deg, rgba(84, 84, 88, 0.94), rgba(58, 58, 60, 0.86)),
            rgba(72, 72, 74, 0.88);
          box-shadow:
            0 8px 20px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.10);
        }

        .${APP}-segmented button.${CLASS.active} {
          color: rgb(245, 245, 247);
        }
      }

      @media (max-width: 520px) {
        #${PANEL_ID} {
          right: 10px;
          bottom: 124px;
          width: min(292px, calc(100vw - 20px));
        }

        .${CLASS.thumbGrid} {
          width: 100%;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
      }

      @media (prefers-reduced-motion: reduce) {
        article[data-testid="tweet"].${CLASS.article},
        .${CLASS.placeholder},
        #${PANEL_ID},
        .${APP}-segment-indicator,
        .${APP}-capsule,
        .${CLASS.thumb},
        .${APP}-panel-button,
        .${APP}-icon-button {
          transition-duration: 1ms !important;
        }
      }
    `;

    const append = () => {
      if (!document.getElementById(STYLE_ID)) {
        document.head.appendChild(style);
      }
    };

    if (document.head) {
      append();
    } else {
      document.addEventListener('DOMContentLoaded', append, { once: true });
    }
  }
})();

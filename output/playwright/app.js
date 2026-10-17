(() => {
  'use strict';

  const storageKey = 'mixer-pwa.tabs.v1';
  const defaultTab = { id: 'ui24-demo', name: 'Ui24 Demo', url: 'https://www.soundcraft.com/ui24-software-demo/mixer.html' };
  const tabs = document.getElementById('tabs');
  const panels = document.getElementById('panels');
  const dialog = document.getElementById('settings-dialog');
  const form = document.getElementById('settings-form');
  const entries = document.getElementById('tab-entries');
  const errorMessage = document.getElementById('form-error');
  const fullscreenButton = document.getElementById('fullscreen');
  const fullscreenMode = window.matchMedia('(display-mode: fullscreen)');
  const floatingControls = document.getElementById('floating-controls');
  const floatingToggle = document.getElementById('floating-toggle');
  const floatingPanel = document.getElementById('floating-panel');
  const positionKey = 'mixer-pwa.dock.v1';
  let dock = { side: 'right', ratio: 0.5 };
  let drag = null;
  let suppressClickUntil = 0;
  let noticeTimer;

  try {
    const saved = JSON.parse(localStorage.getItem(positionKey));
    if (saved && ['left', 'right'].includes(saved.side) && Number.isFinite(saved.ratio) && saved.ratio >= 0 && saved.ratio <= 1) dock = saved;
  } catch { /* Keep the default position when local storage is unavailable or invalid. */ }

  function bounds() {
    const style = getComputedStyle(document.documentElement);
    const inset = side => parseFloat(style.getPropertyValue(`--safe-${side}`)) || 0;
    const minX = 12 + inset('left');
    const minY = 12 + inset('top');
    return {
      minX,
      minY,
      maxX: Math.max(minX, innerWidth - inset('right') - 12 - 48),
      maxY: Math.max(minY, innerHeight - inset('bottom') - 12 - 48),
    };
  }

  function positionDock() {
    const area = bounds();
    floatingControls.dataset.edge = dock.side;
    floatingControls.style.right = 'auto';
    floatingControls.style.left = `${dock.side === 'left' ? area.minX : area.maxX}px`;
    floatingControls.style.top = `${area.minY + dock.ratio * (area.maxY - area.minY)}px`;
    if (!floatingPanel.hidden) {
      floatingPanel.style.maxHeight = `${area.maxY - area.minY + 48}px`;
      const anchor = floatingControls.getBoundingClientRect();
      const height = floatingPanel.getBoundingClientRect().height;
      const top = Math.max(area.minY, Math.min(anchor.top + 24 - height / 2, area.maxY + 48 - height));
      floatingPanel.style.top = `${top - anchor.top}px`;
    }
  }

  function setPanelExpanded(expanded, focusToggle = false) {
    floatingPanel.hidden = !expanded;
    floatingToggle.setAttribute('aria-expanded', String(expanded));
    floatingToggle.setAttribute('aria-label', expanded ? '收合分頁選單' : '開啟分頁選單');
    positionDock();
    if (focusToggle) floatingToggle.focus({ preventScroll: true });
  }

  function savePosition() {
    try { localStorage.setItem(positionKey, JSON.stringify(dock)); }
    catch { notify('浮動按鈕的位置暫時只保留於這次開啟。'); }
  }

  floatingToggle.addEventListener('click', event => {
    if (event.detail > 0 && performance.now() < suppressClickUntil) {
      suppressClickUntil = 0;
      return;
    }
    setPanelExpanded(floatingPanel.hidden);
  });
  floatingToggle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    const anchor = floatingControls.getBoundingClientRect();
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: anchor.left, top: anchor.top, moved: false };
    floatingToggle.setPointerCapture(event.pointerId);
  });
  floatingToggle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) <= 8) return;
    if (!drag.moved) setPanelExpanded(false);
    drag.moved = true;
    floatingControls.classList.add('dragging');
    const area = bounds();
    floatingControls.style.left = `${Math.max(area.minX, Math.min(area.maxX, drag.left + dx))}px`;
    floatingControls.style.top = `${Math.max(area.minY, Math.min(area.maxY, drag.top + dy))}px`;
  });
  floatingToggle.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    floatingControls.classList.remove('dragging');
    if (moved) {
      const anchor = floatingControls.getBoundingClientRect();
      const area = bounds();
      dock = {
        side: anchor.left + 24 < innerWidth / 2 ? 'left' : 'right',
        ratio: area.maxY === area.minY ? 0 : Math.max(0, Math.min(1, (anchor.top - area.minY) / (area.maxY - area.minY))),
      };
      suppressClickUntil = performance.now() + 300;
      positionDock();
      savePosition();
    }
    if (floatingToggle.hasPointerCapture(event.pointerId)) floatingToggle.releasePointerCapture(event.pointerId);
  });
  function cancelDrag() {
    if (!drag) return;
    const id = drag.id;
    drag = null;
    floatingControls.classList.remove('dragging');
    if (floatingToggle.hasPointerCapture(id)) floatingToggle.releasePointerCapture(id);
    positionDock();
  }
  floatingToggle.addEventListener('pointercancel', cancelDrag);
  floatingToggle.addEventListener('lostpointercapture', cancelDrag);
  floatingToggle.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') dock.side = 'left';
    else if (event.key === 'ArrowRight') dock.side = 'right';
    else {
      const area = bounds();
      const step = 24 / Math.max(1, area.maxY - area.minY);
      dock.ratio = Math.max(0, Math.min(1, dock.ratio + (event.key === 'ArrowDown' ? step : -step)));
    }
    positionDock();
    savePosition();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !floatingPanel.hidden && !dialog.open) {
      event.preventDefault();
      setPanelExpanded(false, true);
    }
  });
  window.addEventListener('resize', () => { cancelDrag(); positionDock(); });
  positionDock();

  function notify(message) {
    const notice = document.getElementById('notice');
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.hidden = false;
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 7000);
  }

  function normalizeUrl(value) {
    const text = value.trim();
    if (!text) throw new Error('請填寫控制頁面網址。');
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `http://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      throw new Error('請使用不含帳號密碼的 HTTP 或 HTTPS 網址。');
    }
    return url.href;
  }

  function readState() {
    const fallback = { tabs: [{ ...defaultTab }], activeId: defaultTab.id };
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return fallback;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed.tabs) || !parsed.tabs.length) throw new Error('Invalid tabs');
      const ids = new Set();
      const savedTabs = parsed.tabs.map(tab => {
        if (!tab || typeof tab.id !== 'string' || !/^[a-z\d-]{1,80}$/i.test(tab.id) || ids.has(tab.id) || typeof tab.name !== 'string' || !tab.name.trim() || tab.name.length > 40 || typeof tab.url !== 'string' || tab.url.length > 2048) throw new Error('Invalid tab');
        ids.add(tab.id);
        return { id: tab.id, name: tab.name.trim(), url: normalizeUrl(tab.url) };
      });
      return { tabs: savedTabs, activeId: ids.has(parsed.activeId) ? parsed.activeId : savedTabs[0].id };
    } catch {
      notify('無法讀取本機設定，已暫時載入預設 demo。');
      return fallback;
    }
  }

  let state = readState();

  function persist(nextState) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextState));
      return true;
    } catch {
      return false;
    }
  }

  function activate(id, save = true) {
    const selected = state.tabs.find(tab => tab.id === id);
    if (!selected) return;
    state.activeId = id;
    for (const button of tabs.children) {
      const active = button.dataset.tabId === id;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels.children) panel.hidden = panel.dataset.tabId !== id;
    const panel = document.getElementById(`panel-${id}`);
    if (!panel.firstElementChild) {
      const frame = document.createElement('iframe');
      frame.dataset.mixerFrame = '';
      frame.title = selected.name;
      const supportedPolicies = document.featurePolicy?.features?.() || [];
      frame.allow = ['fullscreen', ...['local-network-access', 'local-network', 'loopback-network'].filter(policy => supportedPolicies.includes(policy))].join('; ');
      frame.src = selected.url;
      panel.append(frame);
    }
    if (save && !persist(state)) notify('目前可切換畫面，但瀏覽器無法保存設定；關閉後可能遺失。');
  }

  function render() {
    const ids = new Set(state.tabs.map(tab => tab.id));
    for (const panel of [...panels.children]) {
      if (!ids.has(panel.dataset.tabId)) panel.remove();
    }
    tabs.replaceChildren();
    for (const tab of state.tabs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab';
      button.id = `tab-${tab.id}`;
      button.dataset.tabId = tab.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', `panel-${tab.id}`);
      button.textContent = tab.name;
      button.title = tab.name;
      button.addEventListener('click', () => { activate(tab.id); setPanelExpanded(false, true); });
      tabs.append(button);

      let panel = document.getElementById(`panel-${tab.id}`);
      if (!panel) {
        panel = document.createElement('section');
        panel.id = `panel-${tab.id}`;
        panel.className = 'tab-panel';
        panel.dataset.tabId = tab.id;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', button.id);
      }
      const frame = panel.firstElementChild;
      if (frame) {
        frame.title = tab.name;
        if (frame.getAttribute('src') !== tab.url) frame.src = tab.url;
      }
      if (!panel.isConnected) panels.append(panel);
    }
    activate(state.activeId, false);
  }

  tabs.addEventListener('keydown', event => {
    const buttons = [...tabs.children];
    const current = buttons.indexOf(document.activeElement);
    if (current < 0 || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
    activate(buttons[next].dataset.tabId);
    buttons[next].focus();
  });

  function renumberEntries() {
    [...entries.children].forEach((entry, index) => { entry.querySelector('legend').textContent = `分頁 ${index + 1}`; });
  }

  function addEntry(tab = {}) {
    const entry = document.getElementById('entry-template').content.firstElementChild.cloneNode(true);
    entry.dataset.tabId = tab.id || `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    entry.querySelector('[name="tab-name"]').value = tab.name || '';
    entry.querySelector('[name="tab-url"]').value = tab.url || '';
    entry.querySelector('.remove-tab').addEventListener('click', () => {
      const next = entry.nextElementSibling || entry.previousElementSibling;
      entry.remove();
      renumberEntries();
      (next?.querySelector('input') || document.getElementById('add-tab')).focus();
    });
    entries.append(entry);
    renumberEntries();
    return entry;
  }

  document.getElementById('settings').addEventListener('click', () => {
    setPanelExpanded(false);
    entries.replaceChildren();
    errorMessage.hidden = true;
    for (const tab of state.tabs) addEntry(tab);
    dialog.showModal();
    entries.querySelector('input')?.focus({ preventScroll: true });
    dialog.querySelector('.dialog-content').scrollTop = 0;
  });
  document.getElementById('add-tab').addEventListener('click', () => addEntry().querySelector('input').focus());
  document.getElementById('cancel-settings').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => floatingToggle.focus({ preventScroll: true }));
  form.addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    errorMessage.hidden = true;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    errorMessage.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
    const nextTabs = [];
    if (!entries.children.length) {
      errorMessage.textContent = '請至少新增一個分頁。';
      errorMessage.hidden = false;
      document.getElementById('add-tab').focus();
      return;
    }
    for (const [index, entry] of [...entries.children].entries()) {
      const nameInput = entry.querySelector('[name="tab-name"]');
      const urlInput = entry.querySelector('[name="tab-url"]');
      const name = nameInput.value.trim();
      let invalidInput = nameInput;
      try {
        if (!name) throw new Error('請填寫分頁名稱。');
        invalidInput = urlInput;
        const url = normalizeUrl(urlInput.value);
        nextTabs.push({ id: entry.dataset.tabId, name, url });
      } catch (error) {
        invalidInput.setAttribute('aria-invalid', 'true');
        invalidInput.focus();
        errorMessage.textContent = `分頁 ${index + 1}：${error instanceof TypeError ? '請填寫有效的 HTTP 或 HTTPS 網址。' : error.message}`;
        errorMessage.hidden = false;
        return;
      }
    }
    const nextState = { tabs: nextTabs, activeId: nextTabs.some(tab => tab.id === state.activeId) ? state.activeId : nextTabs[0].id };
    if (!persist(nextState)) {
      errorMessage.textContent = '無法儲存設定。請確認瀏覽器允許本機儲存，再試一次。';
      errorMessage.hidden = false;
      return;
    }
    state = nextState;
    render();
    dialog.close();
    floatingToggle.focus({ preventScroll: true });
    notify('分頁設定已儲存在此裝置。');
  });

  function updateFullscreenButton() {
    const active = Boolean(document.fullscreenElement);
    const label = active ? '離開全螢幕' : '進入全螢幕';
    fullscreenButton.setAttribute('aria-label', label);
    fullscreenButton.title = label;
    fullscreenButton.hidden = !document.fullscreenEnabled || (fullscreenMode.matches && !active);
    positionDock();
  }
  fullscreenButton.addEventListener('click', async () => {
    setPanelExpanded(false, true);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify('瀏覽器未允許全螢幕，請再點一次全螢幕按鈕。');
    }
  });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  fullscreenMode.addEventListener('change', updateFullscreenButton);
  updateFullscreenButton();
  render();

  if (location.protocol === 'file:' || !window.isSecureContext) {
    document.getElementById('install-help').textContent = '如需安裝至主畫面並預設全螢幕，請使用 HTTPS 網址開啟；本機開發可使用 localhost。';
  }
  if ('serviceWorker' in navigator && window.isSecureContext && ['http:', 'https:'].includes(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      notify('外層離線快取未啟用；目前仍可使用分頁控制。');
    });
  }
})();

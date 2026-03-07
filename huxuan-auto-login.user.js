// ==UserScript==
// @name         互选官网自动登录
// @namespace    https://huxuan.qq.com/
// @version      1.0.3
// @description  自动完成互选官网的 QQ 密码登录流程，支持配置账号、密码和目标账户 ID
// @author       Huxuan AutoLogin
// @homepageURL  https://github.com/xiaowulang-turbo/Huxuan-AutoLogin
// @supportURL   https://github.com/xiaowulang-turbo/Huxuan-AutoLogin/issues
// @updateURL    https://update.greasyfork.org/scripts/568729.user.js
// @downloadURL  https://update.greasyfork.org/scripts/568729.user.js
// @match        https://huxuan.qq.com/*
// @match        https://test-huxuan.qq.com/*
// @match        https://pre-huxuan.qq.com/*
// @match        https://sso.e.qq.com/*
// @match        https://*.ptlogin2.qq.com/*
// @match        https://graph.qq.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const PREFIX = '[互选自动登录]';
  const CONFIG_KEYS = {
    QQ: 'autoLogin_qq',
    PASSWORD: 'autoLogin_password',
    ACCOUNT_ID: 'autoLogin_accountId',
    CHECK_INTERVAL: 'autoLogin_checkInterval',
    ENABLED: 'autoLogin_enabled',
  };

  // ==================== 工具函数 ====================

  function log(...args) {
    console.log(PREFIX, ...args);
  }

  function isHuxuanDomain(host = hostname) {
    return /^(test-|pre-)?huxuan\.qq\.com$/.test(host);
  }

  function encode(str) {
    return btoa(
      Array.from(new TextEncoder().encode(str), (b) =>
        String.fromCharCode(b)
      ).join('')
    );
  }

  function decode(str) {
    try {
      return new TextDecoder().decode(
        Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
      );
    } catch {
      return str;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`等待元素 "${selector}" 超时 (${timeout}ms)`));
      }, timeout);

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  // ==================== 配置管理 ====================

  function getConfig() {
    return {
      qq: decode(GM_getValue(CONFIG_KEYS.QQ, '')),
      password: decode(GM_getValue(CONFIG_KEYS.PASSWORD, '')),
      accountId: GM_getValue(CONFIG_KEYS.ACCOUNT_ID, ''),
      checkInterval: GM_getValue(CONFIG_KEYS.CHECK_INTERVAL, 30),
      enabled: GM_getValue(CONFIG_KEYS.ENABLED, true),
    };
  }

  function saveConfig(config) {
    GM_setValue(CONFIG_KEYS.QQ, encode(config.qq));
    GM_setValue(CONFIG_KEYS.PASSWORD, encode(config.password));
    GM_setValue(CONFIG_KEYS.ACCOUNT_ID, config.accountId);
    GM_setValue(CONFIG_KEYS.CHECK_INTERVAL, config.checkInterval);
    GM_setValue(CONFIG_KEYS.ENABLED, config.enabled);
  }

  function isConfigValid() {
    const config = getConfig();
    return config.qq && config.password && config.accountId;
  }

  function showConfigDialog() {
    const existing = document.getElementById('huxuan-auto-login-dialog');
    if (existing) {
      existing.remove();
    }

    const config = getConfig();

    GM_addStyle(`
      #huxuan-auto-login-dialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #huxuan-auto-login-dialog .dialog-content {
        background: #fff;
        border-radius: 12px;
        padding: 28px 32px;
        width: 400px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      }
      #huxuan-auto-login-dialog h3 {
        margin: 0 0 20px;
        font-size: 18px;
        color: #1a1a1a;
        text-align: center;
      }
      #huxuan-auto-login-dialog .form-group {
        margin-bottom: 14px;
      }
      #huxuan-auto-login-dialog label {
        display: block;
        margin-bottom: 4px;
        font-size: 13px;
        color: #555;
        font-weight: 500;
      }
      #huxuan-auto-login-dialog input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d9d9d9;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s;
      }
      #huxuan-auto-login-dialog input:focus {
        border-color: #1677ff;
      }
      #huxuan-auto-login-dialog .checkbox-group {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 14px;
      }
      #huxuan-auto-login-dialog .checkbox-group input {
        width: auto;
      }
      #huxuan-auto-login-dialog .checkbox-group label {
        margin: 0;
        cursor: pointer;
      }
      #huxuan-auto-login-dialog .btn-group {
        display: flex;
        gap: 10px;
        margin-top: 20px;
      }
      #huxuan-auto-login-dialog button {
        flex: 1;
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      #huxuan-auto-login-dialog button:hover {
        opacity: 0.85;
      }
      #huxuan-auto-login-dialog .btn-primary {
        background: #1677ff;
        color: #fff;
      }
      #huxuan-auto-login-dialog .btn-cancel {
        background: #f0f0f0;
        color: #333;
      }
      #huxuan-auto-login-dialog .hint {
        font-size: 12px;
        color: #999;
        margin-top: 2px;
      }
      #huxuan-auto-login-dialog .required::after {
        content: ' *';
        color: #ff4d4f;
      }
      #huxuan-auto-login-dialog input.error {
        border-color: #ff4d4f;
      }
      #huxuan-auto-login-dialog .error-hint {
        font-size: 12px;
        color: #ff4d4f;
        margin-top: 2px;
        display: none;
      }
      #huxuan-auto-login-dialog input.error + .error-hint {
        display: block;
      }
      #huxuan-auto-login-dialog .password-wrapper {
        position: relative;
      }
      #huxuan-auto-login-dialog .password-wrapper input {
        padding-right: 36px;
      }
      #huxuan-auto-login-dialog .toggle-password {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        color: #999;
        line-height: 0;
        user-select: none;
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.2s, visibility 0.2s;
      }
      #huxuan-auto-login-dialog .password-wrapper:hover .toggle-password {
        visibility: visible;
        opacity: 0.5;
      }
      #huxuan-auto-login-dialog .password-wrapper:hover .toggle-password:hover {
        visibility: visible;
        opacity: 1;
        color: #666;
      }
      #huxuan-auto-login-dialog .toggle-password.active {
        visibility: visible;
        opacity: 1;
        color: #1677ff;
      }
      @media (prefers-color-scheme: dark) {
        #huxuan-auto-login-dialog .toggle-password {
          opacity: 0.6;
        }
      }
    `);

    const dialog = document.createElement('div');
    dialog.id = 'huxuan-auto-login-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>互选官网自动登录 - 设置</h3>
        <form autocomplete="on">
          <div class="form-group">
            <label class="required">QQ 号</label>
            <input type="text" id="hal-qq" name="username" autocomplete="username" placeholder="请输入 QQ 号">
            <div class="error-hint">请输入 QQ 号</div>
          </div>
          <div class="form-group">
            <label class="required">QQ 密码</label>
            <div class="password-wrapper">
              <input type="password" id="hal-password" name="password" autocomplete="current-password" placeholder="请输入密码">
              <span class="toggle-password" title="显示/隐藏密码"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>
            </div>
            <div class="error-hint">请输入密码</div>
          </div>
        </form>
        <div class="form-group">
          <label class="required">目标账户 ID</label>
          <input type="text" id="hal-account-id" autocomplete="off" placeholder="例如: 95918">
          <div class="error-hint">请输入目标账户 ID</div>
          <div class="hint">账户选择页显示的 ID 数字</div>
        </div>
        <div class="form-group">
          <label>自动检测间隔（分钟）</label>
          <input type="number" id="hal-interval" autocomplete="off" min="1" max="1440" placeholder="默认 30 分钟">
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="hal-enabled">
          <label for="hal-enabled">启用自动登录</label>
        </div>
        <div class="btn-group">
          <button class="btn-cancel" id="hal-cancel">取消</button>
          <button class="btn-primary" id="hal-save">保存</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('hal-qq').value = config.qq;
    document.getElementById('hal-password').value = config.password;
    document.getElementById('hal-account-id').value = config.accountId;
    document.getElementById('hal-interval').value = config.checkInterval;
    document.getElementById('hal-enabled').checked = config.enabled;

    ['hal-qq', 'hal-password', 'hal-account-id'].forEach((id) => {
      document.getElementById(id).addEventListener('input', (e) => {
        e.target.classList.remove('error');
      });
    });

    document.querySelector('.toggle-password').addEventListener('click', function () {
      const input = document.getElementById('hal-password');
      const isVisible = input.type === 'text';
      input.type = isVisible ? 'password' : 'text';
      this.classList.toggle('active', !isVisible);
      this.innerHTML = isVisible
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
      }
    });

    document.getElementById('hal-cancel').addEventListener('click', () => {
      dialog.remove();
    });

    document.getElementById('hal-save').addEventListener('click', () => {
      const fields = [
        { id: 'hal-qq', key: 'qq', getter: (el) => el.value.trim() },
        { id: 'hal-password', key: 'password', getter: (el) => el.value },
        { id: 'hal-account-id', key: 'accountId', getter: (el) => el.value.trim() },
      ];

      let hasError = false;
      const newConfig = {
        checkInterval: parseInt(document.getElementById('hal-interval').value, 10) || 30,
        enabled: document.getElementById('hal-enabled').checked,
      };

      fields.forEach(({ id, key, getter }) => {
        const el = document.getElementById(id);
        const val = getter(el);
        newConfig[key] = val;
        el.classList.toggle('error', !val);
        if (!val) hasError = true;
      });

      if (hasError) return;

      saveConfig(newConfig);
      log('配置已保存，刷新页面...');
      window.location.reload();
    });
  }

  GM_registerMenuCommand('设置自动登录', showConfigDialog);

  // ==================== 阶段逻辑 ====================

  const { hostname, pathname, href } = window.location;

  // 阶段 1：互选官网首页 - 点击广告主登录
  async function handleHuxuanHome() {
    if (!pathname.startsWith('/trade/free')) return;
    log('检测到互选首页，准备点击广告主登录...');

    try {
      const loginBtn = await waitForElement(
        'button[data-behavior-click="home_navbar_advertisers_login"]'
      );
      await sleep(500);
      loginBtn.click();
      log('已点击广告主登录');
    } catch (e) {
      log('未找到广告主登录按钮:', e.message);
    }
  }

  // 阶段 2：SSO 登录页 - 点击 QQ 登录 Tab
  async function handleSSOLogin() {
    if (!pathname.startsWith('/login/hub')) return;
    log('检测到 SSO 登录页，准备点击 QQ 登录 Tab...');

    try {
      const qqTab = await waitForElement('#qqLogin');
      await sleep(300);
      qqTab.click();
      log('已点击 QQ 登录 Tab');
    } catch (e) {
      log('未找到 QQ 登录 Tab:', e.message);
    }
  }

  // 阶段 3：QQ 登录 iframe - 密码登录
  async function handleQQLogin() {
    const config = getConfig();
    log('检测到 QQ 登录页，准备填充密码登录...');

    try {
      await sleep(500);

      // 检查是否需要切换到密码登录（可能已经在密码登录模式）
      const switcherPlogin = document.getElementById('switcher_plogin');
      if (switcherPlogin && window.getComputedStyle(switcherPlogin).display !== 'none') {
        switcherPlogin.click();
        log('已切换到密码登录');
        await sleep(500);
      } else {
        log('已在密码登录模式');
      }

      // 填充账号
      const qqInput = await waitForElement('#u');
      qqInput.value = '';
      qqInput.focus();
      qqInput.value = config.qq;
      qqInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('已填充 QQ 号');

      await sleep(300);

      // 填充密码
      const pwdInput = await waitForElement('#p');
      pwdInput.value = '';
      pwdInput.focus();
      pwdInput.value = config.password;
      pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
      log('已填充密码');

      await sleep(300);

      // 点击登录
      const loginBtn = await waitForElement('#login_button');
      loginBtn.click();
      log('已点击登录按钮');
    } catch (e) {
      log('QQ 登录失败:', e.message);
    }
  }

  // 阶段 4：账户选择页 - 搜索并登录
  async function handleAccountSelect() {
    if (!pathname.startsWith('/login/sportal')) return;
    const config = getConfig();
    log('检测到账户选择页，准备搜索账户 ID:', config.accountId);

    try {
      const searchInput = await waitForElement('#searchInput');
      await sleep(500);

      // 输入搜索内容并触发 keyup 事件
      searchInput.value = config.accountId;
      searchInput.dispatchEvent(
        new KeyboardEvent('keyup', { bubbles: true })
      );
      log('已输入搜索关键字');

      await sleep(800);

      // 找到匹配的账户行并点击登录
      const rows = document.querySelectorAll('.ac-tablerow');
      let targetRow = null;

      for (const row of rows) {
        const idEl = row.querySelector('.at-id');
        if (idEl && idEl.textContent.includes(config.accountId)) {
          const style = window.getComputedStyle(row);
          if (style.display !== 'none') {
            targetRow = row;
            break;
          }
        }
      }

      if (targetRow) {
        const loginLink = targetRow.querySelector('.at-login a[data-portal-id]');
        if (loginLink) {
          loginLink.click();
          log('已点击目标账户登录链接');
        } else {
          log('找到目标账户行但未找到登录链接');
        }
      } else {
        log('未找到匹配的账户，ID:', config.accountId);
      }
    } catch (e) {
      log('账户选择失败:', e.message);
    }
  }

  // 阶段 5：已登录检测
  function isLoggedIn() {
    return (
      isHuxuanDomain() &&
      (pathname.startsWith('/trade/selection') ||
        href.includes('account_id='))
    );
  }

  // ==================== 定时检测 ====================

  function setupAutoCheck() {
    const config = getConfig();
    if (!config.enabled) {
      log('自动登录已禁用');
      return;
    }

    const intervalMs = config.checkInterval * 60 * 1000;

    log(`定时检测已启动，间隔 ${config.checkInterval} 分钟`);

    setInterval(() => {
      if (isLoggedIn()) {
        log('当前已登录，无需操作');
        return;
      }

      if (isHuxuanDomain()) {
        log('检测到未登录，刷新页面触发自动登录...');
        window.location.href = `https://${hostname}/trade/free/index`;
      }
    }, intervalMs);
  }

  // ==================== 主入口 ====================

  async function main() {
    const config = getConfig();

    if (!isConfigValid()) {
      log('配置未完成，请通过油猴菜单设置账号信息');
      if (isHuxuanDomain()) {
        showConfigDialog();
      }
      return;
    }

    if (!config.enabled) {
      log('自动登录已禁用');
      return;
    }

    log('脚本启动，当前页面:', href);

    // 已登录则启动定时检测
    if (isLoggedIn()) {
      log('当前已登录');
      setupAutoCheck();
      return;
    }

    // 根据域名和路径执行对应阶段逻辑
    if (isHuxuanDomain()) {
      await handleHuxuanHome();
      setupAutoCheck();
    } else if (hostname === 'sso.e.qq.com') {
      if (pathname.startsWith('/login/hub')) {
        await handleSSOLogin();
      } else if (pathname.startsWith('/login/sportal')) {
        await handleAccountSelect();
      }
    } else if (hostname.includes('ptlogin2.qq.com')) {
      await handleQQLogin();
    }
  }

  main();
})();

// 动态版本管理 - 从版本文件获取版本号
let BUILD_VERSION = 'unknown';
let STATIC_CACHE = 'static-cache-v1';
let DYNAMIC_CACHE = 'dynamic-cache-v1';
let versionInitialized = false;
let hasNotifiedUpdate = false; // 标记是否已通知过更新

// 初始化时从版本文件获取版本信息
async function initializeVersion(clientVersion = null) {
  if (versionInitialized && BUILD_VERSION !== 'unknown') {
    console.log('[SW] 版本已初始化，跳过:', BUILD_VERSION);
    return;
  }

  try {
    const response = await fetch('/version.json?t=' + Date.now());
    if (response.ok) {
      const versionData = await response.json();
      const newVersion = versionData.version || versionData.buildVersion || 'v1.0.1';

      BUILD_VERSION = newVersion;
      STATIC_CACHE = `static-cache-${BUILD_VERSION}`;
      DYNAMIC_CACHE = `dynamic-cache-${BUILD_VERSION}`;
      versionInitialized = true;
      console.log(`[SW] 初始化版本: ${BUILD_VERSION}`);

      // 只有当客户端版本与服务器版本不一致时才通知
      if (clientVersion && clientVersion !== newVersion) {
        console.log(`[SW] 检测到版本不一致: 客户端=${clientVersion}, 服务器=${newVersion}`);
        notifyClientsAboutUpdate(newVersion);
      }
    }
  } catch (error) {
    console.warn('[SW] 无法获取版本信息，使用默认版本:', error.message);
  }
}

// 版本检查间隔（30秒，更频繁的检查）
const VERSION_CHECK_INTERVAL = 30 * 1000;

// 需要缓存的资源列表（Vite 构建后使用文件哈希）
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json', // 版本文件也需要缓存
  // 图标文件（使用正确的路径）
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-144.png',
  '/icons/icon-96.png',
  '/icons/icon-72.png',
  '/icons/icon-180.png',
  '/favicon.svg',
  '/favicon.ico',
  // 数据文件
  '/data/grade71_words.json',
  '/data/grade72_words.json',
  '/data/grade81_words.json',
  '/data/grade82_words.json',
  '/data/grade91_words.json',
  '/data/grade92_words.json'
  // 注意：JS 和 CSS 文件现在使用文件哈希，路径会自动变化
  // 例如：/assets/index-[hash].js, /assets/index-[hash].css
  // 这些文件会通过动态缓存模式自动缓存
];

const DYNAMIC_CACHE_PATTERNS = [
  /\.css$/,
  /\.js$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.svg$/,
  /\.ico$/,
  /\.woff$/,
  /\.woff2$/
];

// 预缓存安装函数
async function precacheStaticAssets() {
  const cache = await caches.open(STATIC_CACHE);
  const requests = STATIC_ASSETS.map(async (url) => {
    try {
      // 尝试从网络获取并缓存
      const response = await fetch(url);
      if (okToCache(response)) {
        await cache.put(url, response);
        console.log(`[SW] Precached: ${url}`);
      } else {
        console.warn(`[SW] Skip precaching (bad response): ${url}`);
      }
    } catch (error) {
      console.warn(`[SW] Failed to precache ${url}:`, error);
      // 对于关键文件，尝试创建基本响应
      if (url === '/' || url === '/index.html') {
        const basicHTML = `<!DOCTYPE html><html><head><title>法语背单词</title></head><body><div id="root">Loading...</div></body></html>`;
        await cache.put(url, new Response(basicHTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }));
      }
    }
  });
  await Promise.all(requests);
}

self.addEventListener('install', event => {
  event.waitUntil(
    initializeVersion()
      .then(() => precacheStaticAssets())
      .then(() => {
        console.log(`[SW] Install complete for version ${BUILD_VERSION}, skipping waiting`);
        return self.skipWaiting();
      })
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 删除旧版本的缓存
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      // 立即检查版本更新
      checkForUpdates();
      // 定期检查更新
      setInterval(checkForUpdates, VERSION_CHECK_INTERVAL);
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(handleFetchRequest(request));
});

async function handleFetchRequest(request) {
  const url = new URL(request.url);

  // 导航请求 -> 优先返回 index.html（离线 SPA 支持）
  if (request.mode === 'navigate') {
    try {
      const networkResp = await fetch(request);
      // 始终缓存 index.html 的最新版本
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResp.clone()).catch(() => {});
      return networkResp;
    } catch (err) {
      console.log('[SW] Navigation request offline, using cache');
      // 尝试多个缓存路径
      const cached = await caches.match(request) || 
                    await caches.match('/index.html') || 
                    await caches.match('/');
      if (cached) {
        return cached;
      }
      // 如果完全没有缓存，返回基本的离线页面
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>离线模式</title></head>
        <body>
          <h1>应用处于离线状态</h1>
          <p>请检查网络连接后重试</p>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
  }

  // 静态资源 -> cache-first
  if (isStaticAsset(url)) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const networkResp = await fetch(request);
      if (okToCache(networkResp)) {
        cacheResponse(request, networkResp.clone(), STATIC_CACHE).catch(() => {});
      }
      return networkResp;
    } catch {
      console.log('[SW] Static asset offline, trying fallback');
      // 对于静态资源，尝试返回 index.html 作为回退
      const fallback = await caches.match('/index.html');
      if (fallback && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'))) {
        // 对于 JS/CSS 文件，返回空内容而不是 HTML
        return new Response('', {
          status: 200,
          headers: { 'Content-Type': url.pathname.endsWith('.js') ? 'application/javascript' : 'text/css' }
        });
      }
      return fallback || offlineJsonResponse();
    }
  }

  // 动态资源（脚本、图片等） -> network-first then cache fallback
  if (DYNAMIC_CACHE_PATTERNS.some(rx => rx.test(url.pathname))) {
    try {
      const networkResp = await fetch(request);
      if (okToCache(networkResp)) {
        cacheResponse(request, networkResp.clone(), DYNAMIC_CACHE).catch(() => {});
      }
      return networkResp;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      return offlineJsonResponse();
    }
  }

  // 默认网络优先，失败后缓存
  try {
    const networkResp = await fetch(request);
    if (okToCache(networkResp)) {
      cacheResponse(request, networkResp.clone(), DYNAMIC_CACHE).catch(() => {});
    }
    return networkResp;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineJsonResponse();
  }
}

function isStaticAsset(url) {
  const pathname = url.pathname;
  return STATIC_ASSETS.includes(pathname) || 
         pathname.startsWith('/data/') || 
         pathname.startsWith('/static/') ||
         pathname.startsWith('/icon/') ||
         pathname.endsWith('.json') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.woff2');
}

function okToCache(response) {
  return response && (response.status === 200 || response.type === 'opaque');
}

async function cacheResponse(request, response, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (err) {
    console.warn('[SW] cache put failed', err);
  }
}

function offlineJsonResponse() {
  return new Response(JSON.stringify({
    error: 'offline',
    message: '应用当前处于离线状态，请检查网络连接'
  }), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' }
  });
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) event.ports[0].postMessage({ version: VERSION });
  }
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});

// 可选：后台同步与推送通知保持不变（如需保留可以合并原有逻辑）
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// 后台同步函数
async function doBackgroundSync() {
  try {
    // 这里可以添加后台同步逻辑
    // 比如同步学习进度到云端
    console.log('[Service Worker] Performing background sync');
  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error);
  }
}

// 推送通知（可选功能）
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received:', event);
  
  const options = {
    body: event.data ? event.data.text() : '您有新的学习任务！',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      {
        action: 'explore',
        title: '开始学习',
        icon: '/icon-96x96.png'
      },
      {
        action: 'close',
        title: '关闭',
        icon: '/icon-72x72.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('法语背单词', options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    // 打开应用
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // 关闭通知
    // 无需额外处理
  } else {
    // 默认行为：打开应用
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// 版本检查和更新逻辑
async function checkForUpdates() {
  try {
    // 获取版本信息文件（添加时间戳防止缓存）
    const versionResponse = await fetch('/version.json?t=' + Date.now(), {
      cache: 'no-cache' // 禁用缓存
    });

    if (!versionResponse.ok) {
      console.log('[SW] 无法获取版本文件，跳过检查');
      return;
    }

    const versionData = await versionResponse.json();
    const latestVersion = versionData.version || versionData.buildVersion;

    if (!latestVersion) {
      console.log('[SW] 无法获取版本号，跳过检查');
      return;
    }

    // 如果版本已初始化且检测到新版本
    if (versionInitialized && latestVersion !== BUILD_VERSION && !hasNotifiedUpdate) {
      console.log(`[SW] 检测到新版本: ${latestVersion} (当前版本: ${BUILD_VERSION})`);

      // 更新本地版本信息
      BUILD_VERSION = latestVersion;
      STATIC_CACHE = `static-cache-${BUILD_VERSION}`;
      DYNAMIC_CACHE = `dynamic-cache-${BUILD_VERSION}`;

      // 标记已通知过
      hasNotifiedUpdate = true;

      // 通知所有客户端有新版本可用
      notifyClientsAboutUpdate(latestVersion);

      // 立即清理旧缓存
      cleanupOldCaches();
    } else if (!versionInitialized) {
      // 首次检查，只更新版本，不通知
      BUILD_VERSION = latestVersion;
      STATIC_CACHE = `static-cache-${BUILD_VERSION}`;
      DYNAMIC_CACHE = `dynamic-cache-${BUILD_VERSION}`;
      versionInitialized = true;
      console.log('[SW] 首次版本检查完成，当前版本:', BUILD_VERSION);
    } else {
      console.log('[SW] 版本检查完成，当前是最新版本:', BUILD_VERSION);
    }
  } catch (error) {
    console.log('[SW] 版本检查失败:', error);
  }
}

// 清理旧缓存
async function cleanupOldCaches() {
  try {
    const cacheNames = await caches.keys();
    const allPromises = cacheNames.map(cacheName => {
      // 只保留当前版本的缓存
      if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
        console.log(`[SW] 清理旧缓存: ${cacheName}`);
        return caches.delete(cacheName);
      }
      return Promise.resolve();
    });
    await Promise.all(allPromises);
    console.log('[SW] 旧缓存清理完成');
  } catch (error) {
    console.error('[SW] 清理缓存失败:', error);
  }
}

// 通知所有客户端有新版本可用
function notifyClientsAboutUpdate(newVersion) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      console.log('[SW] 通知客户端有新版本:', client.url, '版本:', newVersion);
      // 发送新版本可用消息
      client.postMessage({
        type: 'NEW_VERSION_AVAILABLE',
        version: newVersion,
        message: '检测到新版本，请刷新页面获取更新'
      });
    });
  });
}

// 自动刷新所有客户端
function refreshAllClients() {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      console.log('[SW] 自动刷新客户端:', client.url);
      // 发送刷新消息，让客户端自动重新加载
      client.postMessage({
        type: 'FORCE_REFRESH',
        message: '检测到新版本，正在自动刷新...'
      });
    });
  });
}

// 监听来自客户端的消息
self.addEventListener('message', event => {
  const data = event.data || {};

  switch (data.type) {
    case 'INIT_VERSION':
      // 客户端初始化时发送的版本号
      console.log('[SW] 收到客户端版本初始化:', data.version);
      initializeVersion(data.version);
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          version: BUILD_VERSION,
          updateAvailable: false // 这里可以添加更新检测逻辑
        });
      }
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      );
      break;

    case 'CHECK_FOR_UPDATES':
      console.log('[SW] 收到检查更新请求');
      checkForUpdates();
      break;

    case 'FORCE_UPDATE':
    case 'FORCE_REFRESH':
      // 强制更新：清除缓存并重新加载
      console.log('[SW] 收到强制更新请求');
      event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .then(() => self.skipWaiting())
      );
      break;

    case 'NEW_VERSION_AVAILABLE':
      // 处理来自客户端的版本更新通知
      console.log('[SW] Received version update notification from client:', data.version);
      // 可以在这里触发缓存清理和更新
      break;
  }
});

console.log('[Service Worker] Script loaded successfully');
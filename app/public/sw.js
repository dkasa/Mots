const VERSION = 'v1.0.1';
const STATIC_CACHE = `static-cache-${VERSION}`;
const DYNAMIC_CACHE = `dynamic-cache-${VERSION}`;

// 需要缓存的资源列表（根据构建产物调整路径）
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon/icon-192.png',
  '/icon/icon-512.png',
  '/icon/icon-144.png',
  '/icon/icon-96.png',
  '/icon/icon-72.png',
  '/data/grade71_words.json',
  '/data/grade72_words.json',
  '/data/grade81_words.json',
  '/data/grade82_words.json',
  '/data/grade91_words.json',
  '/data/grade92_words.json'
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

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => {
          if (k !== STATIC_CACHE && k !== DYNAMIC_CACHE) {
            return caches.delete(k);
          }
        })
      )
    ).then(() => self.clients.claim())
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
      // 可选：缓存 index.html 的最新版本
      const cache = await caches.open(STATIC_CACHE);
      cache.put('/index.html', networkResp.clone()).catch(() => {});
      return networkResp;
    } catch (err) {
      const cached = await caches.match('/index.html') || await caches.match('/');
      if (cached) return cached;
      return offlineJsonResponse();
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
      // 若无法从网络获取，则尝试返回任意缓存或失败响应
      const fallback = await caches.match('/index.html');
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
  return STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/data/') || url.pathname.startsWith('/static/');
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

console.log('[Service Worker] Script loaded successfully');

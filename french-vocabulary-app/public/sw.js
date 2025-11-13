const CACHE_NAME = 'french-vocabulary-app-v1.0.0';
const STATIC_CACHE = 'static-cache-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-cache-v1.0.0';

// 需要缓存的资源列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-144x144.png',
  '/icon-96x96.png',
  '/icon-72x72.png',
  '/data/grade7_words.json',
  '/data/grade8_words.json',
  '/data/grade9_words.json'
];

// 动态缓存的资源类型
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

// 安装事件 - 缓存静态资源
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Failed to cache static assets:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

// 获取事件 - 缓存策略
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理GET请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 跳过非HTTP/HTTPS请求
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    handleFetchRequest(request)
  );
});

// 处理fetch请求的策略
async function handleFetchRequest(request) {
  const url = new URL(request.url);
  
  try {
    // 1. 首先尝试从缓存获取
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving from cache:', url.pathname);
      return cachedResponse;
    }
    
    // 2. 如果缓存中没有，从网络获取
    console.log('[Service Worker] Fetching from network:', url.pathname);
    const networkResponse = await fetch(request);
    
    // 3. 如果网络请求成功，缓存响应
    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      await cacheResponse(request, responseClone);
      console.log('[Service Worker] Network response cached:', url.pathname);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // 4. 网络请求失败，返回离线页面或缓存的页面
    if (request.destination === 'document') {
      // 返回主页作为离线页面
      const offlinePage = await caches.match('/');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    // 返回基本的离线响应
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: '应用当前处于离线状态，请检查网络连接'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
          'X-Offline': 'true'
        }
      }
    );
  }
}

// 缓存响应的函数
async function cacheResponse(request, response) {
  const url = new URL(request.url);
  
  // 确定缓存类型
  const isStaticAsset = STATIC_ASSETS.includes(url.pathname) || 
                       STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) ||
                       url.pathname.startsWith('/data/');
  
  const cacheName = isStaticAsset ? STATIC_CACHE : DYNAMIC_CACHE;
  
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (error) {
    console.error('[Service Worker] Failed to cache response:', error);
  }
}

// 监听来自主线程的消息
self.addEventListener('message', event => {
  console.log('[Service Worker] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

// 后台同步（可选功能）
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

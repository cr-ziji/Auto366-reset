// sw-message.js
self.addEventListener('install', (event) => {
  console.log('Service Worker 安装中...');
  self.skipWaiting(); // 强制激活新的 Service Worker
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker 激活中...');
  event.waitUntil(self.clients.claim()); // 立即控制所有页面
});

// 监听来自页面的消息
self.addEventListener('message', (event) => {
  console.log('收到来自页面的消息:', event.data);
  
  if (event.data.type === 'INJECT_EXTERNAL_CODE') {
    console.log('开始注入外部代码');
    
    // 向所有控制的页面发送注入指令
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'INJECT_CODE',
          code: event.data.code,
          id: event.data.id || Date.now()
        });
        console.log('已向页面发送注入指令');
      });
    });
  }
  
  // 可以添加其他类型的消息处理
  if (event.data.type === 'PING') {
    event.ports[0].postMessage({ type: 'PONG' });
  }
});
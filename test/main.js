// 在 Shadow DOM 中的组件
class ShadowComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'closed' });
    this.shadowRoot.innerHTML = `
      <button id="inject-btn">注入代码到外部</button>
    `;
  }

  connectedCallback() {
    this.shadowRoot.getElementById('inject-btn').addEventListener('click', () => {
      this.injectCodeToExternal();
    });

    // 注册 Service Worker
    this.registerServiceWorker();
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        // 监听来自 Service Worker 的消息
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'INJECT_CODE') {
            this.executeInjection(event.data.code);
          }
        });
      } catch (error) {
        console.error('Service Worker 注册失败:', error);
      }
    }
  }

  // 向 Service Worker 发送注入请求
  injectCodeToExternal() {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'INJECT_EXTERNAL_CODE',
        code: `
          // 要注入到外部 DOM 的代码
          const div = document.createElement('div');
          div.innerHTML = '通过 Service Worker 注入的内容';
          div.style.position = 'fixed';
          div.style.top = '10px';
          div.style.right = '10px';
          div.style.background = 'yellow';
          div.style.padding = '10px';
          div.style.zIndex = '10000';
          document.body.appendChild(div);
        `
      });
    }
  }

  // 执行代码注入
  executeInjection(code) {
    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
    setTimeout(() => {
      document.head.removeChild(script);
    }, 0);
  }
}

customElements.define('shadow-component', ShadowComponent);
document.att
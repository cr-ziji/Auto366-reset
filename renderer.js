let cachePath = ''
class Global {
  constructor() {
    this.initSettingsBtn()
  }

  initSettingsBtn() {
    window.electronAPI.setCachePath(localStorage.getItem('cache-path') || 'D:\\Up366StudentFiles')
    cachePath = localStorage.getItem('cache-path') || 'D:\\Up366StudentFiles'
    document.getElementsByClassName('settings-btn')[0].addEventListener('click', () => {
      document.getElementById('settings-modal').style.display = 'flex'
      document.getElementById('cache-path').value = cachePath
      document.getElementById('keep-cache-files').checked = localStorage.getItem('keep-cache-files') === 'true'
    })

    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseBtn = settingsModal.querySelector('.close');

    settingsCloseBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none'
    })

    window.addEventListener('click', (event) => {
      if (event.target === settingsModal) {
        settingsModal.style.display = 'none'
      }
    })

    document.getElementById('browse-cache').addEventListener('click', function () {
      window.electronAPI.openDirectoryChoosing()
    })
    window.electronAPI.chooseDirectory((event, path) => {
      document.getElementById('cache-path').value = path
    })
    document.getElementById('save-settings').addEventListener('click', function () {
      const cachePathValue = document.getElementById('cache-path').value
      const keepCacheFiles = document.getElementById('keep-cache-files').checked

      if (window.electronAPI.setCachePath(cachePathValue)) {
        localStorage.setItem('cache-path', cachePathValue)
        localStorage.setItem('keep-cache-files', keepCacheFiles.toString())
        cachePath = cachePathValue
        document.getElementById('settings-modal').style.display = 'none'
      }
      else {
        document.getElementById('error-message').textContent = '路径不正确，请设置正确的路径'
      }
    })
    document.getElementById('reset-settings').addEventListener('click', function () {
      document.getElementById('cache-path').value = 'D:\\Up366StudentFiles'
      document.getElementById('keep-cache-files').checked = false
      cachePath = 'D:\\Up366StudentFiles'
    })
    document.getElementById('check-updates').addEventListener('click', function () {
      window.electronAPI.checkForUpdates()
      showToast('正在检查更新...', 'info')
    })
  }
}

class UniversalAnswerFeature {
  constructor() {
    this.isProxyRunning = false;
    this.sortMode = 'file';
    this.lastAnswersData = null;
    this.initEventListeners();
    this.initIpcListeners();
    this.initImportAnswer()
  }

  initEventListeners() {
    document.getElementById('startProxyBtn').addEventListener('click', () => {
      this.startProxy();
    });

    document.getElementById('stopProxyBtn').addEventListener('click', () => {
      this.stopProxy();
    });

    document.getElementById('browseFileBtn').addEventListener('click', () => {
      this.appendImplant();
    });

    document.getElementById('deleteTempBtn').addEventListener('click', () => {
      this.handleDeleteTemp();
    });

    document.getElementById('deleteFileTempBtn').addEventListener('click', () => {
      this.handleDeleteFileTemp();
    })

    document.getElementById('sortMode').addEventListener('change', (e) => {
      this.sortMode = e.target.value;
      const container = document.getElementById('answersContainer');
      if (container.innerHTML && !container.innerHTML.includes('暂无答案数据')) {
        const answersData = this.lastAnswersData;
        if (answersData) {
          this.displayAnswers(answersData);
        }
      }
    });
  }

  initIpcListeners() {
    // 监听代理状态
    window.electronAPI.onProxyStatus((event, data) => {
      this.updateProxyStatus(data);
    });

    // 监听证书状态
    window.electronAPI.onCertificateStatus((event, data) => {
      this.updateCertificateStatus(data);
    });

    // 监听流量日志
    window.electronAPI.onTrafficLog((event, data) => {
      this.addTrafficLog(data);
    });

    // 监听响应捕获
    window.electronAPI.onResponseCaptured((event, data) => {
      this.addTrafficLog(data);
    });

    // 监听响应错误
    window.electronAPI.onResponseError((event, data) => {
      this.addErrorLog(`响应错误: ${data.error} - ${data.url}`);
    });

    // 监听重要请求
    window.electronAPI.onImportantRequest((event, data) => {
      this.addImportantLog(data);
    });

    // 监听下载发现
    window.electronAPI.onDownloadFound((event, data) => {
      this.addSuccessLog(`发现下载链接: ${data.url}`);
    });

    // 监听处理状态
    window.electronAPI.onProcessStatus((event, data) => {
      this.updateProcessStatus(data);
    });

    // 监听处理错误
    window.electronAPI.onProcessError((event, data) => {
      this.addErrorLog(data.error);
    });

    // 监听答案提取
    window.electronAPI.onAnswersExtracted((event, data) => {
      this.displayAnswers(data);
    });

    // 监听捕获状态
    window.electronAPI.onCaptureStatus((event, data) => {
      this.updateCaptureStatus(data);
    });

    // 监听代理错误
    window.electronAPI.onProxyError((event, data) => {
      this.addErrorLog(data.message);
      // 如果代理出错，重置按钮状态
      const startBtn = document.getElementById('startProxyBtn');
      const stopBtn = document.getElementById('stopProxyBtn');
      const captureBtn = document.getElementById('startCaptureBtn');

      startBtn.disabled = false;
      stopBtn.disabled = true;
      captureBtn.disabled = true;

      this.isProxyRunning = false;
      this.updateProxyStatus({ running: false, message: '代理服务器出错' });
    });

    // 监听文件结构
    window.electronAPI.onFileStructure((event, data) => {
      this.displayFileStructure(data);
    });

    // 监听文件处理结果
    window.electronAPI.onFilesProcessed((event, data) => {
      this.displayProcessedFiles(data);
    });

    window.electronAPI.chooseImplantZip(async (filePath) => {
      if (!filePath) {
        this.addErrorLog('未选择文件');
        return;
      }
      document.getElementById('rule-zip-implant').value = filePath;
      // this.addInfoLog(`正在导入压缩包: ${filePath}`);
      // const result = await window.electronAPI.importImplantZip(filePath);
      // if (result.success) {
      //   this.addSuccessLog(result.message);
      // } else {
      //   this.addErrorLog(`导入失败: ${result.error}`);
      // }
    });
  }

  startProxy() {
    const startBtn = document.getElementById('startProxyBtn');
    const stopBtn = document.getElementById('stopProxyBtn');

    // 更新按钮状态，防止重复点击
    startBtn.disabled = true;
    stopBtn.disabled = false;

    window.electronAPI.startAnswerProxy();
    this.addInfoLog('正在启动代理服务器...');

    // 设置超时检查，如果代理没有启动，恢复按钮状态
    setTimeout(() => {
      if (!this.isProxyRunning) {
        this.addErrorLog('代理服务器启动超时，请检查网络或端口占用');
        startBtn.disabled = false;
        stopBtn.disabled = true;
      } else {
        this.addInfoLog('代理服务器启动成功，自动开始监听网络请求...');
      }
    }, 5000);
  }

  stopProxy() {
    const startBtn = document.getElementById('startProxyBtn');
    const stopBtn = document.getElementById('stopProxyBtn');

    // 更新按钮状态，防止重复点击
    startBtn.disabled = true;
    stopBtn.disabled = true;

    window.electronAPI.stopAnswerProxy();
    this.addInfoLog('正在停止代理服务器...');

    // 设置超时检查，如果代理没有停止，恢复按钮状态
    setTimeout(() => {
      if (this.isProxyRunning) {
        this.addErrorLog('代理服务器停止超时，请尝试手动关闭');
        startBtn.disabled = false;
        stopBtn.disabled = false;
      }
    }, 5000);
  }

  updateProxyStatus(data) {
    const statusElement = document.getElementById('proxyStatus');
    const startBtn = document.getElementById('startProxyBtn');
    const stopBtn = document.getElementById('stopProxyBtn');

    if (data.running) {
      this.isProxyRunning = true;
      statusElement.textContent = '运行中';
      statusElement.className = 'status-value running';
      startBtn.disabled = true;
      stopBtn.disabled = false;
      this.addSuccessLog(data.message);
    } else {
      this.isProxyRunning = false;
      statusElement.textContent = '已停止';
      statusElement.className = 'status-value stopped';
      startBtn.disabled = false;
      stopBtn.disabled = true;
      this.addInfoLog(data.message);
    }
  }

  updateCertificateStatus(data) {
    const statusElement = document.getElementById('certificateStatus');

    if (data.status === 'importing') {
      statusElement.textContent = '导入中';
      statusElement.className = 'status-value processing';
      this.addInfoLog(data.message);
    } else if (data.status === 'success') {
      statusElement.textContent = '已导入';
      statusElement.className = 'status-value success';
      this.addSuccessLog(data.message);
    } else if (data.status === 'error') {
      statusElement.textContent = '导入失败';
      statusElement.className = 'status-value error';
      this.addErrorLog(data.message);
    } else if (data.status === 'exists') {
      statusElement.textContent = '已存在';
      statusElement.className = 'status-value success';
      this.addSuccessLog(data.message);
    } else if (data.status === 'not_found') {
      statusElement.textContent = '未找到';
      statusElement.className = 'status-value error';
      this.addErrorLog(data.message);
    }
  }

  updateCaptureStatus(data) {
    const statusElement = document.getElementById('captureStatus');
    const startBtn = document.getElementById('startCaptureBtn');
    const stopBtn = document.getElementById('stopCaptureBtn');

    if (data.capturing) {
      statusElement.textContent = '监听中';
      statusElement.className = 'status-value running';
      startBtn.disabled = true;
      stopBtn.disabled = false;
      this.addSuccessLog('网络监听已启动');
    } else {
      statusElement.textContent = '未开始';
      statusElement.className = 'status-value stopped';
      startBtn.disabled = false;
      stopBtn.disabled = true;
      this.addInfoLog('网络监听已停止');
    }
  }

  updateProcessStatus(data) {
    const statusElement = document.getElementById('processStatus');

    if (data.status === 'downloading') {
      statusElement.textContent = '下载中';
      statusElement.className = 'status-value processing';
    } else if (data.status === 'extracting') {
      statusElement.textContent = '解压中';
      statusElement.className = 'status-value processing';
    } else if (data.status === 'processing') {
      statusElement.textContent = '处理中';
      statusElement.className = 'status-value processing';
    }

    this.addInfoLog(data.message);
  }

  addTrafficLog(data) {
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    const method = data.method || 'UNKNOWN';
    const url = data.url || 'Unknown URL';

    // 创建可展开的日志项
    const logItem = document.createElement('div');
    logItem.className = `log-item request-item ${method.toLowerCase()}`;

    // 创建请求行
    const requestLine = document.createElement('div');
    requestLine.className = 'request-line';

    // 添加状态码显示
    let statusDisplay = '';
    if (data.statusCode) {
      const statusClass = data.statusCode >= 200 && data.statusCode < 300 ? 'success' :
        data.statusCode >= 400 ? 'error' : 'warning';
      statusDisplay = ` <span class="status-${statusClass}">[${data.statusCode}]</span>`;
    }

    // 格式化URL确保完整显示，并修复重复协议问题
    let formattedUrl = this.formatUrl(url);
    // 修复URL重复问题，例如 http://fs.up366.cnhttp://fs.up366.cn/download/xxx
    formattedUrl = formattedUrl.replace(/(https?:\/\/[^\/]+)\1+/, '$1');

    requestLine.innerHTML = `<span class="log-method ${method}">${method} [${timestamp}]</span>${statusDisplay} ${formattedUrl}`;
    logItem.appendChild(requestLine);

    // 创建详情容器（默认隐藏）
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'request-details';
    detailsContainer.style.display = 'none';

    // 添加时间戳
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'detail-item';
    timestampDiv.innerHTML = `<strong>时间:</strong> ${timestamp}`;
    detailsContainer.appendChild(timestampDiv);

    // 添加主机信息
    if (data.host) {
      const hostDiv = document.createElement('div');
      hostDiv.className = 'detail-item';
      hostDiv.innerHTML = `<strong>主机:</strong> ${data.host}`;
      detailsContainer.appendChild(hostDiv);
    }

    // 添加协议信息
    if (data.isHttps !== undefined) {
      const protocolDiv = document.createElement('div');
      protocolDiv.className = 'detail-item';
      protocolDiv.innerHTML = `<strong>协议:</strong> ${data.isHttps ? 'HTTPS' : 'HTTP'}`;
      detailsContainer.appendChild(protocolDiv);
    }

    // 添加请求头
    if (data.requestHeaders) {
      const headersDiv = document.createElement('div');
      headersDiv.className = 'detail-item';
      headersDiv.innerHTML = `<strong>请求头:</strong><pre class="headers">${JSON.stringify(data.requestHeaders, null, 2)}</pre>`;
      detailsContainer.appendChild(headersDiv);
    }

    // 添加Cookie（从请求头中提取）
    if (data.requestHeaders && data.requestHeaders.cookie) {
      const cookiesDiv = document.createElement('div');
      cookiesDiv.className = 'detail-item';
      cookiesDiv.innerHTML = `<strong>Cookie:</strong><pre class="cookies">${data.requestHeaders.cookie}</pre>`;
      detailsContainer.appendChild(cookiesDiv);
    }

    // 添加请求体（如果有）
    if (data.requestBody) {
      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'detail-item';
      bodyDiv.innerHTML = `<strong>请求体:</strong><pre class="request-body">${this.formatBody(data.requestBody)}</pre>`;
      detailsContainer.appendChild(bodyDiv);
    }

    // 添加响应状态（如果有）
    if (data.statusCode) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'detail-item';
      const statusClass = data.statusCode >= 200 && data.statusCode < 300 ? 'success' :
        data.statusCode >= 400 ? 'error' : 'warning';
      statusDiv.innerHTML = `<strong>响应状态:</strong> <span class="status-${statusClass}">${data.statusCode} ${data.statusMessage || ''}</span>`;
      detailsContainer.appendChild(statusDiv);
    }

    // 添加响应头
    if (data.responseHeaders) {
      const responseHeadersDiv = document.createElement('div');
      responseHeadersDiv.className = 'detail-item';
      responseHeadersDiv.innerHTML = `<strong>响应头:</strong><pre class="response-headers">${JSON.stringify(data.responseHeaders, null, 2)}</pre>`;
      detailsContainer.appendChild(responseHeadersDiv);
    }

    // 添加内容类型（如果有）
    if (data.contentType) {
      const contentTypeDiv = document.createElement('div');
      contentTypeDiv.className = 'detail-item';
      contentTypeDiv.innerHTML = `<strong>内容类型:</strong> ${data.contentType}`;
      detailsContainer.appendChild(contentTypeDiv);
    }

    // 添加响应体
    if (data.responseBody) {
      const responseBodyDiv = document.createElement('div');
      responseBodyDiv.className = 'detail-item';

      const responseBodyContainer = document.createElement('div');
      responseBodyContainer.className = 'response-body-container';

      const responseBodyPreview = document.createElement('pre');
      responseBodyPreview.className = 'response-body';
      responseBodyPreview.textContent = this.formatBody(data.responseBody);

      const downloadContainer = document.createElement('div');
      downloadContainer.style.position = 'absolute';
      downloadContainer.style.right = '5px';
      downloadContainer.style.top = '5px';

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'download-response-btn';
      downloadBtn.textContent = '下载';
      downloadBtn.style.padding = '3px 8px';
      downloadBtn.style.fontSize = '11px';
      downloadBtn.style.marginLeft = '5px';

      downloadBtn.addEventListener('click', () => {
        this.downloadResponse(data.uuid);
      });

      downloadContainer.appendChild(downloadBtn);
      responseBodyContainer.appendChild(responseBodyPreview);
      responseBodyContainer.appendChild(downloadContainer);

      responseBodyDiv.innerHTML = '<strong>响应体:</strong>';
      responseBodyDiv.appendChild(responseBodyContainer);
      detailsContainer.appendChild(responseBodyDiv);
    }

    // 添加响应体大小（如果有）
    if (data.bodySize) {
      const bodySizeDiv = document.createElement('div');
      bodySizeDiv.className = 'detail-item';
      bodySizeDiv.innerHTML = `<strong>响应体大小:</strong> ${this.formatFileSize(data.bodySize)}`;
      detailsContainer.appendChild(bodySizeDiv);
    }

    // 添加错误信息（如果有）
    if (data.error) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'detail-item error';
      errorDiv.innerHTML = `<strong>错误:</strong> <span class="error-text">${data.error}</span>`;
      detailsContainer.appendChild(errorDiv);
    }

    logItem.appendChild(detailsContainer);

    // 添加点击事件以展开/折叠详情
    requestLine.addEventListener('click', () => {
      detailsContainer.style.display = detailsContainer.style.display === 'none' ? 'block' : 'none';
      requestLine.classList.toggle('expanded');
    });

    const trafficLog = document.getElementById('trafficLog');
    trafficLog.appendChild(logItem);
    trafficLog.scrollTop = trafficLog.scrollHeight;

    // 限制日志数量
    const logItems = trafficLog.querySelectorAll('.log-item');
    if (logItems.length > 100) {
      trafficLog.removeChild(logItems[0]);
    }
  }

  // 格式化请求/响应体
  formatBody(body) {
    if (!body) return '';

    // 限制显示长度
    const maxLength = 5000;
    let displayBody = body.length > maxLength ? body.substring(0, maxLength) + '\n[内容过长，已截断...]' : body;

    // 尝试格式化JSON
    try {
      if (displayBody.trim().startsWith('{') || displayBody.trim().startsWith('[')) {
        const parsed = JSON.parse(displayBody);
        return JSON.stringify(parsed, null, 2);
      }
    } catch (e) {
      // 不是JSON，返回原始内容
    }

    return displayBody;
  }

  // 格式化URL，确保显示完整URL
  formatUrl(url) {
    if (!url) return '';

    // 如果URL不包含协议，尝试补充
    if (!url.match(/^https?:\/\//)) {
      try {
        const parsed = new URL(url);
        if (!parsed.protocol) {
          // 如果没有协议，根据是否为HTTPS添加协议
          const isHttps = url.includes(':443') || url.includes(':8443') ||
            (url.includes('fs.') && !url.includes(':80'));
          const protocol = isHttps ? 'https://' : 'http://';
          url = protocol + url.replace(/^\//, '');
        }
      } catch (e) {
        // URL解析失败，返回原始URL
        return url;
      }
    }

    return url;
  }

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + 'KB';
    return Math.round(bytes / (1024 * 1024)) + 'MB';
  }

  addImportantLog(data) {
    const logText = `[重要] ${data.url} - 包含关键数据`;
    this.addLogItem(logText, 'important');
  }

  addSuccessLog(message) {
    this.addLogItem(`[成功] ${message}`, 'success');
  }

  addErrorLog(message) {
    this.addLogItem(`[错误] ${message}`, 'error');
  }

  addInfoLog(message) {
    this.addLogItem(`[信息] ${message}`, 'normal');
  }

  addLogItem(text, type) {
    const trafficLog = document.getElementById('trafficLog');
    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;
    logItem.textContent = text;

    trafficLog.appendChild(logItem);
    trafficLog.scrollTop = trafficLog.scrollHeight;

    // 限制日志数量
    const logItems = trafficLog.querySelectorAll('.log-item');
    if (logItems.length > 100) {
      trafficLog.removeChild(logItems[0]);
    }
  }

  displayFileStructure(data) {
    this.addInfoLog(`文件结构分析完成，解压目录: ${data.extractDir}`);

    // 可以在这里添加文件结构的可视化显示
    const structureInfo = this.formatFileStructure(data.structure);
    this.addInfoLog(`文件结构: ${structureInfo}`);
  }

  async downloadResponse(uuid) {
    let res = await window.electronAPI.downloadFile(uuid)
    if (res === 1) {
      this.addSuccessLog(`响应体下载成功`);
    } else if (res === 0) {
      this.addErrorLog(`响应体下载失败`);
    }
  }

  displayProcessedFiles(data) {
    this.addInfoLog(`文件处理完成，共处理 ${data.processedFiles.length} 个文件，提取到 ${data.totalAnswers} 个答案`);

    // 显示每个文件的处理结果
    data.processedFiles.forEach(file => {
      if (file.success) {
        this.addSuccessLog(`✓ ${file.file}: 提取到 ${file.answerCount} 个答案`);
      } else {
        this.addErrorLog(`✗ ${file.file}: ${file.error}`);
      }
    });
  }

  formatFileStructure(structure, depth = 0) {
    const indent = '  '.repeat(depth);
    let result = `${indent}${structure.name}`;

    if (structure.type === 'file') {
      result += ` (${structure.ext}, ${this.formatFileSize(structure.size)})`;
    }

    if (structure.children && structure.children.length > 0) {
      const childrenInfo = structure.children.slice(0, 3).map(child =>
        this.formatFileStructure(child, depth + 1)
      ).join(', ');

      if (structure.children.length > 3) {
        result += ` [${structure.children.length} items: ${childrenInfo}, ...]`;
      } else {
        result += ` [${childrenInfo}]`;
      }
    }

    return result;
  }

  displayAnswers(data) {
    const container = document.getElementById('answersContainer');
    const processStatus = document.getElementById('processStatus');

    this.copyToClipboard = function (text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          const toast = document.createElement('div');
          toast.className = 'copy-toast show';
          toast.textContent = '答案已复制到剪贴板！';
          document.body.appendChild(toast);

          setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
              document.body.removeChild(toast);
            }, 300);
          }, 2000);
        }
      } catch (err) {
        console.error('复制失败:', err);
        const toast = document.createElement('div');
        toast.className = 'copy-toast error show';
        toast.textContent = '复制失败，请手动复制';
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.classList.remove('show');
          setTimeout(() => {
            document.body.removeChild(toast);
          }, 300);
        }, 2000);
      }
      document.body.removeChild(textarea);
    };
    processStatus.textContent = '完成';
    processStatus.className = 'status-value running';

    // 清空容器
    container.innerHTML = '';

    if (data.answers.length === 0) {
      container.innerHTML = '<div class="no-answers">未找到答案数据</div>';
      return;
    }

    this.lastAnswersData = data;

    const patternOrder = {
      '听后选择': 1,
      '听后回答': 2,
      '听后转述': 3,
      '朗读短文': 4,
      '分析内容': 5,
      'JSON句子跟读模式': 6,
      'JSON单词发音模式': 7,
      'JSON答案数组模式': 8,
      'JSON题目模式': 9,
      '文本答案模式': 10,
      '文本选项模式': 11,
      'XML正确答案模式': 12,
      'XML题目答案模式': 13,
      '通用XML答案模式': 14
    };

    if (this.sortMode === 'file') {
      const answersByFile = {};
      data.answers.forEach(answer => {
        const sourceFile = answer.sourceFile || '未知文件';
        if (!answersByFile[sourceFile]) {
          answersByFile[sourceFile] = [];
        }
        answersByFile[sourceFile].push(answer);
      });
      Object.keys(answersByFile).forEach(sourceFile => {
        const fileSection = document.createElement('div');
        fileSection.className = 'file-section';

        const fileHeader = document.createElement('div');
        fileHeader.className = 'file-header';
        fileHeader.innerHTML = `
          <h4>📁 ${sourceFile}</h4>
          <span class="answer-count">${answersByFile[sourceFile].length} 个答案</span>
        `;
        fileSection.appendChild(fileHeader);

        // 按题型排序答案
        const sortedAnswers = answersByFile[sourceFile].sort((a, b) => {
          const patternA = patternOrder[a.pattern] || 99;
          const patternB = patternOrder[b.pattern] || 99;
          return patternA - patternB;
        });

        this.createAnswerDisplay = (answer) => {
          const answerItem = document.createElement('div');
          answerItem.className = 'answer-item';

          const answerNumber = document.createElement('div');
          answerNumber.className = 'answer-number';
          answerNumber.textContent = answer.question;

          const answerOption = document.createElement('div');
          answerOption.className = 'answer-option';
          answerOption.textContent = answer.answer;

          const answerContent = document.createElement('div');
          answerContent.className = 'answer-content';
          answerContent.textContent = answer.content || '暂无内容';

          answerContent.style.textAlign = 'center';
          answerContent.style.color = '#007bff';
          answerContent.style.fontWeight = 'bold';
          answerContent.style.padding = '8px';
          answerContent.style.borderRadius = '4px';
          answerContent.style.backgroundColor = '#e6f2ff';
          answerContent.style.cursor = 'pointer';
          answerContent.style.transition = 'all 0.3s ease';

          const answerPattern = document.createElement('div');
          answerPattern.className = 'answer-pattern';
          answerPattern.textContent = `提取模式: ${answer.pattern}`;

          const copyBtn = document.createElement('div');
          copyBtn.className = 'copy-btn';
          copyBtn.innerHTML = '📋 复制';
          copyBtn.title = '点击复制答案';

          answerOption.dataset.answer = answer.answer;
          answerContent.dataset.answer = answer.content || '暂无内容';

          answerOption.addEventListener('click', () => {
            this.copyToClipboard(answer.answer);
          });

          answerContent.addEventListener('click', () => {
            this.copyToClipboard(answer.content || '暂无内容');
          });

          copyBtn.addEventListener('click', () => {
            const fullAnswer = `${answer.answer}\n${answer.content || ''}`.trim();
            this.copyToClipboard(fullAnswer);
          });

          // 组装答案元素
          answerItem.appendChild(answerNumber);
          answerItem.appendChild(answerOption);
          answerItem.appendChild(answerContent);
          if (answer.pattern) {
            answerItem.appendChild(answerPattern);
          }
          answerItem.appendChild(copyBtn);

          if (answer.children) {
            const childrenItem = document.createElement('div');
            childrenItem.className = 'children';
            childrenItem.style.display = 'none';
            answer.children.forEach(child => {
              childrenItem.appendChild(this.createAnswerDisplay(child))
            })
            answerItem.appendChild(childrenItem);
            answerContent.style.cursor = 'pointer'
            answerContent.addEventListener('click', () => {
              if (childrenItem.style.display === 'none') {
                childrenItem.style.display = 'block';
                answerContent.textContent = '点击收起全部回答';
              } else {
                childrenItem.style.display = 'none';
                answerContent.textContent = '点击展开全部回答';
              }
            })
          }

          return answerItem
        }

        sortedAnswers.forEach(answer => {
          fileSection.appendChild(this.createAnswerDisplay(answer));
        });

        container.appendChild(fileSection);
      });

      this.addSuccessLog(`答案提取完成！共 ${data.count} 题，来自 ${Object.keys(answersByFile).length} 个文件，已保存到: ${data.file}`);
    } else {
      const answersByPattern = {};
      data.answers.forEach(answer => {
        const pattern = answer.pattern || '未知题型';
        if (!answersByPattern[pattern]) {
          answersByPattern[pattern] = [];
        }
        answersByPattern[pattern].push(answer);
      });

      Object.keys(patternOrder).forEach(pattern => {
        if (answersByPattern[pattern]) {
          const patternSection = document.createElement('div');
          patternSection.className = 'pattern-section';

          const patternHeader = document.createElement('div');
          patternHeader.className = 'pattern-header';
          patternHeader.innerHTML = `
            <h4>📝 ${pattern}</h4>
            <span class="answer-count">${answersByPattern[pattern].length} 个答案</span>
          `;
          patternSection.appendChild(patternHeader);

          const sortedAnswers = answersByPattern[pattern].sort((a, b) => {
            const fileA = a.sourceFile || '未知文件';
            const fileB = b.sourceFile || '未知文件';
            return fileA.localeCompare(fileB);
          });

          this.createAnswerDisplay = (answer) => {
            const answerItem = document.createElement('div');
            answerItem.className = 'answer-item';

            const answerNumber = document.createElement('div');
            answerNumber.className = 'answer-number';
            answerNumber.textContent = answer.question;

            const answerOption = document.createElement('div');
            answerOption.className = 'answer-option';
            answerOption.textContent = answer.answer;

            const answerContent = document.createElement('div');
            answerContent.className = 'answer-content';
            answerContent.textContent = answer.content || '暂无内容';

            answerContent.style.textAlign = 'center';
            answerContent.style.color = '#007bff';
            answerContent.style.fontWeight = 'bold';
            answerContent.style.padding = '8px';
            answerContent.style.borderRadius = '4px';
            answerContent.style.backgroundColor = '#e6f2ff';
            answerContent.style.cursor = 'pointer';
            answerContent.style.transition = 'all 0.3s ease';

            const answerSource = document.createElement('div');
            answerSource.className = 'answer-source';
            answerSource.textContent = `来源: ${answer.sourceFile}`;

            const copyBtn = document.createElement('div');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = '📋 复制';
            copyBtn.title = '点击复制答案';

            answerOption.dataset.answer = answer.answer;
            answerContent.dataset.answer = answer.content || '暂无内容';

            answerOption.addEventListener('click', () => {
              this.copyToClipboard(answer.answer);
            });

            answerContent.addEventListener('click', () => {
              this.copyToClipboard(answer.content || '暂无内容');
            });

            copyBtn.addEventListener('click', () => {
              const fullAnswer = `${answer.answer}\n${answer.content || ''}`.trim();
              this.copyToClipboard(fullAnswer);
            });

            answerItem.appendChild(answerNumber);
            answerItem.appendChild(answerOption);
            answerItem.appendChild(answerContent);
            if (answer.sourceFile) {
              answerItem.appendChild(answerSource);
            }
            answerItem.appendChild(copyBtn);

            if (answer.children) {
              const childrenItem = document.createElement('div');
              childrenItem.className = 'children';
              childrenItem.style.display = 'none';
              answer.children.forEach(child => {
                childrenItem.appendChild(this.createAnswerDisplay(child))
              })
              answerItem.appendChild(childrenItem);
              answerContent.style.cursor = 'pointer'
              answerContent.addEventListener('click', () => {
                if (childrenItem.style.display === 'none') {
                  childrenItem.style.display = 'block';
                  answerContent.textContent = '点击收起全部回答';
                } else {
                  childrenItem.style.display = 'none';
                  answerContent.textContent = '点击展开全部回答';
                }
              })
            }

            return answerItem
          }

          sortedAnswers.forEach(answer => {
            patternSection.appendChild(this.createAnswerDisplay(answer));
          });

          container.appendChild(patternSection);
        }
      });

      this.addSuccessLog(`答案提取完成！共 ${data.count} 题，按题型排序显示，已保存到: ${data.file}`);
    }
  }

  handleDeleteTemp() {
    const resultDiv = document.getElementById('trafficLog');

    if (confirm('确定要删除临时缓存文件夹吗？此操作将删除所有已下载的缓存文件。')) {
      resultDiv.innerHTML = `
        <div class="log-item">正在删除临时缓存文件夹...</div>
      `;

      window.electronAPI.clearCache().then(result => {
        if (result) {
          resultDiv.innerHTML = `<div class="log-item success">天学网缓存文件清理成功</div>`;
        } else {
          resultDiv.innerHTML = `<div class="log-item error">天学网缓存文件清理失败</div>`;
        }
      });
    }
  }

  handleDeleteFileTemp() {
    const resultDiv = document.getElementById('trafficLog');

    if (confirm('确定要删除天学网临时缓存文件夹吗？此操作将删除所有天学网已下载的课本缓存文件。')) {
      resultDiv.innerHTML += `
        <div class="log-item">正在删除临时天学网缓存文件夹...</div>
      `;

      const result = window.electronAPI.removeCacheFile()
      if (result) {
        resultDiv.innerHTML += `<div class="log-item success">缓存清理成功</div>`;
      } else {
        resultDiv.innerHTML += `<div class="log-item error">缓存清理失败</div>`;
      }
    }
  }

  initImportAnswer() {
    document.getElementById('importAnswer').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          try {
            const answersData = JSON.parse(content);
            this.displayAnswers(answersData);
          } catch (error) {
            console.error(error)
            alert('解析答案文件失败')
          }
          event.target.value = '';
        };
        reader.readAsText(file);
      }
    });

    document.getElementById('clearAnswersBtn').addEventListener('click', () => {
      const container = document.getElementById('answersContainer');

      container.innerHTML = `<div class="no-answers">暂无答案数据</div>`;

      this.lastAnswersData = null;

      const toast = document.createElement('div');
      toast.className = 'copy-toast show';
      toast.textContent = '已清空提取结果';
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, 2000);
    });

    document.getElementById('shareAnswerBtn').addEventListener('click', () => {
      this.handleShareAnswer();
    });
  }

  async handleShareAnswer() {
    if (!this.lastAnswersData || !this.lastAnswersData.file) {
      this.addErrorLog('没有可分享的答案文件');
      return;
    }

    const shareBtn = document.getElementById('shareAnswerBtn');
    shareBtn.disabled = true;
    shareBtn.textContent = '上传中...';

    try {
      const result = await window.electronAPI.shareAnswerFile(this.lastAnswersData.file);

      if (result.success) {
        const downloadUrl = result.downloadUrl;
        const primaryUrl = `https://366.cyril.qzz.io/?url=${encodeURIComponent(downloadUrl)}`;
        const backupUrl = `https://a366.netlify.app/?url=${encodeURIComponent(downloadUrl)}`;

        const shareModal = document.createElement('div');
        shareModal.className = 'share-modal';
        shareModal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
        `;

        const shareContent = document.createElement('div');
        shareContent.style.cssText = `
          background: white;
          padding: 30px;
          border-radius: 8px;
          max-width: 600px;
          width: 90%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        shareContent.innerHTML = `
          <h3 style="margin-top: 0; color: #333;">答案文件分享成功！</h3>
          <p style="color: #666; margin-bottom: 20px;">请复制以下链接分享给他人：</p>
          <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">主网址：</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="primaryUrl" value="${primaryUrl}" readonly 
                     style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
              <button class="copy-url-btn" data-url="${primaryUrl}" 
                      style="padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                复制
              </button>
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 5px; color: #333; font-weight: bold;">备用网址：</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="backupUrl" value="${backupUrl}" readonly 
                     style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
              <button class="copy-url-btn" data-url="${backupUrl}" 
                      style="padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                复制
              </button>
            </div>
          </div>
          <button id="closeShareModal" 
                  style="width: 100%; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
            关闭
          </button>
        `;

        shareModal.appendChild(shareContent);
        document.body.appendChild(shareModal);

        shareContent.querySelectorAll('.copy-url-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const url = btn.getAttribute('data-url');
            this.copyToClipboard(url);
            btn.textContent = '已复制！';
            setTimeout(() => {
              btn.textContent = '复制';
            }, 2000);
          });
        });

        document.getElementById('closeShareModal').addEventListener('click', () => {
          document.body.removeChild(shareModal);
        });

        shareModal.addEventListener('click', (e) => {
          if (e.target === shareModal) {
            document.body.removeChild(shareModal);
          }
        });

        this.addSuccessLog('答案文件上传成功，分享链接已生成');
      } else {
        this.addErrorLog(`上传失败: ${result.error}`);
        alert(`上传失败: ${result.error}`);
      }
    } catch (error) {
      console.error('分享答案文件失败:', error);
      this.addErrorLog(`分享失败: ${error.message}`);
      alert(`分享失败: ${error.message}`);
    } finally {
      shareBtn.disabled = false;
      shareBtn.textContent = '分享答案';
    }
  }

  async appendImplant() {
    window.electronAPI.openImplantZipChoosing();
  }
}

// 初始化代码
document.addEventListener('DOMContentLoaded', () => {
  new Global();
  new UniversalAnswerFeature();

  // 响应体更改规则功能
  setTimeout(() => {
    initResponseRulesFeature();
  }, 100);
  initUpdateFeature();
});

// 响应体更改规则功能初始化
function initResponseRulesFeature() {
  console.log('初始化响应体更改规则功能...');

  // 检查 electronAPI 是否可用
  if (!window.electronAPI) {
    console.error('window.electronAPI 未定义');
    return;
  }

  if (!window.electronAPI.getResponseRules) {
    console.error('window.electronAPI.getResponseRules 未定义');
    return;
  }

  console.log('electronAPI 检查通过');

  const responseRulesBtn = document.getElementById('responseRulesBtn');
  const responseRulesModal = document.getElementById('response-rules-modal');
  const closeResponseRules = document.getElementById('close-response-rules');
  const ruleEditModal = document.getElementById('rule-edit-modal');
  const closeRuleEdit = document.getElementById('close-rule-edit');

  if (!responseRulesBtn) {
    console.error('未找到 responseRulesBtn 元素');
    return;
  }

  if (!responseRulesModal) {
    console.error('未找到 response-rules-modal 元素');
    return;
  }

  // 打开规则管理弹窗
  responseRulesBtn.addEventListener('click', () => {
    console.log('响应规则按钮被点击');
    responseRulesModal.style.display = 'flex';
    loadResponseRules();
  });

  // 关闭规则管理弹窗
  closeResponseRules.addEventListener('click', () => {
    responseRulesModal.style.display = 'none';
  });

  // 关闭规则编辑弹窗
  closeRuleEdit.addEventListener('click', () => {
    ruleEditModal.style.display = 'none';
  });

  // 点击弹窗外部关闭
  window.addEventListener('click', (event) => {
    if (event.target === responseRulesModal) {
      responseRulesModal.style.display = 'none';
    }
    if (event.target === ruleEditModal) {
      ruleEditModal.style.display = 'none';
    }
  });

  // 新建规则
  document.getElementById('add-rule-btn').addEventListener('click', () => {
    openRuleEditor();
  });

  // 新建分组
  document.getElementById('add-group-btn').addEventListener('click', () => {
    createGroup();
  });

  // 导入规则
  document.getElementById('import-rules-btn').addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.importResponseRules();
      if (result.success) {
        showToast(`成功导入 ${result.count} 条规则`, 'success');
        loadResponseRules();
      } else {
        showToast(`导入失败: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`导入失败: ${error.message}`, 'error');
    }
  });

  // 导出规则
  document.getElementById('export-rules-btn').addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.exportResponseRules();
      if (result.success) {
        showToast(`规则已导出到: ${result.path}`, 'success');
      } else {
        showToast(`导出失败: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`导出失败: ${error.message}`, 'error');
    }
  });

  document.getElementById('upload-ruleset-btn').addEventListener('click', () => {
    loadGroupsForUpload();
    document.getElementById('upload-ruleset-modal').style.display = 'flex';
  });

  document.getElementById('download-ruleset-btn').addEventListener('click', () => {
    document.getElementById('download-ruleset-modal').style.display = 'flex';
  });

  initRulesetModals();

  // 调用规则编辑表单初始化
  initRuleEditForm();
}

// 规则编辑表单初始化
function initRuleEditForm() {
  console.log('初始化规则编辑表单事件监听器...');

  // 规则类型变化事件
  const ruleTypeSelect = document.getElementById('rule-type');
  if (ruleTypeSelect) {
    ruleTypeSelect.addEventListener('change', (e) => {
      console.log('规则类型变化:', e.target.value);
      handleRuleTypeChange(e.target.value);
    });
  } else {
    console.error('未找到 rule-type 元素');
  }

  // 规则类型变化事件
  const changeTypeSelect = document.getElementById('change-type');
  if (changeTypeSelect) {
    changeTypeSelect.addEventListener('change', (e) => {
      console.log('更改类型变化:', e.target.value);
      if (e.target.value === 'request-headers' || e.target.value === 'response-headers') {
        document.getElementById('content-type-group').style.display = 'none';
      }
      else {
        document.getElementById('content-type-group').style.display = 'block';
      }
    });
  } else {
    console.error('未找到 change-type 元素');
  }

  // 操作类型变化事件
  const ruleActionSelect = document.getElementById('rule-action');
  if (ruleActionSelect) {
    ruleActionSelect.addEventListener('change', (e) => {
      console.log('操作类型变化:', e.target.value);
      const ruleType = document.getElementById('change-type').value;
      handleActionChange(e.target.value, ruleType);
    });
  } else {
    console.error('未找到 rule-action 元素');
  }

  // 注入位置变化事件
  const injectPositionSelect = document.getElementById('rule-inject-position');
  if (injectPositionSelect) {
    injectPositionSelect.addEventListener('change', (e) => {
      handleInjectPositionChange(e.target.value);
    });
  }

  // 添加修改规则按钮
  const addModifyRuleBtn = document.getElementById('add-modify-rule');
  if (addModifyRuleBtn) {
    addModifyRuleBtn.addEventListener('click', addModifyRule);
  }

  // 添加请求头按钮
  const addRequestHeaderBtn = document.getElementById('add-request-header');
  if (addRequestHeaderBtn) {
    addRequestHeaderBtn.addEventListener('click', addRequestHeader);
  }

  // 添加响应头按钮
  const addResponseHeaderBtn = document.getElementById('add-response-header');
  if (addResponseHeaderBtn) {
    addResponseHeaderBtn.addEventListener('click', addResponseHeader);
  }

  // 保存规则按钮
  const saveRuleBtn = document.getElementById('save-rule-btn');
  if (saveRuleBtn) {
    saveRuleBtn.addEventListener('click', () => {
      console.log('保存规则按钮被点击');
      saveRule();
    });
    console.log('保存规则按钮事件监听器已绑定');
  } else {
    console.error('未找到 save-rule-btn 元素');
  }

  // 取消按钮
  const cancelRuleBtn = document.getElementById('cancel-rule-btn');
  if (cancelRuleBtn) {
    cancelRuleBtn.addEventListener('click', () => {
      console.log('取消按钮被点击');
      document.getElementById('rule-edit-modal').style.display = 'none';
    });
    console.log('取消按钮事件监听器已绑定');
  } else {
    console.error('未找到 cancel-rule-btn 元素');
  }

  // 替换类型切换
  const replaceTypeRadios = document.querySelectorAll('input[name="replace-type"]');
  replaceTypeRadios.forEach(radio => {
    radio.addEventListener('change', handleReplaceTypeChange);
  });

  // 浏览文件按钮
  const browseFileBtn = document.getElementById('browse-replace-file');
  if (browseFileBtn) {
    browseFileBtn.addEventListener('click', () => {
      window.electronAPI.openFileChoosing();
    });
  }

  // 监听文件选择结果
  window.electronAPI.chooseFile((event, filePath) => {
    if (filePath) {
      document.getElementById('rule-file-path').value = filePath;
    }
  });
}

// 加载响应体更改规则
async function loadResponseRules() {
  console.log('开始加载响应体更改规则...');
  try {
    console.log('调用 window.electronAPI.getResponseRules()...');
    const rules = await window.electronAPI.getResponseRules();
    console.log('获取到的规则:', rules);

    if (!Array.isArray(rules)) {
      console.error('规则数据不是数组:', typeof rules, rules);
      showToast('规则数据格式错误', 'error');
      return;
    }

    displayResponseRules(rules);
    updateRulesStatus(rules);
    console.log('规则加载完成');
  } catch (error) {
    console.error('加载规则失败:', error);
    console.error('错误详情:', error.message, error.stack);
    showToast(`加载规则失败: ${error.message}`, 'error');
  }
}

// 更新规则状态显示
function updateRulesStatus(rules) {
  const totalCount = rules.length;
  const enabledCount = rules.filter(rule => rule.enabled).length;

  const rulesCountElement = document.getElementById('rules-count');
  const activeRulesCountElement = document.getElementById('active-rules-count');

  if (rulesCountElement) {
    rulesCountElement.textContent = `规则数量: ${totalCount}`;
  }

  if (activeRulesCountElement) {
    activeRulesCountElement.textContent = `启用: ${enabledCount}`;
  }
}

// 显示规则列表
function displayResponseRules(rules) {
  const rulesList = document.getElementById('rules-list');

  if (rules.length === 0) {
    rulesList.innerHTML = '<div class="no-rules">暂无规则，点击"新建规则"开始添加</div>';
    return;
  }

  // 获取所有分组
  const groups = rules.filter(rule => rule.isGroup);
  // 获取非分组规则
  const nonGroupRules = rules.filter(rule => !rule.isGroup);

  let html = '';

  // 渲染分组
  groups.forEach(group => {
    const groupRules = nonGroupRules.filter(rule => rule.groupId === group.id);
    const enabledCount = groupRules.filter(rule => rule.enabled).length;

    html += `
      <div class="rules-group" data-group-id="${group.id}">
        <div class="rules-group-header" onclick="toggleGroup('${group.id}')">
          <span class="rules-group-toggle">▼</span>
          <span class="rules-group-title">${escapeHtml(group.name)}</span>
          <div class="rules-group-actions">
            <button class="rule-action-btn" onclick="event.stopPropagation(); toggleGroupRules('${group.id}', ${group.enabled})">
              ${group.enabled ? '禁用' : '启用'}
            </button>
            <button class="rule-action-btn edit" onclick="event.stopPropagation(); editGroup('${group.id}')">编辑</button>
            <button class="rule-action-btn delete" onclick="event.stopPropagation(); deleteGroup('${group.id}')">删除</button>
          </div>
        </div>
        <div class="rules-group-content" data-group-content="${group.id}">
          ${groupRules.length > 0 ? groupRules.map(rule => createRuleItemHTML(rule)).join('') : '<div class="no-rules">暂无规则</div>'}
        </div>
      </div>
    `;
  });

  // 渲染未分组的规则
  const ungroupedRules = nonGroupRules.filter(rule => !rule.groupId);
  if (ungroupedRules.length > 0) {
    html += `
      <div class="ungrouped-rules" data-ungrouped="true">
        <div class="ungrouped-rules-header">未分组规则</div>
        ${ungroupedRules.map(rule => createRuleItemHTML(rule)).join('')}
      </div>
    `;
  }

  rulesList.innerHTML = html;

  // 初始化拖拽功能
  initializeDragAndDrop();
}

// 创建规则项HTML
function createRuleItemHTML(rule) {
  return `
    <div class="rule-item" data-rule-id="${rule.id}" draggable="true">
            <input type="checkbox" class="rule-checkbox" ${rule.enabled ? 'checked' : ''} 
                   onchange="toggleRule('${rule.id}', this.checked)">
            <div class="rule-info">
                <div class="rule-name">${escapeHtml(rule.name)}</div>
                <div class="rule-details">
                    <div class="rule-detail-item">
                        <span>类型:</span>
                        <span>${getRuleTypeText(rule.type || 'response')}</span>
                    </div>
                    <div class="rule-detail-item">
                        <span class="rule-status ${rule.enabled ? 'enabled' : 'disabled'}">
                            ${rule.enabled ? '启用' : '禁用'}
                        </span>
                    </div>
                </div>
            </div>
            <div class="rule-actions">
                <button class="rule-action-btn edit" onclick="editRule('${rule.id}')">编辑</button>
                <button class="rule-action-btn delete" onclick="deleteRule('${rule.id}')">删除</button>
            </div>
        </div>
  `;
}

// 获取规则类型文本
function getRuleTypeText(type) {
  const typeMap = {
    'content-change': '网络请求/响应修改',
    'zip-implant': 'ZIP文件植入',
    'answer-upload': '答案上传到本地服务器',
  };
  return typeMap[type] || type;
}

// 切换规则启用状态
async function toggleRule(ruleId, enabled) {
  try {
    const success = await window.electronAPI.toggleResponseRule(ruleId, enabled);
    if (success) {
      loadResponseRules();
    } else {
      showToast('切换规则状态失败', 'error');
    }
  } catch (error) {
    console.error('切换规则状态失败:', error);
    showToast('切换规则状态失败', 'error');
  }
}

// 编辑规则
async function editRule(ruleId) {
  try {
    const rules = await window.electronAPI.getResponseRules();
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      openRuleEditor(rule);
    }
  } catch (error) {
    console.error('加载规则失败:', error);
    showToast('加载规则失败', 'error');
  }
}

// 删除规则
async function deleteRule(ruleId) {
  const confirmed = await showConfirm('确认删除', '确定要删除这条规则吗？');
  if (confirmed) {
    try {
      const success = await window.electronAPI.deleteResponseRule(ruleId);
      if (success) {
        loadResponseRules();
        showToast('规则已删除', 'success');
      } else {
        showToast('删除规则失败', 'error');
      }
    } catch (error) {
      console.error('删除规则失败:', error);
      showToast('删除规则失败', 'error');
    }
  }
}

// 分组管理函数
async function createGroup() {
  const groupName = await showPrompt('创建分组', '请输入分组名称:');
  if (groupName && groupName.trim()) {
    try {
      const newGroup = {
        id: Date.now().toString(),
        name: groupName.trim(),
        isGroup: true,
        enabled: true,
        createdAt: new Date().toISOString()
      };

      const rules = await window.electronAPI.getResponseRules();
      rules.push(newGroup);
      await window.electronAPI.saveResponseRules(rules);

      loadResponseRules();
      showToast('分组创建成功', 'success');
    } catch (error) {
      console.error('创建分组失败:', error);
      showToast('创建分组失败', 'error');
    }
  }
}

async function editGroup(groupId) {
  try {
    const rules = await window.electronAPI.getResponseRules();
    const group = rules.find(r => r.id === groupId);

    if (group) {
      const newName = await showPrompt('编辑分组', '请输入新的分组名称:', group.name);
      if (newName && newName.trim()) {
        group.name = newName.trim();
        await window.electronAPI.saveResponseRules(rules);
        loadResponseRules();
        showToast('分组名称已更新', 'success');
      }
    }
  } catch (error) {
    console.error('编辑分组失败:', error);
    showToast('编辑分组失败', 'error');
  }
}

async function deleteGroup(groupId) {
  const confirmed = await showConfirm('确认删除', '确定要删除此分组吗？分组内的规则将变为未分组状态。');
  if (confirmed) {
    try {
      const rules = await window.electronAPI.getResponseRules();

      // 删除分组
      const filteredRules = rules.filter(r => r.id !== groupId);

      // 将该分组内的规则设置为未分组
      filteredRules.forEach(rule => {
        if (rule.groupId === groupId) {
          rule.groupId = null;
        }
      });

      await window.electronAPI.saveResponseRules(filteredRules);
      loadResponseRules();
      showToast('分组已删除', 'success');
    } catch (error) {
      console.error('删除分组失败:', error);
      showToast('删除分组失败', 'error');
    }
  }
}

function toggleGroup(groupId) {
  const groupContent = document.querySelector(`[data-group-content="${groupId}"]`);
  const toggleIcon = document.querySelector(`[data-group-id="${groupId}"] .rules-group-toggle`);

  if (groupContent && toggleIcon) {
    groupContent.classList.toggle('collapsed');
    toggleIcon.classList.toggle('collapsed');
  }
}

async function toggleGroupRules(groupId, enabled) {
  try {
    const rules = await window.electronAPI.getResponseRules();

    // 切换分组内所有规则的启用状态
    rules.forEach(rule => {
      if (rule.groupId === groupId) {
        rule.enabled = !enabled;
      }
    });

    // 更新分组状态
    const group = rules.find(r => r.id === groupId);
    if (group) {
      group.enabled = !enabled;
    }

    await window.electronAPI.saveResponseRules(rules);
    await loadResponseRules();
    showToast(`分组内规则已${!enabled ? '启用' : '禁用'}`, 'success');
  } catch (error) {
    console.error('切换分组规则状态失败:', error);
    showToast('切换分组规则状态失败', 'error');
  }
}

// 拖拽功能初始化
function initializeDragAndDrop() {
  const ruleItems = document.querySelectorAll('.rule-item');
  const groups = document.querySelectorAll('.rules-group');
  const ungroupedArea = document.querySelector('.ungrouped-rules');

  ruleItems.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
  });

  groups.forEach(group => {
    const groupContent = group.querySelector('.rules-group-content');
    groupContent.addEventListener('dragover', handleDragOver);
    groupContent.addEventListener('dragleave', handleDragLeave);
    groupContent.addEventListener('drop', handleDrop);
  });

  if (ungroupedArea) {
    ungroupedArea.addEventListener('dragover', handleDragOver);
    ungroupedArea.addEventListener('dragleave', handleDragLeave);
    ungroupedArea.addEventListener('drop', handleDrop);
  }
}

let draggedRuleId = null;

function handleDragStart(e) {
  draggedRuleId = this.getAttribute('data-rule-id');
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  if (!draggedRuleId) return;

  try {
    const rules = await window.electronAPI.getResponseRules();
    const rule = rules.find(r => r.id === draggedRuleId);

    if (!rule || rule.isGroup) return;

    // 确定目标分组ID
    let targetGroupId = null;

    if (this.classList.contains('rules-group-content')) {
      const groupElement = this.closest('.rules-group');
      if (groupElement) {
        targetGroupId = groupElement.getAttribute('data-group-id');
      }
    } else if (this.classList.contains('ungrouped-rules')) {
      targetGroupId = null;
    }

    // 更新规则的分组ID
    if (rule.groupId !== targetGroupId) {
      rule.groupId = targetGroupId;
      await window.electronAPI.saveResponseRules(rules);
      loadResponseRules();
      showToast('规则已移动', 'success');
    }
  } catch (error) {
    console.error('移动规则失败:', error);
    showToast('移动规则失败', 'error');
  }

  draggedRuleId = null;
}

// 打开规则编辑器
async function openRuleEditor(rule = null) {
  const modal = document.getElementById('rule-edit-modal');
  const title = document.getElementById('rule-edit-title');

  // 加载分组选项
  await loadGroupOptions();

  if (rule) {
    title.textContent = '编辑规则';
    await fillRuleForm(rule);
  } else {
    title.textContent = '新建规则';
    await clearRuleForm();
  }

  modal.style.display = 'flex';
}

// 加载分组选项
async function loadGroupOptions() {
  try {
    const rules = await window.electronAPI.getResponseRules();
    const groups = rules.filter(rule => rule.isGroup);

    const groupSelect = document.getElementById('rule-group');
    // 保留第一个选项（未分组）
    groupSelect.innerHTML = '<option value="">未分组</option>';

    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      groupSelect.appendChild(option);
    });
  } catch (error) {
    console.error('加载分组选项失败:', error);
  }
}

// 填充规则表单
async function fillRuleForm(rule) {
  document.getElementById('rule-name').value = rule.name || '';
  document.getElementById('rule-group').value = rule.groupId || '';
  document.getElementById('rule-type').value = rule.type || 'content-change';
  document.getElementById('rule-enabled').checked = rule.enabled !== false;

  // 处理规则类型变化
  await handleRuleTypeChange(rule.type || 'content-change');

  // 根据规则类型填充不同的字段
  switch (rule.type) {
    case 'content-change':
      document.getElementById('change-type').value = rule.changeType || 'response-body';
      document.getElementById('rule-url-pattern').value = rule.urlPattern || '';
      document.getElementById('rule-method').value = rule.method || '';
      document.getElementById('rule-action').value = rule.action || 'replace';

      // 内容类型只对响应体规则有效
      if (rule.changeType === 'response-body' || rule.changeType === 'request-body') {
        document.getElementById('rule-content-type').value = rule.contentType || '';
      }

      // 根据修改类型和操作类型显示相应的内容区域
      handleActionChange(rule.action, rule.changeType);

      if (rule.changeType === 'request-headers' || rule.changeType === 'response-headers') {
        document.getElementById('content-type-group').style.display = 'none';
      }
      else {
        document.getElementById('content-type-group').style.display = 'block';
      }

      // 填充具体内容
      if (rule.changeType === 'request-headers') {
        if (rule.action === 'add-headers' || rule.action === 'modify-headers') {
          fillRequestHeaders(rule.requestHeaders || {});
        } else if (rule.action === 'remove-headers') {
          document.getElementById('rule-remove-headers').value = (rule.removeHeaders || []).join(', ');
        }
      } else if (rule.changeType === 'request-body') {
        document.getElementById('rule-new-url').value = rule.newUrl || '';
      } else if (rule.changeType === 'response-headers') {
        if (rule.action === 'add-headers' || rule.action === 'modify-headers') {
          fillResponseHeaders(rule.responseHeaders || {});
        } else if (rule.action === 'remove-headers') {
          document.getElementById('rule-remove-headers').value = (rule.removeHeaders || []).join(', ');
        }
      } else if (rule.changeType === 'response-body') {
        switch (rule.action) {
          case 'replace':
            if (rule.replaceWithFile && rule.filePath) {
              document.querySelector('input[name="replace-type"][value="file"]').checked = true;
              document.getElementById('rule-file-path').value = rule.filePath || '';
              document.getElementById('file-replace-group').style.display = 'block';
              document.getElementById('rule-replace-content').style.display = 'none';
            } else {
              document.querySelector('input[name="replace-type"][value="text"]').checked = true;
              document.getElementById('rule-replace-content').value = rule.replaceContent || '';
              document.getElementById('file-replace-group').style.display = 'none';
              document.getElementById('rule-replace-content').style.display = 'block';
            }
            break;
          case 'modify':
            fillModifyRules(rule.modifyRules || []);
            break;
          case 'inject':
            document.getElementById('rule-inject-content').value = rule.injectContent || '';
            document.getElementById('rule-inject-position').value = rule.injectPosition || 'start';
            document.getElementById('rule-inject-target').value = rule.injectTarget || '';
            handleInjectPositionChange(rule.injectPosition);
            break;
        }
      }
      break;

    case 'zip-implant':
      document.getElementById('rule-zip-implant').value = rule.zipImplant || '';
      document.getElementById('rule-url-zip').value = rule.urlZip || '';
      break;

    case 'answer-upload':
      document.getElementById('rule-url-upload').value = rule.urlUpload || '';
      document.getElementById('server-locate').value = rule.serverLocate || '';
      document.getElementById('upload-type').value = rule.uploadType || 'original';
      break;
  }

  // 存储规则ID用于更新
  document.getElementById('rule-edit-modal').dataset.ruleId = rule.id || '';
}

// 清空规则表单
async function clearRuleForm() {
  document.getElementById('rule-name').value = '';
  document.getElementById('rule-group').value = '';
  document.getElementById('rule-type').value = 'content-change';
  document.getElementById('rule-enabled').checked = true;

  // 清空content-change相关字段
  document.getElementById('rule-url-pattern').value = '';
  document.getElementById('rule-method').value = '';
  document.getElementById('rule-content-type').value = '';
  document.getElementById('rule-replace-content').value = '';
  document.getElementById('rule-file-path').value = '';
  document.getElementById('rule-inject-content').value = '';
  document.getElementById('rule-inject-position').value = 'start';
  document.getElementById('rule-inject-target').value = '';
  document.getElementById('rule-new-url').value = '';
  document.getElementById('rule-remove-headers').value = '';
  document.getElementById('content-type-group').style.display = 'none';

  // 清空zip-implant相关字段
  document.getElementById('rule-zip-implant').value = '';
  document.getElementById('rule-url-zip').value = '';

  // 清空answer-upload相关字段
  document.getElementById('rule-url-upload').value = '';
  document.getElementById('server-locate').value = '';
  document.getElementById('upload-type').value = 'original';

  // 重置替换类型为文本
  document.querySelector('input[name="replace-type"][value="text"]').checked = true;
  document.getElementById('file-replace-group').style.display = 'none';

  // 清空修改规则
  const modifyContainer = document.querySelector('.modify-rules-container');
  if (modifyContainer) {
    modifyContainer.innerHTML = '<div class="modify-rule-item"><input type="text" placeholder="查找内容(支持正则)" class="find-input"><input type="text" placeholder="替换为" class="replace-input"><button type="button" class="remove-modify-rule" onclick="removeModifyRule(this)">删除</button></div>';
  }

  // 清空请求头
  const requestHeadersContainer = document.querySelector('#request-headers-group .headers-container');
  if (requestHeadersContainer) {
    requestHeadersContainer.innerHTML = '<div class="header-item"><input type="text" placeholder="请求头名称" class="header-name-input"><input type="text" placeholder="请求头值" class="header-value-input"><button type="button" class="remove-header" onclick="removeHeader(this)">删除</button></div>';
  }

  // 清空响应头
  const responseHeadersContainer = document.querySelector('#response-headers-group .headers-container');
  if (responseHeadersContainer) {
    responseHeadersContainer.innerHTML = '<div class="header-item"><input type="text" placeholder="响应头名称" class="header-name-input"><input type="text" placeholder="响应头值" class="header-value-input"><button type="button" class="remove-header" onclick="removeHeader(this)">删除</button></div>';
  }

  // 处理默认规则类型
  await handleRuleTypeChange('content-change');

  document.getElementById('rule-edit-modal').dataset.ruleId = '';
}

// 填充修改规则
function fillModifyRules(modifyRules) {
  const container = document.querySelector('.modify-rules-container');
  container.innerHTML = '';

  if (modifyRules.length === 0) {
    addModifyRule();
  } else {
    modifyRules.forEach(rule => {
      const div = document.createElement('div');
      div.className = 'modify-rule-item';
      div.innerHTML = `
        <input type="text" placeholder="查找内容(支持正则)" class="find-input" value="${escapeHtml(rule.find || '')}">
        <input type="text" placeholder="替换为" class="replace-input" value="${escapeHtml(rule.replace || '')}">
        <button type="button" class="remove-modify-rule" onclick="removeModifyRule(this)">删除</button>
      `;
      container.appendChild(div);
    });
  }
}

// 填充请求头
function fillRequestHeaders(headers) {
  const container = document.querySelector('#request-headers-group .headers-container');
  container.innerHTML = '';

  const headerEntries = Object.entries(headers);
  if (headerEntries.length === 0) {
    addRequestHeader();
  } else {
    headerEntries.forEach(([name, value]) => {
      const div = document.createElement('div');
      div.className = 'header-item';
      div.innerHTML = `
        <input type="text" placeholder="请求头名称" class="header-name-input" value="${escapeHtml(name)}">
        <input type="text" placeholder="请求头值" class="header-value-input" value="${escapeHtml(value)}">
        <button type="button" class="remove-header" onclick="removeHeader(this)">删除</button>
      `;
      container.appendChild(div);
    });
  }
}

// 填充响应头
function fillResponseHeaders(headers) {
  const container = document.querySelector('#response-headers-group .headers-container');
  container.innerHTML = '';

  const headerEntries = Object.entries(headers);
  if (headerEntries.length === 0) {
    addResponseHeader();
  } else {
    headerEntries.forEach(([name, value]) => {
      const div = document.createElement('div');
      div.className = 'header-item';
      div.innerHTML = `
        <input type="text" placeholder="响应头名称" class="header-name-input" value="${escapeHtml(name)}">
        <input type="text" placeholder="响应头值" class="header-value-input" value="${escapeHtml(value)}">
        <button type="button" class="remove-header" onclick="removeHeader(this)">删除</button>
      `;
      container.appendChild(div);
    });
  }
}

// 处理规则类型变化
async function handleRuleTypeChange(ruleType) {
  document.getElementById('content-change-group').style.display = 'none';
  document.getElementById('zip-implant-group').style.display = 'none';
  document.getElementById('answer-upload-group').style.display = 'none';
  document.getElementById(ruleType + '-group').style.display = 'block';
}

// 添加请求头
function addRequestHeader() {
  const container = document.querySelector('#request-headers-group .headers-container');
  const div = document.createElement('div');
  div.className = 'header-item';
  div.innerHTML = `
    <input type="text" placeholder="请求头名称" class="header-name-input">
    <input type="text" placeholder="请求头值" class="header-value-input">
    <button type="button" class="remove-header" onclick="removeHeader(this)">删除</button>
  `;
  container.appendChild(div);
}

// 添加响应头
function addResponseHeader() {
  const container = document.querySelector('#response-headers-group .headers-container');
  const div = document.createElement('div');
  div.className = 'header-item';
  div.innerHTML = `
    <input type="text" placeholder="响应头名称" class="header-name-input">
    <input type="text" placeholder="响应头值" class="header-value-input">
    <button type="button" class="remove-header" onclick="removeHeader(this)">删除</button>
  `;
  container.appendChild(div);
}

// 删除头部
function removeHeader(button) {
  const container = button.closest('.headers-container');
  if (container.children.length > 1) {
    button.parentElement.remove();
  } else {
    showToast('至少需要保留一个头部项', 'error');
  }
}

// 处理操作类型变化
function handleActionChange(action, ruleType) {
  console.log(action, ruleType);
  const replaceGroup = document.getElementById('replace-content-group');
  const modifyGroup = document.getElementById('modify-rules-group');
  const injectGroup = document.getElementById('inject-content-group');
  const requestHeadersGroup = document.getElementById('request-headers-group');
  const newUrlGroup = document.getElementById('new-url-group');
  const responseHeadersGroup = document.getElementById('response-headers-group');
  const removeHeadersGroup = document.getElementById('remove-headers-group');

  // 隐藏所有组
  replaceGroup.style.display = 'none';
  modifyGroup.style.display = 'none';
  injectGroup.style.display = 'none';
  requestHeadersGroup.style.display = 'none';
  newUrlGroup.style.display = 'none';
  responseHeadersGroup.style.display = 'none';
  removeHeadersGroup.style.display = 'none';

  // 根据规则类型和操作类型显示对应的组
  if (ruleType === 'response-body') {
    switch (action) {
      case 'replace':
        replaceGroup.style.display = 'block';
        break;
      case 'modify':
        modifyGroup.style.display = 'block';
        break;
      case 'inject':
        injectGroup.style.display = 'block';
        break;
    }
  } else if (ruleType === 'request-headers') {
    switch (action) {
      case 'modify-headers':
        requestHeadersGroup.style.display = 'block';
        break;
      case 'modify-url':
        newUrlGroup.style.display = 'block';
        break;
      case 'block':
        // 阻止请求不需要额外字段
        break;
    }
  } else if (ruleType === 'response-headers') {
    switch (action) {
      case 'add-headers':
      case 'modify-headers':
        responseHeadersGroup.style.display = 'block';
        break;
      case 'remove-headers':
        removeHeadersGroup.style.display = 'block';
        break;
    }
  }
}

// 处理注入位置变化
function handleInjectPositionChange(position) {
  const targetInput = document.getElementById('rule-inject-target');
  if (position === 'before' || position === 'after') {
    targetInput.style.display = 'block';
    targetInput.required = true;
  } else {
    targetInput.style.display = 'none';
    targetInput.required = false;
  }
}

// 添加修改规则
function addModifyRule() {
  const container = document.querySelector('.modify-rules-container');
  const div = document.createElement('div');
  div.className = 'modify-rule-item';
  div.innerHTML = `
        <input type="text" placeholder="查找内容(支持正则)" class="find-input">
        <input type="text" placeholder="替换为" class="replace-input">
        <button type="button" class="remove-modify-rule" onclick="removeModifyRule(this)">删除</button>
    `;
  container.appendChild(div);
}

// 删除修改规则
function removeModifyRule(button) {
  const container = document.querySelector('.modify-rules-container');
  if (container.children.length > 1) {
    button.parentElement.remove();
  } else {
    showToast('至少需要保留一条修改规则', 'error');
  }
}

// 保存规则
async function saveRule() {
  console.log('saveRule 函数被调用');
  try {
    const rule = collectRuleData();
    console.log('收集到的规则数据:', rule);
    if (!validateRule(rule)) {
      console.log('规则验证失败');
      return;
    }

    console.log('开始保存规则...');
    const success = await window.electronAPI.saveResponseRule(rule);
    if (success) {
      document.getElementById('rule-edit-modal').style.display = 'none';
      loadResponseRules();
      showToast('规则保存成功', 'success');
      console.log('规则保存成功');
    } else {
      showToast('规则保存失败', 'error');
      console.log('规则保存失败');
    }
  } catch (error) {
    console.error('保存规则失败:', error);
    showToast('保存规则失败', 'error');
  }
}

// 收集规则数据
function collectRuleData() {
  const ruleId = document.getElementById('rule-edit-modal').dataset.ruleId;
  const ruleType = document.getElementById('rule-type').value;

  const rule = {
    name: document.getElementById('rule-name').value.trim(),
    groupId: document.getElementById('rule-group').value || null,
    type: ruleType,
    enabled: document.getElementById('rule-enabled').checked
  };

  if (ruleId) {
    rule.id = ruleId;
  }

  // 根据规则类型收集不同的数据
  switch (ruleType) {
    case 'content-change':
      rule.changeType = document.getElementById('change-type').value;
      rule.urlPattern = document.getElementById('rule-url-pattern').value.trim();
      rule.method = document.getElementById('rule-method').value;
      rule.action = document.getElementById('rule-action').value;

      // 内容类型只对响应体规则有效
      if (rule.changeType === 'response-body' || rule.changeType === 'request-body') {
        rule.contentType = document.getElementById('rule-content-type').value.trim();
      }

      // 根据修改类型和操作类型收集具体数据
      if (rule.changeType === 'response-body') {
        switch (rule.action) {
          case 'replace':
            const replaceType = document.querySelector('input[name="replace-type"]:checked').value;
            if (replaceType === 'file') {
              rule.replaceWithFile = true;
              rule.filePath = document.getElementById('rule-file-path').value;
              rule.replaceContent = '';
            } else {
              rule.replaceWithFile = false;
              rule.filePath = '';
              rule.replaceContent = document.getElementById('rule-replace-content').value;
            }
            break;
          case 'modify':
            rule.modifyRules = [];
            const modifyItems = document.querySelectorAll('.modify-rule-item');
            modifyItems.forEach(item => {
              const find = item.querySelector('.find-input').value.trim();
              const replace = item.querySelector('.replace-input').value;
              if (find) {
                rule.modifyRules.push({ find, replace });
              }
            });
            break;
          case 'inject':
            rule.injectContent = document.getElementById('rule-inject-content').value;
            rule.injectPosition = document.getElementById('rule-inject-position').value;
            rule.injectTarget = document.getElementById('rule-inject-target').value.trim();
            break;
        }
      } else if (rule.changeType === 'request-headers') {
        rule.requestHeaders = {};
        const requestHeaderItems = document.querySelectorAll('#request-headers-group .header-item');
        requestHeaderItems.forEach(item => {
          const name = item.querySelector('.header-name-input').value.trim();
          const value = item.querySelector('.header-value-input').value.trim();
          if (name) {
            rule.requestHeaders[name] = value;
          }
        });
      } else if (rule.changeType === 'request-body') {
        rule.newUrl = document.getElementById('rule-new-url').value.trim();
      } else if (rule.changeType === 'response-headers') {
        if (rule.action === 'add-headers' || rule.action === 'modify-headers') {
          rule.responseHeaders = {};
          const responseHeaderItems = document.querySelectorAll('#response-headers-group .header-item');
          responseHeaderItems.forEach(item => {
            const name = item.querySelector('.header-name-input').value.trim();
            const value = item.querySelector('.header-value-input').value.trim();
            if (name) {
              rule.responseHeaders[name] = value;
            }
          });
        } else if (rule.action === 'remove-headers') {
          const removeHeadersValue = document.getElementById('rule-remove-headers').value.trim();
          rule.removeHeaders = removeHeadersValue ? removeHeadersValue.split(',').map(h => h.trim()) : [];
        }
      }
      break;

    case 'zip-implant':
      rule.zipImplant = document.getElementById('rule-zip-implant').value.trim();
      rule.urlZip = document.getElementById('rule-url-zip').value.trim();
      break;

    case 'answer-upload':
      rule.urlUpload = document.getElementById('rule-url-upload').value.trim();
      rule.serverLocate = document.getElementById('server-locate').value.trim();
      rule.uploadType = document.getElementById('upload-type').value;
      break;
  }

  return rule;
}

// 验证规则数据
function validateRule(rule) {
  if (!rule.name) {
    showToast('请输入规则名称', 'error');
    return false;
  }

  // 根据规则类型进行不同的验证
  switch (rule.type) {
    case 'content-change':
      return validateContentChangeRule(rule);
    case 'zip-implant':
      return validateZipImplantRule(rule);
    case 'answer-upload':
      return validateAnswerUploadRule(rule);
    // 兼容旧的规则类型
    case 'response':
    case 'request':
    case 'response-headers':
      return validateLegacyRule(rule);
    default:
      showToast('未知的规则类型', 'error');
      return false;
  }
}

// 验证内容修改规则
function validateContentChangeRule(rule) {
  // 验证URL模式是否为有效正则表达式
  if (rule.urlPattern) {
    try {
      new RegExp(rule.urlPattern);
    } catch (e) {
      showToast('URL匹配模式不是有效的正则表达式', 'error');
      return false;
    }
  }

  if (!rule.changeType) {
    showToast('请选择修改类型', 'error');
    return false;
  }

  if (!rule.action) {
    showToast('请选择操作类型', 'error');
    return false;
  }

  // 根据修改类型和操作类型验证具体内容
  if (rule.changeType === 'response-body') {
    switch (rule.action) {
      case 'replace':
        if (rule.replaceWithFile) {
          if (!rule.filePath) {
            showToast('请选择替换文件', 'error');
            return false;
          }
        } else {
          if (!rule.replaceContent && rule.replaceContent !== '') {
            showToast('请输入替换内容', 'error');
            return false;
          }
        }
        break;
      case 'modify':
        if (!rule.modifyRules || rule.modifyRules.length === 0) {
          showToast('请至少添加一条修改规则', 'error');
          return false;
        }
        // 验证正则表达式
        for (const modifyRule of rule.modifyRules) {
          try {
            new RegExp(modifyRule.find);
          } catch (e) {
            showToast(`修改规则中的查找内容不是有效的正则表达式: ${modifyRule.find}`, 'error');
            return false;
          }
        }
        break;
      case 'inject':
        if (!rule.injectContent) {
          showToast('请输入注入内容', 'error');
          return false;
        }
        if ((rule.injectPosition === 'before' || rule.injectPosition === 'after') && !rule.injectTarget) {
          showToast('请输入目标内容', 'error');
          return false;
        }
        break;
    }
  } else if (rule.changeType === 'request-headers') {
    if (!rule.requestHeaders || Object.keys(rule.requestHeaders).length === 0) {
      showToast('请至少添加一个请求头', 'error');
      return false;
    }
  } else if (rule.changeType === 'request-body') {
    if (!rule.newUrl) {
      showToast('请输入重定向URL', 'error');
      return false;
    }
  } else if (rule.changeType === 'response-headers') {
    if (rule.action === 'add-headers' || rule.action === 'modify-headers') {
      if (!rule.responseHeaders || Object.keys(rule.responseHeaders).length === 0) {
        showToast('请至少添加一个响应头', 'error');
        return false;
      }
    } else if (rule.action === 'remove-headers') {
      if (!rule.removeHeaders || rule.removeHeaders.length === 0) {
        showToast('请输入要删除的响应头', 'error');
        return false;
      }
    }
  }

  return true;
}

// 验证ZIP植入规则
function validateZipImplantRule(rule) {
  if (!rule.zipImplant) {
    showToast('请选择要植入的ZIP文件', 'error');
    return false;
  }

  if (!rule.urlZip) {
    showToast('请输入植入请求URL匹配部分', 'error');
    return false;
  }

  return true;
}

// 验证答案上传规则
function validateAnswerUploadRule(rule) {
  if (!rule.urlUpload) {
    showToast('请输入上传URL匹配部分', 'error');
    return false;
  }

  if (!rule.serverLocate) {
    showToast('请输入服务器位置', 'error');
    return false;
  }

  if (!rule.uploadType) {
    showToast('请选择上传类型', 'error');
    return false;
  }

  return true;
}

// 验证旧版规则（兼容性）
function validateLegacyRule(rule) {
  // 验证URL模式是否为有效正则表达式
  if (rule.urlPattern) {
    try {
      new RegExp(rule.urlPattern);
    } catch (e) {
      showToast('URL匹配模式不是有效的正则表达式', 'error');
      return false;
    }
  }

  // 根据规则类型和操作类型验证具体内容
  if (rule.type === 'response') {
    switch (rule.action) {
      case 'replace':
        if (rule.replaceWithFile) {
          if (!rule.filePath) {
            showToast('请选择替换文件', 'error');
            return false;
          }
        } else {
          if (!rule.replaceContent && rule.replaceContent !== '') {
            showToast('请输入替换内容', 'error');
            return false;
          }
        }
        break;
      case 'modify':
        if (!rule.modifyRules || rule.modifyRules.length === 0) {
          showToast('请至少添加一条修改规则', 'error');
          return false;
        }
        // 验证正则表达式
        for (const modifyRule of rule.modifyRules) {
          try {
            new RegExp(modifyRule.find);
          } catch (e) {
            showToast(`修改规则中的查找内容不是有效的正则表达式: ${modifyRule.find}`, 'error');
            return false;
          }
        }
        break;
      case 'inject':
        if (!rule.injectContent) {
          showToast('请输入注入内容', 'error');
          return false;
        }
        if ((rule.injectPosition === 'before' || rule.injectPosition === 'after') && !rule.injectTarget) {
          showToast('请输入目标内容', 'error');
          return false;
        }
        break;
    }
  } else if (rule.type === 'request') {
    switch (rule.action) {
      case 'modify-headers':
        if (!rule.requestHeaders || Object.keys(rule.requestHeaders).length === 0) {
          showToast('请至少添加一个请求头', 'error');
          return false;
        }
        break;
      case 'modify-url':
        if (!rule.newUrl) {
          showToast('请输入重定向URL', 'error');
          return false;
        }
        try {
          new URL(rule.newUrl);
        } catch (e) {
          showToast('重定向URL格式不正确', 'error');
          return false;
        }
        break;
    }
  } else if (rule.type === 'response-headers') {
    switch (rule.action) {
      case 'add-headers':
      case 'modify-headers':
        if (!rule.responseHeaders || Object.keys(rule.responseHeaders).length === 0) {
          showToast('请至少添加一个响应头', 'error');
          return false;
        }
        break;
      case 'remove-headers':
        if (!rule.removeHeaders || rule.removeHeaders.length === 0) {
          showToast('请输入要删除的响应头名称', 'error');
          return false;
        }
        break;
    }
  }

  return true;
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示提示消息
function showToast(message, type = 'info') {
  // 创建提示元素
  const toast = document.createElement('div');
  toast.className = `copy-toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // 显示提示
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  // 3秒后隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// 将函数暴露到全局作用域，供HTML中的onclick使用
window.toggleRule = toggleRule;
window.editRule = editRule;
window.deleteRule = deleteRule;
window.removeModifyRule = removeModifyRule;
window.removeHeader = removeHeader;

function initUpdateFeature() {
  const updateModal = document.getElementById('update-modal');
  const updateDownloadedModal = document.getElementById('update-downloaded-modal');
  const closeUpdate = document.getElementById('close-update');
  const updateCancel = document.getElementById('update-cancel');
  const updateConfirmBtn = document.getElementById('update-confirm-btn');
  const updateInstallLater = document.getElementById('update-install-later');
  const updateInstallNow = document.getElementById('update-install-now');

  if (closeUpdate) {
    closeUpdate.addEventListener('click', () => {
      updateModal.style.display = 'none';
    });
  }

  if (updateCancel) {
    updateCancel.addEventListener('click', () => {
      updateModal.style.display = 'none';
    });
  }

  if (updateConfirmBtn) {
    updateConfirmBtn.addEventListener('click', () => {
      window.electronAPI.updateConfirm();
      const progressContainer = document.getElementById('update-progress-container');
      const confirmBtn = document.getElementById('update-confirm-btn');
      const cancelBtn = document.getElementById('update-cancel');
      if (progressContainer) progressContainer.style.display = 'block';
      if (confirmBtn) confirmBtn.disabled = true;
      if (cancelBtn) cancelBtn.disabled = true;
    });
  }

  if (updateInstallLater) {
    updateInstallLater.addEventListener('click', () => {
      updateDownloadedModal.style.display = 'none';
    });
  }

  if (updateInstallNow) {
    updateInstallNow.addEventListener('click', () => {
      window.electronAPI.updateInstall();
    });
  }

  const updateNotificationBtn = document.getElementById('update-notification-btn');
  if (updateNotificationBtn) {
    updateNotificationBtn.addEventListener('click', () => {
      updateModal.style.display = 'flex';
    });
  }

  window.electronAPI.onUpdateAvailable((data) => {
    document.getElementById('update-version').textContent = data.version;
    document.getElementById('update-date').textContent = data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('zh-CN') : '未知';

    let releaseNotes = data.releaseNotes || '新版本已发布，请更新以获得最新功能。';
    if (typeof releaseNotes !== 'string') {
      if (Array.isArray(releaseNotes)) {
        releaseNotes = releaseNotes.join('\n');
      } else {
        releaseNotes = '新版本已发布，请更新以获得最新功能。';
      }
    }

    const notesElement = document.getElementById('update-notes');
    notesElement.innerHTML = releaseNotes.trim();

    const progressContainer = document.getElementById('update-progress-container');
    if (progressContainer) progressContainer.style.display = 'none';
    const confirmBtn = document.getElementById('update-confirm-btn');
    const cancelBtn = document.getElementById('update-cancel');
    if (confirmBtn) confirmBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;

    if (updateNotificationBtn) {
      updateNotificationBtn.style.display = 'flex';
    }

    updateModal.style.display = 'flex';
  });

  window.electronAPI.onUpdateNotAvailable((data) => {
    if (data && data.isDev) {
      return;
    }
    showToast('已是最新版本', 'info');
  });

  window.electronAPI.onUpdateDownloadProgress((data) => {
    const progressText = document.getElementById('update-progress-text');
    const progressSpeed = document.getElementById('update-progress-speed');
    const progressBarFill = document.getElementById('update-progress-bar-fill');

    if (progressText) {
      const percent = Math.round(data.percent || 0);
      progressText.textContent = `下载中: ${percent}%`;
    }

    if (progressSpeed) {
      if (data.bytesPerSecond) {
        const speed = formatBytes(data.bytesPerSecond);
        progressSpeed.textContent = speed + '/s';
      } else {
        progressSpeed.textContent = '';
      }
    }

    if (progressBarFill) {
      progressBarFill.style.width = `${data.percent || 0}%`;
    }
  });

  window.electronAPI.onUpdateDownloaded(() => {
    updateModal.style.display = 'none';
    updateDownloadedModal.style.display = 'flex';
  });

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// 处理替换类型切换
function handleReplaceTypeChange() {
  const replaceType = document.querySelector('input[name="replace-type"]:checked').value;
  const textArea = document.getElementById('rule-replace-content');
  const fileGroup = document.getElementById('file-replace-group');

  if (replaceType === 'file') {
    textArea.style.display = 'none';
    fileGroup.style.display = 'block';
  } else {
    textArea.style.display = 'block';
    fileGroup.style.display = 'none';
  }
}

// 自定义弹窗函数
let promptResolve = null;
let confirmResolve = null;

// 初始化自定义弹窗
function initCustomModals() {
  // 初始化提示弹窗
  const promptModal = document.getElementById('custom-prompt-modal');
  const promptTitle = document.getElementById('prompt-title');
  const promptMessage = document.getElementById('prompt-message');
  const promptInput = document.getElementById('prompt-input');
  const promptConfirm = document.getElementById('prompt-confirm');
  const promptCancel = document.getElementById('prompt-cancel');
  const closePrompt = document.getElementById('close-prompt');

  promptConfirm.addEventListener('click', () => {
    if (promptResolve) {
      promptResolve(promptInput.value);
      promptResolve = null;
    }
    promptModal.style.display = 'none';
  });

  promptCancel.addEventListener('click', () => {
    if (promptResolve) {
      promptResolve(null);
      promptResolve = null;
    }
    promptModal.style.display = 'none';
  });

  closePrompt.addEventListener('click', () => {
    if (promptResolve) {
      promptResolve(null);
      promptResolve = null;
    }
    promptModal.style.display = 'none';
  });

  // 初始化确认弹窗
  const confirmModal = document.getElementById('custom-confirm-modal');
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmOk = document.getElementById('confirm-ok');
  const confirmCancel = document.getElementById('confirm-cancel');
  const closeConfirm = document.getElementById('close-confirm');

  confirmOk.addEventListener('click', () => {
    if (confirmResolve) {
      confirmResolve(true);
      confirmResolve = null;
    }
    confirmModal.style.display = 'none';
  });

  confirmCancel.addEventListener('click', () => {
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
    confirmModal.style.display = 'none';
  });

  closeConfirm.addEventListener('click', () => {
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
    confirmModal.style.display = 'none';
  });

  // 点击弹窗外部关闭
  window.addEventListener('click', (event) => {
    if (event.target === promptModal) {
      if (promptResolve) {
        promptResolve(null);
        promptResolve = null;
      }
      promptModal.style.display = 'none';
    }
    if (event.target === confirmModal) {
      if (confirmResolve) {
        confirmResolve(false);
        confirmResolve = null;
      }
      confirmModal.style.display = 'none';
    }
  });
}

// 显示提示弹窗
function showPrompt(title, message, defaultValue = '') {
  return new Promise((resolve) => {
    promptResolve = resolve;

    const promptModal = document.getElementById('custom-prompt-modal');
    const promptTitle = document.getElementById('prompt-title');
    const promptMessage = document.getElementById('prompt-message');
    const promptInput = document.getElementById('prompt-input');

    promptTitle.textContent = title;
    promptMessage.textContent = message;
    promptInput.value = defaultValue;

    promptModal.style.display = 'flex';
    promptInput.focus();
  });
}

// 显示确认弹窗
function showConfirm(title, message) {
  return new Promise((resolve) => {
    confirmResolve = resolve;

    const confirmModal = document.getElementById('custom-confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');

    confirmTitle.textContent = title;
    confirmMessage.textContent = message;

    confirmModal.style.display = 'flex';
  });
}

// 页面加载完成后初始化自定义弹窗
document.addEventListener('DOMContentLoaded', () => {
  initCustomModals();
});
// 初始化规则集上传和下载弹窗
function initRulesetModals() {
  const uploadModal = document.getElementById('upload-ruleset-modal');
  const closeUpload = document.getElementById('close-upload-ruleset');
  const cancelUpload = document.getElementById('cancel-upload-ruleset');
  const uploadSubmit = document.getElementById('upload-ruleset-submit');

  const downloadModal = document.getElementById('download-ruleset-modal');
  const closeDownload = document.getElementById('close-download-ruleset');
  const cancelDownload = document.getElementById('cancel-download-ruleset');
  const getInfoBtn = document.getElementById('get-ruleset-info');
  const downloadApplyBtn = document.getElementById('download-apply-ruleset');

  closeUpload.addEventListener('click', () => {
    uploadModal.style.display = 'none';
    resetUploadForm();
  });

  cancelUpload.addEventListener('click', () => {
    uploadModal.style.display = 'none';
    resetUploadForm();
  });

  closeDownload.addEventListener('click', () => {
    downloadModal.style.display = 'none';
    resetDownloadForm();
  });

  cancelDownload.addEventListener('click', () => {
    downloadModal.style.display = 'none';
    resetDownloadForm();
  });

  uploadSubmit.addEventListener('click', () => {
    uploadRuleset();
  });

  getInfoBtn.addEventListener('click', () => {
    getRulesetInfo();
  });

  downloadApplyBtn.addEventListener('click', () => {
    downloadAndApplyRuleset();
  });

  window.addEventListener('click', (event) => {
    if (event.target === uploadModal) {
      uploadModal.style.display = 'none';
      resetUploadForm();
    }
    if (event.target === downloadModal) {
      downloadModal.style.display = 'none';
      resetDownloadForm();
    }
  });
}

// 上传规则集
async function uploadRuleset() {
  const name = document.getElementById('ruleset-name').value.trim();
  const description = document.getElementById('ruleset-description').value.trim();
  const author = document.getElementById('ruleset-author').value.trim();
  const selectedGroup = document.getElementById('upload-group-select').value;

  if (!name || !description || !author || !selectedGroup) {
    showToast('请填写所有必填字段并选择规则分组', 'error');
    return;
  }

  try {
    showUploadProgress(true);
    updateUploadProgress(0, '准备上传...');

    const allRules = await window.electronAPI.getResponseRules();

    let groupRules;
    if (selectedGroup === 'ungrouped') {
      groupRules = allRules.filter(rule => 
        rule.isGroup !== true && (!rule.group || rule.group === '')
      );
    } else {
      groupRules = allRules.filter(rule => 
        rule.isGroup !== true && rule.group === selectedGroup
      );
    }

    if (groupRules.length === 0) {
      showToast('选中的分组没有规则', 'error');
      showUploadProgress(false);
      return;
    }

    updateUploadProgress(30, '准备规则数据...');

    const cleanRules = groupRules.map(rule => {
      const cleanRule = { ...rule };
      delete cleanRule.group;
      delete cleanRule.groupId;
      delete cleanRule.isGroup;
      return cleanRule;
    });

    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('author', author);

    const rulesJson = JSON.stringify(cleanRules, null, 2);
    const jsonBlob = new Blob([rulesJson], { type: 'application/json' });
    formData.append('json', jsonBlob, `${name}.json`);

    updateUploadProgress(50, '上传中...');

    const response = await fetch('https://366.cyril.qzz.io/api/rulesets', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok && result.success) {
      updateUploadProgress(100, '上传成功！');
      showToast(`规则集上传成功！ID: ${result.data.id}`, 'success');

      setTimeout(() => {
        document.getElementById('upload-ruleset-modal').style.display = 'none';
        resetUploadForm();
      }, 2000);
    } else {
      throw new Error(result.message || '上传失败');
    }
  } catch (error) {
    console.error('上传规则集失败:', error);
    showToast(`上传失败: ${error.message}`, 'error');
    showUploadProgress(false);
  }
}

async function loadGroupsForUpload() {
  try {
    const rules = await window.electronAPI.getResponseRules();
    const groupSelect = document.getElementById('upload-group-select');

    groupSelect.innerHTML = '<option value="">请选择要上传的规则分组</option>';

    const groups = new Set();
    let hasUngrouped = false;

    rules.forEach(rule => {
      if (rule.group && rule.group.trim() !== '') {
        groups.add(rule.group);
      } else {
        hasUngrouped = true;
      }
    });

    if (hasUngrouped) {
      const option = document.createElement('option');
      option.value = 'ungrouped';
      option.textContent = '未分组';
      groupSelect.appendChild(option);
    }

    Array.from(groups).sort().forEach(group => {
      const option = document.createElement('option');
      option.value = group;
      option.textContent = group;
      groupSelect.appendChild(option);
    });

    if (groups.size === 0 && !hasUngrouped) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = '暂无规则分组';
      option.disabled = true;
      groupSelect.appendChild(option);
    }
  } catch (error) {
    console.error('加载规则分组失败:', error);
    showToast('加载规则分组失败', 'error');
  }
}

// 获取规则集信息
async function getRulesetInfo() {
  const rulesetId = document.getElementById('ruleset-id').value.trim();

  if (!rulesetId) {
    showToast('请输入规则集ID', 'error');
    return;
  }

  try {
    showDownloadProgress(true);
    updateDownloadProgress(50, '获取规则集信息...');

    const response = await fetch(`https://366.cyril.qzz.io/api/rulesets/${rulesetId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '获取规则集信息失败');
    }

    const result = await response.json();
    updateDownloadProgress(100, '信息获取成功！');

    displayRulesetInfo(result.data);

    document.getElementById('download-apply-ruleset').disabled = false;

    showToast('规则集信息获取成功', 'success');
    showDownloadProgress(false);

  } catch (error) {
    console.error('获取规则集信息失败:', error);
    showToast(`获取信息失败: ${error.message}`, 'error');
    showDownloadProgress(false);

    document.getElementById('ruleset-info').style.display = 'none';
    document.getElementById('download-apply-ruleset').disabled = true;
  }
}

// 显示规则集信息
function displayRulesetInfo(rulesetData) {
  document.getElementById('info-name').textContent = rulesetData.name || '未知';
  document.getElementById('info-description').textContent = rulesetData.description || '无描述';
  document.getElementById('info-author').textContent = rulesetData.author || '未知';
  document.getElementById('info-downloads').textContent = rulesetData.download_count || 0;

  const createdAt = rulesetData.created_at ? new Date(rulesetData.created_at).toLocaleString('zh-CN') : '未知';
  document.getElementById('info-created').textContent = createdAt;

  document.getElementById('ruleset-info').style.display = 'block';
}

// 下载并应用规则集
async function downloadAndApplyRuleset() {
  const rulesetId = document.getElementById('ruleset-id').value.trim();

  if (!rulesetId) {
    showToast('请输入规则集ID', 'error');
    return;
  }

  try {
    showDownloadProgress(true);
    updateDownloadProgress(0, '准备下载...');

    const response = await fetch(`https://366.cyril.qzz.io/api/rulesets/${rulesetId}/download?type=json`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '获取下载链接失败');
    }

    const result = await response.json();
    updateDownloadProgress(30, '正在下载JSON文件...');

    const fileResponse = await fetch(result.downloadUrl);
    if (!fileResponse.ok) {
      throw new Error('下载JSON文件失败');
    }

    const jsonText = await fileResponse.text();
    updateDownloadProgress(60, '解析规则数据...');

    let rules;
    try {
      rules = JSON.parse(jsonText);
      console.log('下载的规则数据:', rules);
      console.log('数据类型:', typeof rules);
      console.log('是否为数组:', Array.isArray(rules));
    } catch (parseError) {
      throw new Error(`JSON解析失败: ${parseError.message}`);
    }

    if (!Array.isArray(rules)) {
      console.error('规则数据不是数组格式:', rules);
      throw new Error('下载的规则数据格式不正确，期望数组格式');
    }

    if (rules.length === 0) {
      throw new Error('规则集为空');
    }

    const groups = rules.filter(item => item.isGroup === true);
    const actualRules = rules.filter(item => item.isGroup !== true);
    
    console.log('分组数据:', groups);
    console.log('规则数据:', actualRules);

    if (actualRules.length === 0) {
      throw new Error('规则集中没有有效的规则');
    }

    updateDownloadProgress(80, '应用规则...');

    if (window.electronAPI && window.electronAPI.importResponseRulesFromData) {
      const importResult = await window.electronAPI.importResponseRulesFromData(actualRules);
      console.log('导入结果:', importResult);
      if (importResult.success) {
        updateDownloadProgress(90, '检查ZIP文件...');

        try {
          const zipResponse = await fetch(`https://366.cyril.qzz.io/api/rulesets/${rulesetId}/download?type=zip`);
          if (zipResponse.ok) {
            const zipResult = await zipResponse.json();
            const zipFileResponse = await fetch(zipResult.downloadUrl);
            if (zipFileResponse.ok) {
              const zipBlob = await zipFileResponse.blob();

              const url = window.URL.createObjectURL(zipBlob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = zipResult.fileName;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);

              updateDownloadProgress(100, '完成！');
              showToast(`规则集应用成功！导入了 ${importResult.count} 条规则，ZIP文件已下载`, 'success');
            }
          } else {
            updateDownloadProgress(100, '完成！');
            showToast(`规则集应用成功！导入了 ${importResult.count} 条规则`, 'success');
          }
        } catch (zipError) {
          console.log('ZIP文件下载失败:', zipError);
          updateDownloadProgress(100, '完成！');
          showToast(`规则集应用成功！导入了 ${importResult.count} 条规则`, 'success');
        }

        loadResponseRules(); // 刷新规则列表
      } else {
        throw new Error(importResult.error || '规则应用失败');
      }
    } else {
      throw new Error('无法应用规则，请检查系统配置');
    }

    setTimeout(() => {
      document.getElementById('download-ruleset-modal').style.display = 'none';
      resetDownloadForm();
    }, 2000);

  } catch (error) {
    console.error('下载应用规则集失败:', error);
    showToast(`操作失败: ${error.message}`, 'error');
    showDownloadProgress(false);
  }
}

function showUploadProgress(show) {
  const progressDiv = document.getElementById('upload-progress');
  const submitBtn = document.getElementById('upload-ruleset-submit');
  const cancelBtn = document.getElementById('cancel-upload-ruleset');

  if (show) {
    if (progressDiv) progressDiv.style.display = 'block';
    if (submitBtn) submitBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
  } else {
    if (progressDiv) progressDiv.style.display = 'none';
    if (submitBtn) submitBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

function updateUploadProgress(percent, text) {
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
  if (progressText) {
    progressText.textContent = text;
  }
}

function showDownloadProgress(show) {
  const progressDiv = document.getElementById('download-progress');
  const getInfoBtn = document.getElementById('get-ruleset-info');
  const downloadApplyBtn = document.getElementById('download-apply-ruleset');
  const cancelBtn = document.getElementById('cancel-download-ruleset');

  if (show) {
    if (progressDiv) progressDiv.style.display = 'block';
    if (getInfoBtn) getInfoBtn.disabled = true;
    if (downloadApplyBtn) downloadApplyBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
  } else {
    if (progressDiv) progressDiv.style.display = 'none';
    if (getInfoBtn) getInfoBtn.disabled = false;
    if (downloadApplyBtn) downloadApplyBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

function updateDownloadProgress(percent, text) {
  const progressBar = document.getElementById('download-progress-bar');
  const progressText = document.getElementById('download-progress-text');

  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
  if (progressText) {
    progressText.textContent = text;
  }
}

function resetUploadForm() {
  document.getElementById('ruleset-name').value = '';
  document.getElementById('ruleset-description').value = '';
  document.getElementById('ruleset-author').value = '';
  document.getElementById('upload-group-select').value = '';
  showUploadProgress(false);
}

function resetDownloadForm() {
  document.getElementById('ruleset-id').value = '';
  document.getElementById('ruleset-info').style.display = 'none';
  document.getElementById('download-apply-ruleset').disabled = true;
  showDownloadProgress(false);
}
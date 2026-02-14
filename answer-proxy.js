const crypto = require('crypto');
const http = require('http')
const https = require('https')
const fs = require('fs-extra')
const StreamZip = require('node-stream-zip')
const Proxy = require('http-mitm-proxy').Proxy;
const proxy = new Proxy();
const zlib = require('zlib')
const path = require('path')
const { app } = require('electron')
const { v4: uuidv4 } = require('uuid')
const CertificateManager = require('./certificate-manager')
const appPath = app.isPackaged ? process.resourcesPath : __dirname;
const tempDir = path.join(appPath, 'temp');
const ansDir = path.join(appPath, 'answers');
const fileDir = path.join(appPath, 'file');
const rulesDir = path.join(app.getPath('userData'), 'response-rules');

class AnswerProxy {
  constructor() {
    this.downloadUrl = '';
    this.mainWindow = null;
    this.trafficCache = new Map();
    this.responseRules = [];
    this.certManager = new CertificateManager();
    this.bucketServer = null; // 本地词库HTTP服务器
    this.serverDatas = {}

    this.loadResponseRules();
  }

  findLocalFile(url) {
    const filepath = path.join(fileDir, url.split('/').pop() + '.zip');
    console.log(filepath)
    if (!fs.existsSync(filepath)) {
      console.log('未找到对应的本地文件，不更改请求')
      return {
        enabled: false
      }
    }
    const buffer = fs.readFileSync(filepath);
    const md5 = crypto.createHash('md5').update(buffer).digest('hex');
    const md5Base64 = Buffer.from(md5, 'hex').toString('base64');
    const size = buffer.length;
    return {
      enabled: true,
      zipPath: filepath,
      md5: md5,
      md5Base64: md5Base64,
      size: size
    }
  }

  // 导入压缩包到fileDir
  async importZipToDir(sourcePath) {
    try {
      // 确保fileDir存在
      fs.ensureDirSync(fileDir);

      // 检查源文件是否存在
      if (!fs.existsSync(sourcePath)) {
        throw new Error('源文件不存在');
      }

      // 获取文件名
      const fileName = path.basename(sourcePath);
      const destPath = path.join(fileDir, fileName);

      // 复制文件到fileDir
      fs.copyFileSync(sourcePath, destPath);

      return {
        success: true,
        message: `成功导入压缩包: ${fileName}`,
        path: destPath
      };
    } catch (error) {
      console.error('导入压缩包失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 安全的IPC发送函数
  safeIpcSend(channel, data) {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        // console.log(`发送IPC消息 [${channel}]:`, data);
        this.mainWindow.webContents.send(channel, data);
      } else {
        console.warn(`无法发送IPC消息 [${channel}]: 主窗口不可用`);
      }
    } catch (error) {
      console.error(`发送IPC消息失败 [${channel}]:`, error);
    }
  }

  // 加载响应体更改规则
  loadResponseRules() {
    try {
      fs.ensureDirSync(rulesDir);
      const rulesFile = path.join(rulesDir, 'rules.json');

      if (fs.existsSync(rulesFile)) {
        const rulesData = fs.readFileSync(rulesFile, 'utf-8');
        this.responseRules = JSON.parse(rulesData);
        console.log(`已加载 ${this.responseRules.length} 条响应体更改规则`);
      } else {
        this.responseRules = [];
      }
    } catch (error) {
      console.error('加载响应体更改规则失败:', error);
      this.responseRules = [];
    }
  }

  // 保存响应体更改规则
  saveResponseRules(rules = null) {
    try {
      fs.ensureDirSync(rulesDir);
      const rulesFile = path.join(rulesDir, 'rules.json');

      // 如果传入了规则数组，则使用传入的规则；否则使用当前规则
      const rulesToSave = rules !== null ? rules : this.responseRules;

      fs.writeFileSync(rulesFile, JSON.stringify(rulesToSave, null, 2), 'utf-8');
      console.log(`已保存 ${rulesToSave.length} 条响应体更改规则`);

      // 如果传入了规则数组，则更新当前规则
      if (rules !== null) {
        this.responseRules = rules;
      }

      return true;
    } catch (error) {
      console.error('保存响应体更改规则失败:', error);
      return false;
    }
  }

  // 获取所有规则
  getResponseRules() {
    console.log('AnswerProxy.getResponseRules() 被调用');
    console.log('当前规则数量:', this.responseRules ? this.responseRules.length : 'undefined');
    console.log('规则数据:', this.responseRules);
    return this.responseRules || [];
  }

  // 添加或更新规则
  saveRule(rule) {
    try {
      if (rule.id) {
        // 更新现有规则
        const index = this.responseRules.findIndex(r => r.id === rule.id);
        if (index !== -1) {
          this.responseRules[index] = { ...rule, updatedAt: new Date().toISOString() };
        }
      } else {
        // 添加新规则
        rule.id = uuidv4();
        rule.createdAt = new Date().toISOString();
        rule.updatedAt = new Date().toISOString();
        this.responseRules.push(rule);
      }

      return this.saveResponseRules();
    } catch (error) {
      console.error('保存规则失败:', error);
      return false;
    }
  }

  // 删除规则
  deleteRule(ruleId) {
    try {
      this.responseRules = this.responseRules.filter(r => r.id !== ruleId);
      return this.saveResponseRules();
    } catch (error) {
      console.error('删除规则失败:', error);
      return false;
    }
  }

  // 切换规则启用状态
  toggleRule(ruleId, enabled) {
    try {
      const rule = this.responseRules.find(r => r.id === ruleId);
      if (rule) {
        rule.enabled = enabled;
        rule.updatedAt = new Date().toISOString();
        return this.saveResponseRules();
      }
      return false;
    } catch (error) {
      console.error('切换规则状态失败:', error);
      return false;
    }
  }

  // 应用请求修改规则
  applyRequestHeadRules(url, method, headers) {
    try {
      for (const rule of this.responseRules) {
        if (!rule.enabled) continue;
        if (rule.type === 'content-change'){

        }
        else if (rule.type === 'zip-implant'){

        }
        else if (rule.type === 'answer-upload'){

        }
        else {
          console.log('未知规则类型:', rule.type);
          return {};
        }
      }
    } catch (error) {
      console.error('应用请求头修改规则失败:', error);
      return {};
    }
  }

  // 响应体解压缩工具函数
  decompressResponse(buffer, encoding) {
    return new Promise((resolve, reject) => {
      try {
        if (!encoding || encoding === 'identity') {
          // 无压缩，返回buffer和字符串
          resolve({
            buffer: buffer,
            text: buffer.toString('utf8')
          });
          return;
        }

        if (encoding.includes('gzip')) {
          zlib.gunzip(buffer, (err, result) => {
            if (err) {
              console.error('Gzip解压失败:', err);
              // 解压失败时返回原始内容
              resolve({
                buffer: buffer,
                text: buffer.toString('utf8')
              });
            } else {
              resolve({
                buffer: result,
                text: result.toString('utf8')
              });
            }
          });
        } else if (encoding.includes('deflate')) {
          zlib.inflate(buffer, (err, result) => {
            if (err) {
              console.error('Deflate解压失败:', err);
              resolve({
                buffer: buffer,
                text: buffer.toString('utf8')
              });
            } else {
              resolve({
                buffer: result,
                text: result.toString('utf8')
              });
            }
          });
        } else if (encoding.includes('br')) {
          // Brotli压缩
          zlib.brotliDecompress(buffer, (err, result) => {
            if (err) {
              console.error('Brotli解压失败:', err);
              resolve({
                buffer: buffer,
                text: buffer.toString('utf8')
              });
            } else {
              resolve({
                buffer: result,
                text: result.toString('utf8')
              });
            }
          });
        } else {
          // 未知压缩格式，直接返回
          console.log('未知压缩格式:', encoding)
          resolve({
            buffer: buffer,
            text: buffer.toString('utf8')
          });
        }
      } catch (error) {
        console.error('解压缩过程中出错:', error);
        resolve({
          buffer: buffer,
          text: buffer.toString('utf8')
        });
      }
    });
  }

  startProxyPromise() {
    return new Promise((resolve) => {
      proxy.onError(function (ctx, err) {
        console.error('代理出错:', err);
      });

      proxy.onRequest((ctx, callback) => {
        const protocol = "http"; // 不知道怎么检测http还是https
        const fullUrl = `${protocol}://${ctx.clientToProxyRequest.headers.host}${ctx.clientToProxyRequest.url}`;
        let requestInfo = {
          method: ctx.clientToProxyRequest.method,
          url: fullUrl,
          host: ctx.clientToProxyRequest.headers.host,
          timestamp: new Date().toISOString(),
          isHttps: false,
          requestHeaders: ctx.clientToProxyRequest.headers,
          uuid: uuidv4(),
        }
        let requestBody = [], responseBody = [];
        ctx.onRequestData((ctx, chunk, callback) => {
          requestBody.push(chunk)
          return callback(null, chunk);
        })
        ctx.onRequestEnd((ctx, callback) => {
          requestInfo.requestBody = Buffer.concat(requestBody).toString()
          return callback();
        })
        ctx.onResponse((ctx, callback) => {
          requestInfo.statusCode = ctx.serverToProxyResponse.statusCode;
          requestInfo.statusMessage = ctx.serverToProxyResponse.statusMessage;
          requestInfo.responseHeaders = ctx.serverToProxyResponse.headers;
          requestInfo.contentType = ctx.serverToProxyResponse.headers['content-type'];
          requestInfo.contentEncoding = ctx.serverToProxyResponse.headers['content-encoding'];
          requestInfo.isCompressed = !!requestInfo.contentEncoding;
          return callback();
        })
        ctx.onResponseData((ctx, chunk, callback) => {
          responseBody.push(chunk)
          return callback(null, chunk);
        })
        ctx.onResponseEnd(async (ctx, callback) => {
          const { buffer, text } = await this.decompressResponse(Buffer.concat(responseBody), ctx.serverToProxyResponse.headers['content-encoding']);
          const isJson = /application\/json/.test(requestInfo.contentType);
          const isFile = /application\/octet-stream|image/.test(requestInfo.contentType);
          if (isJson) {
            try {
              requestInfo.responseBody = JSON.stringify(JSON.parse(text), null, 2);
            } catch (e) {
              requestInfo.responseBody = text;
            }
          }
          else if (isFile) {
            if (requestInfo.responseHeaders["Content-Disposition"]) {
              requestInfo.responseBody = requestInfo.responseHeaders["Content-Disposition"].replaceAll('filename=', '').replaceAll('"', '')
            } else {
              requestInfo.responseBody = decodeURIComponent(fullUrl.match(/https?:\/\/[^\/]+\/(?:[^\/]+\/)*([^\/?]+)(?=\?|$)/)[1])
            }
          }
          else {
            requestInfo.responseBody = text;
          }
          requestInfo.bodySize = requestInfo.responseBody.length;
          this.safeIpcSend('traffic-log', requestInfo);
          requestInfo.originalResponse = buffer
          this.trafficCache.set(requestInfo.uuid, requestInfo);

          // 答案提取
          if (isFile && requestInfo.responseBody.includes('zip')) {
            fs.mkdirSync(tempDir, { recursive: true });
            fs.mkdirSync(ansDir, { recursive: true });
            const filePath = path.join(tempDir, requestInfo.responseBody)
            await this.downloadFileByUuid(requestInfo.uuid, filePath)
            await this.extractZipFile(filePath, ansDir)

            try {
              const shouldKeepCache = await this.mainWindow.webContents.executeJavaScript(`
                    localStorage.getItem('keep-cache-files') === 'true'
                  `);

              if (!shouldKeepCache) {
                await fs.unlink(filePath)
                await fs.rm(filePath.replace('.zip', ''), { recursive: true, force: true })
              }
            } catch (error) {
              await fs.unlink(filePath)
              await fs.rm(filePath.replace('.zip', ''), { recursive: true, force: true })
            }
          }

          return callback()
        })
        return callback();
      });

      proxy.listen({ host: '127.0.0.1', port: 5291 }, resolve);
    });
  }

  // 启动抓包代理
  async startProxy(mainWindow) {
    this.mainWindow = mainWindow;

    this.stopProxy();

    // 创建MITM代理实例
    await this.startProxyPromise();

    // 自动导入证书
    try {
      this.safeIpcSend('certificate-status', {
        status: 'importing',
        message: '正在检查并导入证书到受信任的根证书颁发机构...'
      });

      // 先尝试正常导入
      let certResult = await this.certManager.importCertificate();

      // 发送证书导入结果状态
      this.safeIpcSend('certificate-status', {
        status: certResult.status || (certResult.success ? 'success' : 'error'),
        message: certResult.message || certResult.error || '证书处理完成'
      });

      if (!certResult.success) {
        console.warn('证书导入失败，但代理将继续启动:', certResult.error);
      }
    } catch (error) {
      this.safeIpcSend('certificate-status', {
        status: 'error',
        message: '证书导入过程中发生错误: ' + error.message
      });
      console.warn('证书导入过程中发生错误，但代理将继续启动:', error);
    }

    // 启动本地词库HTTP服务器
    this.startBucketServer();

    console.log('万能答案获取代理服务器已启动: 127.0.0.1:5291');
    this.safeIpcSend('proxy-status', {
      running: true,
      message: '代理服务器已启动，请设置天学网客户端代理为 127.0.0.1:5291'
    });
  }

  stopProxy() {
    try {
      proxy.close();
      this.safeIpcSend('proxy-status', {
        running: false,
        message: '代理服务器已停止'
      });
      if (this.bucketServer) {
        try {
          this.bucketServer.close();
        } catch (e) {
          console.error('关闭词库HTTP服务器失败:', e);
        }
        this.bucketServer = null;
      }
    }
    catch (_) { }
  }

  startBucketServer() {
    if (this.bucketServer) return;

    try {
      this.bucketServer = http.createServer((req, res) => {
        try {
          if (req.method === 'GET') {
            if (!(req.url in this.serverDatas)) {
              res.writeHead(404, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ error: 'no bucket data' }));
              return;
            }

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(this.serverDatas[req.url]);
          } else {
            res.writeHead(404, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'not found' }));
          }
        } catch (e) {
          console.error('词库HTTP服务器处理请求失败:', e);
          try {
            res.writeHead(500, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'server error' }));
          } catch (_) { }
        }
      });

      this.bucketServer.listen(5290, '127.0.0.1', () => {
        console.log('本地服务器已启动: http://127.0.0.1:5290/');
      });
    } catch (e) {
      console.error('启动HTTP服务器失败:', e);
      this.bucketServer = null;
    }
  }

  // 解压ZIP文件
  async extractZipFile(zipPath, ansDir) {
    try {
      const extractDir = zipPath.replace('.zip', '');

      if (fs.existsSync(extractDir)) {
        fs.removeSync(extractDir);
      }

      fs.ensureDirSync(extractDir);

      const zip = new StreamZip.async({ file: zipPath });
      await zip.extract(null, extractDir);
      await zip.close();

      this.safeIpcSend('process-status', { status: 'processing', message: '正在分析文件结构...' });

      // 扫描所有解压的文件
      const fileStructure = this.scanDirectory(extractDir);

      // 发送文件结构到前端
      this.safeIpcSend('file-structure', {
        structure: fileStructure,
        extractDir: extractDir
      });

      // 查找并处理所有可能的答案文件
      const answerFiles = this.findAnswerFiles(extractDir);

      if (answerFiles.length > 0) {
        this.safeIpcSend('process-status', { status: 'processing', message: `找到 ${answerFiles.length} 个可能的答案文件，正在提取...` });

        let allAnswers = [];
        let processedFiles = [];
        let allFilesContent = []; // 存储所有文件内容

        for (const filePath of answerFiles) {
          try {
            // 读取文件内容
            const content = fs.readFileSync(filePath, 'utf-8');
            const relativePath = path.relative(extractDir, filePath);

            // 存储文件内容
            allFilesContent.push({
              file: relativePath,
              content: content
            });

            const answers = this.extractAnswersFromFile(filePath);
            if (answers.length > 0) {
              allAnswers = allAnswers.concat(answers.map(ans => ({
                ...ans,
                sourceFile: relativePath
              })));
              processedFiles.push({
                file: relativePath,
                answerCount: answers.length,
                success: true
              });
            } else {
              processedFiles.push({
                file: relativePath,
                answerCount: 0,
                success: false,
                error: '未找到答案数据'
              });
            }
          } catch (error) {
            processedFiles.push({
              file: path.relative(extractDir, filePath),
              answerCount: 0,
              success: false,
              error: error.message
            });
          }
        }

        // 发送处理结果
        this.safeIpcSend('files-processed', {
          processedFiles: processedFiles,
          totalAnswers: allAnswers.length
        });

        if (allAnswers.length > 0) {
          // 尝试合并correctAnswer.xml和paper.xml的数据
          const mergedAnswers = this.mergeAnswerData(allAnswers);

          // 保存所有答案到文件
          const answerFile = path.join(ansDir, `answers_${Date.now()}.json`);
          const answerText = JSON.stringify({
            answers: mergedAnswers,
            count: mergedAnswers.length,
            file: answerFile,
            processedFiles: processedFiles
          }, null, 2);

          fs.writeFileSync(answerFile, answerText, 'utf-8');

          this.safeIpcSend('answers-extracted', {
            answers: mergedAnswers,
            count: mergedAnswers.length,
            file: answerFile,
            processedFiles: processedFiles
          });
        } else {
          // 未找到有效答案数据时，展示所有文件内容
          const allContentFile = path.join(ansDir, `all_content_${Date.now()}.txt`);
          const allContentText = allFilesContent.map(item =>
            `文件: ${item.file}\n内容:\n${item.content}\n\n${'='.repeat(50)}\n\n`
          ).join('\n');

          fs.writeFileSync(allContentFile, allContentText, 'utf-8');

          this.safeIpcSend('no-answers-found', {
            message: '所有文件中都未找到有效的答案数据，已显示所有文件内容',
            file: allContentFile,
            filesContent: allFilesContent,
            processedFiles: processedFiles
          });
        }
      } else {
        this.safeIpcSend('process-error', { error: '未找到可能包含答案的文件' });
      }

    } catch (error) {
      this.safeIpcSend('process-error', { error: `解压失败: ${error.message}` });
    }
  }

  // 扫描目录结构
  scanDirectory(dirPath, maxDepth = 3, currentDepth = 0) {
    const result = {
      name: path.basename(dirPath),
      type: 'directory',
      path: dirPath,
      children: []
    };

    if (currentDepth >= maxDepth) {
      return result;
    }

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          result.children.push(this.scanDirectory(itemPath, maxDepth, currentDepth + 1));
        } else {
          result.children.push({
            name: item,
            type: 'file',
            path: itemPath,
            size: stats.size,
            ext: path.extname(item).toLowerCase()
          });
        }
      }
    } catch (error) {
      console.error(`扫描目录失败: ${dirPath}`, error);
    }

    return result;
  }

  // 查找可能包含答案的文件
  findAnswerFiles(dirPath) {
    const answerFiles = [];

    function searchFiles(dir) {
      try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            searchFiles(itemPath);
          } else {
            const ext = path.extname(item).toLowerCase();
            const name = item.toLowerCase();

            // 处理 XML、JSON、JS 和 TXT 文件
            if (ext === '.xml' || ext === '.json' || ext === '.js' || ext === '.txt') {
              // 特别关注包含 answer、paper、question 等关键词的文件
              if (name.includes('answer') || name.includes('paper') || name.includes('question') || name.includes('questionData')) {
                answerFiles.push(itemPath);
              }
            }
          }
        }
      } catch (error) {
        console.error(`搜索文件失败: ${dir}`, error);
      }
    }

    searchFiles(dirPath);
    return answerFiles;
  }

  // 从单个文件提取答案
  extractAnswersFromFile(filePath) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const content = fs.readFileSync(filePath, 'utf-8');

      // 根据文件类型选择不同的处理方法
      if (ext === '.json') {
        // JS文件可能是变量赋值形式，需要尝试提取变量内容
        return this.extractFromJSON(content, filePath);
      } else if (ext === '.js') {
        let jsonContent = content;
        // 尝试提取变量赋值语句
        const varMatch = content.match(/var\s+pageConfig\s*=\s*({.+?});?$/s);
        if (varMatch && varMatch[1]) {
          jsonContent = varMatch[1];
        }
        return this.extractFromJS(jsonContent, filePath);
      } else if (ext === '.xml') {
        return this.extractFromXML(content, filePath);
      } else if (ext === '.txt') {
        // 尝试从文本文件中提取答案
        return this.extractFromText(content, filePath);
      }

      return [];
    } catch (error) {
      console.error(`读取文件失败: ${filePath}`, error);
      return [];
    }
  }

  // 从JSON文件提取答案
  extractFromJSON(content, filePath) {
    const answers = [];

    try {
      let jsonData;

      // 首先尝试直接解析为JSON
      try {
        jsonData = JSON.parse(content);
      } catch (e) {
        return []
      }

      // 处理句子跟读题型
      if (jsonData.Data && jsonData.Data.sentences) {
        jsonData.Data.sentences.forEach((sentence, index) => {
          if (sentence.text && sentence.text.length > 2) {
            answers.push({
              question: `第${index + 1}题`,
              answer: sentence.text,
              content: `请朗读: ${sentence.text}`,
              pattern: 'JSON句子跟读模式'
            });
          }
        });
      }

      // 处理单词发音题型
      if (jsonData.Data && jsonData.Data.words) {
        jsonData.Data.words.forEach((word, index) => {
          if (word && word.length > 1) {
            answers.push({
              question: `第${index + 1}题`,
              answer: word,
              content: `请朗读单词: ${word}`,
              pattern: 'JSON单词发音模式'
            });
          }
        });
      }

      if (jsonData.questionObj) {
        const questionAnswers = this.parseQuestionFile(jsonData);
        answers.push(...questionAnswers);
      }

      if (Array.isArray(jsonData.answers)) {
        jsonData.answers.forEach((answer, index) => {
          if (answer && (typeof answer === 'string' || (typeof answer === 'object' && answer.content))) {
            answers.push({
              question: `第${index + 1}题`,
              answer: typeof answer === 'string' ? answer : (answer.content || answer.answer || ''),
              content: typeof answer === 'string' ? answer : (answer.content || answer.answer || ''),
              pattern: 'JSON答案数组模式'
            });
          }
        });
      }

      if (jsonData.questions) {
        jsonData.questions.forEach((question, index) => {
          if (question && question.answer) {
            answers.push({
              question: `第${index + 1}题`,
              answer: question.answer,
              content: `题目: ${question.question || '未知题目'}\n答案: ${question.answer}`,
              pattern: 'JSON题目模式'
            });
          }
        });
      }
    } catch (e) {
      return []
    }
    return answers;
  }

  parseQuestionFile(fileContent) {
    try {
      const config = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
      const questionObj = config.questionObj || {};

      // 1. 精确检测类型
      const detectedType = this.detectExactType(questionObj);

      // 2. 根据类型调用相应的解析器
      switch (detectedType) {
        case '听后选择':
          return this.parseChoiceQuestions(questionObj);
        case '听后回答':
          return this.parseAnswerQuestions(questionObj);
        case '听后转述':
          return this.parseRetellContent(questionObj);
        case '朗读短文':
          return this.parseReadingContent(questionObj);
        default:
          return this.parseFallback(questionObj);
      }

    } catch (error) {
      console.error(error)
      return [];
    }
  }

  // 精确的类型检测
  detectExactType(questionObj) {
    // 听后选择：有questions_list且包含options
    if ((questionObj.questions_list && questionObj.questions_list.length > 0 &&
      questionObj.questions_list[0].options && questionObj.questions_list[0].options.length > 0) ||
      (questionObj.options && questionObj.options.length > 0 && questionObj.answer_text)) {
      return '听后选择';
    }

    // 听后回答：有record_speak且包含work/show属性，或者questions_list中的record_speak有这些属性
    if (this.hasAnswerAttributes(questionObj)) {
      return '听后回答';
    }

    // 听后转述：有record_speak但没有work/show属性，且内容较长
    if (questionObj.record_speak && questionObj.record_speak.length > 0) {
      const firstItem = questionObj.record_speak[0];
      if (firstItem && !firstItem.work && !firstItem.show &&
        firstItem.content && firstItem.content.length > 100) {
        return '听后转述';
      }
    }

    // 朗读短文：有record_follow_read或者analysis中包含停顿符号
    if (questionObj.record_follow_read ||
      (questionObj.analysis && /\/\//.test(questionObj.analysis))) {
      return '朗读短文';
    }

    return '未知';
  }

  hasAnswerAttributes(questionObj) {
    // 检查顶层的record_speak
    if (questionObj.record_speak && questionObj.record_speak.length > 0) {
      const firstItem = questionObj.record_speak[0];
      if (firstItem && (firstItem.work === "1" || firstItem.work === 1 ||
        firstItem.show === "1" || firstItem.show === 1)) {
        return true;
      }
    }

    // 检查questions_list中的record_speak
    if (questionObj.questions_list && questionObj.questions_list.length > 0) {
      for (const question of questionObj.questions_list) {
        if (question.record_speak && question.record_speak.length > 0) {
          const firstRecord = question.record_speak[0];
          if (firstRecord && (firstRecord.work === "1" || firstRecord.work === 1 ||
            firstRecord.show === "1" || firstRecord.show === 1)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  // 解析听后选择题
  parseChoiceQuestions(questionObj) {
    const results = [];
    // 处理questions_list中的选择题
    if (questionObj.questions_list) {
      questionObj.questions_list.forEach((question, index) => {
        if (question.answer_text && question.options) {
          const correctOption = question.options.find(
            opt => opt.id === question.answer_text
          );
          if (correctOption) {
            results.push({
              question: `第${index + 1}题: ${question.question_text || '未知问题'}`,
              answer: `${question.answer_text}. ${correctOption.content?.trim() || ''}`,
              content: `请回答: ${question.answer_text}. ${correctOption.content?.trim() || ''}`,
              pattern: '听后选择'
            });
          }
        }
      });
    }

    // 处理单个选择题（没有questions_list但在顶层有options）
    if (results.length === 0 && questionObj.options && questionObj.options.length > 0 && questionObj.answer_text) {
      const correctOption = questionObj.options.find(
        opt => opt.id === questionObj.answer_text
      );
      if (correctOption) {
        // 清理问题文本中的HTML标签
        const cleanQuestionText = questionObj.question_text
          ? questionObj.question_text.replace(/<[^>]*>/g, '').trim()
          : '未知问题';

        results.push({
          question: `第1题: ${cleanQuestionText}`,
          answer: `${questionObj.answer_text}. ${correctOption.content?.trim() || ''}`,
          content: `请回答: ${questionObj.answer_text}. ${correctOption.content?.trim() || ''}`,
          pattern: '听后选择'
        });
      }
    }
    return results;
  }

  // 解析听后回答题
  parseAnswerQuestions(questionObj) {
    const results = [];

    // 处理questions_list中的回答
    if (questionObj.questions_list) {
      questionObj.questions_list.forEach((question, qIndex) => {
        if (question.record_speak) {
          const answers = question.record_speak
            .filter(item => item.show === "1" || item.show === 1)
            .map(item => item.content?.trim() || '')
            .filter(content => content && content !== '<answers/>');

          let messageInfo = {
            question: `第${qIndex + 1}题`,
            answer: question.question_text || '未知',
            content: `点击展开全部回答`,
            pattern: '听后回答',
            children: []
          }
          answers.forEach((answer, aIndex) => {
            messageInfo.children.push({
              question: `第${aIndex + 1}个答案`,
              answer: answer,
              content: `请回答: ${answer}`,
              pattern: '听后回答'
            });
          });
          results.push(messageInfo)
        }
      });
    }

    // 处理顶层的record_speak（单个问题的情况）
    if (questionObj.record_speak && results.length === 0) {
      const answers = questionObj.record_speak
        .filter(item => item.show === "1" || item.show === 1)
        .map(item => item.content?.trim() || '')
        .filter(content => content && content !== '<answers/>');

      let messageInfo = {
        question: `第1题`,
        answer: questionObj.question_text || '未知',
        content: `点击展开全部回答`,
        pattern: '听后回答',
        children: []
      }
      answers.forEach((answer, index) => {
        messageInfo.children.push({
          question: `第${index + 1}个答案`,
          answer: answer,
          content: `请回答: ${answer}`,
          pattern: '听后回答'
        });
      });
      results.push(messageInfo)
    }

    return results;
  }

  // 解析听后转述
  parseRetellContent(questionObj) {
    const results = [];

    if (questionObj.record_speak && questionObj.record_speak.length > 0) {
      questionObj.record_speak.forEach((item, itemIndex) => {
        if (item.content) {
          // 按换行符分割内容，每个段落作为一个答案
          const paragraphs = item.content.split('\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);

          paragraphs.forEach((paragraph, pIndex) => {
            results.push({
              question: `第${itemIndex + 1}题-${pIndex === 0 ? '原文' : `参考答案${pIndex}`}`,
              answer: paragraph,
              content: `请回答: ${paragraph}`,
              pattern: '听后转述'
            });
          });
        }
      });
    }

    return results;
  }

  // 解析朗读短文
  parseReadingContent(questionObj) {
    const results = [];

    // 优先从analysis中提取带停顿的文本
    if (questionObj.analysis) {
      const cleanAnalysis = questionObj.analysis
        .replace(/<[^>]*>/g, '') // 移除HTML标签
        .replace(/参考答案[一二]：/g, '') // 移除参考答案标记
        .trim();

      if (cleanAnalysis) {
        // 按句号分割但保留原文格式
        const sentences = cleanAnalysis.split(/[.!?]。/)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        sentences.forEach((sentence, index) => {
          results.push({
            question: `第${index + 1}题`,
            answer: sentence,
            content: `请回答: ${sentence}`,
            pattern: '朗读短文'
          });
        });
      }
    }

    // 如果没有analysis，从record_follow_read中提取
    if (results.length === 0 && questionObj.record_follow_read?.paragraph_list) {
      let sentenceCount = 1;
      questionObj.record_follow_read.paragraph_list.forEach((paragraph) => {
        if (paragraph.sentences) {
          paragraph.sentences.forEach((sentence) => {
            if (sentence.content_en) {
              results.push({
                question: `第${sentenceCount}题`,
                answer: sentence.content_en.trim(),
                content: `请回答: ${sentence.content_en.trim()}`,
                pattern: '朗读短文'
              });
              sentenceCount++;
            }
          });
        }
      });
    }

    return results;
  }

  // 备用解析方案
  parseFallback(questionObj) {
    const results = [];

    // 尝试从各种可能的位置提取答案
    if (questionObj.analysis) {
      const text = questionObj.analysis.replace(/<[^>]*>/g, '').trim();
      if (text) {
        results.push({
          question: '第1题',
          answer: text,
          content: `请回答: ${text}`,
          pattern: '分析内容'
        });
      }
    }

    return results;
  }

  extractFromJS(content, filePath) {
    try {
      let jsonData;

      // 首先尝试直接解析为JSON
      try {
        jsonData = JSON.parse(content);
      } catch (e) {
        console.log('无法解析JS文件，可能该文件为不支持的格式')
        return []
      }

      return this.parseQuestionFile(jsonData)
    } catch (error) {
      console.error(`解析JS文件失败: ${filePath}`, error);
      return [];
    }
  }

  // 从文本文件提取答案
  extractFromText(content, filePath) {
    const answers = [];

    try {
      // 尝试匹配常见的答案格式
      const answerPatterns = [
        /答案\s*[:：]\s*([^\n]+)/g,  // 答案: xxx
        /标准答案\s*[:：]\s*([^\n]+)/g, // 标准答案: xxx
        /正确答案\s*[:：]\s*([^\n]+)/g, // 正确答案: xxx
        /参考答案\s*[:：]\s*([^\n]+)/g, // 参考答案: xxx
        /\b[A-D]\b/g  // 单独的选项字母
      ];

      // 按行处理文本
      const lines = content.split('\n');
      let lineNum = 0;

      for (const line of lines) {
        lineNum++;

        // 尝试每个答案模式
        for (const pattern of answerPatterns) {
          const matches = [...line.matchAll(pattern)];

          if (matches.length > 0) {
            matches.forEach((match, index) => {
              if (match[1]) {
                answers.push({
                  question: `文本-${lineNum}-${index + 1}`,
                  answer: match[1].trim(),
                  content: `答案: ${match[1].trim()} (行: ${lineNum})`,
                  pattern: '文本答案模式'
                });
              }
            });
          }
        }

        // 处理单独的选项字母
        const optionMatches = [...line.matchAll(/\b([A-D])\b/g)];
        if (optionMatches.length > 0) {
          answers.push({
            question: `选项-${lineNum}`,
            answer: optionMatches.map(m => m[1]).join(''),
            content: `选项: ${optionMatches.map(m => m[1]).join('')} (行: ${lineNum})`,
            pattern: '文本选项模式'
          });
        }
      }

      return answers;
    } catch (error) {
      console.error(`解析文本文件失败: ${filePath}`, error);
      return [];
    }
  }

  // 合并答案数据
  mergeAnswerData(allAnswers) {
    try {
      // 分离correctAnswer.xml和paper.xml的数据
      const correctAnswers = allAnswers.filter(ans => ans.sourceFile === 'correctAnswer.xml');
      const paperQuestions = allAnswers.filter(ans => ans.sourceFile === 'paper.xml');

      // 如果两个文件都存在，尝试合并
      if (correctAnswers.length > 0 && paperQuestions.length > 0) {
        const mergedAnswers = [];
        let successfulMerges = 0;

        // 为每个正确答案找到对应的题目
        correctAnswers.forEach((correctAns, index) => {
          // 尝试通过elementId匹配（最准确）
          let matchingQuestion = paperQuestions.find(q => q.elementId === correctAns.elementId);

          // 如果elementId匹配失败，尝试通过题目编号匹配
          if (!matchingQuestion) {
            matchingQuestion = paperQuestions.find(q =>
              q.questionNo === (index + 1) ||
              q.question.includes(`第${index + 1}题`)
            );
          }

          if (matchingQuestion) {
            // 检查是否有选项的题目类型
            if (matchingQuestion.options && matchingQuestion.options.length > 0) {
              // 找到对应的正确选项
              const correctOption = matchingQuestion.options.find(opt =>
                opt.id === correctAns.answer
              );

              if (correctOption) {
                // 成功合并选择题，使用合并格式
                mergedAnswers.push({
                  question: `第${index + 1}题`,
                  questionText: matchingQuestion.answer.replace('题目: ', ''),
                  answer: correctAns.answer,
                  answerText: correctOption.text,
                  fullAnswer: `${correctAns.answer}. ${correctOption.text}`,
                  options: matchingQuestion.options,
                  analysis: correctAns.content.includes('解析:') ?
                    correctAns.content.split('解析: ')[1].split('\n答案:')[0] : '',
                  pattern: '合并答案模式',
                  sourceFiles: ['correctAnswer.xml', 'paper.xml']
                });
                successfulMerges++;
              } else {
                // 没有找到对应选项，使用普通格式
                mergedAnswers.push({
                  question: `第${index + 1}题`,
                  answer: correctAns.answer,
                  content: correctAns.content,
                  pattern: correctAns.pattern
                });
              }
            } else {
              // 没有选项的题目类型（如填空题、单词题等），直接合并
              mergedAnswers.push({
                question: `第${index + 1}题`,
                questionText: matchingQuestion.content.replace('题目: ', ''),
                answer: correctAns.answer,
                answerText: correctAns.answer,
                fullAnswer: correctAns.answer,
                analysis: correctAns.content.includes('解析:') ?
                  correctAns.content.split('解析: ')[1].split('\n答案:')[0] : '',
                pattern: '合并答案模式',
                sourceFiles: ['correctAnswer.xml', 'paper.xml']
              });
              successfulMerges++;
            }
          } else {
            // 没有找到匹配的题目，使用普通格式
            mergedAnswers.push({
              question: `第${index + 1}题`,
              answer: correctAns.answer,
              content: correctAns.content,
              pattern: correctAns.pattern
            });
          }
        });

        // 如果成功合并的数量太少（少于总数的50%），回退到普通模式
        if (successfulMerges < correctAnswers.length * 0.5) {
          console.log(`合并成功率过低 (${successfulMerges}/${correctAnswers.length})，回退到普通模式`);
          return allAnswers;
        }

        console.log(`成功合并 ${successfulMerges}/${correctAnswers.length} 个答案`);
        return mergedAnswers;
      }

      // 如果只有一个文件或无法合并，返回原始数据
      return allAnswers;
    } catch (error) {
      console.error('合并答案数据失败:', error);
      return allAnswers;
    }
  }



  // 从XML文件提取答案
  extractFromXML(content, filePath) {
    const answers = [];

    try {
      // 处理correctAnswer.xml文件
      if (filePath.includes('correctAnswer')) {
        // 提取所有element元素，包含id、analysis和answers
        const elementMatches = [...content.matchAll(/<element\s+id="([^"]+)"[^>]*>(.*?)<\/element>/gs)];

        elementMatches.forEach((elementMatch, index) => {
          const elementId = elementMatch[1];
          const elementContent = elementMatch[2];

          if (!elementContent.trim()) {
            return;
          }

          let analysisText = '';

          const analysisMatch = elementContent.match(/<analysis>\s*<!\[CDATA\[(.*?)]]>\s*<\/analysis>/s);
          if (analysisMatch && analysisMatch[1]) {
            analysisText = analysisMatch[1].replace(/<[^>]*>/g, '').trim();
          }

          const answersMatch = elementContent.match(/<answers>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/answers>/);
          if (answersMatch && answersMatch[1]) {
            const answerText = answersMatch[1].trim();
            answers.push({
              question: `第${answers.length + 1}题`,
              answer: answerText,
              content: analysisText ? `解析: ${analysisText}\n答案: ${answerText}` : `答案: ${answerText}`,
              pattern: 'XML正确答案模式',
              elementId: elementId
            });
          } else {
            const answerMatches = [...elementContent.matchAll(/<answer[^>]*>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/answer>/g)];

            if (answerMatches.length > 0) {
              answerMatches.forEach((answerMatch, answerIndex) => {
                const answerText = answerMatch[1].trim();
                if (answerText) {
                  answers.push({
                    question: `第${answers.length + 1}题`,
                    answer: answerText,
                    content: analysisText ? `解析: ${analysisText}\n答案: ${answerText}` : `答案: ${answerText}`,
                    pattern: 'XML正确答案模式',
                    elementId: elementId,
                    answerIndex: answerIndex + 1
                  });
                }
              });
            }
          }
        });
      }

      // 处理paper.xml文件
      if (filePath.includes('paper')) {
        const elementMatches = [...content.matchAll(/<element[^>]*id="([^"]+)"[^>]*>(.*?)<\/element>/gs)];

        elementMatches.forEach((elementMatch) => {
          const elementId = elementMatch[1];
          const elementContent = elementMatch[2];

          // 提取题目编号
          const questionNoMatch = elementContent.match(/<question_no>(\d+)<\/question_no>/);

          // 提取题目文本
          const questionTextMatch = elementContent.match(/<question_text>\s*<!\[CDATA\[(.*?)]]>\s*<\/question_text>/s);

          const knowledgeMatch = elementContent.match(/<knowledge>\s*<!\[CDATA\[([^\]]+)]]>\s*<\/knowledge>/);

          if (questionNoMatch && questionTextMatch) {
            const questionNo = parseInt(questionNoMatch[1]);
            let questionText = questionTextMatch[1];

            questionText = questionText.replace(/<img[^>]*>/g, '[音频]').replace(/<[^>]*>/g, '').trim();

            const optionsMatches = [...elementContent.matchAll(/<option\s+id="([^"]+)"\s*[^>]*>\s*<!\[CDATA\[(.*?)]]>\s*<\/option>/gs)];

            let answerInfo = {
              question: `第${questionNo}题`,
              answer: knowledgeMatch ? knowledgeMatch[1].trim() : '未找到答案',
              content: `题目: ${questionText}`,
              pattern: 'XML题目模式',
              elementId: elementId,
              questionNo: questionNo
            };

            if (optionsMatches.length > 0) {
              const optionsText = optionsMatches.map(optionMatch =>
                `${optionMatch[1]}. ${optionMatch[2].trim()}`
              ).join('\n');

              answerInfo.content = `题目: ${questionText}\n\n选项:\n${optionsText}`;
              answerInfo.pattern = 'XML题目选项模式';
              answerInfo.options = optionsMatches.map(optionMatch => ({
                id: optionMatch[1],
                text: optionMatch[2].trim()
              }));
            }

            answers.push(answerInfo);
          }
        });
      }

      return answers;
    } catch (error) {
      console.error(`解析XML文件失败: ${filePath}`, error);
      return [];
    }
  }
  async downloadFileByUuid(uuid, filePath) {
    const fileInfo = this.trafficCache.get(uuid);
    if (!fileInfo) {
      throw new Error('数据不存在');
    }

    let content = fileInfo.responseBody
    if (fileInfo.contentType && (fileInfo.contentType.includes('image') || fileInfo.contentType.includes('octet-stream'))) {
      await fs.promises.writeFile(filePath, fileInfo.originalResponse);
    } else {
      const textContent = typeof content === 'string' ? content : fileInfo.originalResponse.toString('utf-8');
      await fs.promises.writeFile(filePath, textContent, 'utf-8');
    }
  }
  async clearCache() {
    this.trafficCache.clear()
    try {
      const shouldKeepCache = await this.mainWindow.webContents.executeJavaScript(`
        localStorage.getItem('keep-cache-files') === 'true'
      `);

      if (!shouldKeepCache) {
        fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      fs.rm(tempDir, { recursive: true, force: true });
    }
  }
  getTrafficByUuid(uuid) {
    return this.trafficCache.get(uuid)
  }

  // 检查是否是文件信息请求
  isFileInfoRequest(url) {
    return url.includes('https://fs.up366.cn/fileinfo/');
  }

  // 检查是否是文件请求
  isFileRequest(url) {
    return url.includes('https://fs-v2.up366.cn/download/');
  }

  // 处理文件信息请求
  handleFileInfoRequest(url, clientReq, clientRes, requestOptions, ssl) {
    console.log(`检测到文件信息请求: ${url}`);

    const config = this.findLocalFile(url);
    if (!config.enabled) {
      const protocol = ssl ? https : http;
      try {
        const req = protocol.request(requestOptions, (res) => {
          Object.keys(res.headers).forEach(key => {
            try {
              clientRes.setHeader(key, res.headers[key]);
            } catch (e) {
            }
          });
          clientRes.writeHead(res.statusCode);
          res.pipe(clientRes);
        });
        req.on('error', (error) => {
          console.error('文件信息请求转发错误:', error);
          this.handleFileInfoError(clientRes, error);
        });
        if (clientReq.method === 'POST' || clientReq.method === 'PUT') {
          clientReq.pipe(req);
        } else {
          req.end();
        }
      } catch (error) {
        console.error('创建文件信息转发请求失败:', error);
        this.handleFileInfoError(clientRes, error);
      }
      return;
    }

    const protocol = ssl ? https : http;

    try {
      const req = protocol.request(requestOptions, (res) => {
        const chunks = [];

        res.on('data', (chunk) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          try {
            const responseBuffer = Buffer.concat(chunks);
            let responseBody = responseBuffer.toString('utf-8');

            console.log('修改文件信息响应中的MD5和大小');

            const md5 = config.md5 || '1ddb71ec870ca3a6fd22d6e6c8ac18f8';
            const size = config.size || 25329247;

            responseBody = responseBody.replace(/"filemd5":"[^"]+"/g, `"filemd5":"${md5}"`);
            responseBody = responseBody.replace(/"objectMD5":"[^"]+"/g, `"objectMD5":"${md5}"`);
            responseBody = responseBody.replace(/"filesize":\d+/g, `"filesize":${size}`);
            responseBody = responseBody.replace(/"objectSize":\d+/g, `"objectSize":${size}`);

            const modifiedBuffer = Buffer.from(responseBody, 'utf-8');

            Object.keys(res.headers).forEach(key => {
              try {
                if (key.toLowerCase() === 'content-length') {
                  clientRes.setHeader(key, modifiedBuffer.length);
                } else {
                  clientRes.setHeader(key, res.headers[key]);
                }
              } catch (e) {
              }
            });

            if (!clientRes.headersSent) {
              clientRes.writeHead(res.statusCode);
              clientRes.write(modifiedBuffer);
              clientRes.end();
            }

            this.safeIpcSend('pk-request-processed', {
              type: 'fileinfo',
              url: url,
              mode: 'simple'
            });

          } catch (error) {
            console.error('处理文件信息响应失败:', error);
            this.handleFileInfoError(clientRes, error);
          }
        });

        res.on('error', (error) => {
          console.error('文件信息请求响应错误:', error);
          this.handleFileInfoError(clientRes, error);
        });
      });

      req.on('error', (error) => {
        console.error('文件信息请求发送错误:', error);
        this.handleFileInfoError(clientRes, error);
      });

      req.on('timeout', () => {
        console.log('文件信息请求超时');
        req.destroy();
        this.handleFileInfoError(clientRes, new Error('文件信息请求超时'));
      });

      req.setTimeout(30000);

      if (clientReq.method === 'POST' || clientReq.method === 'PUT') {
        clientReq.on('data', (chunk) => {
          req.write(chunk);
        });

        clientReq.on('end', () => {
          req.end();
        });

        clientReq.on('error', (error) => {
          console.error('客户端请求流错误:', error);
          req.destroy();
          this.handleFileInfoError(clientRes, error);
        });
      } else {
        req.end();
      }

    } catch (error) {
      console.error('创建文件信息请求失败:', error);
      this.handleFileInfoError(clientRes, error);
    }
  }

  // 处理文件请求
  handleFileRequest(url, clientReq, clientRes, requestOptions, ssl) {
    console.log(`检测到文件请求: ${url}`);

    const config = this.findLocalFile(url);
    if (!config.enabled) {
      const protocol = ssl ? https : http;
      try {
        const req = protocol.request(requestOptions, (res) => {
          Object.keys(res.headers).forEach(key => {
            try {
              clientRes.setHeader(key, res.headers[key]);
            } catch (e) {
            }
          });
          clientRes.writeHead(res.statusCode);
          res.pipe(clientRes);
        });
        req.on('error', (error) => {
          console.error('文件请求转发错误:', error);
          this.handleFileInfoError({ clientRes }, error);
        });
        if (clientReq.method === 'POST' || clientReq.method === 'PUT') {
          clientReq.pipe(req);
        } else {
          req.end();
        }
      } catch (error) {
        console.error('创建文件转发请求失败:', error);
        this.handleFileInfoError({ clientRes }, error);
      }
      return;
    }

    this.handleFileRequestSimple(config, url, clientReq, clientRes, requestOptions, ssl);
  }

  // 处理文件请求
  async handleFileRequestSimple(config, url, clientReq, clientRes, requestOptions, ssl) {
    try {
      console.log('使用zip替换文件响应');

      const zipPath = config.zipPath;
      const md5 = config.md5;
      const size = config.size;
      const md5Base64 = config.md5Base64;

      if (!fs.existsSync(zipPath)) {
        throw new Error(`zip文件不存在: ${zipPath}`);
      }

      const zipBuffer = fs.readFileSync(zipPath);

      if (clientRes.destroyed) {
        console.log('客户端连接已断开');
        return;
      }

      try {
        clientRes.setHeader('Content-Type', 'application/zip');
        clientRes.setHeader('Content-Length', zipBuffer.length);
        clientRes.setHeader('ETag', `"${md5}"`);
        clientRes.setHeader('Content-MD5', md5Base64);
        clientRes.setHeader('Access-Control-Allow-Origin', '*');
        clientRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        clientRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      } catch (headerError) {
        console.error('设置响应头失败:', headerError);
      }

      if (!clientRes.headersSent) {
        clientRes.writeHead(200);
        clientRes.write(zipBuffer);
        clientRes.end();
      }

      this.safeIpcSend('pk-request-processed', {
        type: 'file',
        url: url,
        mode: 'auto'
      });

      this.safeIpcSend('pk-injection-success', {
        message: 'PK注入完成',
        url: url,
        newMd5: md5,
        newSize: size
      });

    } catch (error) {
      console.error('简单模式处理失败:', error);
      this.handleFileInfoError(clientRes, error);
    }
  }

  // 错误时释放请求
  handleFileInfoError(request, error) {
    try {
      if (!request.clientRes.headersSent) {
        request.clientRes.writeHead(500, { 'Content-Type': 'text/plain' });
        request.clientRes.end(`Proxy error: ${error.message}`);
      }
    } catch (e) {
      console.error('发送错误响应失败:', e);
    }
  }
  // 从数据中提取答案（简化版本，仅用于兼容性）
  extractAnswersFromData(data) {
    // 简化版本：直接返回原始数据
    return data;
  }
}

module.exports = AnswerProxy;
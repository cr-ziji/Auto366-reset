const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')
const fs = require('fs-extra')
const { createClient } = require('@supabase/supabase-js')

// 引入抓包代理类
const AnswerProxy = require('./answer-proxy');

let mainWindow
let updateInfo = null

process.on('uncaughtException', (error) => {
  if (error.code === 'ECONNRESET') {
    console.log('网络连接被重置，这可能是因为远程服务器主动关闭了连接');
    return;
  }

  console.error(error);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason.code === 'ECONNRESET') {
    console.log('网络连接被重置，这可能是因为远程服务器主动关闭了连接');
    return;
  }
  console.error(reason);
});

// 创建抓包代理实例
let answerProxy = new AnswerProxy();

const SUPABASE_URL = 'https://myenzpblosjnrtvicdor.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZW56cGJsb3NqbnJ0dmljZG9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NjAxMzAsImV4cCI6MjA4MzUzNjEzMH0.XkwQ72RmH8l1_krYc_IdPXsFk5pwL5JXQ3mDZ-ax3mU'
const SUPABASE_BUCKET = 'auto366-share'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'cyrilguocode',
  repo: 'Auto366'
})

autoUpdater.autoDownload = false

autoUpdater.on('update-available', (info) => {
  updateInfo = info
  if (mainWindow && !mainWindow.isDestroyed()) {
    let releaseNotes = '新版本已发布，请更新以获得最新功能。'
    if (info.releaseNotes) {
      if (typeof info.releaseNotes === 'string') {
        releaseNotes = info.releaseNotes
      } else if (info.releaseNotes.body) {
        releaseNotes = info.releaseNotes.body
      } else if (Array.isArray(info.releaseNotes)) {
        releaseNotes = info.releaseNotes.join('\n')
      }
    }
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: releaseNotes
    })
  }
})

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-download-progress', {
      percent: progressObj.percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    })
  }
})

autoUpdater.on('update-downloaded', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded')
  }
})

autoUpdater.on('error', (error) => {
  console.error('更新检查失败:', error)
})

ipcMain.on('update-confirm', async () => {
  if (updateInfo) {
    await autoUpdater.downloadUpdate()
  }
})

ipcMain.on('update-install', () => {
  autoUpdater.quitAndInstall(false, true)
})

ipcMain.on('check-for-updates', () => {
  if (!app.isPackaged) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available', { isDev: true })
    }
    return
  }
  autoUpdater.checkForUpdates().catch(error => {
    console.error('检查更新失败:', error)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available', { error: error.message })
    }
  })
})

autoUpdater.on('update-not-available', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-not-available', {})
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 1010,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: true,
    }
  })

  mainWindow.setMenu(null);

  mainWindow.loadFile('index.html')

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key === 'F12') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 所有链接都在外部浏览器打开
    shell.openExternal(url);
    return { action: 'deny' }; // 阻止在Electron中打开
  });
}

app.whenReady().then(async () => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(error => {
        console.error('检查更新失败:', error)
      })
    }, 3000)
  }
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// IPC事件处理 - 抓包代理相关
ipcMain.on('start-answer-proxy', async () => {
  await answerProxy.startProxy(mainWindow);
})

ipcMain.on('stop-answer-proxy', () => {
  answerProxy.stopProxy();
})

ipcMain.on('open-directory-choosing', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (!result.canceled) mainWindow.webContents.send('choose-directory', result.filePaths[0])
})

ipcMain.on('open-file-choosing', async () => {
  const result = await dialog.showOpenDialog({ 
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
      { name: 'Videos', extensions: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'] },
      { name: 'Archives', extensions: ['zip', 'rar', '7z', 'tar', 'gz'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'XML Files', extensions: ['xml'] },
      { name: 'HTML Files', extensions: ['html', 'htm'] }
    ]
  });
  if (!result.canceled) mainWindow.webContents.send('choose-file', result.filePaths[0])
})

ipcMain.on('open-implant-zip-choosing', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Zip Files', extensions: ['zip'] }
    ]
  });
  if (!result.canceled) mainWindow.webContents.send('choose-implant-zip', result.filePaths[0]);
})

// 响应体更改规则相关IPC处理
ipcMain.handle('get-response-rules', () => {
  try {
    console.log('收到 get-response-rules 请求');
    const rules = answerProxy.getResponseRules();
    console.log('返回规则数据:', rules);
    return rules;
  } catch (error) {
    console.error('获取响应规则失败:', error);
    throw error;
  }
});

ipcMain.handle('save-response-rule', (event, rule) => {
  return answerProxy.saveRule(rule);
});

ipcMain.handle('save-response-rules', (event, rules) => {
  return answerProxy.saveResponseRules(rules);
});

ipcMain.handle('delete-response-rule', (event, ruleId) => {
  return answerProxy.deleteRule(ruleId);
});

ipcMain.handle('toggle-response-rule', (event, ruleId, enabled) => {
  return answerProxy.toggleRule(ruleId, enabled);
});

ipcMain.handle('export-response-rules', async () => {
  const rules = answerProxy.getResponseRules();
  const result = await dialog.showSaveDialog({
    defaultPath: `response-rules-${new Date().toISOString().split('T')[0]}.json`,
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (!result.canceled) {
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(rules, null, 2), 'utf-8');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: '用户取消操作' };
});

ipcMain.handle('import-response-rules', async () => {
  const result = await dialog.showOpenDialog({
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    try {
      const rulesData = fs.readFileSync(result.filePaths[0], 'utf-8');
      const rules = JSON.parse(rulesData);

      if (Array.isArray(rules)) {
        // 为导入的规则生成新的ID
        const importedRules = rules.map(rule => ({
          ...rule,
          id: require('uuid').v4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        // 添加到现有规则中
        const currentRules = answerProxy.getResponseRules();
        answerProxy.responseRules = [...currentRules, ...importedRules];
        answerProxy.saveResponseRules();

        return { success: true, count: importedRules.length };
      } else {
        return { success: false, error: '无效的规则文件格式' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: '用户取消操作' };
});

ipcMain.handle('clear-cache', async () => {
  try {
    await answerProxy.clearCache()
    return 1;
  } catch (error) {
    return 0;
  }
});

ipcMain.handle('import-implant-zip', async (event, sourcePath) => {
  try {
    return await answerProxy.importZipToDir(sourcePath);
  } catch (error) {
    console.error('导入压缩包失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('download-file', async (event, uuid) => {
  let traffic = answerProxy.getTrafficByUuid(uuid)
  if (!traffic) return 0;
  let extension = `traffic_${traffic.timestamp.replace(/[:.]/g, '-')}.txt`;
  if (traffic.contentType) {
    if (traffic.contentType.includes('json')) {
      extension = `traffic_${traffic.timestamp.replace(/[:.]/g, '-')}.json`;
    } else if (traffic.contentType.includes('html')) {
      extension = `traffic_${traffic.timestamp.replace(/[:.]/g, '-')}.html`;
    } else if (traffic.contentType.includes('xml')) {
      extension = `traffic_${traffic.timestamp.replace(/[:.]/g, '-')}.xml`;
    } else if (traffic.contentType.includes('javascript')) {
      extension = `traffic_${traffic.timestamp.replace(/[:.]/g, '-')}.js`;
    } else if (traffic.contentType.includes('css')) {
      extension = `traffic_${traffic.timestamp.replace(/[:.]/g, '-')}.css`;
    } else if (traffic.contentType.includes('image')) {
      extension = `traffic_${traffic.timestamp.replace(/[:.]/g, '-')}.png`;
    } else if (traffic.contentType.includes('octet-stream')) {
      extension = traffic.responseBody;
    }
  }
  const result = await dialog.showSaveDialog({ defaultPath: extension });
  if (result.canceled) return -1;
  try {
    await answerProxy.downloadFileByUuid(uuid, result.filePath)
    return 1;
  } catch (error) {
    return 0;
  }
});

ipcMain.handle('share-answer-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }

    const fileName = path.basename(filePath);
    const fileExtension = path.extname(fileName);
    const timestamp = Date.now();
    const randomId = require('uuid').v4().substring(0, 8);
    const uniqueFileName = `${timestamp}_${randomId}${fileExtension}`;

    const fileBuffer = fs.readFileSync(filePath);

    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(uniqueFileName, fileBuffer, {
        contentType: 'application/json',
        upsert: false
      });

    if (error) {
      console.error('Supabase 上传错误:', error);
      return {
        success: false,
        error: `上传失败: ${error.message}`
      };
    }

    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(uniqueFileName);

    if (!urlData || !urlData.publicUrl) {
      return {
        success: false,
        error: '获取下载链接失败'
      };
    }

    return {
      success: true,
      fileId: data.path,
      downloadUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error('分享答案文件失败:', error);
    return {
      success: false,
      error: error.message || '上传失败'
    };
  }
});
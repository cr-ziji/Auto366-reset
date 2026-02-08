const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')

let cachePath = 'D:\\Up366StudentFiles'

contextBridge.exposeInMainWorld('electronAPI', {
  //答案获取相关API
  startAnswerProxy: () => ipcRenderer.send('start-answer-proxy'),
  stopAnswerProxy: () => ipcRenderer.send('stop-answer-proxy'),

  // 监听事件
  onProxyStatus: (callback) => ipcRenderer.on('proxy-status', callback),
  onProxyError: (callback) => ipcRenderer.on('proxy-error', callback),
  onTrafficLog: (callback) => ipcRenderer.on('traffic-log', callback),
  onResponseCaptured: (callback) => ipcRenderer.on('response-captured', callback),
  onResponseError: (callback) => ipcRenderer.on('response-error', callback),
  onImportantRequest: (callback) => ipcRenderer.on('important-request', callback),
  onDownloadFound: (callback) => ipcRenderer.on('download-found', callback),
  onProcessStatus: (callback) => ipcRenderer.on('process-status', callback),
  onProcessError: (callback) => ipcRenderer.on('process-error', callback),
  onAnswersExtracted: (callback) => ipcRenderer.on('answers-extracted', callback),
  onCaptureStatus: (callback) => ipcRenderer.on('capture-status', callback),
  onFileStructure: (callback) => ipcRenderer.on('file-structure', callback),
  onFilesProcessed: (callback) => ipcRenderer.on('files-processed', callback),
  onCertificateStatus: (callback) => ipcRenderer.on('certificate-status', callback),

  clearCache: () => ipcRenderer.invoke('clear-cache'),
  downloadFile: (uuid) => ipcRenderer.invoke('download-file', uuid),
  shareAnswerFile: (filePath) => ipcRenderer.invoke('share-answer-file', filePath),

  openDirectoryChoosing: () => ipcRenderer.send('open-directory-choosing'),
  chooseDirectory: (callback) => ipcRenderer.on('choose-directory', callback),
  
  openFileChoosing: () => ipcRenderer.send('open-file-choosing'),
  chooseFile: (callback) => ipcRenderer.on('choose-file', callback),
  openImplantZipChoosing: () => ipcRenderer.send('open-implant-zip-choosing'),
  chooseImplantZip: (callback) => ipcRenderer.on('choose-implant-zip', (event, filePath) => callback(filePath)),
  importImplantZip: (sourcePath) => ipcRenderer.invoke('import-implant-zip', sourcePath),
  setCachePath: (newPath) => {
    try {
      const normalizedPath = path.resolve(newPath);
      if (!fs.existsSync(normalizedPath)) {
        fs.mkdirSync(normalizedPath, { recursive: true });
      }
      cachePath = normalizedPath;
      return 1;
    } catch (error) {
      console.error('设置缓存路径失败:', error);
      return 0;
    }
  },

  // 响应体更改规则相关API
  getResponseRules: () => ipcRenderer.invoke('get-response-rules'),
  saveResponseRule: (rule) => ipcRenderer.invoke('save-response-rule', rule),
  deleteResponseRule: (ruleId) => ipcRenderer.invoke('delete-response-rule', ruleId),
  toggleResponseRule: (ruleId, enabled) => ipcRenderer.invoke('toggle-response-rule', ruleId, enabled),
  exportResponseRules: () => ipcRenderer.invoke('export-response-rules'),
  importResponseRules: () => ipcRenderer.invoke('import-response-rules'),

  // 更新相关API
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  updateConfirm: () => ipcRenderer.send('update-confirm'),
  updateInstall: () => ipcRenderer.send('update-install'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, data) => callback(data)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, data) => callback(data)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback)
})
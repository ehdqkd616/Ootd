'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onLog:    (cb) => ipcRenderer.on('log',    (_, e) => cb(e)),
  onStatus: (cb) => ipcRenderer.on('status', (_, e) => cb(e)),

  startService: (id) => ipcRenderer.send('start-service', id),
  stopService:  (id) => ipcRenderer.send('stop-service',  id),
  startAll:     ()   => ipcRenderer.send('start-all'),
  stopAll:      ()   => ipcRenderer.send('stop-all'),
  openBrowser:  ()   => ipcRenderer.send('open-browser'),

  getInitialState: () => ipcRenderer.invoke('get-initial-state'),
});

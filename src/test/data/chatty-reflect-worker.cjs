const { workerData, parentPort } = require('worker_threads')

parentPort.postMessage('huh')

parentPort.postMessage(workerData)

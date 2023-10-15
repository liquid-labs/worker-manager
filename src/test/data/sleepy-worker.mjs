import { parentPort } from 'worker_threads'

parentPort.postMessage('started')

for (let i = 0; i < 25; i += 1) {
  await new Promise(resolve => setTimeout(resolve, 10))
}

parentPort.postMessage('done')

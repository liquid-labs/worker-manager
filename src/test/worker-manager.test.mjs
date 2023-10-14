/* global describe expect test */
import * as fsPath from 'node:path'

import { WorkerManager, workerStatus } from '../worker-manager'

const chattyReflectWorkerPath = fsPath.join(__dirname, 'data', 'chatty-reflect-worker.cjs')

describe('WorkerManager', () => {
  test('getLastMessage reflect the last message sent by the worker', async () => {
    let result
    const workerData = 'hi!'
    const wm = new WorkerManager({ onMessage: (msg) => result = msg })

    const worker = wm.create({ runFile: chattyReflectWorkerPath, workerData })
    const { threadId } = worker
    for (let i = 0; i < 100; i += 1) {
      if (wm.getStatus(threadId) === workerStatus.DONE) {
        expect(wm.getLastMessage(threadId)).toEqual(workerData)
        break
      }

      await new Promise(r => setTimeout(r, 10));
    }
  })
})
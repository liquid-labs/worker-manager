/* global beforeAll describe expect test */
import * as fsPath from 'node:path'

import { WorkerManager, workerStatus } from '../worker-manager'

const chattyReflectWorkerPath = fsPath.join(__dirname, 'data', 'chatty-reflect-worker.cjs')
const errorWorkerPath = fsPath.join(__dirname, 'data', 'error-worker.cjs')
const sleepyWorkerPath = fsPath.join(__dirname, 'data', 'sleepy-worker.mjs')

describe('WorkerManager', () => {
  test('kills workers exceeding the timeout', async() => {
    let lastMessage
    const wm = new WorkerManager({ cleanInterval : 100, timeout : 5 })
    const { threadId } = wm.create({ runFile : sleepyWorkerPath, onMessage : (msg) => { lastMessage = msg } })
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(lastMessage).toBe('started')
    expect(wm.get(threadId)).toBe(undefined)
  })

  describe('on worker error', () => {
    let wm, threadId
    let errorMsg = ''
    let onErrorCalled = false

    const stderrMock = {
      write : (chunk) => { errorMsg += chunk }
    }

    beforeAll(async() => {
      wm = new WorkerManager({ stderr : stderrMock });
      ({ threadId } = wm.create({ onError : () => { onErrorCalled = true }, runFile : errorWorkerPath }))
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    test('getStatus() => ERROR', () => expect(wm.getStatus(threadId)).toBe(workerStatus.ERROR))

    test("calls 'onError' handler", () => expect(onErrorCalled).toBe(true))

    test('prints message to supplied stderr', () => expect(errorMsg).toMatch(/Ahh!/))
  })

  // TODO: I cannot figure out how to trigger this event...
  // describe('on message error', () => { })

  describe('create()', () => {
    test("adds 'acknowledge()' to worker which updates the worker data", () => {
      const wm = new WorkerManager()
      const worker = wm.create({ runFile : chattyReflectWorkerPath, workerData : 'ack' })
      worker.acknowledge()
      expect(wm.get(worker.threadId)?.acknowledged).toBe(true)
    })

    test("raises an error when no 'runfile' option specified", () => {
      const wm = new WorkerManager()

      expect(() => wm.create()).toThrow(/missing.*runFile/i)
    })

    test("'onOnline' option is invoked when the worker comes online", async() => {
      let online = false
      const wm = new WorkerManager()
      wm.create({ onOnline : () => { online = true }, runFile : chattyReflectWorkerPath, workerData : 'online' })
      expect(online).toBe(false)
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(online).toBe(true)
    })
  })

  describe('list()', () => {
    test('list a task once started', () => {
      const wm = new WorkerManager()
      const worker = wm.create({ runFile : chattyReflectWorkerPath, workerData : 'hi' })
      const { threadId } = worker
      expect(wm.list().some(({ threadId: testId }) => testId === threadId)).toBe(true)
    })
  })

  test("gathers 'msg' data automatically", async() => {
    const msg = 'do it!'
    const workerData = { msg }
    const wm = new WorkerManager()
    const worker = wm.create({ runFile : chattyReflectWorkerPath, workerData })
    const { threadId } = worker
    for (let i = 0; i < 100; i += 1) {
      if (wm.getStatus(threadId) === workerStatus.DONE) {
        expect(wm.get(threadId).actions).toEqual([msg])
        break
      }

      await new Promise(resolve => setTimeout(resolve, 10))
    }
  })

  test('getLastMessage() reflect the last message sent by the worker', async() => {
    const workerData = 'hi!'
    const wm = new WorkerManager()
    const worker = wm.create({ runFile : chattyReflectWorkerPath, workerData })
    const { threadId } = worker
    for (let i = 0; i < 100; i += 1) {
      if (wm.getStatus(threadId) === workerStatus.DONE) {
        expect(wm.getLastMessage(threadId)).toEqual(workerData)
        break
      }

      await new Promise(resolve => setTimeout(resolve, 10))
    }
  })

  test("calls 'onExit' on exit", async() => {
    let exitCode
    const workerData = 'hi!'
    const wm = new WorkerManager()
    const worker = wm.create({ onExit : (code) => { exitCode = code }, runFile : chattyReflectWorkerPath, workerData })
    const { threadId } = worker
    for (let i = 0; i < 100; i += 1) {
      if (wm.getStatus(threadId) === workerStatus.DONE) {
        expect(exitCode).toBe(0)
        break
      }

      await new Promise(resolve => setTimeout(resolve, 10))
    }
  })
})

import { Worker } from 'worker_threads'

const workerStatus = {
  DONE: 'done',
  ERROR: 'error',
  MESSAGE_ERROR: 'message error',
  NOT_STARTED: 'not started',
  STARTED: 'started'
}

Object.freeze(workerStatus)

const WorkerManager = class {
  #data = {}
  #workers = {}

  constructor({ 
    cleanInterval = 10 * 1000 /* 10 sec */, 
    timeout = 25 * 60 * 60 * 1000 /* a little over a day */ 
  } = {}) {
    // clean out completed, acknowledged tasks and too old tasks
    setInterval(() => {
      for (const threadId of Object.keys(this.#data)) {
        const workerData = this.#data[threadId]
        if ((workerData?.acknowledged === true && workerData?.running === false)
            || new Date().getTime() - workerData?.startTime > timeout) {
          this.#workers[threadId]?.terminate()
          this.remove(threadId)
        }
      }
    }, cleanInterval).unref()
  }

  create({
    runFile = throw new Error("Missing required 'runFile' arg when invoking WorkerManager.create()."),
    workerData,
    onError,
    onOnline,
    onMessage,
    onMessageError,
    onExit
  } = {}) {
    const worker = new Worker(runFile, { workerData })
    const { threadId } = worker
    worker.acknowledge = () => {
      const data = this.#data[threadId]
      if (data) {
        data.acknowledged = true
      }
    }
    worker.unref()

    this.#workers[threadId] = worker

    this.#data[threadId] = {
      threadId,
      startTime    : new Date().getTime(),
      endTime      : null,
      running      : false,
      status       : workerStatus.NOT_STARTED,
      lastMessage  : undefined,
      actions      : [],
      error        : undefined,
      exitCode     : undefined,
      acknowledged : false
    }

    worker.on('online', () => {
      const data = this.#data[threadId]
      if (data) {
        data.running = true
        data.status = workerStatus.STARTED
      }
      if (onOnline) {
        onOnline(worker)
      }
    })
    worker.on('error', (err) => {
      console.error(err) // TODO: we lose the stack trace in the 'err.toString()', but there are probaby better approaches
      const data = this.#data[threadId]
      if (data) {
        data.status = workerStatus.ERROR
        data.error = err.toString()
      }
      if (onError) {
        onError(err, worker)
      }
      worker.terminate()
    })
    worker.on('messageerror', (err) => {
      console.error(err) // TODO: we lose the stack trace in the 'err.toString()', but there are probaby better approaches
      const data = this.#data[threadId]
      if (data) {
        data.status = workerStatus.MESSAGE_ERROR
        data.error = err.toString()
      }
      if (onMessageError) {
        onMessageError(err, worker)
      }
    })
    worker.on('message', (msgData) => {
      const data = this.#data[threadId]
      data.lastMessage = msgData
      if (data) {
        const { msg } = msgData
        if (msg) {
          data.actions.push(msg)
        }
      }
      if (onMessage) {
        onMessage(msgData, worker)
      }
    })
    worker.on('exit', (code) => {
      const data = this.#data[threadId]
      if (data) {
        if (data.status === workerStatus.STARTED) {
          data.status = workerStatus.DONE
        } // else, it's an error condition so we leave it
        data.running = false
        data.exitCode = code
        data.endTime = new Date().getTime()
      }
      if (onExit) {
        onExit(code, worker)
      }
    })

    return worker
  } // end 'create'

  get(threadId) {
    return structuredClone(this.#data[threadId])
  }

  getLastMessage(threadId) { return structuredClone(this.#data[threadId]?.lastMessage) }

  getStatus(threadId) { return this.#data[threadId]?.status }

  list() {
    return Object.values(this.#data)
  }

  remove(threadId) {
    delete this.#workers[threadId]
    delete this.#data[threadId]
  }
}

export { WorkerManager, workerStatus }

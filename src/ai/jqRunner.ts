/**
 * Runs jq programs off the main thread with a hard wall-clock limit — the
 * browser's version of filing-ladder's forked child. jq evaluates to
 * completion and cannot be interrupted, and a model-written program can loop
 * forever (`repeat`, an unbounded `range`); in a Worker, a timeout terminates
 * the whole worker and the model gets a tool error it can recover from. The
 * next call spawns a fresh worker and reloads the document.
 *
 * The document text is posted once per worker and held there; each call
 * carries only the program. The worker is spawned on the first program, not
 * when the report loads, so opening a Tavi file costs nothing until asked.
 */
import { JQ_TIMEOUT_MS, timeoutPayload } from './runJq'
import { errorPayload } from './toolPayload'

export type JqWorkerRequest =
  { type: 'load'; text: string } | { type: 'run'; id: number; program: string }

export type JqWorkerResponse =
  | { type: 'ready' }
  | { type: 'failed'; message: string }
  | { type: 'result'; id: number; payload: string }

export interface JqRunner {
  /**
   * Run one program; resolves with the tool payload — an `{error}` payload,
   * never a rejection, for a jq-level failure or a timeout. Rejects only when
   * jq itself cannot be loaded.
   */
  run(program: string): Promise<string>
  /** Stop the worker and drop the document. */
  dispose(): void
}

export function workerJqRunner(text: string, timeoutMs = JQ_TIMEOUT_MS): JqRunner {
  let worker: Worker | null = null
  let ready: Promise<void> | null = null
  let nextId = 1
  const pending = new Map<number, (payload: string) => void>()

  /** Terminate the worker and answer every program in flight with `payload`. */
  const stop = (payload: string) => {
    worker?.terminate()
    worker = null
    ready = null
    for (const resolve of pending.values()) resolve(payload)
    pending.clear()
  }

  const spawn = (): Promise<void> => {
    const spawned = new Worker(new URL('./jqWorker.ts', import.meta.url), { type: 'module' })
    worker = spawned
    return new Promise<void>((resolve, reject) => {
      spawned.onmessage = (event: MessageEvent<JqWorkerResponse>) => {
        const message = event.data
        if (message.type === 'ready') {
          resolve()
        } else if (message.type === 'failed') {
          reject(new Error(message.message))
          stop(errorPayload(message.message))
        } else {
          pending.get(message.id)?.(message.payload)
          pending.delete(message.id)
        }
      }
      // A worker that dies mid-program (out of memory on an unbounded result)
      // fails what is in flight; the next call respawns.
      spawned.onerror = (event) => {
        const message = `jq worker error: ${event.message || 'the worker stopped'}`
        reject(new Error(message))
        stop(errorPayload(message))
      }
      spawned.postMessage({ type: 'load', text } satisfies JqWorkerRequest)
    })
  }

  return {
    async run(program) {
      if (!worker) ready = spawn()
      await ready
      const running = worker
      if (!running) return errorPayload('the jq worker is not running')
      const id = nextId++
      return new Promise<string>((resolve) => {
        const timer = setTimeout(() => stop(timeoutPayload(timeoutMs)), timeoutMs)
        pending.set(id, (payload) => {
          clearTimeout(timer)
          resolve(payload)
        })
        running.postMessage({ type: 'run', id, program } satisfies JqWorkerRequest)
      })
    },
    dispose() {
      stop(errorPayload('the report was closed'))
    },
  }
}

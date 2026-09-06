/**
 * The jq worker: loads jq-wasm once, holds the Tavi document text, and runs
 * one program per message. Off the main thread so a runaway program never
 * freezes the page, and killable — `jqRunner` terminates it on timeout.
 */
import { loadJq, type Jq } from 'jq-wasm'
import wasmUrl from 'jq-wasm/jq.wasm?url'
import type { JqWorkerRequest, JqWorkerResponse } from './jqRunner'
import { evaluateJq } from './runJq'
import { errorPayload } from './toolPayload'

interface WorkerScope {
  onmessage: ((event: MessageEvent<JqWorkerRequest>) => void) | null
  postMessage(message: JqWorkerResponse): void
}

// The DOM lib types `self` as a Window; this is a dedicated worker.
const scope = self as unknown as WorkerScope

let jq: Jq | null = null
let text = ''

scope.onmessage = async (event) => {
  const message = event.data
  if (message.type === 'load') {
    try {
      jq = await loadJq({ wasmURL: wasmUrl })
      text = message.text
      scope.postMessage({ type: 'ready' })
    } catch (e) {
      scope.postMessage({
        type: 'failed',
        message: `could not load jq: ${e instanceof Error ? e.message : String(e)}`,
      })
    }
    return
  }
  const payload = jq ? evaluateJq(jq, text, message.program) : errorPayload('jq is not loaded')
  scope.postMessage({ type: 'result', id: message.id, payload })
}

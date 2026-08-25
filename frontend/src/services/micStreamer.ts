/**
 * 마이크 오디오를 16kHz mono PCM16으로 실시간 변환해 콜백으로 넘겨주는 스트리머.
 * Deepgram 등 스트리밍 STT 서버가 요구하는 형식(linear16/16000Hz)에 맞춘다.
 * AudioWorklet을 Blob URL로 로드해 별도 빌드 파일 없이 동작한다.
 */

export interface MicStreamerHandle {
  stop(): void
}

const TARGET_SAMPLE_RATE = 16000
// 약 100ms 분량(1600샘플)이 모일 때마다 전송 — 지연과 오버헤드의 균형점
const MIN_CHUNK_SAMPLES = 1600

export async function startMicStreaming(
  stream: MediaStream,
  onChunk: (pcm: ArrayBuffer) => void,
): Promise<MicStreamerHandle> {
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)

  // AudioWorklet 코드: 8 quantum(~21ms)씩 모아 Float32 샘플을 메인 스레드로 전달
  const workletCode = `
    class CaptureProcessor extends AudioWorkletProcessor {
      constructor() { super(); this.buf = []; this.count = 0 }
      process(inputs) {
        const ch = inputs[0] && inputs[0][0]
        if (ch) { this.buf.push(ch.slice(0)); this.count += ch.length }
        if (this.count >= 1024) {
          const merged = new Float32Array(this.count)
          let off = 0
          for (const b of this.buf) { merged.set(b, off); off += b.length }
          this.port.postMessage(merged)
          this.buf = []; this.count = 0
        }
        return true
      }
    }
    registerProcessor('capture-processor', CaptureProcessor)
  `
  const blobUrl = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }))
  await ctx.audioWorklet.addModule(blobUrl)
  URL.revokeObjectURL(blobUrl)

  const node = new AudioWorkletNode(ctx, 'capture-processor')
  source.connect(node)
  // destination으로 연결하지 않는다 (모니터링 출력/하울링 방지)

  const ratio = ctx.sampleRate / TARGET_SAMPLE_RATE
  let pending: Float32Array[] = []
  let pendingLen = 0

  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    pending.push(e.data)
    pendingLen += e.data.length

    if (pendingLen / ratio < MIN_CHUNK_SAMPLES) return

    // 버퍼 합치기
    const merged = new Float32Array(pendingLen)
    let off = 0
    for (const p of pending) { merged.set(p, off); off += p.length }
    pending = []
    pendingLen = 0

    // 선형 보간 다운샘플 + Int16 변환
    const outSamples = Math.floor(merged.length / ratio)
    const pcm = new Int16Array(outSamples)
    for (let i = 0; i < outSamples; i++) {
      const pos = i * ratio
      const idx = Math.floor(pos)
      const frac = pos - idx
      const s0 = merged[idx] ?? 0
      const s1 = merged[idx + 1] ?? s0
      const v = (s0 + (s1 - s0) * frac) * 32767
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v)))
    }
    onChunk(pcm.buffer as ArrayBuffer)
  }

  return {
    stop() {
      try { node.disconnect(); source.disconnect(); ctx.close() } catch { /* noop */ }
    },
  }
}

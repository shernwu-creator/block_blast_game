import { describe, expect, it } from 'vitest'
import { SoundManager } from './SoundManager'

function createFakeAudioContext() {
  const events = []
  const oscillators = []

  class FakeParam {
    setValueAtTime(value, time) {
      events.push(['set', value, time])
      return this
    }

    exponentialRampToValueAtTime(value, time) {
      events.push(['ramp', value, time])
      return this
    }
  }

  class FakeNode {
    constructor(kind) {
      this.kind = kind
      this.frequency = new FakeParam()
      this.gain = new FakeParam()
      this.type = ''
    }

    connect(node) {
      events.push(['connect', this.kind, node?.kind ?? 'destination'])
      return node
    }

    start(time) {
      events.push(['start', this.kind, time])
    }

    stop(time) {
      events.push(['stop', this.kind, time])
    }
  }

  class FakeAudioContext {
    constructor() {
      this.state = 'suspended'
      this.currentTime = 1
      this.destination = { kind: 'destination' }
      this.resumeCalls = 0
    }

    resume() {
      this.resumeCalls += 1
      this.state = 'running'
      return Promise.resolve()
    }

    createOscillator() {
      const oscillator = new FakeNode('oscillator')
      oscillators.push(oscillator)
      return oscillator
    }

    createGain() {
      return new FakeNode('gain')
    }
  }

  const context = new FakeAudioContext()
  return { context, events, oscillators }
}

describe('SoundManager', () => {
  it('resumes a suspended context and synthesizes all three sounds', () => {
    const fake = createFakeAudioContext()
    const sound = new SoundManager(() => fake.context)

    sound.playDrop()
    sound.playClear()
    sound.playError()

    expect(fake.context.resumeCalls).toBe(1)
    expect(fake.context.state).toBe('running')
    expect(fake.oscillators.length).toBe(8)
    expect(fake.events.some(([type]) => type === 'start')).toBe(true)
    expect(fake.events.some(([type]) => type === 'connect')).toBe(true)
  })

  it('creates the context once when unlocked by the first gesture', () => {
    const fake = createFakeAudioContext()
    let factoryCalls = 0
    const sound = new SoundManager(() => {
      factoryCalls += 1
      return fake.context
    })

    sound.unlock()
    sound.unlock()
    sound.playDrop()

    expect(factoryCalls).toBe(1)
    expect(fake.context.state).toBe('running')
  })

  it('degrades silently when Web Audio is unavailable', () => {
    const sound = new SoundManager(() => null)
    expect(() => {
      sound.playDrop()
      sound.playClear()
      sound.playError()
    }).not.toThrow()
  })
})

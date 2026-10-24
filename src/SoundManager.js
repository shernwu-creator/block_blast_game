function createBrowserAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null

  try {
    return new AudioContextClass()
  } catch {
    return null
  }
}

/**
 * Tiny Web Audio synth for retro game feedback. All sounds are generated at
 * runtime, so the game ships without any audio assets.
 */
export class SoundManager {
  constructor(createContext = createBrowserAudioContext) {
    this.createContext = createContext
    this.context = null
  }

  /** Call from the first user gesture so later sounds never create a context. */
  unlock() {
    this.getContext()
  }

  getContext() {
    if (!this.context) {
      try {
        this.context = this.createContext()
      } catch {
        this.context = null
      }
    }

    if (
      this.context?.state === 'suspended' &&
      typeof this.context.resume === 'function'
    ) {
      try {
        const resumeResult = this.context.resume()
        if (resumeResult?.catch) resumeResult.catch(() => {})
      } catch {
        // A suspended context should be retried on the next interaction.
      }
    }

    return this.context
  }

  playTone({
    type = 'sine',
    frequency,
    endFrequency,
    duration,
    volume,
    delay = 0,
  }) {
    const context = this.getContext()
    if (!context) return

    try {
      const startTime = context.currentTime + delay
      const oscillator = context.createOscillator()
      const envelope = context.createGain()

      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, startTime)
      if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(
          endFrequency,
          startTime + duration * 0.82,
        )
      }

      envelope.gain.setValueAtTime(0.0001, startTime)
      envelope.gain.exponentialRampToValueAtTime(volume, startTime + 0.012)
      envelope.gain.exponentialRampToValueAtTime(
        0.0001,
        startTime + duration,
      )

      oscillator.connect(envelope)
      envelope.connect(context.destination)
      oscillator.start(startTime)
      oscillator.stop(startTime + duration + 0.02)
    } catch {
      // Audio feedback is optional and must never interrupt gameplay.
    }
  }

  /** Short, soft low-frequency pop for a successful placement. */
  playDrop() {
    this.playTone({
      type: 'sine',
      frequency: 185,
      endFrequency: 68,
      duration: 0.14,
      volume: 0.16,
    })
    this.playTone({
      type: 'triangle',
      frequency: 420,
      endFrequency: 240,
      duration: 0.055,
      volume: 0.035,
    })
  }

  /** Bright ascending arpeggio when one or more lines clear. */
  playClear() {
    const notes = [880, 1108.73, 1318.51, 1760]
    notes.forEach((frequency, index) => {
      this.playTone({
        type: 'triangle',
        frequency,
        duration: 0.34,
        volume: 0.055,
        delay: 0.035 + index * 0.065,
      })
    })
    this.playTone({
      type: 'sine',
      frequency: 2637.02,
      duration: 0.24,
      volume: 0.025,
      delay: 0.24,
    })
  }

  /** Dull low buzz for an invalid placement. */
  playError() {
    this.playTone({
      type: 'triangle',
      frequency: 128,
      endFrequency: 72,
      duration: 0.22,
      volume: 0.13,
    })
  }
}

export const soundManager = new SoundManager()

export default soundManager

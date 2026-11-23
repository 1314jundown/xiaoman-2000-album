/* ------------------------------------------------------------
   背景音乐：《小满的2000年》
   不用任何音频文件 —— 全部用 Web Audio 现场合成：
   八音盒（sin + 泛音、快速衰减）+ 温暖的和弦垫 + 一点低频根音，
   F 大调、62 BPM 的八小节循环，尽量贴近千禧年夏天的旧时光。
   这样可以精确控制音量/淡入淡出，也不会有任何版权与加载问题。
   ------------------------------------------------------------ */
(function () {
  'use strict';

  const BPM = 62
  const BEAT = 60 / BPM
  const BAR = BEAT * 4

  // 每小节：和弦垫（MIDI）、低音（MIDI）、八音盒旋律（8 个八分音符槽，0 = 休止）
  const BARS = [
    { pad: [53, 57, 60, 64], bass: 41, mel: [0, 0, 72, 0, 0, 0, 77, 0] },   // Fmaj7
    { pad: [55, 60, 64, 67], bass: 48, mel: [0, 74, 0, 0, 79, 0, 0, 0] },   // C
    { pad: [50, 57, 60, 65], bass: 38, mel: [0, 0, 72, 0, 77, 0, 0, 0] },   // Dm7
    { pad: [58, 62, 65, 69], bass: 46, mel: [0, 0, 70, 0, 74, 0, 0, 0] },   // Bbmaj7
    { pad: [53, 57, 60, 64], bass: 41, mel: [72, 0, 0, 0, 0, 0, 77, 0] },   // Fmaj7
    { pad: [55, 60, 64, 67], bass: 48, mel: [0, 76, 0, 0, 79, 0, 0, 0] },   // C
    { pad: [58, 62, 65, 69], bass: 46, mel: [0, 0, 74, 0, 77, 0, 72, 0] },  // Bbmaj7
    { pad: [55, 60, 64, 67], bass: 43, mel: [0, 0, 0, 0, 74, 0, 0, 0] },    // C（回 F）
  ]

  const VOLUME = { bell: 0.095, pad: 0.034, bass: 0.06, master: 1.45 }
  const LOOKAHEAD = 0.8

  const state = {
    ctx: null,
    master: null,
    reverb: null,
    timer: 0,
    barIndex: 0,
    nextBarTime: 0,
    playing: false,
    wakeLockHandler: null,
  }

  const freq = m => 440 * Math.pow(2, (m - 69) / 12)

  // 隐私模式 / file:// 下 localStorage 可能直接抛异常，这里统一兜住
  const store = {
    get(key) {
      try { return localStorage.getItem(key) } catch { return null }
    },
    set(key, value) {
      try { localStorage.setItem(key, value) } catch { /* 忽略 */ }
    },
  }

  function makeReverb(ctx) {
    const seconds = 2.6
    const frames = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, frames, ctx.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      let smooth = 0
      for (let i = 0; i < frames; i++) {
        const decay = Math.pow(1 - i / frames, 2.6)
        smooth = smooth * 0.72 + (Math.random() * 2 - 1) * 0.28
        data[i] = smooth * decay * 0.7
      }
    }
    const convolver = ctx.createConvolver()
    convolver.buffer = buffer
    const wet = ctx.createGain()
    wet.gain.value = 0.42
    convolver.connect(wet)
    return { node: convolver, wet }
  }

  function bell(ctx, when, midi, velocity) {
    const base = freq(midi)
    const out = ctx.createGain()
    out.gain.value = 0
    out.connect(state.master)
    out.connect(state.reverb.node)

    const partials = [
      { type: 'sine', ratio: 1, gain: 1 },
      { type: 'sine', ratio: 2.002, gain: 0.34 },
      { type: 'sine', ratio: 3.01, gain: 0.12 },
      { type: 'triangle', ratio: 4.99, gain: 0.05 },
    ]
    const end = when + 2.4
    partials.forEach(partial => {
      const osc = ctx.createOscillator()
      osc.type = partial.type
      osc.frequency.value = base * partial.ratio
      const amp = ctx.createGain()
      const peak = VOLUME.bell * velocity * partial.gain
      amp.gain.setValueAtTime(0.0001, when)
      amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + 0.008)
      amp.gain.exponentialRampToValueAtTime(0.0001, when + 1.1 + 1.3 / partial.ratio)
      osc.connect(amp)
      amp.connect(out)
      osc.start(when)
      osc.stop(end)
    })
    out.gain.setValueAtTime(1, when)
    return end
  }

  function pad(ctx, when, midis, duration) {
    const end = when + duration + 1.6
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 880
    filter.Q.value = 0.4
    filter.connect(state.master)
    filter.connect(state.reverb.node)

    midis.forEach(midi => {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = freq(midi)
      osc.detune.value = (Math.random() - 0.5) * 6
      const amp = ctx.createGain()
      const peak = VOLUME.pad
      amp.gain.setValueAtTime(0.0001, when)
      amp.gain.exponentialRampToValueAtTime(peak, when + 0.9)
      amp.gain.setValueAtTime(peak, when + duration * 0.6)
      amp.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(amp)
      amp.connect(filter)
      osc.start(when)
      osc.stop(end)
    })
    return end
  }

  function bass(ctx, when, midi, duration) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq(midi)
    const amp = ctx.createGain()
    const peak = VOLUME.bass
    const end = when + duration + 0.9
    amp.gain.setValueAtTime(0.0001, when)
    amp.gain.exponentialRampToValueAtTime(peak, when + 0.06)
    amp.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(amp)
    amp.connect(state.master)
    osc.start(when)
    osc.stop(end + 0.05)
  }

  function scheduleBar(ctx, index, when) {
    const bar = BARS[index % BARS.length]
    pad(ctx, when, bar.pad, BAR)
    bass(ctx, when, bar.bass, BAR * 0.9)
    bar.mel.forEach((midi, slot) => {
      if (!midi) return
      const at = when + slot * BEAT * 0.5
      // 轻微的时值起伏，避免听起来像节拍器
      const jitter = (Math.random() - 0.5) * 0.012
      bell(ctx, Math.max(at + jitter, ctx.currentTime + 0.01), midi, 0.9 - slot * 0.02)
    })
  }

  function tick() {
    const ctx = state.ctx
    if (!ctx || !state.playing) return
    while (state.nextBarTime < ctx.currentTime + LOOKAHEAD) {
      scheduleBar(ctx, state.barIndex, Math.max(state.nextBarTime, ctx.currentTime + 0.05))
      state.nextBarTime += BAR
      state.barIndex += 1
    }
  }

  function build(ctx) {
    state.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -14
    limiter.ratio.value = 4
    limiter.attack.value = 0.01
    limiter.release.value = 0.3
    master.connect(limiter)
    limiter.connect(ctx.destination)
    state.master = master
    const reverb = makeReverb(ctx)
    reverb.wet.connect(master)
    state.reverb = reverb
  }

  function start(externalContext) {
    try {
      let ctx = externalContext || state.ctx
      if (!ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return false
        ctx = new Ctx()
      }
      if (ctx.state === 'suspended') ctx.resume()
      if (state.ctx !== ctx) build(ctx)
      if (state.playing) {
        state.master.gain.setTargetAtTime(VOLUME.master, ctx.currentTime, 0.4)
        return true
      }
      state.playing = true
      state.barIndex = 0
      state.nextBarTime = ctx.currentTime + 0.3
      state.master.gain.cancelScheduledValues(ctx.currentTime)
      state.master.gain.setValueAtTime(Math.max(state.master.gain.value, 0.0001), ctx.currentTime)
      state.master.gain.setTargetAtTime(VOLUME.master, ctx.currentTime, 1.1)
      tick()
      state.timer = window.setInterval(tick, 200)
      store.set('xiaoman.music', 'on')
      return true
    } catch (error) {
      console.warn('[music] 无法开始播放', error)
      state.playing = false
      return false
    }
  }

  function stop() {
    const ctx = state.ctx
    state.playing = false
    if (state.timer) {
      window.clearInterval(state.timer)
      state.timer = 0
    }
    if (!ctx) return
    try {
      state.master.gain.cancelScheduledValues(ctx.currentTime)
      state.master.gain.setTargetAtTime(0, ctx.currentTime, 0.35)
    } catch (error) {
      /* 忽略 */
    }
    store.set('xiaoman.music', 'off')
  }

  function toggle(externalContext) {
    if (state.playing) {
      stop()
      return false
    }
    return start(externalContext)
  }

  function preferred() {
    return store.get('xiaoman.music') !== 'off'
  }

  // 切到后台时安静下来，回来再淡入
  document.addEventListener('visibilitychange', () => {
    const ctx = state.ctx
    if (!ctx) return
    try {
      if (document.hidden) {
        state.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25)
      } else if (state.playing) {
        state.master.gain.setTargetAtTime(VOLUME.master, ctx.currentTime, 0.9)
      }
    } catch (error) {
      /* 忽略 */
    }
  })

  // 离开页面就停止排期，避免 bfcache 恢复后残留旧计时器
  window.addEventListener('pagehide', () => {
    state.playing = false
    if (state.timer) {
      window.clearInterval(state.timer)
      state.timer = 0
    }
  })

  window.bookMusic = {
    start,
    stop,
    toggle,
    preferred,
    isPlaying: () => state.playing,
    masterNode: () => state.master,
    context: () => state.ctx,
  }
})()

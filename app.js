const pageImages = [
  'public/pages/scene-01.webp',
  'public/pages/scene-02.webp',
  'public/pages/scene-03.webp',
  'public/pages/scene-04.webp',
  'public/pages/scene-05.webp',
  'public/pages/scene-06.webp',
  'public/pages/scene-07.webp',
  'public/pages/scene-08.webp',
  'public/pages/scene-09.webp',
  'public/pages/scene-10.webp',
  'public/pages/scene-11.webp',
  'public/pages/scene-12.webp',
  'public/pages/scene-13.webp',
  'public/pages/scene-14.webp',
  'public/pages/scene-15.webp',
  'public/pages/scene-16.webp',
  'public/pages/blank.svg',
  'public/pages/scene-18.webp',
]

// 每一组跨页对应一条章节文案：一组跨页 = 两张内页（pageImages[2n] / [2n + 1]）。
const chapters = [
  { index: '序', title: '千禧年的早晨' },
  { index: '壹', title: '背着书包的那些天' },
  { index: '贰', title: '小卖部的发卡' },
  { index: '叁', title: '铁盒里的秘密' },
  { index: '肆', title: '雨中的奔跑' },
  { index: '伍', title: '给你留着呢' },
  { index: '陆', title: '不用说出口' },
  { index: '柒', title: '爱不会过期' },
  { index: '尾', title: '封底 · 很多年以后' },
]

const book = document.querySelector('#book')
const experience = document.querySelector('#experience')
const openButton = document.querySelector('#openButton')
const prevButton = document.querySelector('#prevButton')
const nextButton = document.querySelector('#nextButton')
const fullscreenButton = document.querySelector('#fullscreenButton')
const soundButton = document.querySelector('#soundButton')
const coverPanel = document.querySelector('#coverPanel')
const spread = document.querySelector('#spread')
const turner = document.querySelector('#pageTurner')
const turnFront = document.querySelector('#turnFront')
const turnBack = document.querySelector('#turnBack')
const leftPage = document.querySelector('#leftPage')
const rightPage = document.querySelector('#rightPage')
const spreadCaption = document.querySelector('#spreadCaption')
const chapterIndex = document.querySelector('#chapterIndex')
const chapterTitle = document.querySelector('#chapterTitle')
const book3d = document.querySelector('#book3d')
const progressLabel = document.querySelector('#progressLabel')
const pageLabel = document.querySelector('#pageLabel')
const progressFill = document.querySelector('#progressFill')
const statusText = document.querySelector('#statusText')
const cursorDot = document.querySelector('.cursor-dot')
const cursorRing = document.querySelector('.cursor-ring')

const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

let isOpen = false
let leftIndex = 0
let rightIndex = 1
let turnState = null
let isAnimating = false
const totalPages = pageImages.length + 1
const spreadTotal = Math.ceil(pageImages.length / 2)

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function updateUi() {
  if (!isOpen) {
    progressLabel.textContent = '封面'
    pageLabel.textContent = `${pad(1)} / ${pad(totalPages)}`
    progressFill.style.width = '6%'
    statusText.textContent = '点击封面开始 · ← 回到封面'
    return
  }

  const spreadNumber = Math.floor(leftIndex / 2) + 1
  progressLabel.textContent = `第 ${spreadNumber} / ${spreadTotal} 组`
  pageLabel.textContent = `${pad(leftIndex + 2)}–${pad(rightIndex + 2)} / ${pad(totalPages)}`
  progressFill.style.width = `${clamp((spreadNumber / spreadTotal) * 100, 8, 100)}%`
  statusText.textContent = window.innerBook && !window.innerBook.ready
    ? '正在准备纸张…'
    : (leftIndex === 0 ? '拖住页面边缘翻页 · ← 回到封面' : '拖住页面边缘翻页')
}

function renderSpread() {
  leftPage.src = pageImages[leftIndex]
  rightPage.src = pageImages[rightIndex]
  leftPage.alt = `《小满的2000年》内页 ${leftIndex + 1}`
  rightPage.alt = `《小满的2000年》内页 ${rightIndex + 1}`
  updateCaption()
  updateUi()
}

let captionTimer = 0
let captionShown = false
function updateCaption() {
  const chapter = chapters[Math.min(Math.floor(leftIndex / 2), chapters.length - 1)] || chapters[0]
  const apply = () => {
    chapterIndex.textContent = chapter.index
    chapterTitle.textContent = chapter.title
    spreadCaption.classList.remove('is-swapping')
  }
  window.clearTimeout(captionTimer)
  // 标签还没真正露面时（刚开书）没有旧文字可交叉淡出，直接落字：
  // 否则一旦主线程被 WebGL 首帧卡住，170ms 的计时器会被推迟，标签会停在透明状态。
  if (!captionShown) {
    apply()
    return
  }
  if (chapterTitle.textContent === chapter.title) {
    spreadCaption.classList.remove('is-swapping')
    return
  }
  spreadCaption.classList.add('is-swapping')
  captionTimer = window.setTimeout(apply, 170)
}

function openBook() {
  if (isOpen) return
  isOpen = true
  leftIndex = 0
  rightIndex = 1
  book.classList.remove('is-cover')
  book.classList.add('is-open')
  document.body.classList.add('reader-open')
  markActivity()
  coverPanel.setAttribute('aria-hidden', 'true')
  stopCoverLoop()
  unlockAudio()
  pageSound('open')
  renderSpread()
  captionShown = true
  window.innerBook?.open?.()
  markActivity()
  book.focus?.({ preventScroll: true })
}

function closeBook() {
  if (!isOpen) return
  isOpen = false
  captionShown = false
  window.clearTimeout(captionTimer)
  spreadCaption.classList.remove('is-swapping')
  book.classList.remove('is-open')
  book.classList.add('is-cover')
  document.body.classList.remove('reader-open')
  coverPanel.setAttribute('aria-hidden', 'false')
  window.innerBook?.close?.()
  startCoverLoop()
  updateUi()
  markActivity()
  openButton.focus?.({ preventScroll: true })
}

function prepareTurn(direction) {
  if (!isOpen || isAnimating) return false
  if (direction === 'next' && rightIndex + 1 >= pageImages.length) return false
  if (direction === 'prev' && leftIndex === 0) {
    turnState = { direction, startX: 0, startY: 0, progress: 0, toCover: true }
    turnFront.src = pageImages[leftIndex]
    turnBack.src = 'public/pages/cover.webp'
    turner.classList.remove('is-settling')
    turner.classList.add('is-prev', 'is-visible')
    turner.style.setProperty('--curl', '0deg')
    turner.style.setProperty('--lift', '0px')
    turner.style.transform = 'rotateY(0deg)'
    return true
  }
  if (direction === 'prev' && leftIndex - 1 < 0) return false

  turnState = { direction, startX: 0, startY: 0, progress: 0, toCover: false }

  if (direction === 'next') {
    turnFront.src = pageImages[rightIndex]
    turnBack.src = pageImages[rightIndex + 1]
  } else {
    turnFront.src = pageImages[leftIndex]
    turnBack.src = pageImages[leftIndex - 1]
  }

  turner.classList.remove('is-prev', 'is-settling')
  if (direction === 'prev') turner.classList.add('is-prev')
  turner.classList.add('is-visible')
  turner.style.setProperty('--curl', '0deg')
  turner.style.setProperty('--lift', '0px')
  turner.style.transform = 'rotateY(0deg)'
  return true
}

function setTurnProgress(progress, pointerY = null) {
  if (!turnState) return
  turnState.progress = clamp(progress, 0, 1)
  const angle = turnState.direction === 'next' ? -180 * turnState.progress : 180 * turnState.progress
  const bounds = spread.getBoundingClientRect()
  const startNorm = turnState.startY ? clamp((turnState.startY - bounds.top) / bounds.height, 0, 1) : .5
  const currentNorm = pointerY == null ? startNorm : clamp((pointerY - bounds.top) / bounds.height, 0, 1)
  const normalizedY = (startNorm + currentNorm) / 2
  const curl = (normalizedY - .5) * -16 * Math.sin(Math.PI * turnState.progress)
  const lift = 2 + 16 * Math.sin(Math.PI * turnState.progress)
  turner.style.setProperty('--curl', `${curl.toFixed(2)}deg`)
  turner.style.setProperty('--lift', `${lift.toFixed(2)}px`)
  turner.style.transform = `rotateY(${angle}deg) rotateX(${curl.toFixed(2)}deg) translateZ(${lift.toFixed(2)}px)`
}

function finishTurn(complete) {
  if (!turnState) return
  const direction = turnState.direction
  const finalAngle = complete ? (direction === 'next' ? -180 : 180) : 0
  isAnimating = true
  turner.classList.add('is-settling')
  turner.style.setProperty('--curl', '0deg')
  turner.style.setProperty('--lift', complete ? '0px' : '5px')
  turner.style.transform = `rotateY(${finalAngle}deg) rotateX(0deg) translateZ(${complete ? 0 : 5}px)`
  if (complete) pageSound(direction)

  window.setTimeout(() => {
    if (complete) {
      if (direction === 'next') {
        leftIndex = rightIndex
        rightIndex += 1
      } else if (turnState.toCover) {
        closeBook()
      } else {
        rightIndex = leftIndex
        leftIndex -= 1
      }
      renderSpread()
    }

    turner.classList.remove('is-visible', 'is-prev', 'is-settling')
    turner.style.transform = 'rotateY(0deg)'
    turnState = null
    isAnimating = false
  }, complete ? 720 : 560)
}

function animateTurn(direction) {
  markActivity()
  if (window.innerBook?.ready) {
    window.innerBook.turn(direction)
    return
  }
  if (!prepareTurn(direction)) return
  setTurnProgress(1)
  finishTurn(true)
}

openButton.addEventListener('click', openBook)
nextButton.addEventListener('click', () => animateTurn('next'))
prevButton.addEventListener('click', () => animateTurn('prev'))

book.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !isOpen) {
    event.preventDefault()
    openBook()
  }
})

window.addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return
  if (event.key === 'Escape') {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else if (isOpen) closeBook()
    return
  }
  // 焦点停在按钮/链接上时，空格与回车交给浏览器原生激活，避免二次触发
  if (target instanceof HTMLElement && target.closest('button, a, [role="button"]')) {
    if (event.key === ' ' || event.key === 'Enter') return
  }
  if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
    event.preventDefault()
    animateTurn('next')
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault()
    animateTurn('prev')
  }
})

spread.addEventListener('pointerdown', event => {
  if (window.innerBook?.ready) return
  if (!isOpen || event.target.closest('button')) return
  event.preventDefault()
  const bounds = spread.getBoundingClientRect()
  const onRightPage = event.clientX >= bounds.left + bounds.width / 2
  const direction = onRightPage ? 'next' : 'prev'
  if (!prepareTurn(direction)) return
  turnState.startX = event.clientX
  turnState.startY = event.clientY
  spread.setPointerCapture?.(event.pointerId)
})

spread.addEventListener('pointermove', event => {
  if (window.innerBook?.ready) return
  if (!turnState || isAnimating) return
  event.preventDefault()
  const bounds = spread.getBoundingClientRect()
  const distance = event.clientX - turnState.startX
  const progress = turnState.direction === 'next'
    ? -distance / (bounds.width / 2)
    : distance / (bounds.width / 2)
  setTurnProgress(progress, event.clientY)
})

spread.addEventListener('pointerup', event => {
  if (window.innerBook?.ready) return
  if (!turnState || isAnimating) return
  const complete = turnState.progress > .32
  spread.releasePointerCapture?.(event.pointerId)
  finishTurn(complete)
})

spread.addEventListener('pointercancel', () => {
  if (window.innerBook?.ready) return
  if (!turnState || isAnimating) return
  finishTurn(false)
})

spread.addEventListener('dragstart', event => {
  event.preventDefault()
})

window.addEventListener('pointerup', () => {
  if (window.innerBook?.ready) return
  if (!turnState || isAnimating) return
  finishTurn(turnState.progress > .32)
})

window.addEventListener('blur', () => {
  if (window.innerBook?.ready) return
  if (!turnState || isAnimating) return
  finishTurn(false)
})

/* ---------------------------------------------------------------- 封面 3D */

const cover = {
  x: 14,
  y: -6,
  targetX: 14,
  targetY: -6,
  dragging: false,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  raf: 0,
}

function renderCover(now) {
  const idle = !cover.dragging && !isOpen
  const swayY = idle && !prefersReducedMotion ? Math.sin(now / 2600) * 2.4 : 0
  const swayX = idle && !prefersReducedMotion ? Math.cos(now / 3300) * 1.5 : 0
  cover.y += (cover.targetY + swayY - cover.y) * .08
  cover.x += (cover.targetX + swayX - cover.x) * .08
  book3d.style.transform = `rotateX(${cover.x.toFixed(2)}deg) rotateY(${cover.y.toFixed(2)}deg) rotateZ(-5deg)`
  cover.raf = requestAnimationFrame(renderCover)
}

function startCoverLoop() {
  if (prefersReducedMotion) {
    book3d.style.transform = `rotateX(${cover.x}deg) rotateY(${cover.y}deg) rotateZ(-5deg)`
    return
  }
  if (!cover.raf) cover.raf = requestAnimationFrame(renderCover)
}

function stopCoverLoop() {
  if (cover.raf) cancelAnimationFrame(cover.raf)
  cover.raf = 0
}

book3d.addEventListener('pointerdown', event => {
  event.preventDefault()
  cover.dragging = true
  cover.startX = event.clientX
  cover.startY = event.clientY
  cover.originX = cover.targetX
  cover.originY = cover.targetY
  book3d.setPointerCapture?.(event.pointerId)
  book3d.classList.add('is-dragging')
})

book3d.addEventListener('pointermove', event => {
  if (!cover.dragging || isOpen) return
  cover.targetY = clamp(cover.originY + (event.clientX - cover.startX) * .12, -22, 14)
  cover.targetX = clamp(cover.originX - (event.clientY - cover.startY) * .08, 2, 26)
})

function endCoverDrag() {
  if (!cover.dragging) return
  cover.dragging = false
  book3d.classList.remove('is-dragging')
  // 松手后回到默认的陈列角度，慢慢归位
  cover.targetX = 14
  cover.targetY = -6
}

book3d.addEventListener('pointerup', endCoverDrag)
book3d.addEventListener('pointercancel', endCoverDrag)

/* ------------------------------------------------------------ 翻页音效 */

const audio = { ctx: null, gain: null, enabled: true }

function unlockAudio() {
  if (!audio.enabled) return null
  try {
    if (!audio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return null
      audio.ctx = new Ctx()
      audio.gain = audio.ctx.createGain()
      audio.gain.gain.value = .5
      audio.gain.connect(audio.ctx.destination)
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume()
    return audio.ctx
  } catch {
    return null
  }
}

function pageSound(kind) {
  if (!audio.enabled) return
  const ctx = unlockAudio()
  if (!ctx || ctx.state !== 'running') return
  try {
    const duration = kind === 'open' ? .5 : .36
    const frames = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let smooth = 0
    for (let i = 0; i < frames; i++) {
      const t = i / frames
      smooth = smooth * .74 + (Math.random() * 2 - 1) * .26
      const env = Math.sin(Math.PI * Math.pow(t, .6)) ** 2 * (1 - t * .3)
      data[i] = smooth * env * .55
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = kind === 'prev' ? 1500 : kind === 'open' ? 1150 : 2200
    filter.Q.value = .8
    const gain = ctx.createGain()
    gain.gain.value = kind === 'open' ? .1 : .07
    source.connect(filter)
    filter.connect(gain)
    gain.connect(audio.gain)
    source.start()
  } catch {
    /* 声音只是点缀，失败就安静地跳过 */
  }
}

soundButton.addEventListener('click', () => {
  audio.enabled = !audio.enabled
  soundButton.setAttribute('aria-pressed', String(audio.enabled))
  soundButton.textContent = audio.enabled ? '◉' : '◌'
  soundButton.title = audio.enabled ? '翻页声音：开' : '翻页声音：关'
  if (audio.enabled) pageSound('next')
  markActivity()
})

/* ------------------------------------------------------------ 全屏与进度 */

function syncFullscreen() {
  const active = Boolean(document.fullscreenElement)
  fullscreenButton.setAttribute('aria-pressed', String(active))
  fullscreenButton.title = active ? '退出全屏' : '全屏'
  fullscreenButton.textContent = active ? '⤡' : '⛶'
  markActivity()
}

fullscreenButton.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    else await document.exitFullscreen?.()
  } catch {
    /* 浏览器不允许时保持原样 */
  }
})

document.addEventListener('fullscreenchange', syncFullscreen)

/* ------------------------------------------------------------ 闲置淡出 */

let idleTimer = 0
function markActivity() {
  experience.classList.remove('is-idle')
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    if (isOpen) experience.classList.add('is-idle')
  }, 3200)
}
window.addEventListener('pointermove', markActivity, { passive: true })
window.addEventListener('keydown', markActivity)
window.addEventListener('wheel', markActivity, { passive: true })

/* ------------------------------------------------------------ 与内页同步 */

window.addEventListener('innerbookcommit', event => {
  if (!isOpen) return
  const { direction, toCover } = event.detail || {}
  if (toCover) {
    closeBook()
    return
  }

  const page = Number(event.detail?.page)
  if (direction === 'next') {
    leftIndex = Number.isFinite(page) ? Math.max(0, page - 1) : leftIndex + 2
  } else {
    leftIndex = Number.isFinite(page) ? Math.max(0, page - 1) : Math.max(0, leftIndex - 2)
  }
  rightIndex = Math.min(leftIndex + 1, pageImages.length - 1)
  renderSpread()
  window.innerBook?.setSpread?.(leftIndex, rightIndex)
  markActivity()
})

window.addEventListener('innerbookready', () => {
  updateUi()
  markActivity()
})

updateUi()
startCoverLoop()

// A small, tactile pointer for desktop. It is disabled on touch devices so the
// page's native pointer gestures remain predictable.
if (window.matchMedia && !window.matchMedia('(pointer: coarse)').matches && cursorDot && cursorRing) {
  document.body.classList.add('cursor-enabled')
  let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  let ring = { ...pointer }
  let raf = 0

  const renderCursor = () => {
    ring.x += (pointer.x - ring.x) * .16
    ring.y += (pointer.y - ring.y) * .16
    cursorDot.style.left = `${pointer.x}px`
    cursorDot.style.top = `${pointer.y}px`
    cursorRing.style.left = `${ring.x}px`
    cursorRing.style.top = `${ring.y}px`
    raf = requestAnimationFrame(renderCursor)
  }
  raf = requestAnimationFrame(renderCursor)

  document.addEventListener('pointermove', event => {
    pointer = { x: event.clientX, y: event.clientY }
    document.body.classList.toggle('cursor-hover', Boolean(event.target.closest('button, a, .book-3d, .spread')))
  }, { passive: true })
  document.addEventListener('pointerleave', () => document.body.classList.remove('cursor-hover'))
  window.addEventListener('beforeunload', () => cancelAnimationFrame(raf), { once: true })
}

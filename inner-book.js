import './public/vendor/leafthrough/element.js'

const interiorPages = [
  'public/pages/scene-01.webp', 'public/pages/scene-02.webp',
  'public/pages/scene-03.webp', 'public/pages/scene-04.webp',
  'public/pages/scene-05.webp', 'public/pages/scene-06.webp',
  'public/pages/scene-07.webp', 'public/pages/scene-08.webp',
  'public/pages/scene-09.webp', 'public/pages/scene-10.webp',
  'public/pages/scene-11.webp', 'public/pages/scene-12.webp',
  'public/pages/scene-13.webp', 'public/pages/scene-14.webp',
  'public/pages/scene-15.webp', 'public/pages/scene-16.webp',
  'public/pages/blank.svg', 'public/pages/scene-18.webp',
]
const pageImages = ['public/pages/cover.webp', ...interiorPages]

const root = document.querySelector('#innerBookWebgl')

if (!root) {
  console.warn('[inner-book] LeafThrough container not found')
} else {
  const magazine = document.createElement('leaf-through')
  magazine.setAttribute('layout', 'spread')
  magazine.setAttribute('page-aspect', String(9 / 16))
  magazine.setAttribute('preload', String(pageImages.length))
  magazine.setAttribute('label', '小满的2000年 · 内页')
  magazine.setAttribute('keyboard', 'false')
  magazine.style.cssText = 'display:block;width:100%;height:100%;'
  magazine.pages = pageImages
  magazine.options = {
    layout: 'spread', pageAspect: 9 / 16, preload: pageImages.length,
    loop: false, label: '小满的2000年 · 内页',
    paper: {
      grain: true, grainScale: 1.35, grainStrength: .12,
      showThrough: .035, inkGloss: .2, roughness: .62, metalness: .08,
      backColor: '#f4eee2', wrinkles: .5, bulge: .4, depthBias: true,
    },
    lighting: {
      ambient: { sky: '#fffaf0', ground: '#6a6058', intensity: 1.65 },
      sun: { color: '#fff1d6', intensity: 2.2, position: [-3.5, 1.5, 4.2] },
      shadows: true, floorShadow: .18,
    },
    motion: {
      speed: .86, dragDistance: .72, commitThreshold: .2,
      curl: 1.18, maxTilt: 44, jitter: true, hoverLift: .045,
    },
    interaction: { drag: true, click: true, hold: true, hover: true, keyboard: false },
  }
  root.append(magazine)

  const state = { page: 0, ready: false, edgeDrag: null }

  window.innerBook = {
    get ready() { return state.ready },
    open() {
      root.setAttribute('aria-hidden', 'false')
      state.page = 1
      magazine.goTo?.(1, { animate: false })
    },
    close() {
      root.setAttribute('aria-hidden', 'true')
      magazine.goTo?.(0, { animate: false })
      state.page = 0
    },
    turn(direction) {
      if (!state.ready) return false
      return direction === 'next' ? magazine.next() : magazine.prev()
    },
    setSpread(leftIndex) {
      if (!state.ready) return
      const target = Math.max(1, leftIndex + 1)
      magazine.goTo?.(target, { animate: false })
      state.page = target
    },
  }

  magazine.addEventListener('ready', () => {
    state.ready = true
    document.body.classList.add('leafthrough-ready')
    window.dispatchEvent(new CustomEvent('innerbookready'))
  })

  magazine.addEventListener('pagechange', event => {
    const nextPage = Number(event.detail?.page ?? 0)
    if (!state.ready || nextPage === state.page) return
    const direction = nextPage > state.page ? 'next' : 'prev'
    state.page = nextPage
    const commit = () => window.dispatchEvent(new CustomEvent('innerbookcommit', {
      detail: { direction, toCover: nextPage === 0, page: nextPage },
    }))
    // LeafThrough announces the new stack at the start of a turn. Give the
    // cover turn time to finish before switching back to the CSS cover scene.
    if (nextPage === 0) window.setTimeout(commit, 680)
    else commit()
  })

}

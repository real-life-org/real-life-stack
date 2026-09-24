/**
 * Verhalten der Story-Einbettungen (`.story-example`): Rahmen Desktop/Handy mit Umschalter, Massstab je Spaltenbreite,
 * Hell/Dunkel aus Starlights `data-theme`. Geteilt von Story.astro (Handbuch) und der Startseite (Hero).
 */
  // Desktop rendert 1040px (knapp ueber dem Panel-Breakpoint) und schrumpft auf die Spalte. Das Telefon hat ueberall
  // denselben Massstab, im Handbuch wie im Hero der Startseite; nur eine schmalere Flaeche drueckt ihn weiter.
  const DESKTOP = 1040, PHONE = 390, PHONE_HEIGHT = 720, PHONE_SCALE = 0.8
  const KEY = 'rls-story-frame'
  const figures = Array.from(document.querySelectorAll<HTMLElement>('.story-example'))

  function layout(fig: HTMLElement) {
    const stage = fig.querySelector<HTMLElement>('.story-stage')!
    // Skaliert wird die Box, nicht der Iframe: Ein transformierter Iframe beschneidet seinen Inhalt in Chrome nicht
    // an runden Ecken, eine Box mit overflow hidden schon.
    const box = fig.querySelector<HTMLElement>('.story-box')!
    const height = Number(fig.dataset.height) || 560
    const phone = fig.dataset.frame === 'phone'
    const scale = phone ? Math.min(PHONE_SCALE, stage.clientWidth / PHONE) : Math.min(1, stage.clientWidth / DESKTOP)
    const w = phone ? PHONE : DESKTOP, h = phone ? PHONE_HEIGHT : height
    box.style.width = `${w}px`; box.style.height = `${h}px`; box.style.transform = `scale(${scale})`
    stage.style.height = `${Math.round(h * scale)}px`
    for (const b of fig.querySelectorAll<HTMLButtonElement>('.story-frames button'))
      b.setAttribute('aria-pressed', String(b.dataset.frame === fig.dataset.frame))
  }

  // Hell oder dunkel: Starlight stempelt `data-theme` auf <html>; Storybook nimmt es als Global `theme` in der Adresse.
  const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  // Die App bleibt unsichtbar, bis Storybook die Story gerendert hat, und blendet dann ein. Gleicher Ursprung
  // (gebaute Site): auf den Inhalt der Story-Wurzel warten; sonst (Dev-Server auf anderem Port) reicht `load` plus Puffer.
  function reveal(fig: HTMLElement, iframe: HTMLIFrameElement) {
    const box = fig.querySelector<HTMLElement>('.story-box')!
    const ready = () => box.classList.add('is-ready')
    const started = Date.now()
    const poll = () => {
      let rendered = false
      try { rendered = !!iframe.contentDocument?.querySelector('#storybook-root > *') } catch { rendered = Date.now() - started > 800 }
      if (rendered || Date.now() - started > 6000) ready()
      else setTimeout(poll, 100)
    }
    poll()
  }
  /**
   * Ein Klick in die Vorschau gibt dem Iframe den Fokus, und der Browser holt
   * ihn dafuer ins Bild: Die Seite darunter scrollte weg. Die Vorschau ist ein
   * Fenster, kein Formular — sie darf nichts ausserhalb von sich bewegen.
   *
   * Der Halter laeuft dauerhaft, nicht als Anmeldung auf ein Ereignis: Ein
   * Iframe meldet dem Elternteil kein `focus`, und beim zweiten Klick in
   * dieselbe Vorschau faellt auch kein `blur` mehr — das Fenster hat den Fokus
   * ja laengst abgegeben. Unterschieden wird darum am Scrollereignis selbst:
   * Liegt der Fokus in einer Vorschau und hat gerade niemand gescrollt,
   * getippt oder gezogen, kommt die Bewegung nicht vom Menschen und wird
   * zurueckgenommen. Scrollen ueber der Vorschau selbst zaehlt mit: Das
   * meldet die Vorschau per Nachricht, weil ihre Ereignisse hier nicht ankommen.
   */
  // Eine Eingabe erklaert Bewegung fuer EINGABEFENSTER ms. Danach traegt die Bewegung sich selbst: Ausrollen nach
  // einem Wisch und weiches Scrollen liefern luekenlos Ereignisse, ein Fokus-Sprung ist ein einzelner Satz. Jede
  // menschliche Bewegung erklaert darum auch die naechste, wenn sie innerhalb von NACHLAUF ms folgt.
  const EINGABEFENSTER = 400, NACHLAUF = 250
  let ruhigePosition = window.scrollY
  let letzteEingabe = 0
  let letzteMenschlicheBewegung = 0
  const merkeEingabe = () => { letzteEingabe = performance.now() }
  for (const ereignis of ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'])
    window.addEventListener(ereignis, merkeEingabe, { passive: true, capture: true })
  // Rad, Wischen und Tasten in der Vorschau kommen im Iframe an, nicht hier. Die Storybook-Vorschau meldet sie
  // per postMessage (siehe .storybook/preview.tsx); so bleibt Scroll-Chaining aus der Vorschau erlaubt.
  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'rls-story-scroll') return
    if (figures.some((f) => f.querySelector('iframe')?.contentWindow === e.source)) merkeEingabe()
  })

  window.addEventListener('scroll', () => {
    const jetzt = performance.now()
    const ziel = document.activeElement
    const vorschauImFokus = ziel instanceof HTMLIFrameElement && !!ziel.closest('.story-example')
    const menschScrollt = jetzt - letzteEingabe < EINGABEFENSTER || jetzt - letzteMenschlicheBewegung < NACHLAUF
    if (!vorschauImFokus || menschScrollt) { ruhigePosition = window.scrollY; letzteMenschlicheBewegung = jetzt; return }
    if (window.scrollY !== ruhigePosition) window.scrollTo(0, ruhigePosition)
  }, { passive: true })

  function load(fig: HTMLElement) {
    const iframe = fig.querySelector<HTMLIFrameElement>('iframe')!
    const src = `${iframe.dataset.src}&globals=theme:${theme()}`
    if (iframe.src === src) return
    fig.querySelector('.story-box')?.classList.remove('is-ready')
    iframe.addEventListener('load', () => reveal(fig, iframe), { once: true })
    iframe.src = src
  }
  new MutationObserver(() => figures.forEach(load)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  let remembered: string | null = null
  try { remembered = localStorage.getItem(KEY) } catch {}
  // Nur Vorschauen mit Umschalter folgen der gemerkten Wahl; eine feste (Hero der Startseite) behaelt ihren Rahmen.
  const switchable = figures.filter((f) => f.querySelector('.story-frames'))
  for (const fig of figures) {
    if (switchable.includes(fig) && (remembered === 'phone' || remembered === 'desktop')) fig.dataset.frame = remembered
    layout(fig)
    load(fig)
    fig.querySelector('.story-frames')?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-frame]')
      if (!b) return
      try { localStorage.setItem(KEY, b.dataset.frame!) } catch {}
      for (const f of switchable) { f.dataset.frame = b.dataset.frame; layout(f) }
    })
  }
  new ResizeObserver(() => figures.forEach(layout)).observe(document.body)

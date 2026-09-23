/**
 * Verhalten der Story-Einbettungen (`.story-example`): Rahmen Desktop/Handy mit Umschalter, Massstab je Spaltenbreite,
 * Hell/Dunkel aus Starlights `data-theme`. Geteilt von Story.astro (Handbuch) und der Startseite (Hero).
 */
  // Beide Rahmen teilen den Faktor Spaltenbreite/1040, damit Desktop und Handy im gleichen Massstab stehen.
  const DESKTOP = 1040, PHONE = 390, PHONE_HEIGHT = 720
  // Breite der Handbuchspalte (54rem Inhalt abzueglich Rand), damit die Startseite denselben Massstab zeigt.
  const HANDBOOK_COLUMN = 792
  const KEY = 'rls-story-frame'
  const figures = Array.from(document.querySelectorAll<HTMLElement>('.story-example'))

  function layout(fig: HTMLElement) {
    const stage = fig.querySelector<HTMLElement>('.story-stage')!
    const iframe = fig.querySelector<HTMLIFrameElement>('iframe')!
    const height = Number(fig.dataset.height) || 560
    const desktopScale = Math.min(1, stage.clientWidth / DESKTOP)
    const phone = fig.dataset.frame === 'phone'
    // Handy im selben Massstab wie Desktop, damit beide Bilder vergleichbar sind; auf schmalen Flaechen
    // (Telefon, Hero auf dem Handy) waere das unlesbar klein, dort fuellt das Telefon die Breite.
    // `data-scale="handbook"` nimmt den Massstab der Handbuchspalte (Hero der Startseite), sonst folgt er der Spaltenbreite.
    const fixed = fig.dataset.scale === 'handbook' ? HANDBOOK_COLUMN / DESKTOP : Number(fig.dataset.scale)
    const scale = fixed > 0
      ? Math.min(fixed, stage.clientWidth / (phone ? PHONE : DESKTOP))
      : phone && stage.clientWidth < 640 ? Math.min(1, stage.clientWidth / PHONE) : desktopScale
    const w = phone ? PHONE : DESKTOP, h = phone ? PHONE_HEIGHT : height
    iframe.style.width = `${w}px`; iframe.style.height = `${h}px`; iframe.style.transform = `scale(${scale})`
    stage.style.height = `${Math.round(h * scale)}px`
    for (const b of fig.querySelectorAll<HTMLButtonElement>('.story-frames button'))
      b.setAttribute('aria-pressed', String(b.dataset.frame === fig.dataset.frame))
  }

  // Hell oder dunkel: Starlight stempelt `data-theme` auf <html>; Storybook nimmt es als Global `theme` in der Adresse.
  const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  function load(fig: HTMLElement) {
    const iframe = fig.querySelector<HTMLIFrameElement>('iframe')!
    const src = `${iframe.dataset.src}&globals=theme:${theme()}`
    if (iframe.src !== src) iframe.src = src
  }
  new MutationObserver(() => figures.forEach(load)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  let remembered: string | null = null
  try { remembered = localStorage.getItem(KEY) } catch {}
  for (const fig of figures) {
    if (remembered === 'phone' || remembered === 'desktop') fig.dataset.frame = remembered
    layout(fig)
    load(fig)
    fig.querySelector('.story-frames')?.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-frame]')
      if (!b) return
      try { localStorage.setItem(KEY, b.dataset.frame!) } catch {}
      for (const f of figures) { f.dataset.frame = b.dataset.frame; layout(f) }
    })
  }
  new ResizeObserver(() => figures.forEach(layout)).observe(document.body)

import { icons, type IconName } from '../components/icons'

/**
 * Der Stack als Bild: vier Schichten, die Schnittstelle als schmale Taille. Oben viele Apps und Module,
 * unten viele Connectoren, dazwischen ein Vertrag, dieselbe Ordnung wie in docs/spec/00-architecture.md.
 * Jede Schicht fuehrt zu ihrem Abschnitt der Landing; das Bild ist zugleich die Karte der Seite darunter.
 */
type Tone = 'green' | 'blue' | 'orange' | 'purple'
interface Layer { key: string; label: string; tone: Tone; href: string; chips: [IconName, string][] }

const svg = (name: IconName) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`

function layers(de: boolean, prefix: string): Layer[] {
  return [
    { key: 'apps', label: 'Apps', tone: 'orange', href: `${prefix}/handbuch/erste-app/`, chips: [['globe', de ? 'Referenz-App' : 'Reference app'], ['rocket', de ? 'Deine App' : 'Your app']] },
    { key: 'toolkit', label: 'Toolkit', tone: 'purple', href: '#module', chips: [['map', de ? 'Karte' : 'Map'], ['calendar', de ? 'Kalender' : 'Calendar'], ['kanban', 'Kanban'], ['message-square', 'Feed']] },
    { key: 'interface', label: 'Data Interface', tone: 'blue', href: '#schnittstelle', chips: [['layers', 'Items'], ['users', 'Spaces'], ['shield-check', 'Capabilities']] },
    { key: 'connectors', label: de ? 'Connectoren' : 'Connectors', tone: 'green', href: '#connectoren', chips: [['wot', 'Web of Trust'], ['database', 'Supabase'], ['plug', de ? 'Eigener' : 'Your own']] },
  ]
}

export function stackDiagramHtml(lang: string, prefix: string): string {
  const de = lang === 'de'
  const label = de ? 'Aufbau des Real Life Stack' : 'How Real Life Stack is built'
  const bands = layers(de, prefix)
    .map(
      (l) =>
        `<a class="rl-stack-layer tone-${l.tone}" data-layer="${l.key}" href="${l.href}">` +
        `<span class="rl-stack-label">${l.label}</span>` +
        `<ul>${l.chips.map(([icon, text]) => `<li>${svg(icon)}<span>${text}</span></li>`).join('')}</ul>` +
        `</a>`,
    )
    .join('')
  return `<nav class="rl-stack" aria-label="${label}">${bands}</nav>`
}

/**
 * Der sichtbare Text eines Elements ohne seine Avatare (`[data-avatar]`): Ein
 * Personen-Knopf zeigt Initialen im Avatar, sein Name ist der übrige Text.
 * Der Avatar ist `aria-hidden`, zählt also für den zugänglichen Namen nicht.
 */
export function textOhneAvatar(el: Element): string {
  const copy = el.cloneNode(true) as Element
  for (const avatar of copy.querySelectorAll("[data-avatar]")) avatar.remove()
  return copy.textContent?.trim() ?? ""
}

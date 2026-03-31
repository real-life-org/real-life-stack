# RelativeTime — Requirements Specification

## 1. Overview

**RelativeTime** is a reusable component that displays timestamps as human-readable relative time strings (e.g. "vor 2 Stunden", "gestern") with an HTML tooltip showing the full date and time on hover.

### Motivation

Relative timestamps are used across multiple components:
- **CommentBubble** — "vor 30 Min."
- **PostCard** — "vor 2 Stunden"
- **Feed items** — "gestern"

Currently, the formatting logic is duplicated (inline in `comment-thread.tsx`, hardcoded strings in stories, plain string prop in `PostCard`). This component centralizes the formatting and adds the tooltip for the full timestamp.

### Design principles

- **Single source of truth** — one formatting function, one component
- **Native HTML tooltip** — `title` attribute, no custom tooltip component needed
- **Locale-aware** — German relative strings, full date in `de-DE` locale
- **Auto-updating** — relative time updates periodically (e.g. "gerade eben" becomes "vor 1 Min." after a minute)
- **Lightweight** — no dependencies, no Intl.RelativeTimeFormat (bundle size)

---

## 2. User Stories

- **US-T1**: As a user I see timestamps like "gerade eben", "vor 5 Min.", "vor 2 Std.", "vor 3 Tagen", "gestern" instead of absolute dates.
- **US-T2**: As a user I can hover over (desktop) or long-press (mobile) a relative timestamp to see the full date and time (e.g. "20. Maerz 2026, 14:30 Uhr") in a native browser tooltip.
- **US-T3**: As a user the relative time automatically updates without page reload — "gerade eben" becomes "vor 1 Min." after a minute.
- **US-T4**: As a developer I can use `<RelativeTime date="2026-03-20T14:30:00Z" />` anywhere, and it handles formatting + tooltip.
- **US-T5**: As a developer I can also use `formatRelativeTime(date)` as a standalone function when I need just the string (e.g. for aria-labels).

---

## 3. Formatting Rules

| Time difference | Display |
|---|---|
| < 1 minute | "gerade eben" |
| 1–59 minutes | "vor {n} Min." |
| 1–23 hours | "vor {n} Std." |
| 1 day (yesterday) | "gestern" |
| 2–6 days | "vor {n} Tagen" |
| 7+ days, same year | "20. Maerz" (day + month) |
| Different year | "20. Maerz 2025" (day + month + year) |

### Tooltip (full format)

Always shows: `"20. Maerz 2026, 14:30 Uhr"`

Uses `toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })` + `toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })`.

---

## 4. Auto-Update Intervals

The component re-renders periodically to keep the relative time current:

| Age of timestamp | Update interval |
|---|---|
| < 1 minute | every 10 seconds |
| < 1 hour | every 1 minute |
| < 1 day | every 1 hour |
| >= 1 day | no auto-update (date doesn't change within a session) |

Uses `setInterval` with cleanup. Interval adjusts based on the current age.

---

## 5. API

### Component

```typescript
interface RelativeTimeProps {
  /** ISO-8601 date string or Date object. */
  date: string | Date
  /** Additional CSS classes for the <time> element. */
  className?: string
}

function RelativeTime({ date, className }: RelativeTimeProps): JSX.Element
```

Renders a `<time>` element with `datetime` attribute (for SEO/accessibility) and `title` attribute (for tooltip):

```html
<time datetime="2026-03-20T14:30:00Z" title="20. Maerz 2026, 14:30 Uhr" class="...">
  vor 2 Stunden
</time>
```

### Standalone function

```typescript
function formatRelativeTime(date: string | Date): string
```

Returns the formatted relative time string without a component wrapper.

### Full date formatter

```typescript
function formatFullDateTime(date: string | Date): string
```

Returns the full date/time string used in the tooltip.

---

## 6. Scope

### In scope
- RelativeTime component with HTML tooltip
- formatRelativeTime standalone function
- formatFullDateTime standalone function
- Auto-updating relative time
- German locale

### Not in scope
- i18n / multi-locale support (can be added later)
- Custom tooltip component (native `title` attribute is sufficient)
- "time ago" libraries (dayjs, date-fns — not needed for this scope)

---

## Changelog

| Date | Change |
|---|---|
| 2026-03-31 | Initial requirements specification |

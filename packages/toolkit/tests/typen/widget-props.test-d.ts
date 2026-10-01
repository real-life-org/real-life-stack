import { describe, expectTypeOf, it } from "vitest"
import type { ComponentProps } from "react"

import type { FieldAccess } from "../../src/lib/form-state"
import type { AvatarField } from "../../src/components/composer/widgets/avatar-widget"
import type { LocationField } from "../../src/components/composer/widgets/location-field"
import type { LocationWidget } from "../../src/components/composer/widgets/location-widget"
import type { IncomingRelationField, ItemRelationWidget } from "../../src/components/composer/widgets/item-relation-widget"
import type { PeopleWidget } from "../../src/components/composer/widgets/people-widget"
import type { TagsWidget } from "../../src/components/composer/widgets/tags-widget"
import type { TitleWidget } from "../../src/components/composer/widgets/title-widget"
import type { TextWidget } from "../../src/components/composer/widgets/text-widget"
import type { MediaWidget } from "../../src/components/composer/widgets/media-widget"
import type { DateWidget } from "../../src/components/composer/widgets/date-widget"
import type { StatusWidget } from "../../src/components/composer/widgets/status-widget"
import type { ChipsField, ContactField, NumberGroupField, OptionField, UrlField } from "../../src/components/composer/widgets/value-widgets"

/**
 * Typ-Ebene des Formularzustands (shared-components → Formularzustand,
 * Prüfbar): Die Props, die der Composer einem Widget gibt, enthalten als
 * Schreibweg nur den Feldzugang. Kein Prop hat den Typ eines rohen Setters:
 * eine Funktion, die einen Datensatz beliebiger Schlüssel nimmt und nichts
 * liefert (heute nicht mehr: `updateMany`).
 */

/** Nimmt dieser Prop einen Datensatz beliebiger Schlüssel und liefert nichts? */
type RawSetter<F> = F extends (...args: infer P) => void
  ? P extends [infer A, ...unknown[]]
    ? [Record<string, any>] extends [A] // eslint-disable-line @typescript-eslint/no-explicit-any
      ? true
      : false
    : false
  : false
/** Die Namen der Props, die rohe Setter sind; `never`, wenn es keine gibt. */
type RawSetterProps<P> = { [K in keyof P]-?: RawSetter<NonNullable<P[K]>> extends true ? K : never }[keyof P]

describe("Widget-Props: kein roher Setter", () => {
  it("der Prüfer selbst erkennt einen rohen Setter", () => {
    expectTypeOf<RawSetterProps<{ updateMany: (patch: Record<string, unknown>) => void }>>().toEqualTypeOf<"updateMany">()
    expectTypeOf<RawSetterProps<{ updateMany: (patch: Partial<{ title: string; address: string }>) => void }>>().toEqualTypeOf<"updateMany">()
    expectTypeOf<RawSetterProps<{ onChange: (value: string) => void }>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<{ onOpen: () => void }>>().toEqualTypeOf<never>()
  })

  it("Widgets mit Arbeit bekommen genau einen Feldzugang und keinen Setter", () => {
    expectTypeOf<RawSetterProps<ComponentProps<typeof AvatarField>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof LocationField>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof LocationWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof ItemRelationWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof IncomingRelationField>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof PeopleWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof TagsWidget>>>().toEqualTypeOf<never>()

    expectTypeOf<ComponentProps<typeof AvatarField>["field"]>().toEqualTypeOf<FieldAccess<string>>()
    expectTypeOf<ComponentProps<typeof TagsWidget>["field"]>().toEqualTypeOf<FieldAccess<string[]>>()
    expectTypeOf<ComponentProps<typeof AvatarField>>().not.toHaveProperty("onChange")
    expectTypeOf<ComponentProps<typeof LocationField>>().not.toHaveProperty("updateMany")
    expectTypeOf<ComponentProps<typeof LocationField>>().not.toHaveProperty("data")
    expectTypeOf<ComponentProps<typeof ItemRelationWidget>>().not.toHaveProperty("onChange")
    expectTypeOf<ComponentProps<typeof PeopleWidget>>().not.toHaveProperty("onQualifiersChange")
  })

  it("Widgets ohne Arbeit schreiben nur ihren eigenen Wert (den Schreibweg ihres Felds)", () => {
    expectTypeOf<RawSetterProps<ComponentProps<typeof TitleWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof TextWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof MediaWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof DateWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof StatusWidget>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof OptionField>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof NumberGroupField>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof UrlField>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof ChipsField>>>().toEqualTypeOf<never>()
    expectTypeOf<RawSetterProps<ComponentProps<typeof ContactField>>>().toEqualTypeOf<never>()
  })
})

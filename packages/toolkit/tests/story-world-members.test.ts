import { describe, expect, it } from "vitest"
import { makeStoryConnector } from "../src/story-support/story-world"

// rls#456 (Codex): Die Hook-Story „Groups and members" laedt einen Gast ein und
// entfernt ihn wieder. Der Mock liefert Mitglieder nur aus seiner Nutzerliste;
// der Gast muss also im Seed bekannt sein, ohne in einer Gruppe zu stehen.
describe("StoryWorld: Einladen und Entfernen sind sichtbar", () => {
  it("noah ist bekannt, anfangs kein Mitglied, nach Einladen dabei, nach Entfernen weg", async () => {
    const connector = makeStoryConnector()
    await connector.init()
    const members = connector.observeMembers("garden")
    const ids = () => members.current.map((u) => u.id)
    expect(ids()).not.toContain("noah")
    await connector.inviteMember("garden", "noah")
    expect(ids()).toContain("noah")
    await connector.removeMember("garden", "noah")
    expect(ids()).not.toContain("noah")
  })
})

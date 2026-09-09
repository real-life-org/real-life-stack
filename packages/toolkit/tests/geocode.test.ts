import { describe, it, expect, vi, afterEach } from "vitest"
import { createNominatimGeocoder, createNominatimReverseGeocoder, formatShortAddress } from "../src/lib/geocode"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("createNominatimGeocoder", () => {
  it("returns [] for a blank query without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const geocode = createNominatimGeocoder()
    expect(await geocode("   ")).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("kuerzt das Label auf Strasse und Ort und haelt die lange Form daneben", async () => {
    // Anton: „Den Adress-String kuerzen." Gespeichert wird, was hier `label`
    // heisst — der volle `display_name` blieb als `detail` fuer die Auswahl.
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          lat: "49.51",
          lon: "11.19",
          display_name:
            "14a, Rainwiesenweg, Sophienpark, Behringersdorf, Schwaig bei Nürnberg, Landkreis Nürnberger Land, Bayern, 90571, Deutschland",
          address: {
            road: "Rainwiesenweg",
            house_number: "14a",
            postcode: "90571",
            village: "Schwaig bei Nürnberg",
          },
        },
      ],
    } as Response)
    const [treffer] = await createNominatimGeocoder()("Rainwiesenweg 14a")
    expect(treffer.label).toBe("Rainwiesenweg 14a, 90571 Schwaig bei Nürnberg")
    expect(treffer.detail).toContain("Landkreis Nürnberger Land")
  })

  it("fragt die Strukturdaten ueberhaupt erst an", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)
    await createNominatimGeocoder()("Berlin")
    const url = String(fetchSpy.mock.calls[0]![0])
    expect(url).toContain("addressdetails=1")
  })

  it("maps Nominatim entries to { label, lat, lng } and drops non-finite coords", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { lat: "52.52", lon: "13.405", display_name: "Berlin, Deutschland" },
        { lat: "not-a-number", lon: "1", display_name: "Broken" },
      ],
    } as Response)
    // Ohne Strukturdaten bleibt es beim `display_name` — das alte Verhalten.
    const res = await createNominatimGeocoder()("Berlin")
    expect(res).toEqual([
      { label: "Berlin, Deutschland", detail: "Berlin, Deutschland", lat: 52.52, lng: 13.405 },
    ])
  })

  it("forwards limit + language and respects a custom endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)
    await createNominatimGeocoder({
      endpoint: "https://geo.example.org/search",
      limit: 3,
      language: "de",
    })("Markthalle")
    const url = String(fetchSpy.mock.calls[0]?.[0])
    expect(url).toContain("https://geo.example.org/search?")
    expect(url).toContain("limit=3")
    expect(url).toContain("accept-language=de")
    expect(url).toContain("q=Markthalle")
  })

  it("throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 429 } as Response)
    await expect(createNominatimGeocoder()("x")).rejects.toThrow(/429/)
  })
})

describe("createNominatimReverseGeocoder", () => {
  it("returns the display_name for a coordinate", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: "Marheinekeplatz 15, Berlin" }),
    } as Response)
    const label = await createNominatimReverseGeocoder()({ lat: 52.49, lng: 13.4 })
    expect(label).toBe("Marheinekeplatz 15, Berlin")
  })

  it("returns null when there is no display_name", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    expect(await createNominatimReverseGeocoder()({ lat: 0, lng: 0 })).toBeNull()
  })

  it("sends lat/lon to the (custom) endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)
    await createNominatimReverseGeocoder({ endpoint: "https://geo.example.org/reverse" })({
      lat: 52.5,
      lng: 13.4,
    })
    const url = String(fetchSpy.mock.calls[0]?.[0])
    expect(url).toContain("https://geo.example.org/reverse?")
    expect(url).toContain("lat=52.5")
    expect(url).toContain("lon=13.4")
  })

  it("throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(createNominatimReverseGeocoder()({ lat: 1, lng: 2 })).rejects.toThrow(/500/)
  })
})

/**
 * Die kurze Form ist „Strasse Nr, PLZ Ort" — dieselbe, die auch die
 * Rueckwaertssuche liefert. Eine Postleitzahl gehoert dazu: Sie unterscheidet
 * zwei gleichnamige Orte, ohne die Zeile lang zu machen.
 */
describe("formatShortAddress", () => {
  it("setzt die Postleitzahl vor den Ort", () => {
    expect(
      formatShortAddress({
        address: {
          road: "Rainwiesenweg",
          house_number: "14a",
          postcode: "90571",
          village: "Schwaig bei Nürnberg",
        },
      }),
    ).toBe("Rainwiesenweg 14a, 90571 Schwaig bei Nürnberg")
  })

  it("laesst sie weg, wenn es keine gibt", () => {
    expect(
      formatShortAddress({ address: { road: "Saalhof", house_number: "1", city: "Frankfurt am Main" } }),
    ).toBe("Saalhof 1, Frankfurt am Main")
  })

  it("nimmt den Namen eines Ortes vor die Strasse", () => {
    expect(
      formatShortAddress({
        name: "Junges Museum Frankfurt",
        address: { road: "Saalhof", postcode: "60311", city: "Frankfurt am Main" },
      }),
    ).toBe("Junges Museum Frankfurt, 60311 Frankfurt am Main")
  })
})

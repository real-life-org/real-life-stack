// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
  loadRuntimeConfig,
  getRuntimeConfig,
  resetRuntimeConfigForTests,
  applyBranding,
  DEFAULT_RUNTIME_CONFIG,
  type RuntimeConfig,
} from "../src/lib/runtime-config"

/** Stub für einen fetch, der eine config.json liefert (oder scheitert). */
function stubFetch(result: { ok: boolean; json?: unknown; throws?: boolean }) {
  return vi.fn(async () => {
    if (result.throws) throw new Error("network down")
    return {
      ok: result.ok,
      status: result.ok ? 200 : 404,
      json: async () => result.json,
    } as unknown as Response
  })
}

describe("loadRuntimeConfig", () => {
  beforeEach(() => resetRuntimeConfigForTests())
  afterEach(() => vi.restoreAllMocks())

  it("falls back to defaults when no config.json is served", async () => {
    const cfg = await loadRuntimeConfig({ fetchImpl: stubFetch({ ok: false }) })
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("starts with defaults when the fetch itself throws", async () => {
    const cfg = await loadRuntimeConfig({ fetchImpl: stubFetch({ ok: true, throws: true }) })
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("starts with defaults when config.json is not valid JSON", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token")
      },
    }) as unknown as Response)
    const cfg = await loadRuntimeConfig({ fetchImpl })
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("ignores a config.json that is not an object", async () => {
    const cfg = await loadRuntimeConfig({ fetchImpl: stubFetch({ ok: true, json: ["nope"] }) })
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("merges field by field — a set field wins, a missing one falls through", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: "wss://relay.example.org" } } }),
      buildTimeEnv: { profilesUrl: "https://profiles.build-time.example" },
    })
    expect(cfg.endpoints.relayUrl).toBe("wss://relay.example.org")
    // nicht in config.json gesetzt -> Build-Zeit-Wert traegt
    expect(cfg.endpoints.profilesUrl).toBe("https://profiles.build-time.example")
  })

  it("lets an empty config.json change nothing", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: {} }),
      buildTimeEnv: { relayUrl: "wss://relay.build-time.example" },
    })
    expect(cfg.endpoints.relayUrl).toBe("wss://relay.build-time.example")
  })

  it("prefers config.json over the build-time value", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: "wss://runtime.example" } } }),
      buildTimeEnv: { relayUrl: "wss://build.example" },
    })
    expect(cfg.endpoints.relayUrl).toBe("wss://runtime.example")
  })

  it("carries branding through", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({
        ok: true,
        json: { branding: { appName: "Waldgarten", colors: { light: { primary: "#2f6b3a" } } } },
      }),
    })
    expect(cfg.branding?.appName).toBe("Waldgarten")
    expect(cfg.branding?.colors?.light?.primary).toBe("#2f6b3a")
  })

  it("exposes the loaded config via getRuntimeConfig", async () => {
    await loadRuntimeConfig({ fetchImpl: stubFetch({ ok: true, json: { defaultConnector: "wot" } }) })
    expect(getRuntimeConfig().defaultConnector).toBe("wot")
  })

  it("returns defaults from getRuntimeConfig before loading", () => {
    expect(getRuntimeConfig().endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("loads only once — a second call returns the first result", async () => {
    const fetchImpl = stubFetch({ ok: true, json: { defaultConnector: "wot" } })
    await loadRuntimeConfig({ fetchImpl })
    await loadRuntimeConfig({ fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("requests config.json relative to the base path", async () => {
    const fetchImpl = stubFetch({ ok: true, json: {} })
    await loadRuntimeConfig({ fetchImpl, baseUrl: "/app/" })
    expect(fetchImpl).toHaveBeenCalledWith("/app/config.json", expect.anything())
  })
})

/** Der Wert, der tatsaechlich gilt — nicht der Ort, an dem er abgelegt ist. */
function wirksam(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Raeumt auf, was applyBranding im Dokument hinterlaesst. */
function brandingZuruecksetzen(): void {
  document.documentElement.removeAttribute("style")
  document.documentElement.classList.remove("dark")
  document.getElementById("rls-branding")?.remove()
  document.querySelectorAll("style[data-toolkit]").forEach((e) => e.remove())
}

describe("applyBranding", () => {
  beforeEach(() => {
    resetRuntimeConfigForTests()
    brandingZuruecksetzen()
    document.title = ""
  })

  it("sets the document title from appName", () => {
    applyBranding({ appName: "Waldgarten" })
    expect(document.title).toBe("Waldgarten")
  })

  it("leaves the title alone when appName is absent", () => {
    document.title = "unveraendert"
    applyBranding({ colors: { light: { primary: "#123456" } } })
    expect(document.title).toBe("unveraendert")
  })

  it("makes light colors take effect on the root element", () => {
    applyBranding({ colors: { light: { primary: "#2f6b3a" } } })
    expect(wirksam("--primary")).toBe("#2f6b3a")
  })

  it("ignores token names that are not plain identifiers", () => {
    applyBranding({ colors: { light: { "primary; background: url(x)": "#000" } } })
    expect(document.getElementById("rls-branding")?.textContent ?? "").not.toContain("url(")
    expect(wirksam("--primary")).toBe("")
  })

  it("ignores colour values containing CSS escapes", () => {
    applyBranding({ colors: { light: { primary: "red; --injected: bad" } } })
    expect(wirksam("--injected")).toBe("")
    expect(wirksam("--primary")).toBe("")
  })

  it("does nothing without branding", () => {
    expect(() => applyBranding(undefined)).not.toThrow()
  })
})

describe("the config carries no secrets", () => {
  it("has no field that would hold one", () => {
    // Absicht festhalten: config.json geht an jeden Browser. Ein Feld wie
    // `serviceRoleKey` waere hier ein Fehler, kein Feature.
    const forbidden = ["serviceRoleKey", "secret", "password", "privateKey"]
    const cfg: RuntimeConfig = DEFAULT_RUNTIME_CONFIG
    const flat = JSON.stringify(cfg).toLowerCase()
    for (const f of forbidden) expect(flat).not.toContain(f.toLowerCase())
  })
})

describe("Validierung (Review #276)", () => {
  beforeEach(() => resetRuntimeConfigForTests())
  afterEach(() => vi.restoreAllMocks())

  it("rejects an unknown connector instead of passing it through to the mock", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { defaultConnector: "wto" } }),
      allowedConnectors: ["wot", "local", "supabase", "mock"],
    })
    expect(cfg.defaultConnector).toBe("wot")
  })

  it("keeps a known connector", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { defaultConnector: "supabase" } }),
      allowedConnectors: ["wot", "local", "supabase", "mock"],
    })
    expect(cfg.defaultConnector).toBe("supabase")
  })

  it("skips a relayUrl that is not a websocket URL and takes the next stage", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: "https://not-a-relay.example" } } }),
    })
    // NICHT undefined: der ungueltige Wert faellt durch, der Standard traegt.
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("skips an endpoint that is not a URL at all", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { profilesUrl: "kaputt" } } }),
    })
    expect(cfg.endpoints.profilesUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.profilesUrl)
  })

  it("keeps the default config immutable", () => {
    expect(Object.isFrozen(DEFAULT_RUNTIME_CONFIG)).toBe(true)
    expect(Object.isFrozen(DEFAULT_RUNTIME_CONFIG.endpoints)).toBe(true)
  })

  it("freezes the loaded config tree", async () => {
    const cfg = await loadRuntimeConfig({ fetchImpl: stubFetch({ ok: true, json: {} }) })
    expect(Object.isFrozen(cfg)).toBe(true)
    expect(Object.isFrozen(cfg.endpoints)).toBe(true)
  })

  it("loads colours from colorsUrl into branding", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const body = url.endsWith("config.json")
        ? { branding: { appName: "Waldgarten", colorsUrl: "/branding/theme.json" } }
        : { light: { primary: "#2f6b3a" } }
      return { ok: true, status: 200, json: async () => body } as unknown as Response
    })
    const cfg = await loadRuntimeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(cfg.branding?.colors?.light?.primary).toBe("#2f6b3a")
  })

  it("keeps the rest of the config when the colour file is broken", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith("config.json")) {
        return {
          ok: true, status: 200,
          json: async () => ({ endpoints: { relayUrl: "wss://relay.example" }, branding: { appName: "Waldgarten", colorsUrl: "/branding/theme.json" } }),
        } as unknown as Response
      }
      return { ok: true, status: 200, json: async () => { throw new SyntaxError("kaputt") } } as unknown as Response
    })
    const cfg = await loadRuntimeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch })
    // Farben weg, alles andere steht — das ist der Sinn der Trennung.
    expect(cfg.branding?.colors).toBeUndefined()
    expect(cfg.branding?.appName).toBe("Waldgarten")
    expect(cfg.endpoints.relayUrl).toBe("wss://relay.example")
  })
})

describe("applyBranding — Tokenpruefung (Review #276)", () => {
  beforeEach(() => {
    resetRuntimeConfigForTests()
    brandingZuruecksetzen()
  })

  /** Simuliert die Tokens des Toolkits, damit die Herkunftspruefung greifen kann. */
  function withToolkitTokens(names: string[]) {
    const style = document.createElement("style")
    style.setAttribute("data-toolkit", "")
    style.textContent = `:root { ${names.map((n) => `--${n}: red;`).join(" ")} }`
    document.head.appendChild(style)
  }

  it("accepts oklch() and other function notations", () => {
    withToolkitTokens(["primary"])
    applyBranding({ colors: { light: { primary: "oklch(0.63 0.16 55)" } } })
    expect(wirksam("--primary")).toBe("oklch(0.63 0.16 55)")
  })

  it("ignores a syntactically valid but unknown token name", () => {
    withToolkitTokens(["primary"])
    applyBranding({ colors: { light: { "erfundenes-token": "#123456" } } })
    expect(wirksam("--erfundenes-token")).toBe("")
  })

  it("still applies tokens when no stylesheet is readable", () => {
    // Kein Toolkit-CSS im Dokument -> nicht filtern, sonst waere frueh
    // aufgerufenes Branding komplett wirkungslos.
    applyBranding({ colors: { light: { primary: "#123456" } } })
    expect(wirksam("--primary")).toBe("#123456")
  })

  it("rejects a value that tries to smuggle a url()", () => {
    withToolkitTokens(["primary"])
    applyBranding({ colors: { light: { primary: "url(https://evil.example/x)" } } })
    expect(wirksam("--primary")).toBe("red")
  })

  it("rejects an over-long value", () => {
    withToolkitTokens(["primary"])
    applyBranding({ colors: { light: { primary: "#".padEnd(200, "a") } } })
    expect(wirksam("--primary")).toBe("red")
  })
})

describe("applyBranding — Branding und Dunkelmodus (Spec 11, Regel 2)", () => {
  beforeEach(() => {
    resetRuntimeConfigForTests()
    brandingZuruecksetzen()
  })

  /** Toolkit-CSS mit hellen UND dunklen Werten — so sieht die echte App aus. */
  function withToolkitTheme() {
    const style = document.createElement("style")
    style.setAttribute("data-toolkit", "")
    style.textContent = `:root { --primary: rgb(1, 1, 1); } .dark { --primary: rgb(2, 2, 2); }`
    document.head.appendChild(style)
  }

  it("laesst die gebrandeten Dunkel-Werte unter .dark gelten", () => {
    withToolkitTheme()
    applyBranding({
      colors: { light: { primary: "rgb(255, 255, 255)" }, dark: { primary: "rgb(10, 10, 10)" } },
    })
    document.documentElement.classList.add("dark")
    expect(wirksam("--primary")).toBe("rgb(10, 10, 10)")
  })

  it("laesst den Dunkelmodus der App stehen, wenn nur Helligkeit gebrandet ist", () => {
    // Der Fall, der eine gebrandete Instanz um ihren Dunkelmodus bringt:
    // Light-Branding darf die dunklen Werte des Toolkits NICHT ueberschreiben.
    withToolkitTheme()
    applyBranding({ colors: { light: { primary: "rgb(255, 255, 255)" } } })
    document.documentElement.classList.add("dark")
    expect(wirksam("--primary")).toBe("rgb(2, 2, 2)")
  })

  it("laesst die gebrandeten Hell-Werte ohne .dark gelten", () => {
    withToolkitTheme()
    applyBranding({ colors: { light: { primary: "rgb(255, 255, 255)" } } })
    expect(wirksam("--primary")).toBe("rgb(255, 255, 255)")
  })
})

describe("Nicht-Strings brechen die Vorrangkette nicht (Re-Review #276)", () => {
  beforeEach(() => resetRuntimeConfigForTests())
  afterEach(() => vi.restoreAllMocks())

  it("ignores a numeric endpoint and keeps the build-time value", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: 42 } } }),
      buildTimeEnv: { relayUrl: "wss://relay.build.example" },
    })
    expect(cfg.endpoints.relayUrl).toBe("wss://relay.build.example")
  })

  it("ignores an object endpoint and keeps the default", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: { url: "wss://x" } } } }),
    })
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("ignores a boolean endpoint", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { profilesUrl: true } } }),
    })
    expect(cfg.endpoints.profilesUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.profilesUrl)
  })

  it("ignores a non-string defaultConnector", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { defaultConnector: ["wot"] } }),
      allowedConnectors: ["wot", "mock"],
    })
    expect(cfg.defaultConnector).toBe(DEFAULT_RUNTIME_CONFIG.defaultConnector)
  })

  it("never leaves a non-string in the endpoints", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: 1, profilesUrl: null, supabaseUrl: [] } } }),
    })
    for (const v of Object.values(cfg.endpoints)) expect(typeof v).toBe("string")
    // und die Kette hat getragen, statt die Felder zu verlieren
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })
})

describe("Ungueltiges faellt DURCH die Kette (Re-Review #276)", () => {
  beforeEach(() => resetRuntimeConfigForTests())
  afterEach(() => vi.restoreAllMocks())

  it("falls back to the build-time value when config.json holds a bad URL", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: "https://kein-relay" } } }),
      buildTimeEnv: { relayUrl: "wss://relay.build.example" },
    })
    // Vorher wurde das Feld geloescht — der gueltige Build-Wert kam nie zum Zug.
    expect(cfg.endpoints.relayUrl).toBe("wss://relay.build.example")
  })

  it("falls back to the default when both config.json and build-time are bad", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: "kaputt" } } }),
      buildTimeEnv: { relayUrl: "auch-kaputt" },
    })
    expect(cfg.endpoints.relayUrl).toBe(DEFAULT_RUNTIME_CONFIG.endpoints.relayUrl)
  })

  it("falls back over a non-string too", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { profilesUrl: 42 } } }),
      buildTimeEnv: { profilesUrl: "https://profiles.build.example" },
    })
    expect(cfg.endpoints.profilesUrl).toBe("https://profiles.build.example")
  })

  it("falls back to the build-time connector when config.json names an unknown one", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { defaultConnector: "wto" } }),
      buildTimeEnv: { defaultConnector: "supabase" },
      allowedConnectors: ["wot", "supabase", "local", "mock"],
    })
    // Vorher sprang die Kette direkt auf den Standard und uebersprang Stufe 2.
    expect(cfg.defaultConnector).toBe("supabase")
  })

  it("keeps a valid config.json value ahead of build-time", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({ ok: true, json: { endpoints: { relayUrl: "wss://runtime.example" } } }),
      buildTimeEnv: { relayUrl: "wss://build.example" },
    })
    expect(cfg.endpoints.relayUrl).toBe("wss://runtime.example")
  })

  it("freezes branding deeply", async () => {
    const cfg = await loadRuntimeConfig({
      fetchImpl: stubFetch({
        ok: true,
        json: { branding: { appName: "X", colors: { light: { primary: "#fff" }, dark: { primary: "#000" } } } },
      }),
    })
    expect(Object.isFrozen(cfg.branding)).toBe(true)
    expect(Object.isFrozen(cfg.branding?.colors)).toBe(true)
    expect(Object.isFrozen(cfg.branding?.colors?.light)).toBe(true)
    expect(Object.isFrozen(cfg.branding?.colors?.dark)).toBe(true)
  })
})

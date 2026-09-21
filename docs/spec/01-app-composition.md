# App Composition

**Status:** Normativer Entwurf v0.1

Diese Spec beschreibt, wie eine RLS-App strukturiert ist. Sie definiert die Trennung zwischen App Shell, Current Space, Space Modules und Module Components.

Code-Referenzen:

- `packages/toolkit/src/components/layout/`
- `packages/toolkit/src/components/feed/`
- `packages/toolkit/src/components/kanban/`
- `packages/toolkit/src/components/calendar/`
- `packages/toolkit/src/components/map/`
- `packages/toolkit/src/components/detail/` — modul-agnostisches Detail-Panel
- `packages/toolkit/src/hooks/`
- `apps/reference/src/App.tsx` — Komposition: Provider, AuthGate, App Shell
- `apps/reference/src/views/` — ein File pro Space Module + `module-outlet.tsx` (Dispatch)
- `apps/reference/src/hooks/use-workspace-routing.ts` — Space/Module-Auflösung aus URL

## Grundstruktur

```text
App
├─ App Shell
│  ├─ Navigation
│  ├─ Space Switcher
│  ├─ User/Profile
│  ├─ Contacts/Verification
│  ├─ Notifications/Events
│  └─ Debug/Admin
└─ Current Space
   └─ Space Modules
      ├─ Feed
      ├─ Kanban
      ├─ Calendar
      ├─ Map
      ├─ Resonance
      ├─ Collection
      └─ Graph
```

Jedes Space Module kann aus Module Components zusammengesetzt sein.

Kernregel:

```text
App Shell = globaler, space-übergreifender Rahmen
Space Module = pro Space aktivierbare Oberfläche
Module Component = wiederverwendbarer Baustein innerhalb von Modulen
```

## App Shell

Die App Shell ist der globale Rahmen einer RLS-App. Sie lebt nicht innerhalb eines einzelnen Space und ist nicht pro Space aktivierbar.

Zur App Shell gehören:

- Navigation,
- Space- oder Workspace-Wechsel,
- User Menu,
- Profilzugang,
- Kontakte,
- Verifikation,
- Auth,
- Notifications und eingehende Events,
- Relay-, Delivery- oder Sync-Status,
- globale Dialoge,
- Debug- und Adminflächen.

Regeln:

1. Die App Shell darf den aktuellen Space auswählen und anzeigen.
2. Die App Shell darf globale Connector-Capabilities nutzen, z.B. Auth, Contacts, Verification, Messaging oder Profile.
3. Die App Shell darf Space Modules aktivieren, deaktivieren oder navigierbar machen.
4. Die App Shell ist nicht selbst ein Space Module.
5. Funktionen wie Profile, Contacts, Verification oder Auth sind App-Shell-Flächen, auch wenn ihre Daten in Space Modules sichtbar werden können.

## Overlay-Flächen (Panels, Dialoge, Notifications)

Overlays folgen einem Drei-Ebenen-Modell. Pro Ebene gibt es höchstens **eine** Fläche; Ebenen dürfen einander überlagern, weil sie sichtbar von anderer Art sind.

| Ebene | Fläche | Form | Inhalt |
|---|---|---|---|
| 1 Content-Panel | eine app-weite Instanz | Sidebar (Desktop) ↔ Drawer (Mobile) | Item-Detail, Composer, Filter — Content wird getauscht, nie gestapelt |
| 2 Dialog | eine Instanz | zentriertes Modal + Backdrop (Desktop) / Sheet (Mobile) | fokussierte Tasks: Kontakte, Verifizieren, Gruppe, Profil |
| 3 Notification | nicht-destruktiver Hinweis | Banner / Toast | zeitkritische Interrupts: eingehende Verifizierung, Space-Einladung |

Der **Drawer endet oben an der Schutzzone** des Geräts (Statusleiste, Notch): Ganz aufgezogen reicht er bis an sie heran, nicht bis an den Fensterrand, und ein Zug darüber hinaus wird geklemmt. Sonst liegen Griff und Schließen darunter, und das Blatt lässt sich nicht mehr verkleinern (randlose Android-Geräte). Die Zone hat **eine Quelle** (`--safe-top`): Was die Plattform meldet, gilt — auf Android schreibt Capacitor sie in die Wurzel, weil `env()` dort nichts liefert; sonst löst `env(safe-area-inset-top)` sie auf. Ein fester Wert wäre auf dem nächsten Gerät falsch.

Regeln:

1. **Eine Fläche pro Ebene.** Gleichartige Flächen werden nie gestapelt — das verhindert „Panel über Panel" strukturell, nicht per z-index.
2. **Das Content-Panel ist persistent.** Es bleibt beim Modul-Wechsel offen und hält, was der Nutzer zuletzt geöffnet hat, bis er schließt oder anderen Content öffnet.
3. **Dialoge überlagern, ersetzen nicht.** Ein abgedunkeltes Modal liest sich als höhere Ebene und erhält den Content darunter. Ein Dialog ist nie eine zweite Sidebar.
4. **Interrupts stehlen nie den Kontext.** Ebene 3 ersetzt nie Ebene-1/2-Content und nimmt keinen Fokus; der Nutzer öffnet sie bewusst, der Flow landet dann in Ebene 2.
5. **Verschachtelte Flows pro Ebene laufen über einen Back-Stack** (z.B. Kontakte → Verifizieren → zurück), nie über eine zweite gleichartige Fläche.
6. Overlays sind **Präsentation, nie Aktivierung** — welche Items ein Modul zeigt, entscheidet Feld-Präsenz (siehe [06-schema-composition.md](06-schema-composition.md)), nie eine Overlay-Fläche.

### Content-Bereich

Der Content-Bereich ist die Fläche unterhalb der Top-Navigation, links einer rechten Sidebar und rechts einer linken Sidebar. Er rückt automatisch ein, wenn eine Sidebar öffnet (die Panel-Fläche publiziert ihre Breite als CSS-Variable, die der Content als Padding konsumiert); sonst ist er eine `flex-1`-Spalte.

Module wählen einen **Füllmodus** im Content-Bereich: *full-bleed* (füllt die Fläche randlos, z.B. Map) oder *zentrierter Container* (Standard, z.B. Feed, Calendar, Kanban). Full-bleed räumt auf Mobile auch unter die BottomNav.

Nicht jedes Modul darf einrücken. Für Feed, Kalender oder Kanban ist die Fläche ein **Behälter**: Wird sie schmaler, rückt der Inhalt nach — nichts geht verloren. Für Karte und Graph IST die Fläche der Inhalt: Eine Karte, die beim Öffnen eines Details schmaler wird, zeigt weniger Welt, und der gerade angeklickte Punkt wandert unter dem Zeiger weg. Solche Module tragen darum `panelFit: "overlay"`; das Panel legt sich über sie, statt sie zu verdrängen. Daraus folgen drei Pflichten:

1. Das Modul entscheidet das nicht selbst und die App auch nicht: `panelFit` steht im **Registereintrag** (siehe unten). Eine Liste in der App, welches Modul überlagert wird, driftet.
2. Schwebende Bedienelemente über einer überlagerten Fläche — Zoom-Knöpfe, Ladeanzeige, Hinweise — rücken trotzdem ein. Sie lesen dieselbe CSS-Variable und liegen dafür in einer gemeinsamen Schutzzone (`PanelSafeArea`), nicht jedes für sich. Was die ganze Fläche bedeckt (ein Ladeschleier), bleibt dagegen ganzflächig, sonst hat der Bereich hinter dem Panel eine andere Farbe.
3. Eine überlagerte Fläche MUSS ihr eigenes Zentrum korrigieren: Was sie in den Blick nimmt, gehört in die Mitte des **sichtbaren** Rests, nicht der ganzen Fläche — sonst öffnet sich die Detailkarte genau über dem Punkt, den sie beschreibt.

Der Übergang gehört dem Panel: Die Fläche weicht einem auf- oder zugehenden Panel animiert aus. Wechselt dagegen das Modul und damit die Regel, MUSS die neue Breite sofort gelten — animiert sähe man ein zu breit gestartetes Modul zusammenschnurren.

### Die Modulfläche ist eine Spalte

Ein fester **Kopf**, darunter der **Scrollbereich**. Was scrollt, ist der Inhalt — nicht die Fläche.

**Zwei Beobachtungen, eine Ursache.** Vorher reichte die Fläche bis zum Fensterrand und enthielt alles; nur ihr Inhalt rückte per Padding ein. Daraus folgte beides: Die Scrollleiste klemmte im schmalen Spalt rechts *neben* dem Panel, und die Modul-Steuerleiste scrollte mit weg — wer weit unten in einer langen Liste filtern will, musste erst zurück nach oben.

Regeln:

1. Die Fläche weicht dem Panel per **Margin** aus, nicht per Padding. Nur so endet der Scrollbereich dort, wo der Platz endet, und die Leiste sitzt links vom Panel.
2. Die **Steuerelemente eines Moduls** (Ansichtswechsel, „Heute", Ortung, aktive Filter) gehören in den Kopf, nicht in den Scrollbereich. Module reichen sie über `ModuleToolbar` hinein; die Fläche besitzt den Kopf. Es `sticky` im Modul zu lösen wäre billiger — dann löst es aber jedes Modul selbst, und die Lösungen driften auseinander.
2a. **Was sich Module teilen können, gehört der Fläche — nicht dem Modul.** Das ist die allgemeine Regel; die Suche ist ihr erster Fall. Der Prüfsatz: Lässt sich etwas aus den Items des Space oder aus dem geteilten Filterzustand ableiten, dann ist es geteilt und die Fläche stellt es genau einmal her. Dem Modul gehört nur, was ohne seinen eigenen Zustand nicht zu beantworten wäre.

    Geteilt sind heute: die **Suche**, das **Vokabular** (welche Tags und Typen es im Space gibt), die **Filterkarte** und die **Chips der aktiven Filter**. Ein Modul MUSS sie über die Fläche beziehen (`useSpaceVocabulary`) und DARF sie nicht selbst ableiten.

    Dem Modul gehören: seine **Steuerelemente** (Ansichtswechsel, „Heute", Ortung), seine **eigenen Chips** (`chipsExtra`) und seine **eigenen Abschnitte in der Filterkarte** (`drawerExtra`).

    Der Grund ist nicht Sparsamkeit, sondern Konsistenz: `availableTags` stand siebenmal im Code und `availableTypes` viermal, und die Kopien liefen auseinander — Kanban sortierte nicht, der Kalender gab weder Symbol noch Farbe mit, und die Karte nannte einen Typ anders als das Typ-Register. Niemand meldet so etwas, weil es keinen Test bricht (Anton, 19.09.2026).

2b. Die **Suche gehört der Fläche, nicht dem Modul.** Sie zieht sich ausnahmslos durch alle Module und Linsen, hat mit dem `FilterProvider` ohnehin schon einen flächenweiten Zustand, und die `ModuleFrame` rendert sie deshalb genau einmal — bevor irgendein Modul etwas beiträgt. Ein Modul DARF sie weder mitbringen noch abschalten; seine eigenen Steuerelemente stehen rechts daneben, in derselben Zeile. Ihre Beschriftung nennt den Space, nicht das Modul: Was sie durchsucht, wechselt beim Modulwechsel nicht. Vorher brachte jedes Modul sie mit, und wo zwei Beiträge in denselben Kopf portalten — einer vom Modul, einer von der Linse — standen zwei Suchfelder untereinander (Anton, 19.09.2026).
3. Eine Fläche, die **außerhalb der App** läuft (Story, Test, eingebettete Ansicht), bringt ihre Modulfläche selbst mit (`ModuleSurfaceScope` — zusammen mit dem Besitzer des Filters, siehe [modules/shared-components.md](modules/shared-components.md)); ein vorhandener Kopf wird durchgereicht, ein zweiter nie angelegt. Nur die **nackte Steuerleiste** ohne jede Fläche darüber rendert an Ort und Stelle, statt spurlos zu verschwinden — sonst stünde ihre Filter-Pille dort, wo gerade Platz ist, statt unten links.
4. Ein Kopf, in dem nichts steht, bekommt **keine leere Zeile**: Er verschwindet. Da die Suche immer steht (Regel 2a), tritt das nur ohne Besitzer des Filters ein — außerhalb der App, in einem nackten Rahmen.
5. Für `panelFit: "overlay"` schwebt derselbe Kopf-Inhalt **über** der Fläche statt über ihr zu stehen (oben links, in der `PanelSafeArea`; Feld und Chips auf eigener Fläche, weil eine Karte keinen ruhigen Untergrund hat). Gehostet wird er weiterhin von der **Fläche**: Zwei Wirte für dieselben Bausteine laufen auseinander — im Graphen fehlte darum die Chip-Zeile. Ein Modul, das dort eigene Bedienelemente führt (Zoom der Karte), sagt das als Beitrag (`clearsTopLeft`), statt sich einen zweiten Kopf zu bauen.
6. Das **Öffnen des Filters** gehört NICHT in den Kopf, sondern zu den schwebenden Bedienelementen: eine Pille unten links der Fläche (`FilterPill` in der `PanelSafeArea`, siehe [modules/shared-components.md → `FilterPill`](modules/shared-components.md)). Sie ist ein Werkzeug, kein Zustand, und nimmt der Fläche darum eine Ecke statt einer Zeile. Was gerade **filtert**, bleibt oben im Kopf — in Blickrichtung des Inhalts, den es beschneidet. Auch überlagerte Module führen sie, dort schwebend wie ihr Kopf.

### Verworfene Alternativen

Festgehalten, damit sie nicht neu aufgemacht werden:

- **Panel-Provider pro View:** jedes Modul mountete sein eigenes Panel, Debug/Profil separat — verursachte die gleichseitige Überlagerung und verlor die modulübergreifende Persistenz.
- **Debug nach links:** links ist für ein späteres Nav-Menü reserviert, und eine nicht-modale Dev-Sidebar neben dem Content ist dasselbe Anti-Pattern; das eine rechte Panel zu teilen ist sauberer.
- **Reines Flex-Row mit Sidebars als Flex-Children:** der Mobile-Drawer/Modal kann kein Flex-Child sein, also bräuchte es trotzdem die Overlay-Ausnahme; das CSS-Var-Inset liefert denselben Content-Bereich (inkl. links).
- **Dialoge als `AdaptivePanel`s / ein Stack für alles:** Dialoge sind immer zentrierte Modals (nie Sidebar/Drawer); und Interrupts in das eine Panel zu falten ließe ein System-Event den Nutzer-Kontext verdrängen.

## Current Space

Der Current Space ist der aktuell ausgewählte Arbeits-, Sichtbarkeits- und Mitgliedschaftskontext. Im RLS-Code wird er technisch meist als `Group` abgebildet.

Regeln:

1. Space Modules arbeiten im Kontext des Current Space.
2. Welche Space Modules aktiv sind, kann über Space-/Group-Metadaten ausgedrückt werden, z.B. `Group.data.modules`.
3. Ein Space kann andere Module aktivieren als ein anderer Space.
4. Ein Netzwerk, Label oder White-Label-Kontext ist nicht automatisch ein Space. Er kann mehrere Spaces umfassen.

## Space Modules

Ein Space Module ist eine aktivierbare Oberfläche innerhalb eines Space.

Ein Space Module:

- erscheint typischerweise in Navigation, Tabs oder Space-Konfiguration,
- arbeitet gegen Hooks, `DataInterface` und optionale Capabilities,
- zeigt und bearbeitet Items, Relations, Confirmations oder andere Projektionen im Current Space,
- darf eigene UI-Zustände besitzen,
- darf keine Backend-Annahmen treffen,
- besitzt nicht die soziale Semantik von RLNP,
- besitzt nicht die Spielregeln des Real Life Game,
- besitzt nicht die kryptografische Wahrheit von WoT.

Beispiele:

| Space Module | Aufgabe | Grundlage |
|---|---|---|
| Feed | Aktivität, Posts, Events, Dokumentation, Kommentare, Reaktionen | Items und Relations |
| Map | räumliche Ansicht auf Orte, Events und Ressourcen | Items mit `position` |
| Calendar | zeitliche Monats-, Wochen-, Tages- oder Listenansicht | Items mit `start` / `end` |
| Kanban / Tasks | Aufgaben- und Workflow-Ansicht | Items mit `status` |
| Resonance | Zustimmung und Vorbehalt zu Aussagen | Items einer Klasse, die die Affordanz `votesOn` deklariert (Spec 06, „Klassen haben IRIs") — der erklärten Fähigkeit, Stellungnahmen zu tragen; die Stimmen selbst sind Relation Records. Nie die Stimmen: Eine frisch eingebrachte Aussage hat noch keine und muss trotzdem dort erscheinen, wo man sie bewertet |
| Collection | Liste oder Raster über alles, was der Space hält | alle Items, die in einer aggregierenden Ansicht erscheinen |
| Graph | Items und ihre Beziehungen als Netz | Items und Relations |

## Modul-Register

**Ein** kanonischer Eintrag pro Modul, geteilt von allen Flächen. Er beantwortet genau eine Frage — *was folgt daraus, dass ein Space dieses Modul führt?* — und beantwortet sie an genau einer Stelle.

Motivation aus der Praxis: Dieselbe Frage wurde an fünf Stellen unabhängig beantwortet — Aktivierbarkeit im Space-Dialog, gültige Modul-Segmente im Routing, Anzeigenamen, Dispatch der Fläche und die Fallback-Liste der Benachrichtigungs-Navigation. Die Listen sind nachweislich auseinandergelaufen: `collection` und `graph` fehlten in der Benachrichtigungs-Liste, und ein neu gebautes Modul erschien in der Space-Übersicht, ließ sich aber in **keinem** Space aktivieren, weil der Eintrag im Space-Dialog fehlte. Beides ist lautlos passiert.

Das Muster folgt dem Typ-Register aus [06-schema-composition.md](06-schema-composition.md) — mit einem Unterschied: Ein Modul ist vollständig eine Darstellungssache. Es braucht darum keine UI-freie Schicht in `data-interface`; das Register lebt im Toolkit, und Apps hängen ihre Flächen an die Ids.

### Eintrag

| Feld | Zweck |
|---|---|
| `id` | stabile Modul-Identität; zugleich URL-Segment und Schlüssel in `Group.data.modules` |
| `label` | Anzeigename in Tabs und Space-Dialog |
| `icon` | Modul-Icon |
| `enabledByDefault` | ob ein neu angelegter Space das Modul führt |
| `fill` | wie das Modul den Content-Bereich füllt: `container` oder `bleed` |
| `maxWidth` | Breite des Inhalts: bei `fill: "container"` die des Containers, bei `fill: "bleed"` die, an der sich **Kopf und Inhalt** ausrichten — die Lens liest sie aus der Fläche (`useModuleContentClass`), statt eine eigene zu führen, sonst stehen Kopf und Einträge nicht mehr bündig |
| `keepMounted` | Fläche im Baum halten statt beim Wechsel abzubauen — für Module, deren Aufbau teuer ist (Map: WebGL-Kontext, Worker, entfernter Style) |
| `panelFit` | ob ein offenes Panel die Fläche einrückt (`inset`, Standard) oder sich darüber legt (`overlay`) — siehe Content-Bereich |
| `presents` | **Aktivierungshinweise**: was dieses Modul darstellen kann (Karte: `position`, Kalender: `start`, Kanban: `status`, Resonanz: `statement`). Ein Hinweis ist ein Feld **oder** eine Klasse mit deklarierter Affordanz (Spec 06); welches von beiden, weiß `data-interface`, nicht der Eintrag — siehe „Der Ladevertrag" und „Ein Feld führt zu seiner Sicht" |
| `loads` | wer die Items des Moduls lädt: `host` (Standard — aus `presents`) oder `module`. `module` sagt die Karte, die nach Kartenausschnitt lädt; der Host stellt dann **keine** eigene Abfrage. *Aus rls#411: das eine Feld, das der Host wirklich braucht; umgesetzt in rls#414* |
| `options` | modulspezifische Konfiguration: was in den Ladevertrag eingeht (Kanban: `statusField`, Standard `status`) und was der Host liest — `suggestType` (der Vorschlag des Plusknopfs) und `createShell` (`sheet`, Standard, oder `fullscreen` für den Feed). Heute statisch im Eintrag; sobald Module je Space konfigurierbar sind, kommt derselbe Wert aus dem Space. *Umgesetzt in rls#414* |
| `view` | die Fläche selbst. Für die Toolkit-Module liefert sie das **Toolkit** — vollständig, lauffähig ohne eine Zeile in der App (siehe „Der Modul-Host"). Eine App DARF sie in ihrer Erweiterung **ersetzen** — ausdrücklich, mit `replaces: ["view"]` am Fragment (Regel 2; Anton, 21.09.2026) — oder ein eigenes Modul mit eigener Fläche hinzufügen. *Bis zum 21.09.2026 steuerte die App jede Fläche bei; die Verdrahtung darum stand deshalb siebenmal in der Referenz-App.* |

### Regeln

1. Das Register MUSS die **einzige** Quelle für die Frage sein, welche Module es gibt. Jede Fläche, die Module aufzählt, anbietet, benennt oder anzeigt, MUSS ihre Liste daraus ableiten. Eine zweite Aufzählung von Modul-Ids ist ein Fehler in dieser Spec.
2. Ein Modul wird durch genau **einen** Registereintrag eingeführt; eine bereits vergebene `id` ist ein Konflikt und MUSS abgelehnt werden. Das Toolkit **definiert** das Register (seine Module vollständig, samt Fläche), eine App **erweitert** es mit eigenen Modulen oder mit Ergänzungen an vorhandenen — **Definition vor Erweiterung**, ergänzt werden kann nur, was schon eingeführt ist. Eine Erweiterung ist additiv: Ein Feld, das die Definition schon gesetzt hat, DARF sie nur ersetzen, wenn sie den Ersatz ausdrücklich benennt (`replaces: ["view"]`). Alles andere ist ein Konflikt, der die Zusammensetzung mit Feld und beiden Quellen abbricht; es gibt kein Shadowing.

    *Bis zum 21.09.2026 hieß das hier „Schichten in der Reihenfolge Core → App". Das Wort versprach eine Architektur, die es nicht gibt: Es waren genau zwei Eingaben, und die zweite trug nur `view` nach — was mit dem Modul-Host entfällt. „Schicht" gehört Spec 00 (UI-Flächen, Hooks, DataInterface, Connector, Datenquelle); hier hat es nichts zu suchen. Und „Core" ist kein Wort für den Stack: RLS hat keinen Kern, es hat ein `DataInterface` mit einem Pflichtteil und Fähigkeiten darüber (Anton, 21.09.2026). Dass Spec 00 und 02 diesen Pflichtteil bisher „Core" nennen, ist ein eigener Befund; hier heißen die Module, die das Toolkit definiert, jedenfalls Toolkit-Module. Der Mechanismus bleibt, seine Namen nicht.*

3. **Lebenszyklus: eine beobachtbare Quelle, Änderungen atomar.** Es gibt genau ein Register, und jede Fläche liest es aus derselben Quelle. Ändert es sich, geschieht das **in einem Schritt** — Definition und Erweiterungen werden zusammengesetzt, geprüft (Regel 2) und dann als Ganzes gebunden; keine Fläche sieht einen halb zusammengesetzten Stand — und **alle Flächen erfahren es**, so wie sie jede andere Änderung im Stack erfahren: über eine Beobachtung, nicht über einen Schnappschuss. Eine Fläche DARF das Register darum NICHT beim Import in eine Konstante schreiben — ein solcher Schnappschuss sieht eine spätere Erweiterung nicht, und der Fehler zeigt sich nur bei bestimmter Importreihenfolge. Jede Abfrage liest den aktuellen Stand; wer über Zeit richtig bleiben will, abonniert.

    Heute ändert sich das Register nach dem ersten Render nicht — es wird einmal gebunden und dann eingefroren. Das ist der **Sonderfall**, nicht die Regel: das billigste Mittel für Konsistenz, solange nichts nachgeladen wird. Ein Marktplatz, der Module zur Laufzeit installiert, ändert daran nur den Zeitpunkt, nicht den Vertrag; er ersetzt das Einfrieren durch die atomare Neubindung oben (Anton, 21.09.2026). Dasselbe Register erneut zu binden bleibt **folgenlos erlaubt**: idempotent, damit ein zweiter Import derselben Bindung nicht bestraft wird.

4. **Ein Space erweitert das Register nicht.** Das Register ist ein globaler Katalog, der vor dem ersten Render feststeht; der aktive Space wechselt dagegen zur Laufzeit. Ein Space *definiert* darum keine Module, er **wählt** aus dem Katalog: `Group.data.modules` ist eine Auswahl, kein Beitrag. Das Register sagt, was es gibt und was ein neuer Space voreingestellt bekommt — nicht, was ein bestehender Space zeigt. Der Grund dahinter trägt auch dann noch, wenn Module aus einem Marktplatz kommen: **Daten ja, Code nein.** Ein Space bringt sein Domänenmodell als Daten mit — welche Module er führt, künftig auch welche Typen und Filter — und das teilt sich mit dem Space. Ein Modul ist dagegen **Code, der im Client jedes Mitglieds läuft**; könnte ein Space ihn einbringen, würde der Beitritt zu einem Space zur Ausführung fremden Codes. Das ist eine andere Vertrauensfrage als das Teilen von Daten. Ein Marktplatz installiert Module deshalb auf **App- oder Instanz-Ebene**, wie eine Browser-Erweiterung, und Spaces wählen aus dem, was installiert ist (Anton, 21.09.2026). Regel 6 macht den Rest: Ein Space DARF auf ein Modul verweisen, das dieser Client nicht hat — die Id bleibt erhalten, der Tab bleibt weg. Fremde Module tragen ihren Anbieter in der Id (Domain oder DID), damit zwei „Kalender" zweier Anbieter kein Konflikt nach Regel 2 sind, sondern zwei Module.

5. **Die Auswahl gehört ebenfalls an eine Stelle.** Aus einer gespeicherten Liste eine benutzbare zu machen und daraus ein aktives Modul zu wählen, sind zwei Operationen, die das Register anbietet und die jede Fläche benutzt — Routing, Tabs, Space-Wechsel und Benachrichtigungen. Sie selbst zusammenzusetzen ist derselbe Fehler wie eine zweite Modul-Liste: Es hat bereits dazu geführt, dass ein Sprung aus einer Benachrichtigung im Feed statt auf der Karte landete, weil eine Aufrufstelle den Leer-Fall anders behandelte als die andere.
6. Eine `id` in `Group.data.modules` ohne Registereintrag ist **kein Fehler**: Sie stammt aus einer anderen App-Version oder einem Modul, das diese App nicht kennt. Sie MUSS erhalten bleiben (nie stillschweigend entfernt) und DARF NICHT dargestellt werden. Zählungen, Garantien — etwa „mindestens ein Modul bleibt aktiv" — **und jede Auswahl eines aktiven Moduls** MÜSSEN die darstellbaren Einträge nehmen, nie die rohe Liste: Sonst bestimmt eine fremde Id das Routing, und der Nutzer landet auf einem Tab ohne Fläche. Bleibt nach dem Filtern nichts übrig, greift der volle Satz — ein Space ganz ohne Tab wäre schlimmer als einer mit den Vorgaben.
7. Ein Registereintrag ohne `view` MUSS sichtbar degradieren (Hinweis statt leerer Fläche). Ein Modul, das im Tab erscheint und dann nichts zeigt, ist schlimmer als eines, das fehlt.
8. Das Register trägt **keine Aktivierungsregel**: Welche Items ein Modul zeigt, entscheidet Feld-Präsenz (siehe [06-schema-composition.md](06-schema-composition.md)), nie ein Eintrag hier. `presents` ist keine Ausnahme davon, sondern ihre Anwendung: Es nennt die Felder, und der Host leitet daraus den Filter ab — dieselbe Regel, die auch „Ein Feld führt zu seiner Sicht" trägt. Ein Modul ohne `presents` zeigt alles, was in einer aggregierenden Ansicht erscheint. Und die Präsenz ist die des **Feldes**, nie die des Typs — auch nicht als Abkürzung davor: `hasStatus` prüfte bis zum 21.09.2026 zuerst `type === "task"`, und ein Task ohne Status wurde in ein Kanban geleitet, das ihn nicht zeigte.

### Der Modul-Host

**Status: umgesetzt, rls#414 (B0, 21.09.2026).** `ModuleHost` in `packages/toolkit/src/components/host/module-host.tsx`; das Outlet rendert jede Fläche darin. Feed (B1), Kalender und Karte laufen ohne eine Zeile in der App; die vier übrigen Ansichten der Referenz-App lesen Items und Kontext vom Host und ziehen je in einem eigenen Schritt (B2–B5) ins Toolkit.

Der Registereintrag beantwortet, *was folgt daraus, dass ein Space dieses Modul führt*. Der Host ist die Stelle, die aus der Antwort eine laufende Fläche macht — **einmal**, für alle Module.

**Befund, der ihn nötig macht.** In der Referenz-App taten alle sieben Modul-Ansichten dieselben sieben Dinge in derselben Reihenfolge: Items mit dem Modulfilter laden, Mitglieder laden (mit dem Aggregat-Sonderfall, siebenmal abgeschrieben), die geteilte Bearbeitungs-Konfiguration bauen, Detail registrieren, Erstellen registrieren, den Fokus verdrahten, die Ansicht rendern. Die Detail-Blöcke von Kalender und Karte waren wörtlich gleich. Was sich je Modul unterschied, waren die Ansicht und der Filter — und der Filter stand bereits als `presents` im Register. Die Netzwerk-App hat dieselben sieben Dinge nicht übernommen, sondern ohne Fokus-Politik und ohne Erstellen-Host neu erfunden. Das ist die Regel aus Abschnitt 2a eine Ebene höher: Was sich Module teilen können, gehört nicht ins Modul — und was sich Apps teilen können, gehört nicht in die App.

**Was der Host aus einem Eintrag herstellt.** Jedes Modul bekommt alles davon; kein Modul baut es selbst:

| Der Host … | … und woher er es weiß |
|---|---|
| stellt die **Fläche** (Kopf, Suche, Vokabular, Filterkarte, Chips, schwebende Ecke) | `fill`, `panelFit`, `maxWidth` — wie heute |
| lädt die **Items** des Moduls | nach dem **Ladevertrag** unten: aus `presents` und `options` einen Connector-Filter je Hinweis, bei mehreren Hinweisen die Vereinigung. Bei `loads: "module"` stellt der Host **keine** Abfrage — die Karte lädt nach Ausschnitt selbst |
| löst den **Space-Kontext** auf: Mitglieder, Autoren, Gruppenfarben, das Aggregat „Mein Netzwerk" | aus dem aktiven Space; die Ausnahme `__overview__` gibt es damit an genau einer Stelle |
| registriert das **Detail** (Lesen ↔ Bearbeiten im geteilten Panel) | aus der geteilten Bearbeitungs-Konfiguration: alle Inhaltstypen, der Composer-Mapper, die Vorbelegung. Der Hintergrund-Schleier folgt aus `panelFit`: `overlay` bleibt ohne, damit die Karte bewegbar bleibt |
| registriert das **Erstellen** | mit **allen** Inhaltstypen des Space — der Plusknopf bietet immer alles an, das Modul schränkt nicht ein (Anton, 20.09.2026). Ein Modul DARF einen **Vorschlag** machen: Ein Klick auf einen leeren Kalendertag öffnet den Composer mit „Termin" vorgewählt und dem Datum vorbelegt. Ein Vorschlag ist eine Voreinstellung, kein Zaun — das Typmenü bleibt offen |
| hält den **Fokus** (welches Item offen ist, ob es bearbeitet wird, ob gerade erstellt wird) | in der **URL**, als Voreinstellung: `/{scope}/{modul}/{itemId}`, `?edit`, `?compose=`. Zurück im Browser schließt das Panel; ein Link führt zum Item. Das ist keine Wahl der App, sondern Teil des Moduls |

**Was beim Modul bleibt.** Die Ansicht, ihre eigenen Steuerelemente (Regel 2), ihr Vorschlag beim Erstellen, und — wo es das gibt — eigene Logik (Kanban: Spalten, Verschieben, Zuweisung). Das ist alles.

**Was bei der App bleibt.** Der Router selbst und die Entscheidung, welche Module ihr Register führt. Die URL-Fokus-Politik braucht einen Router; sie liegt darum in einem eigenen Unterpfad des Toolkits (`@real-life-stack/toolkit/router`, nach dem Muster von `/maplibre`), damit der Kern routerfrei bleibt. Ohne Router — in einer Story, einem Test, einer Einbettung ohne eigene Adresse — hält der Host den Fokus im Speicher, mit demselben Vertrag. Eine App, die einen Router hat, MUSS die URL-Politik nehmen. Der Fokus im Speicher ist der Rückfall für den Fall ohne Router, keine zweite gleichwertige Betriebsart.

Regeln:

1. Ein Toolkit-Modul MUSS **ohne eine Zeile in der App** laufen: Register binden, Host rendern, fertig. Alles, was die Referenz-App heute je Modul verdrahtet, ist entweder Sache des Hosts oder Sache des Moduls im Toolkit.
2. Ein Modul DARF **nicht** selbst laden, registrieren oder den Fokus verdrahten, was der Host aus dem Eintrag herstellt. Die Tabelle oben ist die Liste; wer etwas davon im Modul wiederfindet, hat einen Fehler gegen diese Spec vor sich.
3. Das Erstellen bietet in jedem Modul **dieselben** Typen an. Eine je Modul verschiedene Liste ist eine zweite Typ-Liste und damit ein Verstoß gegen Regel 1 des Typ-Registers. Ein Modul DARF einen Typ **vorschlagen** und Felder **vorbelegen**; es DARF die Auswahl nicht **einschränken**.
4. Der Fokus lebt in der URL, wo es eine gibt. Eine App mit Router, die den Fokus anders hält, weicht von der Spec ab und MUSS das im Pull Request begründen.
5. Der Host ist **eine** Komponente im Toolkit. Eine zweite Fassung davon in einer App — auch eine teilweise, auch eine „vorläufige" — ist derselbe Fehler wie eine zweite Modul-Liste. Die Netzwerk-App hat heute eine; sie wird auf den Host umgestellt.

Was ein Eintrag dafür **nicht** braucht: kein `items`-Feld (folgt aus `presents`), kein `backdrop` (folgt aus `panelFit`), keine Liste der Erstell-Typen (es sind alle), kein `createLabel` (der Knopf heißt „Erstellen", das Modul schlägt höchstens einen Typ vor). Was er braucht, sind zwei kleine Felder, die nichts anderes herleiten kann: `loads`, weil nur das Modul weiß, ob es selbst lädt, und `options`, weil nur die Konfiguration weiß, welches Feld die Kanban-Spalte trägt. *Der erste Entwurf behauptete, der Eintrag werde gar nicht länger; rls#411 hat gezeigt, dass das die Übergabe an den Host verschwieg.*

### Der Ladevertrag

**Status: umgesetzt, rls#414.** Die Tabelle lebt in `packages/data-interface/src/module-hints.ts` (`registerModuleHint`, `filterForHint`, `moduleHintsFor`); der Host leitet seinen Filter mit `hostFiltersFor` daraus ab — je Hinweis eine Abfrage, zusammen die Vereinigung. Aus rls#411: vier Dinge, die der erste Entwurf offenließ.

**1. Ein Hinweis ist ein Feld oder eine Klasse mit deklarierter Affordanz — und `data-interface` kennt beide Richtungen in einer Tabelle.** Bis rls#414 gab es nur die Richtung Item → Hinweise (`moduleHintsFor`); der Host braucht die Umkehrung Hinweis → Connector-Filter. Beide MÜSSEN aus **derselben** Tabelle kommen, sonst driften Routing und Laden auseinander — genau so, wie es bei `hasStatus` passiert ist (Typ-Abkürzung im Hinweis, Feldfilter in der Ansicht). Und die Tabelle ist **offen, nicht geschlossen**: Ein Registereintrag DARF einen eigenen Hinweis samt beiden Richtungen eintragen. Ein Modul, das ein Feld darstellt, das das Toolkit nicht kennt — ein fremdes Modul aus einem Marktplatz, oder ein eigenes der App — bringt seinen Hinweis mit, statt auf eine Änderung in `data-interface` zu warten. Für B0 heißt das: eine Tabelle, in die man einträgt, kein fester `switch` über vier Namen (Anton, 21.09.2026). Die Zeilen, die das Toolkit einträgt, Stand heute:

| Hinweis | Item → Hinweis | Hinweis → Filter | Art |
|---|---|---|---|
| `position` | `data.position.coordinates` ist ein Array | `hasField: ["position"]` | Feld |
| `start` | `data.start` ist ein nichtleerer String | `hasField: ["start"]` | Feld |
| `status` | `data[statusField]` ist ein String mit Spaltenwert | `hasField: [statusField]` | Feld, **konfiguriert** über `options.statusField` (Standard `status`) |
| `statement` | eine Klasse des Items deklariert die Affordanz `votesOn` (eingehend) | `type: [Klassen mit votesOn]` — Kurzname oder IRI, als Menge | Klasse (Spec 06, „Klassen haben IRIs"). *Bis rls#412 ein Marker-Vokabular `statement/v1` im `@context`; das entfiel, weil `type` per `base/v1` schon `@type` ist und eine interne Regel die JSON-LD-Interoperabilität nicht einschränken darf (Anton, 21.09.2026)* |

Abnahmefall: Ein Resonanz-Item ohne `data.statement` wird geladen — es gibt dieses Feld nicht, die Klasse entscheidet.

**2. Grob lädt der Connector, fein entscheidet das Modul.** Der Connector-Filter prüft **Präsenz** (Feld da, Vokabular da); er prüft keine Werte, denn Connectoren filtern nicht nach Aufzählungen. Ob ein Wert einer Spalte entspricht (`open`, `done` …), prüft das Kanban selbst auf dem geladenen Bestand — wie heute (Spec 06: „plus Spaltenwert-Prüfung"). Der **Hinweis** für Routing und Benachrichtigungen DARF die Wertprüfung enthalten, weil er die Frage „würde dieses Modul das Item zeigen?" beantwortet; er MUSS dafür dieselbe Konfiguration nehmen wie der Filter. Bis Module je Space konfigurierbar sind, gelten die Standardwerte.

Abnahmefall: Ein Kanban mit `options.statusField: "kind"` lädt `hasField: ["kind"]`, und der Hinweis prüft `data.kind`, nicht `data.status`.

**3. Mehrere Hinweise sind eine Vereinigung.** `presents` beantwortet „was kann dieses Modul zeigen"; zwei Hinweise heißen also *das eine oder das andere*. `ItemFilter.hasField` ist dagegen ein Und. Der Host stellt darum **je Hinweis eine Abfrage** und vereinigt die Ergebnisse nach `id`. Ein Hinweis ist der schnelle Normalfall und heute der einzige; der Vertrag steht trotzdem, damit ihn niemand später als Und implementiert.

**4. Wer selbst lädt, sagt es — und der Host schweigt dann.** `loads: "module"` ist die Anmeldung. Der Host stellt keine Standardabfrage, hängt aber alles andere unverändert an: Fläche, Space-Kontext, Detail, Erstellen, Fokus. Das Modul bekommt vom Host, was es zum Laden braucht (den aktiven Space), und liefert seine Items an die Fläche zurück (`fallbackItems`-Pfad des Vokabulars entfällt damit; unter einem Connector gilt ohnehin der Space).

Abnahmefall: Die Karte mit `viewportMode: "bbox-module"` löst **keine** zweite Vollbestandsabfrage aus; im Netzwerk gibt es genau eine Abfrage je Ausschnitt.

Was der Implementierer damit **nicht** erfinden muss: keinen Schalter über Modul-Ids im Host, keine zweite Abfrage neben der des Moduls, keine eigene Tabelle Hinweis → Filter.



**Offen, bewusst.** Sobald Filter und Typen je Space konfigurierbar sind (angekündigt 20.09.2026), heißt „alle Typen" „alle, die dieser Space führt", und der Host liest sie aus der Space-Konfiguration statt aus dem Typ-Register. Dass es dann genau eine Stelle umzustellen gibt, ist der Grund, sie jetzt zusammenzuführen.

### Ein Feld führt zu seiner Sicht

Ein Datum in der Detailansicht führt in den Kalender, eine Position auf die Karte. Die Regel dahinter ist allgemein: **Ein Feld verweist auf das Modul, das es darstellen kann.**

Die Zuordnung gehört ins **Register**, nicht in die Ansicht. Stünde sie dort, wäre sie eine zweite Modul-Liste neben diesem Register (Regel 1) — und sie driftet, sobald ein Modul dazukommt oder wegfällt. Die Richtung ist deshalb umgekehrt: Nicht das Feld sucht ein Modul, sondern das Modul erklärt in `presents`, was es zeigen kann. Eine App bringt damit ihr eigenes Modul samt Feld mit, ohne dass das Toolkit davon wissen muss.

Zum Verweis gehören drei Auskünfte, die an verschiedenen Stellen liegen:

| Frage | Wer weiß es |
|---|---|
| Welches Modul stellt dieses Feld dar? | das Register (`findModulePresenting`) |
| Führt der aktuelle Space dieses Modul? | die App |
| Wie kommt man dorthin (Route, Fokus, Panel)? | die App |

Darum stellt die App die Verbindung her (`FieldNavigationProvider`), und Flächen fragen nur: „Führt dieses Feld irgendwohin?" Regeln:

1. Ohne Ziel bleibt der Wert **Text**. Ein Verweis auf eine Fläche, die dieser Space nicht führt, wäre schlimmer als gar keiner.
2. Ein Feld, dessen Voraussetzung im Item fehlt, verweist nicht: Ein Ort ohne Koordinaten lässt sich auf keiner Karte zeigen, sein Name allein genügt nicht.
3. Steht man bereits im Zielmodul, verweist das Feld nicht — dort ist der Wert eine Auskunft, kein Weg.
4. Der Klick gehört dem **Wert**, nicht der Fläche darunter: Ein Tippen auf das Datum führt in den Kalender, es öffnet nicht die Detailansicht.

### Offener Punkt: Voreinstellung beim Anlegen eines Space

Ein Connector, der einen Space anlegt, schreibt heute selbst eine Modul-Voreinstellung in `Group.data.modules` (`packages/wot-connector`). Das ist die letzte verbliebene Zweitliste — und sie liegt auf der falschen Seite der Grenze: Welche Oberflächen es gibt, ist Darstellungswissen und gehört nicht in einen Connector, der `data-interface` implementiert und das Toolkit nicht kennen darf.

Auflösung ist, dass der Aufrufer die Voreinstellung mitgibt (`defaultModuleIds()` aus dem Register) und der Connector keine eigene Vorstellung davon hat. Bis dahin gilt: Eine dort gesetzte Id **muss** im Register existieren, sonst legt der Connector Spaces mit einem Modul an, das die App nicht zeigen kann.

## Module Components

Module Components sind wiederverwendbare Bausteine innerhalb von Space Modules. Sie können in mehreren Modulen auftauchen, sind aber nicht selbst pro Space aktivierbare Oberflächen.

Geteilte Bausteine, die mehr als ein Modul nutzt, sind in [modules/shared-components.md](modules/shared-components.md) normativ definiert (Vertrag, Slot-Konvention, Datenanker pro Komponente und pro Hook). Diese Sektion gibt die taxonomische Einordnung.

Beispiele:

- ItemPreview,
- ItemDetail,
- ContentComposer,
- FilterBar,
- CommentSection,
- ReactionBar,
- DateWidget,
- LocationWidget,
- PeopleWidget,
- Questlog.

Regeln:

1. Module Components sollen möglichst klein und wiederverwendbar bleiben.
2. Module Components dürfen Hooks nutzen, wenn sie dadurch eindeutig an den RLS-Kontext gebunden sind.
3. Allgemeine UI-Primitives bleiben außerhalb der Modul-Taxonomie.
4. Ein Component wird erst dann zu einem Space Module, wenn er als eigenständige, pro Space aktivierbare Oberfläche erscheint.

## Was kein Space Module ist

Nicht jedes sichtbare UI-Element ist ein Space Module.

| Oberfläche | Einordnung |
|---|---|
| AppShell, Navbar, BottomNav, ModuleTabs | App Shell / Layout |
| WorkspaceSwitcher | App Shell |
| UserMenu | App Shell |
| ProfilePanelContent | App Shell, kann in Modulen referenziert werden |
| ContactsDialog | App Shell |
| VerificationDialog | App Shell |
| RelayStatusBadge | App Shell / Connector-Status |
| DebugDashboard | App Shell / Debug/Admin |
| ItemPreview, ItemDetail, Composer, Questlog | Module Component |

## Abgrenzung zu RLNP, Game und WoT

Space Modules machen externe Semantik bedienbar, besitzen sie aber nicht.

| Ebene | Verantwortung |
|---|---|
| WoT | Identität, Kontakte, Verifikationen, Attestations, Sync |
| RLNP | soziale Semantik, Quests, Evidence, Completion, soziale Operationen |
| Real Life Game | Game Packs, Adventures, Campaigns, Progression, World State |
| RLS | App Shell, Space Modules, Module Components, Hooks und Connector-Projektionen |

Beispiel:

Ein Quests-Modul ist ein Space Module. Es darf Quests, QuestRuns, Evidence, Completion-Status und verschiedene Quest-Komponenten anzeigen und bedienbar machen. Ein Questlog ist darin eine mögliche Module Component, aber nicht selbst die ganze Modul-Ebene. Das Quests-Modul definiert nicht selbst, was eine Quest sozial bedeutet oder wann eine Quest als abgeschlossen gilt. Diese Semantik bleibt im RLNP.

## Modul-Detail-Specs

Verbindliche Detail-Specs für Space Modules entstehen unter [modules/](modules/). Der alte Ordner [../modules/](../modules/) bleibt historisches Brainstorming und Inspirationsmaterial.

Aktuell:

- [modules/template.md](modules/template.md)
- [modules/feed.md](modules/feed.md)
- [modules/kanban.md](modules/kanban.md)
- [modules/calendar.md](modules/calendar.md)
- [modules/map.md](modules/map.md)
- [modules/resonance.md](modules/resonance.md)
- [modules/shared-components.md](modules/shared-components.md)

## Offene Punkte

Diese Spec definiert die Taxonomie. Detail-Specs für weitere Space Modules können später folgen.

Ohne Detail-Spec sind bisher die registrierten Module `collection` und `graph`.

# Anatomie eines Moduls: Einstieg

Eine App oder ein Modul auf dem Real Life Stack baut man nicht aus Bausteinen, die man findet, sondern aus Zonen, die einen Besitzer haben. Die Regeln dafür stehen in der Spec. Diese Seite sagt nur, wo, und in welcher Reihenfolge.

1. [01-app-composition.md → Anatomie der Fläche](spec/01-app-composition.md): die Karte der Zonen, je Zone Besitzer, Baustein, was hinein gehört und was nicht. Vorher nichts bauen.
2. [01-app-composition.md](spec/01-app-composition.md) ganz: App Shell, Overlay-Ebenen, Content-Bereich, Modulfläche, Modul-Register.
3. [modules/shared-components.md](spec/modules/shared-components.md): die Verträge der geteilten Bausteine und der Abschnitt „Abläufe“ für anlegen, öffnen, löschen.
4. [toolkit-index.md](toolkit-index.md): alle Exporte der installierten Toolkit-Version, nach Zonen. Was dort nicht steht, existiert nicht und wird gemeldet, nicht nachgebaut.
5. [modules/template.md](spec/modules/template.md): ein neues Modul wird zuerst hier beschrieben, inklusive Abnahme, dann gebaut.
6. [templates/AGENTS.md](templates/AGENTS.md): Bootstrap und Regeln für eine App auf den npm-Paketen.

Lies die Doku in der Version, die installiert ist. Das Repo ist oft weiter oder älter als das Paket. Jede Toolkit-Version trägt das Tag `toolkit-vX.Y.Z`; die Doku dazu liegt unter `https://github.com/real-life-org/real-life-stack/tree/toolkit-vX.Y.Z/docs` und, ab 0.1.7, im Paket selbst unter `node_modules/@real-life-stack/toolkit/docs/stack/`.

Beispiel: [Karabirrdt](https://github.com/antontranelis/karabirrdt), eine Standalone-App auf den Paketen, mit dem Protokoll aller Abweichungen und Lücken in `docs/rls-kompatibel.md`.

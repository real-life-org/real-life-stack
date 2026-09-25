export interface Translation {
  nav: { modules: string; dataInterface: string; connectors: string }
  hero: {
    title: string
    titleHighlight: string
    subtitle: string
    demo: string
    storybook: string
  }
  modules: {
    title: string
    p1: string
    p2: string
    map: string
    mapDesc: string
    calendar: string
    calendarDesc: string
    marketplace: string
    marketplaceDesc: string
    feed: string
    feedDesc: string
    /** Optional; fehlt es, gilt die englische Fassung. */
    kanban?: string
    kanbanDesc?: string
    more?: string
  }
  dataInterface: {
    title: string
    p1: string
    p2: string
    items: string
    itemsDesc: string
    spaces: string
    spacesDesc: string
    capabilities: string
    capabilitiesDesc: string
  }
  connectors: {
    title: string
    p1: string
    p2: string
    wot: string
    wotDesc: string
    supabase: string
    supabaseDesc: string
    own: string
    ownDesc: string
  }
  footer: { tagline: string; privacy: string; backHome: string }
}

export type TranslatedLanguage =
  | 'de' | 'en' | 'fr' | 'es' | 'pt' | 'it' | 'tr' | 'ar' | 'zh' | 'ru' | 'uk' | 'he'

const EN_DATA_INTERFACE: Translation['dataInterface'] = {
  title: 'One interface for all modules',
  p1: 'All modules speak the same language. What they read and write are items in spaces, related to one another and to people; an event, a place, a task, a profile differ only in their fields. That is why the same neighbourhood festival can sit in the calendar and on the map without existing twice.',
  p2: 'When an item changes, every surface showing it follows. And what the backend underneath can do decides what the surface offers: a connector that cannot write gets no write buttons, but an app that still runs.',
  items: 'Items & relations',
  itemsDesc: 'One object, many views',
  spaces: 'Spaces & members',
  spacesDesc: 'Who sees what, who belongs',
  capabilities: 'Capabilities',
  capabilitiesDesc: 'What a connector can do, the surface checks',
}

const EN_CONNECTORS: Translation['connectors'] = {
  title: 'Two connectors, one contract',
  p1: 'Below the interface sits the connector. It decides where the data lives; the surface does not notice the switch. Two ship ready-made, each an npm package.',
  p2: 'A connector of your own implements the same interface against another source, with exactly the capabilities the source offers. What it cannot do, the surface hides.',
  wot: 'Web of Trust',
  wotDesc: 'Decentralized, end-to-end encrypted, identity as a DID',
  supabase: 'Supabase',
  supabaseDesc: 'Central server with sign-in, permissions and realtime',
  own: 'Your own connector',
  ownDesc: 'The same interface against your source: REST, GraphQL, local or P2P',
}

export const translations: Record<TranslatedLanguage, Translation> = {
  de: {
    nav: { modules: 'Module', dataInterface: 'Schnittstelle', connectors: 'Connectoren' },
    hero: {
      title: 'Der Baukasten für',
      titleHighlight: 'lokale Vernetzung',
      subtitle: 'Werkzeuge für Communities, die sich dezentral organisieren, verwurzelt in echten Begegnungen.',
      demo: 'Demo ansehen',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Module, die zusammenpassen',
      p1: 'Karte, Kalender, Kanban und Feed sind eigenständige React-Komponenten in TypeScript. Jede läuft für sich, zusammen ergeben sie eine App. Die Referenz-App setzt sie zusammen, deine App kann es genauso.',
      p2: 'Wer nicht programmieren will, betreibt die fertige White-Label-App und stellt Module, Farben und Inhalte in der Konfiguration ein.',
      map: 'Karte',
      mapDesc: 'OpenStreetMap via MapLibre',
      calendar: 'Kalender',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Marktplatz',
      marketplaceDesc: 'Teilen & Tauschen',
      feed: 'Feed',
      feedDesc: 'Aktivitäten-Stream',
      kanban: 'Kanban',
      kanbanDesc: 'Aufgaben in Spalten',
      more: 'Dazu Liste, Graph und Resonanz: alle Module live im Storybook',
    },
    dataInterface: {
      title: 'Eine Schnittstelle für alle Module',
      p1: 'Alle Module sprechen dieselbe Sprache. Was sie lesen und schreiben, sind Items in Spaces, mit Beziehungen zueinander und zu Menschen; ein Termin, ein Ort, eine Aufgabe, ein Profil unterscheiden sich nur in ihren Feldern. Deshalb kann dasselbe Nachbarschaftsfest im Kalender und auf der Karte stehen, ohne zweimal zu existieren.',
      p2: 'Ändert sich ein Item, folgt jede Fläche, die es zeigt. Und was das Backend darunter kann, entscheidet, was die Oberfläche anbietet: Ein Connector, der nicht schreiben kann, bekommt keine Schreibknöpfe, aber eine App, die trotzdem läuft.',
      items: 'Items & Relations',
      itemsDesc: 'Ein Objekt, viele Ansichten',
      spaces: 'Spaces & Mitglieder',
      spacesDesc: 'Wer sieht was, wer gehört dazu',
      capabilities: 'Fähigkeiten',
      capabilitiesDesc: 'Was ein Connector kann, prüft die Fläche',
    },
    connectors: {
      title: 'Zwei Connectoren, ein Vertrag',
      p1: 'Unter der Schnittstelle liegt der Connector. Er entscheidet, wo die Daten leben; die Oberfläche merkt den Wechsel nicht. Zwei gibt es fertig, jeder ein npm-Paket.',
      p2: 'Ein eigener Connector implementiert dasselbe Interface gegen eine andere Quelle, mit genau den Fähigkeiten, die die Quelle hergibt. Was er nicht kann, blendet die Oberfläche aus.',
      wot: 'Web of Trust',
      wotDesc: 'Dezentral, Ende-zu-Ende verschlüsselt, Identität als DID',
      supabase: 'Supabase',
      supabaseDesc: 'Zentraler Server mit Anmeldung, Rechten und Echtzeit',
      own: 'Eigener Connector',
      ownDesc: 'Dasselbe Interface gegen eure Quelle: REST, GraphQL, lokal oder P2P',
    },
    footer: {
      tagline: 'Gemeinsam gestalten wir die Zukunft: lokal vernetzt, global gedacht.',
      privacy: 'Datenschutz',
      backHome: '← Zurück zur Startseite',
    },
  },
  en: {
    nav: { modules: 'Modules', dataInterface: 'Data Interface', connectors: 'Connectors' },
    hero: {
      title: 'Your toolkit for',
      titleHighlight: 'local connection',
      subtitle: 'Tools for communities that organize in a decentralized way, rooted in real-world encounters.',
      demo: 'View demo',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Modules that fit together',
      p1: 'Map, calendar, kanban and feed are standalone React components in TypeScript. Each runs on its own; together they make an app. The reference app composes them, and your app can do the same.',
      p2: 'If you would rather not write code, run the finished white-label app and choose modules, colours and content in its configuration.',
      map: 'Map',
      mapDesc: 'OpenStreetMap via MapLibre',
      calendar: 'Calendar',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Marketplace',
      marketplaceDesc: 'Sharing & swapping',
      feed: 'Feed',
      feedDesc: 'Activity stream',
      kanban: 'Kanban',
      kanbanDesc: 'Tasks in columns',
      more: 'Plus list, graph and resonance: every module live in Storybook',
    },
    dataInterface: {
      title: 'One interface for all modules',
      p1: 'All modules speak the same language. What they read and write are items in spaces, related to one another and to people; an event, a place, a task, a profile differ only in their fields. That is why the same neighbourhood festival can sit in the calendar and on the map without existing twice.',
      p2: 'When an item changes, every surface showing it follows. And what the backend underneath can do decides what the surface offers: a connector that cannot write gets no write buttons, but an app that still runs.',
      items: 'Items & relations',
      itemsDesc: 'One object, many views',
      spaces: 'Spaces & members',
      spacesDesc: 'Who sees what, who belongs',
      capabilities: 'Capabilities',
      capabilitiesDesc: 'What a connector can do, the surface checks',
    },
    connectors: {
      title: 'Two connectors, one contract',
      p1: 'Below the interface sits the connector. It decides where the data lives; the surface does not notice the switch. Two ship ready-made, each an npm package.',
      p2: 'A connector of your own implements the same interface against another source, with exactly the capabilities the source offers. What it cannot do, the surface hides.',
      wot: 'Web of Trust',
      wotDesc: 'Decentralized, end-to-end encrypted, identity as a DID',
      supabase: 'Supabase',
      supabaseDesc: 'Central server with sign-in, permissions and realtime',
      own: 'Your own connector',
      ownDesc: 'The same interface against your source: REST, GraphQL, local or P2P',
    },
    footer: {
      tagline: 'Together we shape the future: locally connected, globally minded.',
      privacy: 'Privacy',
      backHome: '← Back to home',
    },
  },
  fr: {
    nav: { modules: 'Modules', dataInterface: 'Interface', connectors: 'Connecteurs' },
    hero: {
      title: 'Une boîte à outils modulaire pour',
      titleHighlight: 'la connexion locale',
      subtitle:
        'Des outils qui permettent aux communautés de s’organiser de manière décentralisée, autodéterminées et ancrées dans de vraies rencontres.',
      demo: 'Voir la démo',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Boîte à outils frontend modulaire',
      p1: "Real Life Stack est développé comme une boîte à outils frontend modulaire en TypeScript avec React. Elle comprend des composants autonomes utilisables aussi bien dans l'application de référence que comme bibliothèque réutilisable dans vos propres projets.",
      p2: "S'y ajoute une application white-label auto-hébergeable avec une interface d'administration intuitive permettant aux groupes d'activer des modules et de personnaliser couleurs et contenus sans connaissances techniques.",
      map: 'Carte',
      mapDesc: 'OpenStreetMap via MapLibre',
      calendar: 'Calendrier',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Marché',
      marketplaceDesc: 'Partage & échange',
      feed: 'Fil',
      feedDesc: "Flux d'activités",
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: "Ensemble, nous façonnons l'avenir, connectés localement, pensés globalement.",
      privacy: 'Confidentialité',
      backHome: "← Retour à l'accueil",
    },
  },
  es: {
    nav: { modules: 'Módulos', dataInterface: 'Interfaz', connectors: 'Conectores' },
    hero: {
      title: 'Un kit modular para',
      titleHighlight: 'la conexión local',
      subtitle:
        'Herramientas que permiten a las comunidades organizarse de forma descentralizada: autodeterminadas y arraigadas en encuentros reales.',
      demo: 'Ver demo',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Kit frontend modular',
      p1: 'Real Life Stack se desarrolla como un kit frontend modular en TypeScript con React. Incluye componentes independientes que pueden usarse tanto en la aplicación de referencia como en tus propios proyectos como biblioteca reutilizable.',
      p2: 'Además se está creando una app white-label autoalojable con una interfaz de administración intuitiva, con la que los grupos pueden activar módulos y personalizar colores y contenidos sin conocimientos técnicos.',
      map: 'Mapa',
      mapDesc: 'OpenStreetMap vía MapLibre',
      calendar: 'Calendario',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Mercado',
      marketplaceDesc: 'Compartir e intercambiar',
      feed: 'Feed',
      feedDesc: 'Flujo de actividades',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'Juntos damos forma al futuro: conectados localmente, pensados globalmente.',
      privacy: 'Privacidad',
      backHome: '← Volver al inicio',
    },
  },
  pt: {
    nav: { modules: 'Módulos', dataInterface: 'Interface', connectors: 'Conectores' },
    hero: {
      title: 'Um kit modular para',
      titleHighlight: 'conexão local',
      subtitle:
        'Ferramentas que permitem às comunidades se organizarem de forma descentralizada, autodeterminadas e enraizadas em encontros reais.',
      demo: 'Ver demo',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Kit frontend modular',
      p1: 'O Real Life Stack está sendo desenvolvido como um kit frontend modular em TypeScript com React. Inclui componentes independentes que podem ser usados tanto no aplicativo de referência quanto como biblioteca reutilizável em seus próprios projetos.',
      p2: 'Além disso, está sendo criado um app white-label auto-hospedável com uma interface de administração intuitiva, com a qual grupos podem ativar módulos e personalizar cores e conteúdos sem conhecimento técnico.',
      map: 'Mapa',
      mapDesc: 'OpenStreetMap via MapLibre',
      calendar: 'Calendário',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Mercado',
      marketplaceDesc: 'Compartilhar e trocar',
      feed: 'Feed',
      feedDesc: 'Fluxo de atividades',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'Juntos moldamos o futuro, conectados localmente, pensados globalmente.',
      privacy: 'Privacidade',
      backHome: '← Voltar ao início',
    },
  },
  it: {
    nav: { modules: 'Moduli', dataInterface: 'Interfaccia', connectors: 'Connettori' },
    hero: {
      title: 'Un kit modulare per',
      titleHighlight: 'la connessione locale',
      subtitle:
        'Strumenti che permettono alle comunità di organizzarsi in modo decentralizzato, autodeterminate e radicate in incontri reali.',
      demo: 'Guarda la demo',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Kit frontend modulare',
      p1: "Real Life Stack viene sviluppato come kit frontend modulare in TypeScript con React. Comprende componenti autonomi utilizzabili sia nell'applicazione di riferimento sia come libreria riutilizzabile nei propri progetti.",
      p2: "Inoltre nasce un'app white-label self-hostable con un'interfaccia di amministrazione intuitiva, con cui i gruppi possono attivare moduli e personalizzare colori e contenuti senza conoscenze tecniche.",
      map: 'Mappa',
      mapDesc: 'OpenStreetMap via MapLibre',
      calendar: 'Calendario',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Mercato',
      marketplaceDesc: 'Condividere e scambiare',
      feed: 'Feed',
      feedDesc: 'Flusso di attività',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'Insieme plasmiamo il futuro, connessi localmente, pensati globalmente.',
      privacy: 'Privacy',
      backHome: '← Torna alla home',
    },
  },
  tr: {
    nav: { modules: 'Modüller', dataInterface: 'Arayüz', connectors: 'Bağlayıcılar' },
    hero: {
      title: 'Yerel bağlantı için',
      titleHighlight: 'modüler bir araç seti',
      subtitle:
        'Toplulukların merkeziyetsiz şekilde örgütlenmesini sağlayan araçlar, kendi kararlarıyla ve gerçek buluşmalara dayanarak.',
      demo: 'Demoyu gör',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Modüler frontend araç seti',
      p1: 'Real Life Stack, TypeScript ve React ile modüler bir frontend araç seti olarak geliştiriliyor. Hem referans uygulamada hem de kendi projelerinizde yeniden kullanılabilir kitaplık olarak kullanılabilen bağımsız bileşenler içerir.',
      p2: 'Ayrıca, grupların teknik bilgi olmadan modülleri etkinleştirip renkleri ve içerikleri özelleştirebildiği sezgisel bir yönetici arayüzüne sahip, kendi sunucunuzda barındırılabilir bir white-label uygulama geliştiriliyor.',
      map: 'Harita',
      mapDesc: 'MapLibre ile OpenStreetMap',
      calendar: 'Takvim',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Pazar yeri',
      marketplaceDesc: 'Paylaşım ve takas',
      feed: 'Akış',
      feedDesc: 'Etkinlik akışı',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'Geleceği birlikte şekillendiriyoruz, yerelde bağlı, küresel düşünen.',
      privacy: 'Gizlilik',
      backHome: '← Ana sayfaya dön',
    },
  },
  ar: {
    nav: { modules: 'الوحدات', dataInterface: 'الواجهة', connectors: 'الموصلات' },
    hero: {
      title: 'مجموعة أدوات معيارية من أجل',
      titleHighlight: 'الترابط المحلي',
      subtitle:
        'أدوات تمكّن المجتمعات من التنظيم بشكل لامركزي, بإرادتها الذاتية ومتجذرة في لقاءات حقيقية.',
      demo: 'شاهد العرض التجريبي',
      storybook: 'Storybook',
    },
    modules: {
      title: 'مجموعة أدوات واجهة أمامية معيارية',
      p1: 'يُطوَّر Real Life Stack كمجموعة أدوات واجهة أمامية معيارية بلغة TypeScript مع React. يتضمن مكونات مستقلة يمكن استخدامها في التطبيق المرجعي وكذلك كمكتبة قابلة لإعادة الاستخدام في مشاريعك الخاصة.',
      p2: 'إضافةً إلى ذلك، يجري تطوير تطبيق white-label قابل للاستضافة الذاتية مع واجهة إدارة سهلة تتيح للمجموعات تفعيل الوحدات وتخصيص الألوان والمحتوى دون معرفة تقنية.',
      map: 'الخريطة',
      mapDesc: 'OpenStreetMap عبر MapLibre',
      calendar: 'التقويم',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'السوق',
      marketplaceDesc: 'المشاركة والتبادل',
      feed: 'الموجز',
      feedDesc: 'تدفق الأنشطة',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'معًا نصنع المستقبل, مترابطون محليًا، نفكر عالميًا.',
      privacy: 'الخصوصية',
      backHome: '← العودة إلى الصفحة الرئيسية',
    },
  },
  zh: {
    nav: { modules: '模块', dataInterface: '接口', connectors: '连接器' },
    hero: {
      title: '一个模块化工具箱，助力',
      titleHighlight: '本地连接',
      subtitle: '让社区能够去中心化地自我组织的工具，自主自决，植根于真实的相遇。',
      demo: '查看演示',
      storybook: 'Storybook',
    },
    modules: {
      title: '模块化前端工具箱',
      p1: 'Real Life Stack 是一个用 TypeScript 和 React 开发的模块化前端工具箱。它包含独立组件，既可用于参考应用，也可作为可复用库用于你自己的项目。',
      p2: '此外还在开发一个可自托管的白标应用，配有直观的管理配置界面，让团体无需技术知识即可启用模块、自定义颜色和内容。',
      map: '地图',
      mapDesc: '通过 MapLibre 使用 OpenStreetMap',
      calendar: '日历',
      calendarDesc: 'iCal / CalDAV',
      marketplace: '市集',
      marketplaceDesc: '分享与交换',
      feed: '动态',
      feedDesc: '活动流',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: '让我们共同塑造未来，本地相连，全球思考。',
      privacy: '隐私',
      backHome: '← 返回首页',
    },
  },
  ru: {
    nav: { modules: 'Модули', dataInterface: 'Интерфейс', connectors: 'Коннекторы' },
    hero: {
      title: 'Модульный конструктор для',
      titleHighlight: 'локальных связей',
      subtitle:
        'Инструменты, позволяющие сообществам организовываться децентрализованно, самостоятельно и на основе реальных встреч.',
      demo: 'Смотреть демо',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Модульный фронтенд-конструктор',
      p1: 'Real Life Stack разрабатывается как модульный фронтенд-конструктор на TypeScript с React. Он включает автономные компоненты, которые можно использовать как в референсном приложении, так и в собственных проектах как переиспользуемую библиотеку.',
      p2: 'Кроме того, создаётся white-label-приложение для самостоятельного хостинга с интуитивной админ-панелью, в которой группы без технических знаний могут включать модули и настраивать цвета и содержимое.',
      map: 'Карта',
      mapDesc: 'OpenStreetMap через MapLibre',
      calendar: 'Календарь',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Маркетплейс',
      marketplaceDesc: 'Делиться и обмениваться',
      feed: 'Лента',
      feedDesc: 'Поток активности',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'Вместе мы формируем будущее, связаны локально, мыслим глобально.',
      privacy: 'Конфиденциальность',
      backHome: '← Назад на главную',
    },
  },
  uk: {
    nav: { modules: 'Модулі', dataInterface: 'Інтерфейс', connectors: 'Конектори' },
    hero: {
      title: 'Модульний конструктор для',
      titleHighlight: 'локальних зв’язків',
      subtitle:
        'Інструменти, що дають спільнотам змогу організовуватися децентралізовано, самостійно і на основі справжніх зустрічей.',
      demo: 'Переглянути демо',
      storybook: 'Storybook',
    },
    modules: {
      title: 'Модульний фронтенд-конструктор',
      p1: 'Real Life Stack розробляється як модульний фронтенд-конструктор на TypeScript із React. Він містить автономні компоненти, які можна використовувати як у референсному застосунку, так і у власних проєктах як бібліотеку багаторазового використання.',
      p2: 'Крім того, створюється white-label-застосунок для самостійного хостингу з інтуїтивною адмін-панеллю, за допомогою якої групи без технічних знань можуть вмикати модулі та налаштовувати кольори і вміст.',
      map: 'Мапа',
      mapDesc: 'OpenStreetMap через MapLibre',
      calendar: 'Календар',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'Маркетплейс',
      marketplaceDesc: 'Ділитися й обмінюватися',
      feed: 'Стрічка',
      feedDesc: 'Потік активності',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'Разом ми формуємо майбутнє, звʼязані локально, мислимо глобально.',
      privacy: 'Конфіденційність',
      backHome: '← Назад на головну',
    },
  },
  he: {
    nav: { modules: 'מודולים', dataInterface: 'ממשק', connectors: 'מחברים' },
    hero: {
      title: 'ערכת כלים מודולרית עבור',
      titleHighlight: 'חיבור מקומי',
      subtitle:
        'כלים שמאפשרים לקהילות להתארגן באופן מבוזר, בהגדרה עצמית ומושרשים במפגשים אמיתיים.',
      demo: 'לצפייה בהדגמה',
      storybook: 'Storybook',
    },
    modules: {
      title: 'ערכת פרונטאנד מודולרית',
      p1: 'Real Life Stack מפותח כערכת פרונטאנד מודולרית ב-TypeScript עם React. הוא כולל רכיבים עצמאיים שניתן להשתמש בהם גם באפליקציית הייחוס וגם כספרייה לשימוש חוזר בפרויקטים משלכם.',
      p2: 'בנוסף נבנית אפליקציית white-label לאירוח עצמי עם ממשק ניהול אינטואיטיבי, שבאמצעותו קבוצות ללא ידע טכני יכולות להפעיל מודולים ולהתאים צבעים ותכנים.',
      map: 'מפה',
      mapDesc: 'OpenStreetMap דרך MapLibre',
      calendar: 'לוח שנה',
      calendarDesc: 'iCal / CalDAV',
      marketplace: 'שוק',
      marketplaceDesc: 'שיתוף והחלפה',
      feed: 'פיד',
      feedDesc: 'זרם פעילויות',
    },
    // Bis zur Uebersetzung die englische Fassung (Sektion neu am 23.09.2026).
    dataInterface: EN_DATA_INTERFACE,
    connectors: EN_CONNECTORS,
    footer: {
      tagline: 'יחד אנחנו מעצבים את העתיד, מחוברים מקומית, חושבים גלובלית.',
      privacy: 'פרטיות',
      backHome: '← חזרה לדף הבית',
    },
  },
}

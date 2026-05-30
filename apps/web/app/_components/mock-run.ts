import type {
  Assumptions,
  Citation,
  Fact,
  Run,
  ValidationPersona,
  ValidationPersonaResult,
  ValidationResult,
} from "@hahaton/contracts";

// Bundled, fully client-side mock Runs (Ukrainian). On a failed real run the
// fallback shows a RANDOM one of these, rendered entirely client-side via
// ReportBody — so the demo needs no API/D1/gateway and never breaks on stage.

const at = "2026-05-30T12:00:00.000Z";
const cite = (id: string, url: string, title: string, snippet: string): Citation => ({ id, url, title, snippet, accessedAt: at });

const f = <T,>(value: T, unit: string | undefined, rationale: string, citationId?: string): Fact<T> => ({
  value,
  ...(unit ? { unit } : {}),
  rationale,
  ...(citationId ? { citationId } : { estimated: true }),
});

const A = (arpu: number, gm: number, cac: number, churn: number, conv: number, fixed: number, funnel: number): Assumptions => ({
  arpu: f(arpu, "USD/mo", "ARPU за бенчмарками ніші"),
  grossMarginPct: f(gm, "%", "типова валова маржа підписки"),
  cac: f(cac, "USD", "змішаний CAC (платний + органіка)"),
  monthlyChurnPct: f(churn, "%", "місячний churn на ранній стадії"),
  conversionPct: f(conv, "%", "конверсія free → paid"),
  fixedMonthlyCost: f(fixed, "USD", "команда + інфраструктура"),
  funnelVolume: f(funnel, "users", "місячна воронка на пілоті"),
});

const persona = (
  p: ValidationPersona,
  sc: [number, number, number, number],
  r: [string, string, string, string],
): ValidationPersonaResult => ({
  persona: p,
  scores: { problemMarket: sc[0], solutionDiff: sc[1], businessModel: sc[2], gtmTraction: sc[3] },
  total: sc[0] + sc[1] + sc[2] + sc[3],
  rationale: { problemMarket: r[0], solutionDiff: r[1], businessModel: r[2], gtmTraction: r[3] },
});

const V = (
  sk: ValidationPersonaResult,
  ad: ValidationPersonaResult,
  an: ValidationPersonaResult,
  cons: [number, number, number, number],
  dis: ValidationResult["disagreements"],
): ValidationResult => ({
  personas: [sk, ad, an],
  consensus: { problemMarket: cons[0], solutionDiff: cons[1], businessModel: cons[2], gtmTraction: cons[3] },
  totalScore: cons[0] + cons[1] + cons[2] + cons[3],
  disagreements: dis,
});

export const MOCK_RUNS: Run[] = [
  // 1 ─ Sleep tracker for shift workers
  {
    id: "mock-sleep-shift",
    input: { idea: "Трекер сну для людей з нічними змінами.", region: "Global" },
    createdAt: at,
    status: "completed",
    citations: [
      cite("c1", "https://www.grandviewresearch.com/industry-analysis/sleep-tech-devices-market", "Sleep Tech Market — Grand View Research", "Світовий ринок sleep-tech ~$28B у 2024, CAGR ~18%."),
      cite("c2", "https://www.cdc.gov/niosh/work-hour-training-for-nurses/", "NIOSH — Shift Work & Sleep", "~20% працівників розвинених країн зайняті у змінній роботі з порушеннями сну."),
    ],
    brief: {
      problem: "У змінників збиваються циркадні ритми; звичайні трекери сну орієнтовані на «нічний сон 23:00–7:00» і не працюють для нічних змін.",
      customer: "Медсестри, водії, працівники складів, підтримка та чергові інженери на ротаційних графіках.",
      valueProp: "Персональні вікна сну під твій графік змін, світлотерапія та розумні нагадування «коли лягати» перед зміною.",
      geography: "Global (англомовні ринки спершу)",
      researchQuestions: ["Скільки змінників і чи платять за сон-додатки?", "Що не закривають Sleep Cycle/Rise?", "Утримання при нерегулярному графіку?"],
    },
    market: {
      method: "top-down",
      tam: f(28000000000, "USD", "Світовий sleep-tech 2024.", "c1"),
      sam: f(1400000000, "USD", "Сегмент змінників (підписки/девайси).", "c2"),
      som: f(12000000, "USD", "~1% SAM за 3 роки через B2B2C з роботодавцями."),
      notes: "Зростання за рахунок wearables + корпоративного wellness.",
    },
    competitors: {
      competitors: [
        { name: "Rise Science", positioning: "Енергія/сон за циркадними ритмами; не заточений під зміни", pricing: f("$60/рік", undefined, "Публічний тариф."), url: "https://risescience.com" },
        { name: "Sleep Cycle", positioning: "Масовий трекер сну, фіксований нічний патерн", pricing: f("$40/рік", undefined, "Публічний тариф."), url: "https://sleepcycle.com" },
        { name: "Timeshifter", positioning: "Джетлаг/зсуви ритму — близько, але про подорожі", url: "https://timeshifter.com" },
      ],
    },
    canvas: {
      customerSegments: ["Медсестри/лікарі", "Водії та логістика", "ІТ-чергові"],
      valuePropositions: ["Сон під графік змін", "Світлотерапія", "Розумні нагадування"],
      channels: ["B2B2C через роботодавців", "App Store/Play ASO", "Спільноти змінників"],
      customerRelationships: ["Підписка", "Персональні плани сну"],
      revenueStreams: ["Підписка", "Корпоративні ліцензії"],
      keyResources: ["Алгоритм циркадних вікон", "Інтеграції з wearables"],
      keyActivities: ["ML-моделювання сну", "Контент світлотерапії"],
      keyPartnerships: ["Виробники wearables", "Корпоративний wellness"],
      costStructure: ["Розробка", "CAC", "Хмара"],
    },
    gtm: {
      channels: ["B2B2C (лікарні/логістика)", "ASO", "Reddit r/nightshift"],
      plan30: ["Лендинг + waitlist", "5 пілотів-роботодавців"],
      plan60: ["MVP iOS + Apple Health", "Перші 500 користувачів"],
      plan90: ["Корпоративний тариф", "Утримання D30 > 25%"],
      hypotheses: ["Роботодавці платитимуть за wellness", "Світлотерапія підіймає утримання"],
    },
    assumptions: A(5, 80, 18, 7, 4, 14000, 20000),
    risks: {
      risks: [
        { title: "Залежність від даних wearables", likelihood: "medium", impact: "high", mitigation: "Працювати і без девайса (ручний ввід + телефонні сенсори)." },
        { title: "Висока конкуренція в sleep-tech", likelihood: "high", impact: "medium", mitigation: "Вузький фокус на змінниках, чого нема в інкумбентів." },
        { title: "Доказовість ефекту", likelihood: "medium", impact: "medium", mitigation: "Пілот із вимірюванням якості сну + кейси." },
      ],
    },
    synthesis: {
      executiveSummary: "Перший трекер сну, побудований навколо змінних графіків, а не «нічного сну» — з циркадними вікнами та світлотерапією.",
      narrative: "Змінники — велика, недообслужена аудиторія: інкумбенти припускають фіксований нічний сон. B2B2C через роботодавців дає дешевий канал і платоспроможність, а світлотерапія та персональні вікна — диференціацію.",
      deckOutline: [
        { slide: "Проблема", bullets: ["Циркадні збої у змінників", "Трекери не під зміни"] },
        { slide: "Рішення", bullets: ["Вікна сну під графік", "Світлотерапія"] },
        { slide: "Ринок", bullets: ["Sleep-tech $28B", "Сегмент змінників $1.4B"] },
        { slide: "GTM", bullets: ["B2B2C роботодавці", "ASO"] },
      ],
    },
    validation: V(
      persona("skeptic", [18, 13, 12, 12], ["Аудиторія є, але платоспроможність неясна.", "Фічі копіюються інкумбентами.", "ARPU низький у consumer-sleep.", "B2B2C-продажі довгі."]),
      persona("advocate", [23, 19, 16, 18], ["Велика недообслужена ніша.", "Фокус на змінах — реальний рів.", "B2B-ліцензії підіймають ARPU.", "Роботодавці = дешевий канал."]),
      persona("analyst", [20, 16, 14, 15], ["Стійкий попит.", "Диференціація є за швидкого виконання.", "Юніт-ек. ок із корп-тарифом.", "Канал правдоподібний."]),
      [20, 16, 14, 15],
      [
        { category: "businessModel", min: 12, max: 16, custDevQuestion: "Скільки роботодавець готовий платити за співробітника на місяць?" },
        { category: "gtmTraction", min: 12, max: 18, custDevQuestion: "Який цикл і конверсія B2B2C-пілоту з лікарнею/логістикою?" },
      ],
    ),
    events: [],
  },

  // 2 ─ AI symptom diary for migraine
  {
    id: "mock-migraine-diary",
    input: { idea: "AI-щоденник симптомів для людей з мігренню.", region: "Global" },
    createdAt: at,
    status: "completed",
    citations: [
      cite("c1", "https://www.who.int/news-room/fact-sheets/detail/headache-disorders", "WHO — Headache disorders", "Мігрень вражає ~1 з 7 людей у світі."),
      cite("c2", "https://www.grandviewresearch.com/industry-analysis/digital-health-market", "Digital Health Market — GVR", "Цифрова охорона здоров'я зростає двозначно."),
    ],
    brief: {
      problem: "Люди з мігренню не можуть надійно зв'язати тригери (їжа, сон, погода, стрес) із нападами — паперові щоденники губляться, а нотатки неструктуровані.",
      customer: "Дорослі 20–50 з епізодичною/хронічною мігренню, що шукають патерни та хочуть приходити до невролога з даними.",
      valueProp: "AI-щоденник: швидкий ввід симптомів голосом/тапами, авто-кореляція тригерів і звіт для лікаря.",
      geography: "Global",
      researchQuestions: ["Скільки людей із мігренню платять за health-додатки?", "Чим кращі за Migraine Buddy?", "Чи довіряють AI-кореляціям?"],
    },
    market: {
      method: "top-down",
      tam: f(660000000000, "USD", "Глобальна цифрова охорона здоров'я (широко).", "c2"),
      sam: f(2000000000, "USD", "Сегмент трекерів болю/мігрені.", "c1"),
      som: f(15000000, "USD", "~0.75% SAM за 3 роки."),
    },
    competitors: {
      competitors: [
        { name: "Migraine Buddy", positioning: "Лідер трекінгу мігрені; ручний ввід, мало AI", pricing: f("freemium", undefined, "Безкоштовно + преміум."), url: "https://migrainebuddy.com" },
        { name: "Bearable", positioning: "Загальний трекер симптомів/настрою", pricing: f("$30/рік", undefined, "Публічний тариф."), url: "https://bearable.app" },
        { name: "Паперовий щоденник", positioning: "Статус-кво: блокнот" },
      ],
    },
    canvas: {
      customerSegments: ["Епізодична мігрень", "Хронічна мігрень", "Пацієнти неврологів"],
      valuePropositions: ["Швидкий ввід симптомів", "AI-кореляція тригерів", "Звіт для лікаря"],
      channels: ["ASO", "Спільноти/інфлюенсери здоров'я", "Реферали від клінік"],
      customerRelationships: ["Підписка", "Персональні інсайти"],
      revenueStreams: ["Преміум-підписка", "Анонімні дані (opt-in) для рісерчу"],
      keyResources: ["Модель кореляції тригерів", "UX швидкого вводу"],
      keyActivities: ["ML-аналітика", "Контент про мігрень"],
      keyPartnerships: ["Неврологічні клініки", "Пацієнтські спільноти"],
      costStructure: ["Розробка/ML", "CAC", "Комплаєнс/приватність"],
    },
    gtm: {
      channels: ["ASO (migraine)", "Інфлюенсери здоров'я", "Реферали неврологів"],
      plan30: ["Лендинг + waitlist", "Інтерв'ю з 20 пацієнтами"],
      plan60: ["MVP iOS + голосовий ввід", "Перші 1000 щоденників"],
      plan90: ["AI-звіт для лікаря", "Партнерство з 3 клініками"],
      hypotheses: ["Голосовий ввід підіймає утримання", "Звіт для лікаря = ключова цінність"],
    },
    assumptions: A(4, 82, 12, 6, 5, 12000, 25000),
    risks: {
      risks: [
        { title: "Регуляторика/приватність даних здоров'я", likelihood: "medium", impact: "high", mitigation: "Не діагноз, а трекер; GDPR/HIPAA-by-design, opt-in." },
        { title: "Інкумбент Migraine Buddy", likelihood: "high", impact: "medium", mitigation: "Вигравати швидкістю вводу + реальним AI-інсайтом." },
        { title: "Довіра до AI-кореляцій", likelihood: "medium", impact: "medium", mitigation: "Показувати докази/впевненість, не «чорний ящик»." },
      ],
    },
    synthesis: {
      executiveSummary: "AI-щоденник мігрені, що перетворює хаотичні нотатки на патерни тригерів і звіт для невролога.",
      narrative: "Мігрень масова, а існуючі трекери — ручні й без справжнього AI. Швидкий ввід + кореляція тригерів + звіт для лікаря дають цінність, за яку платять, і канал через клініки.",
      deckOutline: [
        { slide: "Проблема", bullets: ["Тригери незрозумілі", "Паперові щоденники губляться"] },
        { slide: "Рішення", bullets: ["Швидкий ввід", "AI-кореляція + звіт лікарю"] },
        { slide: "Ринок", bullets: ["1 з 7 має мігрень", "Трекери болю $2B"] },
        { slide: "GTM", bullets: ["ASO + клініки"] },
      ],
    },
    validation: V(
      persona("skeptic", [21, 13, 13, 14], ["Біль реальний, але монетизація health складна.", "Migraine Buddy домінує.", "Низький ARPU consumer-health.", "Клінічні канали повільні."]),
      persona("advocate", [24, 20, 17, 19], ["Величезна аудиторія з болем.", "Швидкий ввід + AI = диференціація.", "Дані + клініки відкривають апсейл.", "Реферали лікарів дешеві."]),
      persona("analyst", [22, 17, 15, 16], ["Сильний попит.", "Диференціація потребує реального AI.", "Юніт-ек. помірна.", "Канал через клініки правдоподібний."]),
      [22, 17, 15, 16],
      [{ category: "solutionDiff", min: 13, max: 20, custDevQuestion: "Чи реально наша AI-кореляція точніша за ручний Migraine Buddy?" }],
    ),
    events: [],
  },

  // 3 ─ Financial calendar for freelancers
  {
    id: "mock-freelance-calendar",
    input: { idea: "Фінансовий календар для фрилансерів.", region: "Global" },
    createdAt: at,
    status: "completed",
    citations: [
      cite("c1", "https://www.upwork.com/research/freelance-forward", "Upwork — Freelance Forward", "Десятки мільйонів фрилансерів; частка зростає."),
      cite("c2", "https://www.grandviewresearch.com/industry-analysis/accounting-software-market", "Accounting Software Market — GVR", "Ринок облікового ПЗ великий і зростає."),
    ],
    brief: {
      problem: "У фрилансерів нерегулярний дохід: важко планувати податки, касові розриви й «скільки можна витратити цього місяця».",
      customer: "Самозайняті: дизайнери, розробники, маркетологи, копірайтери з нерегулярними інвойсами.",
      valueProp: "Календар грошового потоку: прогноз надходжень за інвойсами, авто-відкладання податків і «безпечна сума на місяць».",
      geography: "Global (спершу US/EU)",
      researchQuestions: ["Скільки фрилансерів і чи платять за фінтул?", "Чим кращі за QuickBooks/Wave?", "Інтеграції з банками/інвойсингом?"],
    },
    market: {
      method: "top-down",
      tam: f(20000000000, "USD", "Облікове/фінтех ПЗ для SMB та self-employed.", "c2"),
      sam: f(1800000000, "USD", "Інструменти для фрилансерів.", "c1"),
      som: f(16000000, "USD", "~0.9% SAM за 3 роки."),
    },
    competitors: {
      competitors: [
        { name: "QuickBooks Self-Employed", positioning: "Облік + податки, важкий і не про cash-flow календар", pricing: f("$15/міс", undefined, "Публічний тариф."), url: "https://quickbooks.intuit.com" },
        { name: "Wave", positioning: "Безкоштовний облік/інвойсинг", pricing: f("free + платежі", undefined, "Модель на платежах."), url: "https://waveapps.com" },
        { name: "Excel/нотатки", positioning: "Статус-кво" },
      ],
    },
    canvas: {
      customerSegments: ["Фриланс-розробники", "Дизайнери/маркетологи", "Консультанти"],
      valuePropositions: ["Прогноз cash-flow", "Авто-відкладання податків", "Безпечна сума/міс"],
      channels: ["ASO", "Фриланс-спільноти", "Інтеграції (Stripe/банки)"],
      customerRelationships: ["Підписка", "Розумні нагадування"],
      revenueStreams: ["Підписка", "Преміум-інтеграції"],
      keyResources: ["Прогнозна модель доходу", "Банківські інтеграції"],
      keyActivities: ["Інтеграції", "Податкова логіка по країнах"],
      keyPartnerships: ["Платіжні провайдери", "Інвойсинг-сервіси"],
      costStructure: ["Розробка", "Інтеграції/банки", "CAC"],
    },
    gtm: {
      channels: ["ASO", "Спільноти фрилансерів", "Інтеграції-маркетплейси"],
      plan30: ["Лендинг + waitlist", "20 інтерв'ю"],
      plan60: ["MVP + Stripe/інвойси", "Перші 500 платних"],
      plan90: ["Банк-інтеграції", "Податкові правила 2 країн"],
      hypotheses: ["Авто-податки = killer-фіча", "Інтеграції підіймають утримання"],
    },
    assumptions: A(9, 85, 25, 5, 4, 16000, 18000),
    risks: {
      risks: [
        { title: "Складність податків по країнах", likelihood: "high", impact: "high", mitigation: "Старт з 1-2 юрисдикцій; партнерство з податковими сервісами." },
        { title: "Конкуренція QuickBooks/Wave", likelihood: "medium", impact: "medium", mitigation: "Вузький фокус на cash-flow календарі, не повний облік." },
        { title: "Доступ до банківських даних", likelihood: "medium", impact: "high", mitigation: "Open banking (Plaid/TrueLayer) + ручний ввід." },
      ],
    },
    synthesis: {
      executiveSummary: "Фінансовий календар, що робить нерегулярний дохід фрилансера передбачуваним: прогноз, податки, безпечна сума.",
      narrative: "Фрилансерів десятки мільйонів, а інструменти або важкі (QuickBooks), або не вирішують cash-flow. Вузький фокус на календарі грошового потоку + авто-податки дають чітку цінність і вищий ARPU, ніж consumer-додатки.",
      deckOutline: [
        { slide: "Проблема", bullets: ["Нерегулярний дохід", "Податки зненацька"] },
        { slide: "Рішення", bullets: ["Cash-flow календар", "Авто-відкладання податків"] },
        { slide: "Ринок", bullets: ["Фінтех SMB $20B", "Фриланс-тули $1.8B"] },
        { slide: "GTM", bullets: ["ASO + інтеграції"] },
      ],
    },
    validation: V(
      persona("skeptic", [19, 14, 16, 13], ["Біль є, але звичка до Excel сильна.", "Cash-flow копіюється.", "Інтеграції дорогі.", "Фрилансери розпорошені."]),
      persona("advocate", [23, 19, 20, 18], ["Чіткий фінансовий біль.", "Календар + податки = фокус.", "ARPU вищий за consumer.", "Спільноти = дешевий канал."]),
      persona("analyst", [21, 16, 18, 15], ["Стійкий попит.", "Диференціація через фокус.", "Юніт-ек. приваблива.", "Канал ок, але CAC треба тестувати."]),
      [21, 16, 18, 15],
      [{ category: "businessModel", min: 16, max: 20, custDevQuestion: "Чи окупляться банк-інтеграції при нашому ARPU та churn?" }],
    ),
    events: [],
  },

  // 4 ─ IT interview prep
  {
    id: "mock-it-interview",
    input: { idea: "Застосунок для підготовки до співбесід в IT.", region: "Global" },
    createdAt: at,
    status: "completed",
    citations: [
      cite("c1", "https://www.grandviewresearch.com/industry-analysis/test-preparation-market", "Test Prep Market — GVR", "Ринок підготовки/edtech великий і зростає."),
      cite("c2", "https://www.bls.gov/ooh/computer-and-information-technology/", "BLS — IT employment outlook", "Зайнятість в IT зростає швидше середнього."),
    ],
    brief: {
      problem: "Кандидати в IT губляться у підготовці: LeetCode окремо, system design окремо, поведінкові окремо — немає персонального плану й живого фідбеку.",
      customer: "Джуни/міддли в IT і свічери, що готуються до співбесід (алго, system design, behavioral).",
      valueProp: "AI-репетитор співбесід: персональний план, мок-інтерв'ю з голосовим AI і фідбек по відповідях.",
      geography: "Global",
      researchQuestions: ["Скільки готується щороку й чи платять?", "Чим кращі за LeetCode/Pramp?", "Чи довіряють AI-фідбеку?"],
    },
    market: {
      method: "top-down",
      tam: f(30000000000, "USD", "Edtech/test-prep (широко).", "c1"),
      sam: f(2500000000, "USD", "IT interview prep сегмент.", "c2"),
      som: f(20000000, "USD", "~0.8% SAM за 3 роки."),
    },
    competitors: {
      competitors: [
        { name: "LeetCode", positioning: "Алго-задачі, без персонального плану й мок-інтерв'ю з AI", pricing: f("$35/міс", undefined, "Premium."), url: "https://leetcode.com" },
        { name: "Pramp / Exponent", positioning: "Мок-інтерв'ю (peer/курси)", pricing: f("$79/міс", undefined, "Exponent підписка."), url: "https://tryexponent.com" },
        { name: "YouTube/безкоштовне", positioning: "Статус-кво" },
      ],
    },
    canvas: {
      customerSegments: ["Джуни/міддли IT", "Свічери в IT", "Студенти CS"],
      valuePropositions: ["Персональний план", "Мок-інтерв'ю з AI", "Фідбек по відповідях"],
      channels: ["ASO", "YouTube/TikTok dev-контент", "Універ-партнерства"],
      customerRelationships: ["Підписка", "Прогрес/геміфікація"],
      revenueStreams: ["Підписка", "Кар'єрні апсейли (резюме/менторинг)"],
      keyResources: ["Голосовий AI-інтерв'юер", "Банк задач/сценаріїв"],
      keyActivities: ["AI-оцінювання відповідей", "Контент по ролях"],
      keyPartnerships: ["Буткемпи/універи", "Dev-інфлюенсери"],
      costStructure: ["LLM-інференс", "Контент", "CAC"],
    },
    gtm: {
      channels: ["ASO", "Dev-інфлюенсери (YouTube/TikTok)", "Буткемпи"],
      plan30: ["Лендинг + waitlist", "Контент-сидинг"],
      plan60: ["MVP: алго + мок-інтерв'ю", "Перші 1000 користувачів"],
      plan90: ["System design + behavioral", "Партнерство з буткемпом"],
      hypotheses: ["Голосові мок-інтерв'ю = killer-фіча", "Інфлюенсери дають низький CAC"],
    },
    assumptions: A(15, 80, 28, 9, 6, 20000, 30000),
    risks: {
      risks: [
        { title: "Разове використання (готувався → пішов)", likelihood: "high", impact: "high", mitigation: "Кар'єрна підписка на постійне зростання, не лише підготовка." },
        { title: "Сильні інкумбенти (LeetCode)", likelihood: "high", impact: "medium", mitigation: "AI-мок-інтерв'ю + план, чого нема в LeetCode." },
        { title: "Вартість LLM-інференсу", likelihood: "medium", impact: "medium", mitigation: "Кешувати, дешевші моделі на рутинні кроки." },
      ],
    },
    synthesis: {
      executiveSummary: "AI-репетитор IT-співбесід: персональний план + голосові мок-інтерв'ю + фідбек — все в одному, де зараз зоопарк інструментів.",
      narrative: "Готується величезна кількість кандидатів, але інструменти фрагментовані. AI-мок-інтерв'ю з фідбеком — реальна цінність; ризик разового використання знімаємо кар'єрною підпискою.",
      deckOutline: [
        { slide: "Проблема", bullets: ["Фрагментована підготовка", "Немає живого фідбеку"] },
        { slide: "Рішення", bullets: ["AI-мок-інтерв'ю", "Персональний план"] },
        { slide: "Ринок", bullets: ["Edtech $30B", "IT-prep $2.5B"] },
        { slide: "GTM", bullets: ["Інфлюенсери + ASO"] },
      ],
    },
    validation: V(
      persona("skeptic", [20, 16, 12, 16], ["Попит є, але разовий.", "AI-фідбек ще треба довести.", "Churn після офера вбиває LTV.", "Інфлюенсер-CAC нестабільний."]),
      persona("advocate", [23, 21, 16, 20], ["Постійний потік кандидатів.", "Голосові мок-інтерв'ю — рів.", "Кар'єрна підписка тримає LTV.", "Dev-контент = дешевий канал."]),
      persona("analyst", [22, 18, 14, 18], ["Сильний попит.", "Диференціація реальна.", "LTV — головний ризик.", "Канал перспективний."]),
      [22, 18, 14, 18],
      [{ category: "businessModel", min: 12, max: 16, custDevQuestion: "Як утримати користувача після того, як він отримав офер?" }],
    ),
    events: [],
  },

  // 5 ─ Expense tracker for couples
  {
    id: "mock-couples-expenses",
    input: { idea: "Трекер витрат для пар.", region: "Global" },
    createdAt: at,
    status: "completed",
    citations: [
      cite("c1", "https://www.grandviewresearch.com/industry-analysis/personal-finance-software-market", "Personal Finance Software — GVR", "Ринок особистих фінансів зростає двозначно."),
      cite("c2", "https://www.pewresearch.org/", "Pew — Couples & money", "Гроші — топ-джерело конфліктів у парах."),
    ],
    brief: {
      problem: "Пари сваряться через гроші: незрозуміло хто скільки витратив, як ділити спільні витрати й чи вкладаємось у бюджет.",
      customer: "Пари 22–40, що ведуть спільний побут (оренда, продукти, підписки), частково окремі фінанси.",
      valueProp: "Спільний трекер витрат: автоматичний розподіл «хто кому винен», спільні цілі та бюджет на двох.",
      geography: "Global",
      researchQuestions: ["Скільки пар платять за фінтул?", "Чим кращі за Splitwise?", "Чи готові підключати банки?"],
    },
    market: {
      method: "top-down",
      tam: f(15000000000, "USD", "Особисті фінанси/бюджетування.", "c1"),
      sam: f(1200000000, "USD", "Сегмент спільних фінансів пар.", "c2"),
      som: f(10000000, "USD", "~0.8% SAM за 3 роки."),
    },
    competitors: {
      competitors: [
        { name: "Splitwise", positioning: "Розподіл витрат, але не бюджет/цілі пари", pricing: f("freemium", undefined, "Pro-підписка."), url: "https://splitwise.com" },
        { name: "Honeydue", positioning: "Фінанси для пар; UX і утримання слабкі", pricing: f("free", undefined, "Безкоштовний."), url: "https://honeydue.com" },
        { name: "Таблиця/нотатки", positioning: "Статус-кво" },
      ],
    },
    canvas: {
      customerSegments: ["Пари, що з'їхались", "Молоді сім'ї", "Пари з окремими картами"],
      valuePropositions: ["Хто кому винен — авто", "Спільний бюджет", "Спільні цілі"],
      channels: ["ASO", "TikTok/Instagram (couples)", "Реферали (вірусність на двох)"],
      customerRelationships: ["Підписка", "Сповіщення про витрати"],
      revenueStreams: ["Підписка (на пару)", "Преміум-цілі/аналітика"],
      keyResources: ["Логіка розподілу", "Банк-інтеграції"],
      keyActivities: ["Інтеграції", "Вірусні механіки"],
      keyPartnerships: ["Open banking", "Інфлюенсери"],
      costStructure: ["Розробка", "Інтеграції", "CAC"],
    },
    gtm: {
      channels: ["TikTok/Instagram (couples-контент)", "ASO", "Реферали"],
      plan30: ["Лендинг + waitlist", "Креативи couples"],
      plan60: ["MVP + ручний/банк ввід", "Перші 1000 пар"],
      plan90: ["Спільні цілі + аналітика", "Реферальний цикл"],
      hypotheses: ["Вірусність «на двох» знижує CAC", "Авто-розподіл = killer-фіча"],
    },
    assumptions: A(6, 85, 14, 6, 5, 12000, 30000),
    risks: {
      risks: [
        { title: "Обидва партнери мають поставити додаток", likelihood: "high", impact: "high", mitigation: "Цінність і для одного; запрошення партнера через 1 тап." },
        { title: "Splitwise звичка", likelihood: "medium", impact: "medium", mitigation: "Додати бюджет/цілі, чого нема у Splitwise." },
        { title: "Чутливість фінданих у парі", likelihood: "medium", impact: "medium", mitigation: "Гнучкі налаштування приватності між партнерами." },
      ],
    },
    synthesis: {
      executiveSummary: "Трекер витрат для пар: авто-розподіл «хто кому винен» + спільний бюджет і цілі — там, де Splitwise зупиняється.",
      narrative: "Гроші — головний конфлікт у парах, а інструменти або вузькі (Splitwise), або слабкі (Honeydue). Вірусність «на двох» і couples-контент дають дешевий канал, підписка на пару — кращий ARPU.",
      deckOutline: [
        { slide: "Проблема", bullets: ["Конфлікти через гроші", "Незрозумілий розподіл"] },
        { slide: "Рішення", bullets: ["Авто хто-кому-винен", "Бюджет + цілі пари"] },
        { slide: "Ринок", bullets: ["Особисті фінанси $15B", "Couples-сегмент $1.2B"] },
        { slide: "GTM", bullets: ["TikTok couples + реферали"] },
      ],
    },
    validation: V(
      persona("skeptic", [18, 14, 13, 15], ["Біль є, але Splitwise «достатньо».", "Фічі копіюються.", "Низький ARPU.", "Потрібні обидва партнери."]),
      persona("advocate", [22, 18, 16, 20], ["Гроші = топ-конфлікт пар.", "Бюджет+цілі — диференціація.", "Підписка на пару кращий ARPU.", "Вбудована вірусність."]),
      persona("analyst", [20, 16, 14, 17], ["Стійкий попит.", "Диференціація помірна.", "Юніт-ек. ок із вірусністю.", "Канал перспективний."]),
      [20, 16, 14, 17],
      [{ category: "gtmTraction", min: 15, max: 20, custDevQuestion: "Який реальний k-фактор запрошення другого партнера?" }],
    ),
    events: [],
  },

  // 6 ─ Habit tracker for ADHD
  {
    id: "mock-adhd-habits",
    input: { idea: "Трекер звичок для людей з СДУГ (ADHD).", region: "Global" },
    createdAt: at,
    status: "completed",
    citations: [
      cite("c1", "https://www.cdc.gov/adhd/data/index.html", "CDC — ADHD prevalence", "СДУГ діагностовано у значної частки дорослих і дітей."),
      cite("c2", "https://www.grandviewresearch.com/industry-analysis/mental-health-apps-market", "Mental Health Apps — GVR", "Ринок mental-health додатків швидко зростає."),
    ],
    brief: {
      problem: "Звичайні трекери звичок карають за пропуски й набридають — для людей із СДУГ це вбиває мотивацію та призводить до закидання.",
      customer: "Дорослі з СДУГ (діагностовані/самоідентифіковані) 18–40, що борються з рутинами та фокусом.",
      valueProp: "Трекер звичок під СДУГ: мікрокроки, дофамінові винагороди, гнучкі «streak-friendly» правила без сорому за пропуск.",
      geography: "Global",
      researchQuestions: ["Розмір ADHD-аудиторії й платоспроможність?", "Чим кращі за Habitica/Finch?", "Що тримає СДУГ-користувача довго?"],
    },
    market: {
      method: "top-down",
      tam: f(7000000000, "USD", "Mental-health додатки (широко).", "c2"),
      sam: f(900000000, "USD", "ADHD/продуктивність сегмент.", "c1"),
      som: f(12000000, "USD", "~1.3% SAM за 3 роки."),
    },
    competitors: {
      competitors: [
        { name: "Finch", positioning: "Self-care з петом; не заточений під СДУГ", pricing: f("$40/рік", undefined, "Підписка."), url: "https://finchcare.com" },
        { name: "Habitica", positioning: "Геміфікація звичок; складна, карає за пропуски", pricing: f("freemium", undefined, "Підписка."), url: "https://habitica.com" },
        { name: "Inflow", positioning: "ADHD-додаток (CBT-контент), менше про звички", pricing: f("$48/міс", undefined, "Підписка."), url: "https://getinflow.io" },
      ],
    },
    canvas: {
      customerSegments: ["Дорослі з СДУГ", "Самоідентифіковані", "Студенти з фокус-проблемами"],
      valuePropositions: ["Мікрокроки", "Дофамінові винагороди", "Без сорому за пропуск"],
      channels: ["TikTok (#adhd)", "ASO", "ADHD-спільноти/інфлюенсери"],
      customerRelationships: ["Підписка", "Підбадьорливі нагадування"],
      revenueStreams: ["Підписка", "Преміум-контент/коучинг"],
      keyResources: ["UX під СДУГ", "Поведінкові механіки"],
      keyActivities: ["Геміфікація", "Контент про СДУГ"],
      keyPartnerships: ["ADHD-інфлюенсери", "Коучі/психологи"],
      costStructure: ["Розробка", "Контент", "CAC"],
    },
    gtm: {
      channels: ["TikTok (#adhd величезний)", "ASO", "ADHD-інфлюенсери"],
      plan30: ["Лендинг + waitlist", "Сидинг у TikTok"],
      plan60: ["MVP: мікрокроки + винагороди", "Перші 2000 користувачів"],
      plan90: ["Преміум-контент", "Утримання D30 > 30%"],
      hypotheses: ["TikTok #adhd дає дуже низький CAC", "Streak-friendly правила тримають довше"],
    },
    assumptions: A(5, 85, 8, 8, 5, 11000, 40000),
    risks: {
      risks: [
        { title: "Утримання саме у СДУГ-аудиторії", likelihood: "high", impact: "high", mitigation: "Дизайн під дофамін + гнучкі правила; вимірювати D30/D90." },
        { title: "Інкумбенти (Finch/Habitica)", likelihood: "medium", impact: "medium", mitigation: "Чіткий ADHD-фокус, чого нема в загальних трекерах." },
        { title: "Етика «експлуатації дофаміну»", likelihood: "low", impact: "medium", mitigation: "Прозорі, здорові механіки; без dark patterns." },
      ],
    },
    synthesis: {
      executiveSummary: "Трекер звичок, спроєктований під мозок із СДУГ: мікрокроки й винагороди без покарань за пропуски — там, де загальні трекери відштовхують.",
      narrative: "ADHD-аудиторія велика, голосна в TikTok і недообслужена: загальні трекери карають за пропуски. Дизайн під дофамін + #adhd-канал дають дешеву дистрибуцію та сильне утримання, якщо влучити в механіки.",
      deckOutline: [
        { slide: "Проблема", bullets: ["Трекери карають за пропуск", "СДУГ закидає рутини"] },
        { slide: "Рішення", bullets: ["Мікрокроки + винагороди", "Streak-friendly"] },
        { slide: "Ринок", bullets: ["Mental-health $7B", "ADHD-сегмент $0.9B"] },
        { slide: "GTM", bullets: ["TikTok #adhd"] },
      ],
    },
    validation: V(
      persona("skeptic", [20, 15, 13, 18], ["Аудиторія є, але утримання у СДУГ складне.", "Механіки копіюються.", "Низький ARPU.", "TikTok-трафік нестабільний."]),
      persona("advocate", [24, 20, 16, 22], ["Велика голосна недообслужена ніша.", "ADHD-фокус — рів.", "Сильне утримання = добрий LTV.", "#adhd = майже безкоштовний канал."]),
      persona("analyst", [22, 17, 14, 20], ["Сильний попит і канал.", "Диференціація реальна.", "Утримання — ключ до юніт-ек.", "Канал відмінний, CAC низький."]),
      [22, 17, 14, 20],
      [{ category: "businessModel", min: 13, max: 16, custDevQuestion: "Яке реальне D30/D90-утримання у СДУГ-аудиторії на пілоті?" }],
    ),
    events: [],
  },
];

/** Pick a random mock Run (used by the demo fallback). */
export function randomMockRun(): Run {
  return MOCK_RUNS[Math.floor(Math.random() * MOCK_RUNS.length)];
}

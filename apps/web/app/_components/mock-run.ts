import type { Citation, Fact, Run } from "@hahaton/contracts";

// Bundled, fully client-side mock Run (Ukrainian). Rendered by the fallback so
// the demo report shows even if the API / D1 / gateway are all down.

const at = "2026-05-30T12:00:00.000Z";
const cite = (id: string, url: string, title: string, snippet: string): Citation => ({ id, url, title, snippet, accessedAt: at });
const f = (value: number | string, unit: string | undefined, rationale: string, citationId?: string, estimated?: boolean): Fact<typeof value> => {
  const o: Fact<typeof value> = { value, rationale };
  if (unit) o.unit = unit;
  if (citationId) o.citationId = citationId;
  if (estimated) o.estimated = true;
  return o;
};

const citations: Citation[] = [
  cite("c1", "https://www.grandviewresearch.com/industry-analysis/pet-food-market", "Європейський ринок кормів — Grand View Research", "Ринок кормів ЄС ~$38.4 млрд у 2024, CAGR ~5%; свіжий/преміум — найшвидше зростання."),
  cite("c2", "https://www.crunchbase.com/organization/butternut-box", "Butternut Box — Crunchbase", "Британська підписка на свіжий корм; залучено $350M+ Series E (2023)."),
  cite("c3", "https://www.lilyskitchen.co.uk/", "Lily's Kitchen", "Преміальний натуральний корм, придбаний Nestlé Purina (2020)."),
  cite("c4", "https://www.statista.com/statistics/poland-pet-ownership", "Власники тварин у Польщі — Statista", "~8.3 млн собак у польських домогосподарствах; преміум-витрати зростають двозначно."),
];

export const MOCK_RUN: Run = {
  id: "demo",
  input: { idea: "Підписка на доставку ветеринарно-сформульованого свіжого корму для собак у Польщі.", region: "PL" },
  createdAt: at,
  status: "completed",
  brief: {
    problem: "Польські власники собак дедалі менше довіряють масовому сухому корму, але не мають зручного доступу до свіжого ветеринарно-сформульованого харчування.",
    customer: "Міські власники собак (25–45) із вищим доходом у Варшаві, Кракові, Вроцлаві, що сприймають улюбленця як члена сім'ї.",
    valueProp: "Ветеринарно-сформульовані порційні свіжі раціони з доставкою за підпискою — корисніше за сухий корм, зручніше за готування.",
    geography: "Польща (спершу великі міста)",
    researchQuestions: [
      "Наскільки великий сегмент преміум/свіжого корму в Польщі?",
      "Хто вже грає в ніші свіжого корму за підпискою і чи вони в Польщі?",
      "Який реалістичний CAC і churn для DTC-підписки на їжу в ЦСЄ?",
    ],
  },
  market: {
    method: "top-down",
    tam: f(38400000000, "USD", "Ринок кормів ЄС у 2024 (Grand View Research).", "c1") as Fact,
    sam: f(900000000, "USD", "Частка преміум/свіжого корму для собак у Польщі, виведена з даних ЄС + витрат у Польщі.", "c4") as Fact,
    som: f(18000000, "USD", "~2% польського SAM, досяжні за 3 роки через міський DTC.", undefined, true) as Fact,
    notes: "Свіжий/охолоджений — найшвидше зростаючий формат; преміум-витрати в Польщі зростають двозначно.",
  },
  competitors: {
    competitors: [
      { name: "Butternut Box", positioning: "Британський лідер, свіжа DTC-підписка; розширюється в ЄС", pricing: f("€2–5 / день", undefined, "Публічна сторінка цін; залежить від ваги собаки.", "c2") as Fact<string>, funding: f("$350M+ Series E", undefined, "Crunchbase.", "c2") as Fact<string>, url: "https://butternutbox.com", citationId: "c2" },
      { name: "Lily's Kitchen", positioning: "Преміум натуральний, ритейл + онлайн (Nestlé)", pricing: f("€3–4 / день", undefined, "Преміум-тариф у ритейлі.", "c3") as Fact<string>, url: "https://lilyskitchen.co.uk", citationId: "c3" },
      { name: "Pupil Foods (PL)", positioning: "Локальний польський преміум-корм, обмежена свіжа лінійка", url: "https://pupil.com.pl", citationId: "c4" },
      { name: "Локальні бренди сухого корму", positioning: "Масові гравці; орієнтація на ціну, не на свіжість" },
    ],
  },
  canvas: {
    customerSegments: ["Міські власники собак 25–45", "Домогосподарства з преміум-витратами", "Собаки з дієтичними потребами"],
    valuePropositions: ["Ветеринарно-сформульовані свіжі раціони", "Порційно та з доставкою", "Корисніше за сухий корм", "Зручна підписка"],
    channels: ["Платний соціал (Meta/TikTok)", "Партнерства з ветклініками", "Реферальна програма", "Інфлюенсери/UGC"],
    customerRelationships: ["Підписка", "Персональний план годування", "Чат із ветеринаром"],
    revenueStreams: ["Місячна підписка", "Додатки: ласощі/добавки"],
    keyResources: ["Холодова логістика", "Команда ветнутриціологів", "Бренд"],
    keyActivities: ["Виробництво раціонів", "Холодова доставка", "Утримання/CRM"],
    keyPartnerships: ["Локальні кухні/виробники", "Кур'єри холодового ланцюга", "Ветеринарні клініки"],
    costStructure: ["Собівартість (інгредієнти)", "Холодова логістика", "CAC/маркетинг", "Фіксовані витрати"],
  },
  gtm: {
    channels: ["Платний Meta/TikTok", "Реферали від ветклінік", "Інфлюенсер-сидинг (PL спільнота собачників)"],
    plan30: ["Лендинг + waitlist", "10 LOI від ветклінік", "Тестування креативів у Meta"],
    plan60: ["Пілот у Варшаві", "Перші 100 підписників", "Доопрацювати квіз плану годування"],
    plan90: ["Розширення Краків/Вроцлав", "Запуск реферального циклу", "500 активних підписок"],
    hypotheses: ["Реферали ветклінік дешевші за платний трафік", "Квіз підіймає конверсію >2.5%", "Churn <6% із планом годування"],
  },
  assumptions: {
    arpu: f(45, "EUR/mo", "Середня підписка на середню собаку, бенчмарк до Butternut.", "c2") as Fact,
    grossMarginPct: f(35, "%", "Собівартість свіжого корму + холодова логістика важкі; 35% реалістично на старті.", undefined, true) as Fact,
    cac: f(55, "EUR", "Змішаний платний + реферальний CAC для DTC-їжі в ЦСЄ.", undefined, true) as Fact,
    monthlyChurnPct: f(6, "%", "Підписки на їжу churn 5–8%/міс на старті.", undefined, true) as Fact,
    conversionPct: f(2.5, "%", "Конверсія лендинг→оплата з квізом плану годування.", undefined, true) as Fact,
    fixedMonthlyCost: f(18000, "EUR", "Кухня, веткоманда, операційні витрати.", undefined, true) as Fact,
    funnelVolume: f(12000, "users", "Місячна воронка з платного + органіки на пілотному масштабі.", undefined, true) as Fact,
  },
  risks: {
    risks: [
      { title: "Вартість холодової логістики", likelihood: "high", impact: "high", mitigation: "Старт гіперлокально (Варшава), щоб доставка була щільною й дешевою." },
      { title: "Низька валова маржа", likelihood: "medium", impact: "high", mitigation: "Оптимізувати рецепти/порціонування; додати високомаржинальні ласощі." },
      { title: "Експансія Butternut у ЄС", likelihood: "medium", impact: "medium", mitigation: "Вигравати локальним смаком, партнерствами з ветами, швидшою доставкою." },
      { title: "Зростання CAC", likelihood: "medium", impact: "high", mitigation: "Спиратися на реферали ветів + реферальний цикл замість платного." },
    ],
  },
  synthesis: {
    executiveSummary: "Свіжий ветеринарно-сформульований корм за підпискою для швидкозростаючого преміум-сегменту тварин Польщі — зручність DTC із health-історією, якої локально немає в інкумбентів.",
    narrative: "Преміум-витрати на тварин у Польщі зростають двозначно, а свіжий формат — найшвидший, проте лідер ЄС (Butternut) ще не локалізувався. Старт у Варшаві через реферали ветклінік може виграти на смаку, довірі та швидкості доставки до приходу інкумбентів. Модель тримається на дисциплінованому CAC (реферали ветів) і покращенні тонкої маржі свіжого корму через ласощі й порціонування.",
    deckOutline: [
      { slide: "Проблема", bullets: ["Власники не довіряють сухому корму", "Немає зручного локального свіжого варіанту"] },
      { slide: "Ринок", bullets: ["Корми ЄС $38.4 млрд", "PL преміум зростає двозначно", "Свіжий = найшвидший формат"] },
      { slide: "Рішення", bullets: ["Ветеринарно-сформульовані свіжі раціони", "Порційно та з доставкою", "Квіз плану годування"] },
      { slide: "Конкуренти", bullets: ["Butternut не локалізований", "Lily's лише ритейл", "Локальні бренди не свіжі"] },
      { slide: "Бізнес-модель", bullets: ["€45/міс ARPU", "Підписка + ласощі"] },
      { slide: "GTM", bullets: ["Реферали ветів", "Пілот Варшава → 500 підписок"] },
      { slide: "Запит", bullets: ["Seed-раунд на пілот + холодовий ланцюг"] },
    ],
  },
  validation: {
    personas: [
      { persona: "skeptic", scores: { problemMarket: 17, solutionDiff: 12, businessModel: 11, gtmTraction: 13 }, total: 53, rationale: { problemMarket: "Реальна, але нішева; ціночутливий ринок.", solutionDiff: "Свіжий корм копіюється; Butternut може швидко локалізуватись.", businessModel: "35% маржа + холодовий ланцюг — жорстко.", gtmTraction: "Реферали ветів не доведені на масштабі." } },
      { persona: "advocate", scores: { problemMarket: 23, solutionDiff: 20, businessModel: 18, gtmTraction: 21 }, total: 82, rationale: { problemMarket: "Преміум-витрати на тварин ростуть, люди хочуть свіже.", solutionDiff: "Локальність + довіра ветів — реальний рів у PL.", businessModel: "Ласощі/додатки підіймають маржу; LTV сильний.", gtmTraction: "Реферали ветів = дешевий канал, якого нема в інкумбентів." } },
      { persona: "analyst", scores: { problemMarket: 20, solutionDiff: 16, businessModel: 14, gtmTraction: 17 }, total: 67, rationale: { problemMarket: "Стійкий попит, значний міський сегмент.", solutionDiff: "Диференціація захищена лише за швидкого локального виконання.", businessModel: "Маржа — ключове, треба доводити.", gtmTraction: "Канал правдоподібний; потрібні дані пілоту." } },
    ],
    consensus: { problemMarket: 20, solutionDiff: 16, businessModel: 14, gtmTraction: 17 },
    totalScore: 67,
    disagreements: [
      { category: "solutionDiff", min: 12, max: 20, custDevQuestion: "Якщо Butternut локалізується в Польщі за 6 місяців — чому клієнти все одно оберуть нас?" },
      { category: "businessModel", min: 11, max: 18, custDevQuestion: "Яку валову маржу ми реально досягнемо на 500 підписках із холодовим ланцюгом?" },
      { category: "gtmTraction", min: 13, max: 21, custDevQuestion: "Чи реально ветклініки рекомендуватимуть — і за якої конверсії та вартості?" },
    ],
  },
  citations,
  events: [],
};

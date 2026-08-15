import { analyzeCall } from "../worker/ai.js";

// Дефолтный чек-лист из миграции 0002 (7 пунктов, веса в сумме 100).
const checklist = {
  items: [
    { key: "greeting",      weight: 8,  label: "Приветствие и представление", hint: "Назвал компанию и себя" },
    { key: "needs",         weight: 20, label: "Выявление потребности", hint: "Открытые вопросы, докопался до задачи" },
    { key: "qualification", weight: 14, label: "Квалификация", hint: "Бюджет, сроки, ЛПР" },
    { key: "pitch",         weight: 14, label: "Презентация под потребность", hint: "О выгоде клиента" },
    { key: "objections",    weight: 16, label: "Работа с возражениями", hint: "Уточнил суть, привёл аргумент" },
    { key: "next_step",     weight: 18, label: "Фиксация следующего шага", hint: "Конкретная дата" },
    { key: "tone",          weight: 10, label: "Тон и инициатива", hint: "Вёл разговор" }
  ]
};

// Реалистичный слабый звонок: менеджер не квалифицировал и не зафиксировал шаг.
const transcript = `
Менеджер: Алло, добрый день, компания "Онлайн-школа Профи", меня Игорь зовут.
Клиент: Да, здравствуйте, я оставлял заявку на курс по программированию.
Менеджер: Ага, отлично. У нас есть курс Python, стоит 25 тысяч, длится 4 месяца, там всё с нуля.
Клиент: А а на кого рассчитано? Я вообще с гуманитарным образованием.
Менеджер: Ну на всех, там с самых основ идёт. Записываю вас?
Клиент: Ну я не знаю, надо подумать, дороговато.
Менеджер: Хорошо, думайте, если что звоните. Всего доброго.
Клиент: Ага, до свидания.
`.trim();

const result = await analyzeCall({
  provider: "gemini",
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-flash-latest",
  transcript,
  checklist,
  context: { managerName: "Игорь", direction: "inbound", durationSec: 95 }
});

console.log("═══ РАЗБОР ЗВОНКА (живой Gemini) ═══");
console.log("Итоговый балл:", result.score, "/ 100");
console.log("Токенов:", result.tokensIn, "вход /", result.tokensOut, "выход");
console.log("\nРезюме:", result.summary);
console.log("\nПо пунктам чек-листа:");
for (const it of result.items) console.log(`  ${String(it.score).padStart(3)} — ${it.label}`);
console.log("\nГде течёт выручка:");
for (const l of result.leaks) console.log(`  [${l.severity}] ${l.title}: ${l.detail}`);
console.log("\nЧто коучить:");
for (const c of result.coaching) console.log(`  • ${c.title}: ${c.detail}`);
console.log("\nСледующий шаг зафиксирован:", result.next_step.present, "—", result.next_step.detail);

// Сохраняем сырой результат, чтобы следующим шагом положить в Supabase.
import { writeFileSync } from "fs";
writeFileSync("/tmp/analysis.json", JSON.stringify(result, null, 2));

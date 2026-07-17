import fs from "node:fs";
import path from "node:path";

const ruleCatalog = {
  svo: {
    title: "Basic subject–verb–object order",
    overview: "Mandarin usually places the subject before the verb and the object after it. Keep the core order stable instead of moving the object as English sometimes does in questions.",
    situations: [
      ["Simple facts and routines", "Use subject + verb + object for everyday actions, habits, and work or school statements.", [0, 3, 8, 13, 14]],
      ["Time and place before the action", "Time expressions commonly come before the verb, while a location can come before the action or after 在.", [2, 4, 7, 9, 15]]
    ],
    contrasts: ["Unlike English questions, Mandarin question words stay in the position of the missing information."],
    commonMistakes: ["Do not add a form of ‘to be’ before an ordinary action verb.", "Do not put the object before the verb unless a special construction is being taught."]
  },
  ma: {
    title: "Yes-no questions with 吗",
    overview: "Add 吗 to the end of a statement to make a neutral yes-no question. The statement word order stays the same.",
    situations: [
      ["Checking facts", "Use 吗 when you want confirmation about a person, object, action, or situation.", [0, 1, 8, 13]],
      ["Polite workplace and school checks", "A 吗 question can sound neutral and professional when the context is clear.", [9, 10, 14, 15]]
    ],
    contrasts: ["吗 asks whether a statement is true; question words such as 什么 and 哪里 ask for missing information."],
    commonMistakes: ["Do not invert the subject and verb as in English.", "Do not use 吗 after a question-word question."]
  },
  de: {
    title: "的 for possession and description",
    overview: "Place 的 after a possessor or description and before the noun. 的 links ‘whose’ or ‘what kind of’ information to the noun.",
    situations: [
      ["Possession", "Use A 的 B for belongings, relationships, documents, and responsibilities.", [0, 4, 9, 10, 13]],
      ["Describing a noun", "Longer descriptions can come before a noun with 的, especially when the relationship is not fixed.", [5, 6, 14, 15]]
    ],
    contrasts: ["Short familiar relationships such as 我的朋友 may omit 的 in casual speech, but 我的电脑 keeps it naturally."],
    commonMistakes: ["Do not place 的 after the noun.", "Do not treat 的 as a general replacement for 是."]
  },
  zai: {
    title: "在 for location and ongoing action",
    overview: "在 can introduce a location, and 在 + verb describes an action in progress. The meaning comes from whether 在 is followed by a place or an action.",
    situations: [
      ["Where something is", "Use 在 + place to say where a person or object is located.", [4, 7, 8, 13, 15]],
      ["What is happening now", "Use 在 + verb when an action is underway at the moment of speaking.", [3, 9, 14, 17]]
    ],
    contrasts: ["在 + place answers ‘where’; 在 + verb answers ‘what is happening now’."],
    commonMistakes: ["Do not use 在 alone to mark every past or future action.", "Keep the location after 在 when it is functioning as a place phrase."]
  },
  le: {
    title: "了 for completed change or action",
    overview: "了 marks a completed event or a change of state. It does not simply mean ‘past tense’; time words and context still matter.",
    situations: [
      ["Completed events", "Use verb + 了 when an action has been completed or a result is now relevant.", [2, 3, 5, 7, 9, 14, 17, 18]],
      ["Change of state", "Sentence-final 了 can show that a new situation now exists, such as being late, tired, or ready.", [11, 12, 16, 19]]
    ],
    contrasts: ["了 is not a universal past-tense ending; 未 and 没有 handle some negative completed events."],
    commonMistakes: ["Do not add 了 to every sentence about yesterday.", "Learn whether 了 marks the verb event or a new state in the whole sentence."]
  },
  measure: {
    title: "Measure words after numbers",
    overview: "A number normally comes before a measure word and then a noun: number + measure word + noun. 个 is common, but objects and events often use more specific classifiers.",
    situations: [
      ["Counting people and objects", "Use 个 for many everyday objects and 个人 for people when a more specific classifier is not needed.", [2, 4, 5, 6, 13, 15]],
      ["Counting events and documents", "Use 次 for occurrences, 张 for flat items, and 份 for documents or portions.", [9, 10, 11, 14, 16]]
    ],
    contrasts: ["English can say ‘three books’ directly; Mandarin normally requires 三本书."],
    commonMistakes: ["Do not place the noun directly after the number in careful Mandarin.", "Choose a classifier that fits the noun when the specific word is known."]
  },
  ba: {
    title: "把 for handling an object",
    overview: "把 moves a definite object before the verb so the sentence emphasizes what happens to that object. The verb phrase must usually show an outcome, location, or completion.",
    situations: [
      ["Changing or moving a thing", "Use 把 when a person deliberately handles, moves, fixes, closes, or changes a known object.", [6, 10, 12, 15, 18]],
      ["Giving instructions", "把 is common in practical instructions when the listener knows which object is meant.", [7, 9, 17, 19]]
    ],
    contrasts: ["A normal SVO sentence states an action; 把 highlights the object and its result."],
    commonMistakes: ["Do not use 把 with an unknown or indefinite object.", "A bare verb after 把 often sounds incomplete; include a result, direction, location, or other complement."]
  },
  modal: {
    title: "Modal verbs 能、可以、要、应该",
    overview: "Modal verbs come before the main verb. 能 focuses on ability or circumstances, 可以 on permission or possibility, 要 on intention or necessity, and 应该 on advice or expectation.",
    situations: [
      ["Ability and permission", "Use 能 for whether circumstances allow something and 可以 for permission or a possible option.", [1, 7, 8, 13, 15, 17]],
      ["Plans and advice", "Use 要 for plans or requirements and 应该 for what is advisable or expected.", [3, 9, 11, 14, 16, 19]]
    ],
    contrasts: ["可以 is not always the same as 能: permission and ability are different questions."],
    commonMistakes: ["Do not add 的 after a modal verb before the main verb.", "Use 不 or 没有 according to the meaning and time of the modal expression."]
  },
  guo: {
    title: "过 for life experience",
    overview: "Verb + 过 says that someone has had an experience at least once before. It focuses on experience, not on a specific completed event.",
    situations: [
      ["Asking about experience", "Use 过 to ask whether someone has ever visited, tried, seen, or done something.", [5, 7, 13, 14, 17, 18]],
      ["Contrasting experience with a specific event", "Use 过 for general experience and 了 with a time or result for one particular event.", [11, 16, 19]]
    ],
    contrasts: ["我去过北京 means ‘I have been to Beijing’; 我去了北京 describes a particular trip or completed visit."],
    commonMistakes: ["Do not use 过 when you mean one specific event with a stated time.", "过 usually follows the verb, before the object or other complements."]
  },
  bi: {
    title: "Comparisons with 比",
    overview: "A 比 B + adjective compares A with B. The adjective usually does not need 很 in this structure, and a degree expression can follow it.",
    situations: [
      ["Comparing people and objects", "Use 比 for size, speed, difficulty, price, or quality comparisons.", [4, 6, 8, 13, 14, 15]],
      ["Adding a degree", "Use 一点儿, 多了, or a number-plus-measure phrase to show how much greater the difference is.", [9, 11, 16, 19]]
    ],
    contrasts: ["比 expresses ‘more…than’; 不如 expresses ‘not as…as’."],
    commonMistakes: ["Do not put the adjective before 比.", "Do not use 很 automatically in A 比 B sentences unless the structure requires it for another reason."]
  },
  yinwei: {
    title: "因为…所以… for reasons and results",
    overview: "因为 introduces a reason and 所以 introduces the result. Either part can be omitted in casual speech when the relationship is obvious.",
    situations: [
      ["Explaining a problem", "Use the pair to explain why a work, school, travel, or health situation happened.", [3, 7, 9, 11, 12, 14, 17, 18]],
      ["Giving a reason for a decision", "Use 因为…所以… when connecting a reason to a plan, request, apology, or solution.", [5, 6, 10, 15, 16, 19]]
    ],
    contrasts: ["因为 gives the cause; 所以 gives the consequence. The English order can be reversed, but the Chinese roles stay clear."],
    commonMistakes: ["Do not confuse 所以 with 所以说 in formal writing.", "Keep the reason and result logically connected rather than using the pair as filler."]
  },
  ruguo: {
    title: "如果…就… for conditions",
    overview: "如果 introduces a condition and 就 introduces the expected result. The pattern is useful for plans, warnings, instructions, and problem solving.",
    situations: [
      ["Plans and alternatives", "Use 如果…就… to say what will happen if a plan, schedule, or condition changes.", [7, 9, 11, 15, 16, 19]],
      ["Safety instructions", "Use the pattern to state what someone should do if an accident or urgent problem occurs.", [12, 17, 18]]
    ],
    contrasts: ["就 marks the result or response; it does not mean every English use of ‘then’."],
    commonMistakes: ["Do not omit the condition when the listener cannot infer it.", "Use 要是 or 如果 consistently within a sentence rather than mixing structures randomly."]
  },
  result: {
    title: "Result complements",
    overview: "A result complement follows a verb to show what the action achieves or fails to achieve, such as 听懂, 找到, 记住, or 看清楚.",
    situations: [
      ["Success and failure", "Use result complements to distinguish doing an action from successfully achieving its intended result.", [3, 6, 9, 11, 13, 14, 16]],
      ["Accidents and instructions", "Result complements clearly describe what was found, damaged, understood, or made safe.", [12, 17, 18, 19]]
    ],
    contrasts: ["做了 means ‘did it’; 做完了 means ‘finished it’, and 做不到 means ‘cannot achieve it’."],
    commonMistakes: ["Do not translate every complement as a separate English verb.", "Negative 没 often comes before the verb-complement combination: 没找到."]
  },
  bei: {
    title: "被 for unwanted passive events",
    overview: "被 introduces the person or thing affected by an event, especially when the event is unwanted or important to report.",
    situations: [
      ["Reports and damage", "Use 被 to report lost, broken, taken, or affected objects and people.", [6, 10, 12, 17, 18]],
      ["Formal incident descriptions", "被 is useful when the affected person matters more than the actor or when the actor is unknown.", [11, 19]]
    ],
    contrasts: ["Chinese often omits the actor after 被 when it is unknown or unimportant."],
    commonMistakes: ["Do not use 被 for every English passive sentence.", "The sentence usually needs a clear result or consequence after the verb."]
  },
  qing: {
    title: "Polite requests with 请 and 可以",
    overview: "请 makes a request explicit and polite; 可以吗 asks for permission. Tone, context, and the relationship still affect how direct the request feels.",
    situations: [
      ["Work and school requests", "Use 请 and 可以吗 when asking coworkers, teachers, classmates, or staff for an action or permission.", [8, 9, 10, 13, 14, 15]],
      ["Emergency instructions", "Use 请 + verb for calm, clear directions while helping someone or contacting services.", [17, 18, 19]]
    ],
    contrasts: ["请 is a politeness marker, not a translation of ‘please’ that must appear in every English request."],
    commonMistakes: ["Do not make every request excessively formal; casual contexts may use 可以 or 能不能.", "Keep the requested action after 请."]
  },
  ne: {
    title: "呢 for follow-up and current context",
    overview: "呢 keeps a topic active, asks ‘what about…?’, or highlights a current situation. It is common in natural conversation.",
    situations: [
      ["Returning a question", "Use 呢 after a short answer to ask the same question about another person or thing.", [0, 1, 4, 13, 14]],
      ["Keeping a situation open", "Use 呢 to ask about an ongoing task, missing item, or current status.", [9, 10, 11, 12, 19]]
    ],
    contrasts: ["呢 is conversational and context-sensitive; it is not a direct equivalent of one English word."],
    commonMistakes: ["Do not use 呢 as a general question ending in every question.", "Let the previous topic determine what 呢 refers to."]
  },
  baoyuan: {
    title: "Apologies and softening with 对不起、抱歉、可能",
    overview: "对不起 and 抱歉 apologize; 可能 softens uncertainty. Combining an apology with a reason and a solution sounds more responsible than giving only 对不起.",
    situations: [
      ["Small mistakes and delays", "Use a brief apology with a reason when late, mistaken, or unable to finish something.", [3, 9, 10, 11, 14, 15]],
      ["Incidents and responsibility", "Use 抱歉, 可能, and clear next steps when reporting a problem or helping after an accident.", [12, 16, 17, 18, 19]]
    ],
    contrasts: ["可能 expresses possibility, not necessarily an apology; the responsibility comes from the surrounding sentence."],
    commonMistakes: ["Do not promise certainty with 可能.", "A useful apology usually states what happened and what you will do next."]
  },
  yiding: {
    title: "一定、应该、必须 for certainty and obligation",
    overview: "一定 expresses strong certainty or a firm promise, 应该 expresses advice or expectation, and 必须 expresses a requirement.",
    situations: [
      ["Rules and deadlines", "Use 必须 for requirements and 应该 for recommended behavior at work, school, or in public places.", [8, 9, 11, 14, 15, 19]],
      ["Promises and predictions", "Use 一定 to make a confident promise or prediction when the speaker has strong commitment or evidence.", [3, 7, 10, 16, 18]]
    ],
    contrasts: ["应该 is softer than 必须; 一定 can describe certainty rather than obligation depending on context."],
    commonMistakes: ["Do not use 必须 for a friendly suggestion.", "Check whether 一定 means ‘definitely’ or ‘must’ from the sentence context."]
  },
  time: {
    title: "Time expressions and sequence",
    overview: "Mandarin uses time words such as 先、再、已经、还没、刚才, and later to organize events without changing the verb for tense.",
    situations: [
      ["Schedules and routines", "Place a time expression before the verb to show when an action happens.", [2, 3, 8, 9, 14, 15]],
      ["Incident timelines", "Use sequence words to report what happened first, next, and afterward.", [11, 12, 17, 18, 19]]
    ],
    contrasts: ["Time words carry much of the tense information; the verb itself usually stays unchanged."],
    commonMistakes: ["Do not force English tense endings onto Mandarin verbs.", "Use 已经, 还没, or 刚才 when the timing matters to the listener."]
  },
  question: {
    title: "Question words in their normal position",
    overview: "什么, 谁, 哪儿, 怎么, 为什么, and 什么时候 stay where the requested information would appear in a statement.",
    situations: [
      ["Finding information", "Use a question word in the object, place, time, or manner position instead of moving it to the front.", [1, 4, 7, 8, 13, 14]],
      ["Work and emergency clarification", "Question words help identify the task, location, cause, time, or person involved in a problem.", [9, 10, 11, 12, 17, 18, 19]]
    ],
    contrasts: ["Mandarin does not normally invert word order for question words as English does."],
    commonMistakes: ["Do not move 什么 or 哪里 to the front automatically.", "Use 吗 only for yes-no questions, not after a question word."]
  },
  complement: {
    title: "Directional complements 来、去、上、下、进、出",
    overview: "Directional complements show movement toward or away from a reference point and can describe practical changes of location.",
    situations: [
      ["Directions and transport", "Use directional complements for entering, exiting, going upstairs, getting on, and coming back.", [4, 7, 8, 15, 17]],
      ["Practical instructions", "They make safety and workplace instructions more precise by showing where an object or person moves.", [9, 12, 18, 19]]
    ],
    contrasts: ["The direction is attached to the verb phrase rather than expressed only with a separate English preposition."],
    commonMistakes: ["Choose 来 or 去 according to the reference point, not only according to the speaker’s movement.", "Do not omit the direction when it changes the meaning of the instruction."]
  }
};

const vocabulary = [
  ["你好", "hello", "greeting"], ["谢谢", "thank you", "politeness"], ["请", "please; invite", "politeness"], ["对不起", "sorry", "politeness"], ["抱歉", "sorry; regret", "politeness"], ["没关系", "it is okay", "phrase"],
  ["我", "I; me", "pronoun"], ["你", "you", "pronoun"], ["他", "he; him", "pronoun"], ["她", "she; her", "pronoun"], ["我们", "we; us", "pronoun"], ["大家", "everyone", "pronoun"],
  ["是", "to be", "verb"], ["有", "to have; there is", "verb"], ["在", "at; in; be doing", "coverb"], ["要", "want to; need to", "modal"], ["可以", "may; can", "modal"], ["能", "can; be able to", "modal"], ["应该", "should", "modal"], ["必须", "must", "modal"], ["一定", "definitely", "adverb"], ["可能", "possibly", "adverb"],
  ["现在", "now", "time"], ["今天", "today", "time"], ["明天", "tomorrow", "time"], ["昨天", "yesterday", "time"], ["刚才", "just now", "time"], ["已经", "already", "time"], ["还没", "not yet", "time"], ["先", "first", "adverb"], ["再", "then; again", "adverb"],
  ["公司", "company", "workplace"], ["办公室", "office", "workplace"], ["同事", "coworker", "workplace"], ["经理", "manager", "workplace"], ["会议", "meeting", "workplace"], ["项目", "project", "workplace"], ["任务", "task", "workplace"], ["文件", "file; document", "workplace"], ["邮件", "email", "workplace"], ["电脑", "computer", "workplace"], ["打印机", "printer", "workplace"], ["客户", "client", "workplace"], ["报告", "report", "workplace"], ["截止日期", "deadline", "workplace"],
  ["学校", "school", "school"], ["老师", "teacher", "school"], ["学生", "student", "school"], ["同学", "classmate", "school"], ["课", "class", "school"], ["作业", "homework", "school"], ["考试", "exam", "school"], ["问题", "question; problem", "school"], ["答案", "answer", "school"], ["小组", "group", "school"], ["图书馆", "library", "school"], ["校园", "campus", "school"],
  ["家", "home", "daily life"], ["房间", "room", "daily life"], ["钥匙", "key", "daily life"], ["邻居", "neighbor", "daily life"], ["超市", "supermarket", "daily life"], ["商店", "shop", "daily life"], ["钱", "money", "daily life"], ["价格", "price", "daily life"], ["地铁", "subway", "transport"], ["公交车", "bus", "transport"], ["车站", "station", "transport"], ["机场", "airport", "transport"], ["路", "road; way", "transport"], ["左边", "left side", "direction"], ["右边", "right side", "direction"], ["前面", "in front", "direction"], ["后面", "behind", "direction"],
  ["饭", "meal; rice", "food"], ["水", "water", "food"], ["咖啡", "coffee", "food"], ["餐厅", "restaurant", "food"], ["菜单", "menu", "food"], ["服务员", "server", "food"], ["医院", "hospital", "health"], ["医生", "doctor", "health"], ["药", "medicine", "health"], ["身体", "body; health", "health"], ["疼", "to hurt; painful", "health"], ["伤", "injury", "health"], ["救护车", "ambulance", "emergency"], ["警察", "police", "emergency"], ["危险", "dangerous; danger", "emergency"], ["事故", "accident", "emergency"], ["帮助", "help", "emergency"], ["电话", "phone; telephone", "communication"], ["地址", "address", "communication"], ["声音", "sound; voice", "communication"]
].sort((a, b) => b[0].length - a[0].length);

function rows(value) {
  return value.trim().split("\n").map((line) => line.split("\t"));
}

function makeSentence([text, pinyin, translation], ruleId, unitTitle) {
  const words = vocabulary.filter(([surface]) => text.includes(surface)).slice(0, 5).map(([surface, meaning, role]) => ({ surface, lemma: surface, meaning, role }));
  const secondaryRules = [
    text.includes("把") ? "ba" : null,
    /可以|能|要|应该|必须/.test(text) ? "modal" : null,
    text.includes("呢") ? "ne" : null,
    text.includes("一定") ? "yiding" : null
  ].filter((id) => id && id !== ruleId);
  const grammar = [ruleId, ...secondaryRules].map((id) => {
    const rule = ruleCatalog[id];
    return { pattern: rule.title, meaning: rule.overview, ruleId: id, explanation: `This sentence gives a practical ${unitTitle.toLowerCase()} example of the rule.` };
  });
  return {
    text,
    translation,
    words,
    grammar,
    chunks: [{ surface: text, meaning: pinyin, explanation: `Pinyin: ${pinyin}. Read the whole sentence smoothly and use the English translation to check the meaning.`, type: "pinyin", level: "A0-A2", tags: ["pinyin", "pronunciation"] }]
  };
}

const supplementalSentences = {
  "Minor Accidents and Asking for Help": [["如果你不确定，就请工作人员检查。", "Rúguǒ nǐ bù quèdìng, jiù qǐng gōngzuò rényuán jiǎnchá.", "If you are unsure, ask a staff member to check."]]
};

function makeUnit(position, title, level, tags, ruleId, source) {
  const sentences = [...rows(source), ...(supplementalSentences[title] ?? [])].map((row) => makeSentence(row, ruleId, title));
  if (sentences.length !== 22) throw new Error(`${title} has ${sentences.length} sentences, expected 22.`);
  const displayPosition = title === "Shopping and Payments" ? 7 : position + 1;
  return { language: "zh", baseLanguage: "en", title: `Unit ${String(displayPosition).padStart(2, "0")}: ${title}`, description: `Practical Mandarin for ${title.toLowerCase()}.`, source: "ai_generated", level, tags: [`unit:${String(displayPosition).padStart(2, "0")}`, ...tags], sentences };
}

const units = [
  makeUnit(0, "Introductions and Roles", "A0", ["introductions", "identity", "daily-life"], "svo", `你好，我叫李明。\tNǐ hǎo, wǒ jiào Lǐ Míng.\tHello, my name is Li Ming.\n你叫什么名字？\tNǐ jiào shénme míngzi?\tWhat is your name?\n我是新同事。\tWǒ shì xīn tóngshì.\tI am the new coworker.\n她是我们的老师吗？\tTā shì wǒmen de lǎoshī ma?\tIs she our teacher?\n我是学生，不是老师。\tWǒ shì xuésheng, bú shì lǎoshī.\tI am a student, not a teacher.\n你在哪家公司工作？\tNǐ zài nǎ jiā gōngsī gōngzuò?\tWhich company do you work for?\n我在一家小公司工作。\tWǒ zài yì jiā xiǎo gōngsī gōngzuò.\tI work at a small company.\n这是我的同事王芳。\tZhè shì wǒ de tóngshì Wáng Fāng.\tThis is my coworker Wang Fang.\n那是我们的经理。\tNà shì wǒmen de jīnglǐ.\tThat is our manager.\n你是哪个小组的？\tNǐ shì nǎge xiǎozǔ de?\tWhich group are you in?\n我是市场小组的。\tWǒ shì shìchǎng xiǎozǔ de.\tI am in the marketing group.\n我今天第一次来这里。\tWǒ jīntiān dì yī cì lái zhèlǐ.\tThis is my first time coming here today.\n请多关照。\tQǐng duō guānzhào.\tPlease take care of me.\n认识你很高兴。\tRènshi nǐ hěn gāoxìng.\tNice to meet you.\n你会说英语吗？\tNǐ huì shuō Yīngyǔ ma?\tCan you speak English?\n我会说一点儿中文。\tWǒ huì shuō yìdiǎnr Zhōngwén.\tI can speak a little Chinese.\n请你说慢一点儿。\tQǐng nǐ shuō màn yìdiǎnr.\tPlease speak a little more slowly.\n没问题，我再说一次。\tMéi wèntí, wǒ zài shuō yí cì.\tNo problem, I will say it once more.\n你住在哪儿？\tNǐ zhù zài nǎr?\tWhere do you live?\n我住在学校附近。\tWǒ zhù zài xuéxiào fùjìn.\tI live near the school.\n你今天忙吗？\tNǐ jīntiān máng ma?\tAre you busy today?\n我不太忙，可以聊天。\tWǒ bú tài máng, kěyǐ liáotiān.\tI am not too busy; we can chat.`),
  makeUnit(1, "Names, Clarification, and Communication", "A0", ["questions", "communication", "clarification"], "question", `你是哪国人？\tNǐ shì nǎ guó rén?\tWhat country are you from?\n我是美国人，你呢？\tWǒ shì Měiguó rén, nǐ ne?\tI am American; what about you?\n你的中文名字是什么？\tNǐ de Zhōngwén míngzi shì shénme?\tWhat is your Chinese name?\n我的名字是安娜。\tWǒ de míngzi shì Ānnà.\tMy name is Anna.\n这个字怎么读？\tZhège zì zěnme dú?\tHow is this character pronounced?\n这个字读作“明”。\tZhège zì dú zuò “míng”.\tThis character is pronounced “míng.”\n你听懂了吗？\tNǐ tīng dǒng le ma?\tDid you understand?\n我还没听懂，请再说一遍。\tWǒ hái méi tīng dǒng, qǐng zài shuō yí biàn.\tI still did not understand; please say it again.\n你能写下来吗？\tNǐ néng xiě xiàlái ma?\tCan you write it down?\n我可以用手机查一下。\tWǒ kěyǐ yòng shǒujī chá yíxià.\tI can look it up on my phone.\n你说的是这个地址吗？\tNǐ shuō de shì zhège dìzhǐ ma?\tIs this the address you mean?\n不是，我说的是后面的地址。\tBú shì, wǒ shuō de shì hòumiàn de dìzhǐ.\tNo, I mean the address on the back.\n请问，洗手间在哪里？\tQǐngwèn, xǐshǒujiān zài nǎlǐ?\tExcuse me, where is the restroom?\n洗手间在右边。\tXǐshǒujiān zài yòubian.\tThe restroom is on the right.\n你为什么迟到？\tNǐ wèishénme chídào?\tWhy are you late?\n因为公交车晚点了。\tYīnwèi gōngjiāochē wǎndiǎn le.\tBecause the bus was delayed.\n什么时候开始上课？\tShénme shíhou kāishǐ shàngkè?\tWhen does class start?\n下午两点开始。\tXiàwǔ liǎng diǎn kāishǐ.\tIt starts at two in the afternoon.\n谁有我的电话？\tShéi yǒu wǒ de diànhuà?\tWho has my phone number?\n我有，你要我发给你吗？\tWǒ yǒu, nǐ yào wǒ fā gěi nǐ ma?\tI do; do you want me to send it to you?\n你要发邮件还是发消息？\tNǐ yào fā yóujiàn háishì fā xiāoxi?\tDo you want to send an email or a message?\n我发消息，因为比较快。\tWǒ fā xiāoxi, yīnwèi bǐjiào kuài.\tI will send a message because it is faster.`),
  makeUnit(2, "Numbers, Dates, and Schedules", "A0", ["numbers", "time", "schedules"], "time", `今天是几月几号？\tJīntiān shì jǐ yuè jǐ hào?\tWhat is today's date?\n今天是五月十六号。\tJīntiān shì wǔ yuè shíliù hào.\tToday is May sixteenth.\n现在几点？\tXiànzài jǐ diǎn?\tWhat time is it now?\n现在八点半。\tXiànzài bā diǎn bàn.\tIt is eight thirty now.\n我九点有一个会议。\tWǒ jiǔ diǎn yǒu yí ge huìyì.\tI have a meeting at nine.\n请把会议时间写在日历上。\tQǐng bǎ huìyì shíjiān xiě zài rìlì shàng.\tPlease put the meeting time on the calendar.\n你每天几点起床？\tNǐ měitiān jǐ diǎn qǐchuáng?\tWhat time do you get up every day?\n我每天七点起床。\tWǒ měitiān qī diǎn qǐchuáng.\tI get up at seven every day.\n星期几有中文课？\tXīngqī jǐ yǒu Zhōngwén kè?\tWhat day is Chinese class?\n星期三和星期五有课。\tXīngqī sān hé xīngqī wǔ yǒu kè.\tThere is class on Wednesday and Friday.\n我有三份文件要看。\tWǒ yǒu sān fèn wénjiàn yào kàn.\tI have three documents to review.\n这个任务需要几个小时？\tZhège rènwu xūyào jǐ ge xiǎoshí?\tHow many hours does this task need?\n我需要两个小时。\tWǒ xūyào liǎng ge xiǎoshí.\tI need two hours.\n下午五点以前可以完成吗？\tXiàwǔ wǔ diǎn yǐqián kěyǐ wánchéng ma?\tCan it be finished before five?\n如果现在开始，应该可以。\tRúguǒ xiànzài kāishǐ, yīnggāi kěyǐ.\tIf we start now, it should be possible.\n明天的课几点结束？\tMíngtiān de kè jǐ diǎn jiéshù?\tWhat time does tomorrow's class end?\n课四点结束，但是图书馆六点关门。\tKè sì diǎn jiéshù, dànshì túshūguǎn liù diǎn guānmén.\tClass ends at four, but the library closes at six.\n我已经安排好时间了。\tWǒ yǐjīng ānpái hǎo shíjiān le.\tI have already arranged the time.\n你还没安排吗？\tNǐ hái méi ānpái ma?\tYou have not arranged it yet?\n没关系，我们现在安排。\tMéi guānxi, wǒmen xiànzài ānpái.\tIt is okay; we will arrange it now.\n请提前十分钟到。\tQǐng tíqián shí fēnzhōng dào.\tPlease arrive ten minutes early.\n好的，我不会迟到。\tHǎo de, wǒ bú huì chídào.\tOkay, I will not be late.`),
  makeUnit(3, "Daily Routines", "A0", ["routine", "home", "habits"], "svo", `我早上六点半起床。\tWǒ zǎoshang liù diǎn bàn qǐchuáng.\tI get up at six thirty in the morning.\n我先喝一杯水。\tWǒ xiān hē yì bēi shuǐ.\tI first drink a glass of water.\n然后我洗澡和吃早饭。\tRánhòu wǒ xǐzǎo hé chī zǎofàn.\tThen I shower and eat breakfast.\n我每天坐地铁上班。\tWǒ měitiān zuò dìtiě shàngbān.\tI take the subway to work every day.\n我八点到办公室。\tWǒ bā diǎn dào bàngōngshì.\tI arrive at the office at eight.\n我上午通常开会。\tWǒ shàngwǔ tōngcháng kāihuì.\tI usually have meetings in the morning.\n中午我和同事一起吃饭。\tZhōngwǔ wǒ hé tóngshì yìqǐ chīfàn.\tAt noon I eat with my coworkers.\n下午我处理邮件。\tXiàwǔ wǒ chǔlǐ yóujiàn.\tIn the afternoon I handle emails.\n我今天还在完成一个项目。\tWǒ jīntiān hái zài wánchéng yí ge xiàngmù.\tI am still finishing a project today.\n如果很忙，我就带饭去公司。\tRúguǒ hěn máng, wǒ jiù dài fàn qù gōngsī.\tIf I am very busy, I bring food to the company.\n我下午六点下班。\tWǒ xiàwǔ liù diǎn xiàbān.\tI finish work at six in the afternoon.\n下班以后我去超市。\tXiàbān yǐhòu wǒ qù chāoshì.\tAfter work I go to the supermarket.\n我买菜和牛奶。\tWǒ mǎi cài hé niúnǎi.\tI buy vegetables and milk.\n晚上我回家做饭。\tWǎnshang wǒ huí jiā zuòfàn.\tIn the evening I go home and cook.\n我昨天做了很多饭。\tWǒ zuótiān zuò le hěn duō fàn.\tI cooked a lot of food yesterday.\n今天我不想做饭。\tJīntiān wǒ bù xiǎng zuòfàn.\tI do not want to cook today.\n所以我在餐厅吃晚饭。\tSuǒyǐ wǒ zài cāntīng chī wǎnfàn.\tSo I eat dinner at a restaurant.\n我晚上喜欢看书。\tWǒ wǎnshang xǐhuan kàn shū.\tI like reading in the evening.\n我十一点以前睡觉。\tWǒ shíyī diǎn yǐqián shuìjiào.\tI go to bed before eleven.\n周末我会打扫房间。\tZhōumò wǒ huì dǎsǎo fángjiān.\tI clean my room on weekends.\n今天太累了，我要早点睡。\tJīntiān tài lèi le, wǒ yào zǎodiǎn shuì.\tI am too tired today, so I will sleep early.\n明天我一定会精神一点。\tMíngtiān wǒ yídìng huì jīngshen yìdiǎn.\tI will definitely feel more energetic tomorrow.`),
  makeUnit(4, "Home and Neighborhood", "A0", ["home", "neighborhood", "location"], "zai", `我的家在地铁站附近。\tWǒ de jiā zài dìtiě zhàn fùjìn.\tMy home is near the subway station.\n我的房间在二楼。\tWǒ de fángjiān zài èr lóu.\tMy room is on the second floor.\n钥匙在桌子上。\tYàoshi zài zhuōzi shàng.\tThe keys are on the table.\n你的电脑在哪里？\tNǐ de diànnǎo zài nǎlǐ?\tWhere is your computer?\n电脑在房间里面。\tDiànnǎo zài fángjiān lǐmiàn.\tThe computer is inside the room.\n楼下有一家超市。\tLóuxià yǒu yì jiā chāoshì.\tThere is a supermarket downstairs.\n我家旁边有一个公园。\tWǒ jiā pángbiān yǒu yí ge gōngyuán.\tThere is a park beside my home.\n邻居家的门开着。\tLínjū jiā de mén kāizhe.\tMy neighbor's door is open.\n请把门关上。\tQǐng bǎ mén guān shàng.\tPlease close the door.\n我已经把窗户关好了。\tWǒ yǐjīng bǎ chuānghu guān hǎo le.\tI have already closed the window properly.\n你能帮我找钥匙吗？\tNǐ néng bāng wǒ zhǎo yàoshi ma?\tCan you help me find the keys?\n我找不到钥匙了。\tWǒ zhǎo bú dào yàoshi le.\tI cannot find the keys.\n如果你看到钥匙，请告诉我。\tRúguǒ nǐ kàn dào yàoshi, qǐng gàosu wǒ.\tIf you see the keys, please tell me.\n楼道的灯坏了。\tLóudào de dēng huài le.\tThe hallway light is broken.\n我已经给物业打电话了。\tWǒ yǐjīng gěi wùyè dǎ diànhuà le.\tI have already called building management.\n维修人员明天会来。\tWéixiū rényuán míngtiān huì lái.\tThe repair person will come tomorrow.\n垃圾桶在厨房外面。\tLèsètǒng zài chúfáng wàimiàn.\tThe trash can is outside the kitchen.\n这条路晚上很安静。\tZhè tiáo lù wǎnshang hěn ānjìng.\tThis road is very quiet at night.\n你家离学校远吗？\tNǐ jiā lí xuéxiào yuǎn ma?\tIs your home far from the school?\n我家比以前近多了。\tWǒ jiā bǐ yǐqián jìn duō le.\tMy home is much closer than before.\n周末我们在附近散步。\tZhōumò wǒmen zài fùjìn sànbù.\tWe take a walk nearby on weekends.\n请小心楼梯。\tQǐng xiǎoxīn lóutī.\tPlease be careful on the stairs.`),
  makeUnit(5, "Food, Cafés, and Restaurants", "A0", ["food", "restaurant", "requests"], "measure", `我想要一杯咖啡。\tWǒ xiǎng yào yì bēi kāfēi.\tI would like a cup of coffee.\n请给我一杯热水。\tQǐng gěi wǒ yì bēi rè shuǐ.\tPlease give me a cup of hot water.\n你们有几个座位？\tNǐmen yǒu jǐ ge zuòwèi?\tHow many seats do you have?\n我们有两个人。\tWǒmen yǒu liǎng ge rén.\tThere are two of us.\n请给我们一张菜单。\tQǐng gěi wǒmen yì zhāng càidān.\tPlease give us a menu.\n这个菜辣不辣？\tZhège cài là bu là?\tIs this dish spicy?\n这个菜不太辣。\tZhège cài bú tài là.\tThis dish is not very spicy.\n我不吃花生。\tWǒ bù chī huāshēng.\tI do not eat peanuts.\n服务员，请帮我换一碗饭。\tFúwùyuán, qǐng bāng wǒ huàn yì wǎn fàn.\tServer, please help me change to a bowl of rice.\n我们已经点过菜了。\tWǒmen yǐjīng diǎn guo cài le.\tWe have already ordered the dishes.\n还要等多长时间？\tHái yào děng duō cháng shíjiān?\tHow much longer do we need to wait?\n因为厨房很忙，所以要等一会儿。\tYīnwèi chúfáng hěn máng, suǒyǐ yào děng yíhuìr.\tBecause the kitchen is busy, we need to wait a while.\n请把汤放在这边。\tQǐng bǎ tāng fàng zài zhèbiān.\tPlease put the soup here.\n这碗汤比那碗热。\tZhè wǎn tāng bǐ nà wǎn rè.\tThis bowl of soup is hotter than that one.\n我吃饱了，谢谢。\tWǒ chī bǎo le, xièxie.\tI am full, thank you.\n可以给我一份账单吗？\tKěyǐ gěi wǒ yí fèn zhàngdān ma?\tCould you give me a bill?\n我们可以刷卡吗？\tWǒmen kěyǐ shuākǎ ma?\tCan we pay by card?\n这里的价格合理吗？\tZhèlǐ de jiàgé hélǐ ma?\tAre the prices here reasonable?\n如果没有座位，我们就去别的餐厅。\tRúguǒ méiyǒu zuòwèi, wǒmen jiù qù bié de cāntīng.\tIf there are no seats, we will go to another restaurant.\n我以前来过这家店。\tWǒ yǐqián lái guo zhè jiā diàn.\tI have been to this restaurant before.\n这家店的服务比上次好。\tZhè jiā diàn de fúwù bǐ shàng cì hǎo.\tThe service here is better than last time.\n谢谢你的推荐。\tXièxie nǐ de tuījiàn.\tThank you for your recommendation.`),
  makeUnit(5, "Shopping and Payments", "A0", ["shopping", "money", "payments"], "measure", `这个多少钱？\tZhège duōshao qián?\tHow much is this?\n这件衣服多少钱？\tZhè jiàn yīfu duōshao qián?\tHow much is this piece of clothing?\n我想买两件白衬衫。\tWǒ xiǎng mǎi liǎng jiàn bái chènshān.\tI want to buy two white shirts.\n有没有小一点儿的？\tYǒu méiyǒu xiǎo yìdiǎnr de?\tDo you have a smaller one?\n这个颜色比那个好看。\tZhège yánsè bǐ nàge hǎokàn.\tThis color looks better than that one.\n请给我看另一双鞋。\tQǐng gěi wǒ kàn lìng yì shuāng xié.\tPlease show me another pair of shoes.\n我可以试穿吗？\tWǒ kěyǐ shìchuān ma?\tMay I try it on?\n这双鞋有点儿紧。\tZhè shuāng xié yǒudiǎnr jǐn.\tThis pair of shoes is a little tight.\n我需要一张购物袋。\tWǒ xūyào yì zhāng gòuwùdài.\tI need a shopping bag.\n请把发票放进袋子里。\tQǐng bǎ fāpiào fàng jìn dàizi lǐ.\tPlease put the receipt into the bag.\n我已经付钱了。\tWǒ yǐjīng fù qián le.\tI have already paid.\n你还没有给我找钱。\tNǐ hái méiyǒu gěi wǒ zhǎo qián.\tYou have not given me my change yet.\n抱歉，我马上给你。\tBàoqiàn, wǒ mǎshàng gěi nǐ.\tSorry, I will give it to you right away.\n这里接受手机支付吗？\tZhèlǐ jiēshòu shǒujī zhīfù ma?\tDoes this place accept mobile payment?\n如果没有现金，可以刷卡。\tRúguǒ méiyǒu xiànjīn, kěyǐ shuākǎ.\tIf you do not have cash, you can pay by card.\n我找不到我的钱包。\tWǒ zhǎo bú dào wǒ de qiánbāo.\tI cannot find my wallet.\n钱包可能在车上。\tQiánbāo kěnéng zài chē shàng.\tThe wallet may be in the car.\n你看过收银台了吗？\tNǐ kàn guo shōuyíntái le ma?\tHave you checked the checkout counter?\n我去过那边，但是没有看到。\tWǒ qù guo nàbiān, dànshì méiyǒu kàn dào.\tI went over there, but I did not see it.\n这家超市晚上十点关门。\tZhè jiā chāoshì wǎnshang shí diǎn guānmén.\tThis supermarket closes at ten at night.\n我们先买水，再买水果。\tWǒmen xiān mǎi shuǐ, zài mǎi shuǐguǒ.\tWe will buy water first, then fruit.\n请保留这张收据。\tQǐng bǎoliú zhè zhāng shōujù.\tPlease keep this receipt.`),
  makeUnit(7, "Directions and Transportation", "A0", ["transport", "directions", "safety"], "complement", `地铁站在哪儿？\tDìtiě zhàn zài nǎr?\tWhere is the subway station?\n地铁站在路的左边。\tDìtiě zhàn zài lù de zuǒbian.\tThe subway station is on the left side of the road.\n请一直往前走。\tQǐng yìzhí wǎng qián zǒu.\tPlease keep walking straight ahead.\n到了路口以后向右转。\tDào le lùkǒu yǐhòu xiàng yòu zhuǎn.\tTurn right after you reach the intersection.\n我应该在哪一站下车？\tWǒ yīnggāi zài nǎ yí zhàn xià chē?\tAt which stop should I get off?\n你在第三站下车。\tNǐ zài dì sān zhàn xià chē.\tGet off at the third stop.\n这辆公交车去机场吗？\tZhè liàng gōngjiāochē qù jīchǎng ma?\tDoes this bus go to the airport?\n这辆车不去机场。\tZhè liàng chē bú qù jīchǎng.\tThis bus does not go to the airport.\n如果你坐地铁，就会更快。\tRúguǒ nǐ zuò dìtiě, jiù huì gèng kuài.\tIf you take the subway, it will be faster.\n我已经买好车票了。\tWǒ yǐjīng mǎi hǎo chēpiào le.\tI have already bought the ticket.\n请把行李放上去。\tQǐng bǎ xíngli fàng shàngqù.\tPlease put the luggage up there.\n小心，不要走下楼梯。\tXiǎoxīn, bú yào zǒu xià lóutī.\tBe careful; do not walk down the stairs.\n我刚才在车站迷路了。\tWǒ gāngcái zài chēzhàn mílù le.\tI got lost at the station just now.\n你可以把地址发给我吗？\tNǐ kěyǐ bǎ dìzhǐ fā gěi wǒ ma?\tCan you send me the address?\n我找到了正确的出口。\tWǒ zhǎo dào le zhèngquè de chūkǒu.\tI found the correct exit.\n从这里走到学校要多久？\tCóng zhèlǐ zǒu dào xuéxiào yào duō jiǔ?\tHow long does it take to walk from here to school?\n走路大约需要二十分钟。\tZǒulù dàyuē xūyào èrshí fēnzhōng.\tWalking takes about twenty minutes.\n下雨了，路上很滑。\tXià yǔ le, lù shàng hěn huá.\tIt is raining, and the road is slippery.\n请在安全的地方等车。\tQǐng zài ānquán de dìfang děng chē.\tPlease wait for the vehicle in a safe place.\n司机已经停下来了。\tSījī yǐjīng tíng xiàlái le.\tThe driver has stopped.\n我坐过这条线，但是不常坐。\tWǒ zuò guo zhè tiáo xiàn, dànshì bù cháng zuò.\tI have taken this line before, but not often.\n谢谢，你的说明很清楚。\tXièxie, nǐ de shuōmíng hěn qīngchu.\tThanks, your directions are very clear.`),
  makeUnit(8, "Office People and Equipment", "A1", ["office", "coworkers", "equipment"], "de", `我在办公室的前面等你。\tWǒ zài bàngōngshì de qiánmiàn děng nǐ.\tI am waiting for you in front of the office.\n这是我的工作电脑。\tZhè shì wǒ de gōngzuò diànnǎo.\tThis is my work computer.\n那是经理的桌子。\tNà shì jīnglǐ de zhuōzi.\tThat is the manager's desk.\n你的文件在打印机旁边。\tNǐ de wénjiàn zài dǎyìnjī pángbiān.\tYour document is beside the printer.\n谁负责这个项目？\tShéi fùzé zhège xiàngmù?\tWho is responsible for this project?\n我是这个项目的负责人。\tWǒ shì zhège xiàngmù de fùzérén.\tI am the person responsible for this project.\n我们的客户下午来公司。\tWǒmen de kèhù xiàwǔ lái gōngsī.\tOur client is coming to the company this afternoon.\n请把客户的名字写下来。\tQǐng bǎ kèhù de míngzi xiě xiàlái.\tPlease write down the client's name.\n会议室在走廊的尽头。\tHuìyìshì zài zǒuláng de jìntóu.\tThe meeting room is at the end of the hallway.\n我可以坐在你的旁边吗？\tWǒ kěyǐ zuò zài nǐ de pángbiān ma?\tMay I sit beside you?\n这个打印机能用吗？\tZhège dǎyìnjī néng yòng ma?\tCan this printer be used?\n打印机的纸用完了。\tDǎyìnjī de zhǐ yòng wán le.\tThe printer has run out of paper.\n请把纸放进去。\tQǐng bǎ zhǐ fàng jìnqù.\tPlease put the paper in.\n我已经把文件打印出来了。\tWǒ yǐjīng bǎ wénjiàn dǎyìn chūlái le.\tI have already printed the document.\n这个文件是谁的？\tZhège wénjiàn shì shéi de?\tWhose document is this?\n这是新同事的文件。\tZhè shì xīn tóngshì de wénjiàn.\tThis is the new coworker's document.\n请不要打开别人的文件。\tQǐng bú yào dǎkāi biérén de wénjiàn.\tPlease do not open other people's files.\n如果电脑坏了，就告诉我。\tRúguǒ diànnǎo huài le, jiù gàosu wǒ.\tIf the computer breaks, tell me.\n我的屏幕比你的大。\tWǒ de píngmù bǐ nǐ de dà.\tMy screen is bigger than yours.\n今天的办公室比昨天安静。\tJīntiān de bàngōngshì bǐ zuótiān ānjìng.\tThe office is quieter today than yesterday.\n谢谢你的帮助。\tXièxie nǐ de bāngzhù.\tThank you for your help.\n没问题，这是我的工作。\tMéi wèntí, zhè shì wǒ de gōngzuò.\tNo problem, this is my job.`),
  makeUnit(9, "Meetings and Calendars", "A1", ["meetings", "calendar", "work"], "qing", `请把会议安排在上午。\tQǐng bǎ huìyì ānpái zài shàngwǔ.\tPlease schedule the meeting in the morning.\n你可以参加明天的会议吗？\tNǐ kěyǐ cānjiā míngtiān de huìyì ma?\tCan you attend tomorrow's meeting?\n我应该提前准备什么？\tWǒ yīnggāi tíqián zhǔnbèi shénme?\tWhat should I prepare in advance?\n请带两份报告。\tQǐng dài liǎng fèn bàogào.\tPlease bring two copies of the report.\n会议已经开始了。\tHuìyì yǐjīng kāishǐ le.\tThe meeting has already started.\n经理正在介绍新的项目。\tJīnglǐ zhèngzài jièshào xīn de xiàngmù.\tThe manager is introducing the new project.\n我还没看完这份文件。\tWǒ hái méi kàn wán zhè fèn wénjiàn.\tI have not finished reading this document yet.\n请给我五分钟。\tQǐng gěi wǒ wǔ fēnzhōng.\tPlease give me five minutes.\n我们先讨论问题，再决定时间。\tWǒmen xiān tǎolùn wèntí, zài juédìng shíjiān.\tWe will discuss the problem first, then decide the time.\n如果客户同意，我们就开始。\tRúguǒ kèhù tóngyì, wǒmen jiù kāishǐ.\tIf the client agrees, we will start.\n谁可以记录会议内容？\tShéi kěyǐ jìlù huìyì nèiróng?\tWho can take notes during the meeting?\n我可以记录，但是需要一台电脑。\tWǒ kěyǐ jìlù, dànshì xūyào yì tái diànnǎo.\tI can take notes, but I need a computer.\n请把重点写在白板上。\tQǐng bǎ zhòngdiǎn xiě zài báibǎn shàng.\tPlease write the key points on the whiteboard.\n这个问题比上一个重要。\tZhège wèntí bǐ shàng yí ge zhòngyào.\tThis problem is more important than the previous one.\n我们已经讨论过这个问题。\tWǒmen yǐjīng tǎolùn guo zhège wèntí.\tWe have already discussed this issue before.\n但是现在情况不一样了。\tDànshì xiànzài qíngkuàng bù yíyàng le.\tBut the situation is different now.\n请问，截止日期是哪一天？\tQǐngwèn, jiézhǐ rìqī shì nǎ yì tiān?\tExcuse me, which day is the deadline?\n截止日期是下周五。\tJiézhǐ rìqī shì xià zhōu wǔ.\tThe deadline is next Friday.\n我们必须按时完成。\tWǒmen bìxū ànshí wánchéng.\tWe must finish on time.\n如果需要帮助，就告诉我。\tRúguǒ xūyào bāngzhù, jiù gàosu wǒ.\tIf you need help, tell me.\n会议结束以后请发邮件。\tHuìyì jiéshù yǐhòu qǐng fā yóujiàn.\tPlease send an email after the meeting.\n好的，我一定会发。\tHǎo de, wǒ yídìng huì fā.\tOkay, I definitely will.`),
  makeUnit(10, "Phones, Messages, and Email", "A1", ["communication", "email", "phone"], "question", `你收到我的邮件了吗？\tNǐ shōudào wǒ de yóujiàn le ma?\tDid you receive my email?\n我已经收到，但是还没回复。\tWǒ yǐjīng shōudào, dànshì hái méi huífù.\tI received it, but I have not replied yet.\n请把文件发给客户。\tQǐng bǎ wénjiàn fā gěi kèhù.\tPlease send the document to the client.\n客户问我们什么时候回复。\tKèhù wèn wǒmen shénme shíhou huífù.\tThe client asked when we would reply.\n你能听见我的声音吗？\tNǐ néng tīngjiàn wǒ de shēngyīn ma?\tCan you hear my voice?\n我听不见，你再说一次。\tWǒ tīng bú jiàn, nǐ zài shuō yí cì.\tI cannot hear you; say it once more.\n网络可能不太稳定。\tWǎngluò kěnéng bú tài wěndìng.\tThe network may not be very stable.\n如果断线，我们就发消息。\tRúguǒ duànxiàn, wǒmen jiù fā xiāoxi.\tIf we get disconnected, we will send messages.\n这是客户的电话号码。\tZhè shì kèhù de diànhuà hàomǎ.\tThis is the client's phone number.\n请不要把电话号码发错。\tQǐng bú yào bǎ diànhuà hàomǎ fā cuò.\tPlease do not send the wrong phone number.\n我刚才给你打过电话。\tWǒ gāngcái gěi nǐ dǎ guo diànhuà.\tI called you just now.\n我没有听到电话。\tWǒ méiyǒu tīngdào diànhuà.\tI did not hear the phone.\n你现在方便说话吗？\tNǐ xiànzài fāngbiàn shuōhuà ma?\tIs now a convenient time for you to talk?\n我在开会，不方便。\tWǒ zài kāihuì, bù fāngbiàn.\tI am in a meeting; it is not convenient.\n请你下午再打来。\tQǐng nǐ xiàwǔ zài dǎ lái.\tPlease call again this afternoon.\n邮件的主题写清楚了吗？\tYóujiàn de zhǔtí xiě qīngchu le ma?\tDid you write the email subject clearly?\n我已经把主题写好了。\tWǒ yǐjīng bǎ zhǔtí xiě hǎo le.\tI have already written the subject properly.\n这个附件打不开。\tZhège fùjiàn dǎ bù kāi.\tThis attachment cannot be opened.\n我能把文件重新发一次。\tWǒ néng bǎ wénjiàn chóngxīn fā yí cì.\tI can send the document again.\n如果你看不懂，请问我。\tRúguǒ nǐ kàn bù dǒng, qǐng wèn wǒ.\tIf you do not understand it, please ask me.\n谢谢，你的说明很有用。\tXièxie, nǐ de shuōmíng hěn yǒuyòng.\tThanks, your explanation is very useful.\n我会在今天下班以前回复。\tWǒ huì zài jīntiān xiàbān yǐqián huífù.\tI will reply before I finish work today.`),
  makeUnit(11, "Tasks, Deadlines, and Work Status", "A1", ["tasks", "deadlines", "status"], "le", `这个任务我已经做完了。\tZhège rènwu wǒ yǐjīng zuò wán le.\tI have finished this task.\n报告还没写完。\tBàogào hái méi xiě wán.\tThe report is not finished yet.\n你做到哪一步了？\tNǐ zuò dào nǎ yí bù le?\tWhat step have you reached?\n我已经完成了一半。\tWǒ yǐjīng wánchéng le yíbàn.\tI have completed half of it.\n截止日期快到了。\tJiézhǐ rìqī kuài dào le.\tThe deadline is coming soon.\n我们必须今天交报告。\tWǒmen bìxū jīntiān jiāo bàogào.\tWe must submit the report today.\n如果来不及，就马上告诉经理。\tRúguǒ láibují, jiù mǎshàng gàosu jīnglǐ.\tIf there is not enough time, tell the manager immediately.\n我可能需要多一天。\tWǒ kěnéng xūyào duō yì tiān.\tI may need one more day.\n抱歉，我昨天没有看清要求。\tBàoqiàn, wǒ zuótiān méiyǒu kàn qīng yāoqiú.\tSorry, I did not read the requirements clearly yesterday.\n现在我已经找到问题了。\tXiànzài wǒ yǐjīng zhǎodào wèntí le.\tI have found the problem now.\n问题在文件的最后一页。\tWèntí zài wénjiàn de zuìhòu yí yè.\tThe problem is on the last page of the document.\n请把错误改过来。\tQǐng bǎ cuòwù gǎi guòlái.\tPlease correct the error.\n我已经改好了。\tWǒ yǐjīng gǎi hǎo le.\tI have fixed it.\n你能检查一下吗？\tNǐ néng jiǎnchá yíxià ma?\tCan you check it?\n我检查过了，没有问题。\tWǒ jiǎnchá guo le, méiyǒu wèntí.\tI have checked it; there is no problem.\n这个项目比上个项目复杂。\tZhège xiàngmù bǐ shàng ge xiàngmù fùzá.\tThis project is more complicated than the last one.\n但是我们应该能完成。\tDànshì wǒmen yīnggāi néng wánchéng.\tBut we should be able to finish.\n请先处理客户的要求。\tQǐng xiān chǔlǐ kèhù de yāoqiú.\tPlease handle the client's request first.\n然后再整理内部文件。\tRánhòu zài zhěnglǐ nèibù wénjiàn.\tThen organize the internal documents.\n我今天还要参加一个会议。\tWǒ jīntiān hái yào cānjiā yí ge huìyì.\tI also have to attend a meeting today.\n会议结束以后我继续做。\tHuìyì jiéshù yǐhòu wǒ jìxù zuò.\tI will continue working after the meeting.\n谢谢你的提醒，我一定记住。\tXièxie nǐ de tíxǐng, wǒ yídìng jìzhù.\tThanks for reminding me; I will definitely remember.`),
  makeUnit(12, "Workplace Problems and Misunderstandings", "A1", ["problems", "equipment", "repair"], "result", `我的电脑突然关机了。\tWǒ de diànnǎo tūrán guānjī le.\tMy computer suddenly shut down.\n我打不开这个文件。\tWǒ dǎ bù kāi zhège wénjiàn.\tI cannot open this file.\n文件可能被删除了。\tWénjiàn kěnéng bèi shānchú le.\tThe file may have been deleted.\n请问，谁可以帮我？\tQǐngwèn, shéi kěyǐ bāng wǒ?\tExcuse me, who can help me?\n你先把电脑重新打开。\tNǐ xiān bǎ diànnǎo chóngxīn dǎkāi.\tFirst restart the computer.\n如果还是不行，就联系技术人员。\tRúguǒ háishi bù xíng, jiù liánxì jìshù rényuán.\tIf it still does not work, contact technical support.\n打印机被卡住了。\tDǎyìnjī bèi kǎ zhù le.\tThe printer is jammed.\n我已经把纸拿出来了。\tWǒ yǐjīng bǎ zhǐ ná chūlái le.\tI have taken the paper out.\n但是机器还不能工作。\tDànshì jīqì hái bù néng gōngzuò.\tBut the machine still cannot work.\n经理正在找维修人员。\tJīnglǐ zhèngzài zhǎo wéixiū rényuán.\tThe manager is looking for a repair person.\n我可能听错了你的要求。\tWǒ kěnéng tīng cuò le nǐ de yāoqiú.\tI may have misunderstood your request.\n抱歉，请你再解释一次。\tBàoqiàn, qǐng nǐ zài jiěshì yí cì.\tSorry, please explain it once more.\n你说的是今天还是明天？\tNǐ shuō de shì jīntiān háishi míngtiān?\tDo you mean today or tomorrow?\n我说的是明天上午。\tWǒ shuō de shì míngtiān shàngwǔ.\tI mean tomorrow morning.\n如果我理解错了，请纠正我。\tRúguǒ wǒ lǐjiě cuò le, qǐng jiūzhèng wǒ.\tIf I understood incorrectly, please correct me.\n现在我们已经说清楚了。\tXiànzài wǒmen yǐjīng shuō qīngchu le.\tNow we have made it clear.\n这个办法比原来的简单。\tZhège bànfǎ bǐ yuánlái de jiǎndān.\tThis method is simpler than the original one.\n你可以把步骤写下来。\tNǐ kěyǐ bǎ bùzhòu xiě xiàlái.\tYou can write down the steps.\n请不要删除原来的文件。\tQǐng bú yào shānchú yuánlái de wénjiàn.\tPlease do not delete the original file.\n我已经把备份找到。\tWǒ yǐjīng bǎ bèifèn zhǎodào.\tI have found the backup.\n问题解决了，谢谢大家。\tWèntí jiějué le, xièxie dàjiā.\tThe problem is solved; thank you, everyone.\n下次我们应该先确认。\tXià cì wǒmen yīnggāi xiān quèrèn.\tNext time we should confirm first.`),
  makeUnit(13, "Classroom Language and School Routines", "A1", ["classroom", "school", "study"], "ma", `老师，我们可以进教室吗？\tLǎoshī, wǒmen kěyǐ jìn jiàoshì ma?\tTeacher, may we enter the classroom?\n请把书打开到第十页。\tQǐng bǎ shū dǎkāi dào dì shí yè.\tPlease open the book to page ten.\n今天我们学习新的语法。\tJīntiān wǒmen xuéxí xīn de yǔfǎ.\tToday we are studying new grammar.\n这个句子是什么意思？\tZhège jùzi shì shénme yìsi?\tWhat does this sentence mean?\n请问，这个问题怎么回答？\tQǐngwèn, zhège wèntí zěnme huídá?\tExcuse me, how do we answer this question?\n答案在黑板上。\tDá'àn zài hēibǎn shàng.\tThe answer is on the board.\n你听懂老师的说明了吗？\tNǐ tīng dǒng lǎoshī de shuōmíng le ma?\tDid you understand the teacher's explanation?\n我听懂了一部分。\tWǒ tīng dǒng le yí bùfen.\tI understood part of it.\n你能再举一个例子吗？\tNǐ néng zài jǔ yí ge lìzi ma?\tCan you give another example?\n当然可以，我写在这里。\tDāngrán kěyǐ, wǒ xiě zài zhèlǐ.\tOf course, I will write it here.\n我们今天有两节课。\tWǒmen jīntiān yǒu liǎng jié kè.\tWe have two classes today.\n第一节课九点开始。\tDì yī jié kè jiǔ diǎn kāishǐ.\tThe first class starts at nine.\n下课以后我去图书馆。\tXiàkè yǐhòu wǒ qù túshūguǎn.\tAfter class I will go to the library.\n我已经借了三本书。\tWǒ yǐjīng jiè le sān běn shū.\tI have borrowed three books.\n这些书是学校的。\tZhèxiē shū shì xuéxiào de.\tThese books belong to the school.\n请不要在书上写字。\tQǐng bú yào zài shū shàng xiězì.\tPlease do not write in the books.\n如果你有问题，就问老师。\tRúguǒ nǐ yǒu wèntí, jiù wèn lǎoshī.\tIf you have a question, ask the teacher.\n我应该每天练习吗？\tWǒ yīnggāi měitiān liànxí ma?\tShould I practice every day?\n每天练习十分钟就很好。\tMěitiān liànxí shí fēnzhōng jiù hěn hǎo.\tTen minutes of practice every day is good.\n我的发音比以前清楚了。\tWǒ de fāyīn bǐ yǐqián qīngchu le.\tMy pronunciation is clearer than before.\n谢谢老师的帮助。\tXièxie lǎoshī de bāngzhù.\tThank you for the teacher's help.\n明天见，老师。\tMíngtiān jiàn, lǎoshī.\tSee you tomorrow, teacher.`),
  makeUnit(14, "Assignments, Exams, and Study Plans", "A1", ["assignments", "exams", "study"], "guo", `你做完作业了吗？\tNǐ zuò wán zuòyè le ma?\tHave you finished the homework?\n我还没做完。\tWǒ hái méi zuò wán.\tI have not finished it yet.\n作业什么时候交？\tZuòyè shénme shíhou jiāo?\tWhen is the homework due?\n老师说明天早上交。\tLǎoshī shuō míngtiān zǎoshang jiāo.\tThe teacher said to hand it in tomorrow morning.\n我已经写了两页。\tWǒ yǐjīng xiě le liǎng yè.\tI have written two pages.\n但是我的结论还不清楚。\tDànshì wǒ de jiélùn hái bù qīngchu.\tBut my conclusion is still unclear.\n你以前做过这种练习吗？\tNǐ yǐqián zuò guo zhè zhǒng liànxí ma?\tHave you done this kind of exercise before?\n我做过，但是这次更难。\tWǒ zuò guo, dànshì zhè cì gèng nán.\tI have, but this time is harder.\n如果你不懂，就和同学讨论。\tRúguǒ nǐ bù dǒng, jiù hé tóngxué tǎolùn.\tIf you do not understand, discuss it with a classmate.\n我们应该先看例子。\tWǒmen yīnggāi xiān kàn lìzi.\tWe should look at the example first.\n考试比作业重要吗？\tKǎoshì bǐ zuòyè zhòngyào ma?\tIs the exam more important than the homework?\n考试和作业都很重要。\tKǎoshì hé zuòyè dōu hěn zhòngyào.\tBoth exams and homework are important.\n请把答案写在答题纸上。\tQǐng bǎ dá'àn xiě zài dátízhǐ shàng.\tPlease write the answers on the answer sheet.\n我看不清最后一道题。\tWǒ kàn bù qīng zuìhòu yí dào tí.\tI cannot see the last question clearly.\n可以给我一张新的答题纸吗？\tKěyǐ gěi wǒ yì zhāng xīn de dátízhǐ ma?\tCould you give me a new answer sheet?\n我以前参加过中文考试。\tWǒ yǐqián cānjiā guo Zhōngwén kǎoshì.\tI have taken a Chinese exam before.\n这次我的成绩比上次好。\tZhè cì wǒ de chéngjī bǐ shàng cì hǎo.\tMy score is better this time than last time.\n我每天晚上复习一个小时。\tWǒ měitiān wǎnshang fùxí yí ge xiǎoshí.\tI review for an hour every evening.\n周末我会和同学一起学习。\tZhōumò wǒ huì hé tóngxué yìqǐ xuéxí.\tI will study with classmates on the weekend.\n谢谢你帮我解释。\tXièxie nǐ bāng wǒ jiěshì.\tThanks for helping me explain it.\n我一定会按时交作业。\tWǒ yídìng huì ànshí jiāo zuòyè.\tI will definitely submit the homework on time.\n考试以后我们一起吃饭吧。\tKǎoshì yǐhòu wǒmen yìqǐ chīfàn ba.\tLet us eat together after the exam.`),
  makeUnit(15, "Campus Life and Group Projects", "A1", ["campus", "projects", "groups"], "bi", `我们的教室比图书馆近。\tWǒmen de jiàoshì bǐ túshūguǎn jìn.\tOur classroom is closer than the library.\n校园里有三个食堂。\tXiàoyuán lǐ yǒu sān ge shítáng.\tThere are three dining halls on campus.\n你在哪个小组？\tNǐ zài nǎge xiǎozǔ?\tWhich group are you in?\n我是第二小组的成员。\tWǒ shì dì èr xiǎozǔ de chéngyuán.\tI am a member of group two.\n我们正在做一个项目。\tWǒmen zhèngzài zuò yí ge xiàngmù.\tWe are working on a project.\n这个项目比上个项目有趣。\tZhège xiàngmù bǐ shàng ge xiàngmù yǒuqù.\tThis project is more interesting than the last one.\n请把你的想法写下来。\tQǐng bǎ nǐ de xiǎngfǎ xiě xiàlái.\tPlease write down your idea.\n我的想法和你的不一样。\tWǒ de xiǎngfǎ hé nǐ de bù yíyàng.\tMy idea is different from yours.\n如果大家同意，我们就这样做。\tRúguǒ dàjiā tóngyì, wǒmen jiù zhèyàng zuò.\tIf everyone agrees, we will do it this way.\n你能负责第一部分吗？\tNǐ néng fùzé dì yī bùfen ma?\tCan you be responsible for the first part?\n我可以，但是我需要你的资料。\tWǒ kěyǐ, dànshì wǒ xūyào nǐ de zīliào.\tI can, but I need your materials.\n资料已经发到群里了。\tZīliào yǐjīng fā dào qún lǐ le.\tThe materials have already been sent to the group chat.\n我还没看完全部资料。\tWǒ hái méi kàn wán quánbù zīliào.\tI have not finished reading all the materials.\n我们先分任务，再开始工作。\tWǒmen xiān fēn rènwu, zài kāishǐ gōngzuò.\tWe will divide the tasks first, then start working.\n谁可以做最后的报告？\tShéi kěyǐ zuò zuìhòu de bàogào?\tWho can give the final presentation?\n我做过这样的报告。\tWǒ zuò guo zhèyàng de bàogào.\tI have given this kind of presentation before.\n但是我这次想和你一起做。\tDànshì wǒ zhè cì xiǎng hé nǐ yìqǐ zuò.\tBut this time I want to do it with you.\n老师说我们的计划很清楚。\tLǎoshī shuō wǒmen de jìhuà hěn qīngchu.\tThe teacher said our plan is clear.\n这个问题比我们想的复杂。\tZhège wèntí bǐ wǒmen xiǎng de fùzá.\tThis problem is more complicated than we thought.\n我们应该重新安排时间。\tWǒmen yīnggāi chóngxīn ānpái shíjiān.\tWe should rearrange the schedule.\n项目已经完成了。\tXiàngmù yǐjīng wánchéng le.\tThe project has been completed.\n大家做得很好。\tDàjiā zuò de hěn hǎo.\tEveryone did a very good job.`),
  makeUnit(16, "Illness, Injuries, and Appointments", "A1", ["health", "doctor", "appointments"], "yinwei", `我今天身体不舒服。\tWǒ jīntiān shēntǐ bù shūfu.\tI do not feel well today.\n因为我发烧了，所以不能上班。\tYīnwèi wǒ fāshāo le, suǒyǐ bù néng shàngbān.\tBecause I have a fever, I cannot go to work.\n我的头很疼。\tWǒ de tóu hěn téng.\tMy head hurts a lot.\n你的手怎么了？\tNǐ de shǒu zěnme le?\tWhat happened to your hand?\n我昨天不小心撞到了桌子。\tWǒ zuótiān bù xiǎoxīn zhuàng dào le zhuōzi.\tI accidentally hit the table yesterday.\n现在手还疼吗？\tXiànzài shǒu hái téng ma?\tDoes your hand still hurt now?\n比昨天好多了。\tBǐ zuótiān hǎo duō le.\tIt is much better than yesterday.\n我应该去医院吗？\tWǒ yīnggāi qù yīyuàn ma?\tShould I go to the hospital?\n如果疼得厉害，就去医院。\tRúguǒ téng de lìhai, jiù qù yīyuàn.\tIf it hurts badly, go to the hospital.\n请告诉医生你什么时候受伤的。\tQǐng gàosu yīshēng nǐ shénme shíhou shòushāng de.\tPlease tell the doctor when you were injured.\n我以前没有受过这样的伤。\tWǒ yǐqián méiyǒu shòu guo zhèyàng de shāng.\tI have never had this kind of injury before.\n医生说需要休息几天。\tYīshēng shuō xūyào xiūxi jǐ tiān.\tThe doctor said I need to rest for a few days.\n我已经预约了下午的医生。\tWǒ yǐjīng yùyuē le xiàwǔ de yīshēng.\tI have already made an appointment with the doctor this afternoon.\n请把身份证带上。\tQǐng bǎ shēnfènzhèng dài shàng.\tPlease bring your ID.\n医院离公司比学校远。\tYīyuàn lí gōngsī bǐ xuéxiào yuǎn.\tThe hospital is farther from the company than the school.\n我可以请一天假吗？\tWǒ kěyǐ qǐng yì tiān jià ma?\tMay I take one day off?\n当然可以，你应该休息。\tDāngrán kěyǐ, nǐ yīnggāi xiūxi.\tOf course; you should rest.\n我会把医生的说明发给经理。\tWǒ huì bǎ yīshēng de shuōmíng fā gěi jīnglǐ.\tI will send the doctor's note to the manager.\n别担心，我一定会好起来。\tBié dānxīn, wǒ yídìng huì hǎo qǐlái.\tDo not worry; I will definitely get better.\n你吃过这种药吗？\tNǐ chī guo zhè zhǒng yào ma?\tHave you taken this kind of medicine before?\n我吃过，但是要先问医生。\tWǒ chī guo, dànshì yào xiān wèn yīshēng.\tI have, but we should ask the doctor first.\n谢谢你陪我去医院。\tXièxie nǐ péi wǒ qù yīyuàn.\tThank you for going to the hospital with me.`),
  makeUnit(17, "Minor Accidents and Asking for Help", "A1", ["accidents", "help", "safety"], "ruguo", `你还好吗？刚才发生什么事？\tNǐ hái hǎo ma? Gāngcái fāshēng shénme shì?\tAre you okay? What happened just now?\n我在楼梯上滑倒了。\tWǒ zài lóutī shàng huádǎo le.\tI slipped on the stairs.\n你的腿疼不疼？\tNǐ de tuǐ téng bu téng?\tDoes your leg hurt?\n腿有一点儿疼，但是可以走。\tTuǐ yǒu yìdiǎnr téng, dànshì kěyǐ zǒu.\tMy leg hurts a little, but I can walk.\n请坐下来，不要马上站起来。\tQǐng zuò xiàlái, bú yào mǎshàng zhàn qǐlái.\tPlease sit down; do not stand up immediately.\n如果你不能走，我就叫救护车。\tRúguǒ nǐ bù néng zǒu, wǒ jiù jiào jiùhùchē.\tIf you cannot walk, I will call an ambulance.\n我已经把地上的水擦干了。\tWǒ yǐjīng bǎ dì shàng de shuǐ cā gān le.\tI have dried the water on the floor.\n地板刚才很滑。\tDìbǎn gāngcái hěn huá.\tThe floor was very slippery just now.\n请把这个地方围起来。\tQǐng bǎ zhège dìfang wéi qǐlái.\tPlease block off this area.\n你有没有受伤？\tNǐ yǒu méiyǒu shòushāng?\tAre you injured?\n我没有受伤，但是我的包破了。\tWǒ méiyǒu shòushāng, dànshì wǒ de bāo pò le.\tI am not injured, but my bag is torn.\n包可能被门夹坏了。\tBāo kěnéng bèi mén jiā huài le.\tThe bag may have been damaged by the door.\n你需要我帮你找工作人员吗？\tNǐ xūyào wǒ bāng nǐ zhǎo gōngzuò rényuán ma?\tDo you need me to find a staff member?\n需要，请帮我打电话。\tXūyào, qǐng bāng wǒ dǎ diànhuà.\tYes, please help me make a call.\n请告诉工作人员事故在哪里。\tQǐng gàosu gōngzuò rényuán shìgù zài nǎlǐ.\tPlease tell the staff where the accident is.\n事故在二楼的楼梯旁边。\tShìgù zài èr lóu de lóutī pángbiān.\tThe accident is beside the stairs on the second floor.\n如果需要，我可以作证。\tRúguǒ xūyào, wǒ kěyǐ zuòzhèng.\tIf necessary, I can be a witness.\n我已经把时间和地址记下来了。\tWǒ yǐjīng bǎ shíjiān hé dìzhǐ jì xiàlái le.\tI have written down the time and address.\n请不要移动受伤的人。\tQǐng bú yào yídòng shòushāng de rén.\tPlease do not move the injured person.\n医生马上就到了。\tYīshēng mǎshàng jiù dào le.\tThe doctor will arrive soon.\n谢谢你及时帮助我。\tXièxie nǐ jíshí bāngzhù wǒ.\tThank you for helping me promptly.`),
  makeUnit(18, "Serious Accidents and Emergency Services", "A2", ["emergency", "hospital", "police"], "bei", `这里发生了一起交通事故。\tZhèlǐ fāshēng le yì qǐ jiāotōng shìgù.\tA traffic accident happened here.\n有人受伤了，请马上打电话。\tYǒu rén shòushāng le, qǐng mǎshàng dǎ diànhuà.\tSomeone is injured; please call immediately.\n请问，救护车什么时候到？\tQǐngwèn, jiùhùchē shénme shíhou dào?\tExcuse me, when will the ambulance arrive?\n救护车已经在路上了。\tJiùhùchē yǐjīng zài lù shàng le.\tThe ambulance is already on the way.\n请告诉我你的地址。\tQǐng gàosu wǒ nǐ de dìzhǐ.\tPlease tell me your address.\n地址是学校后面的那条路。\tDìzhǐ shì xuéxiào hòumiàn de nà tiáo lù.\tThe address is the road behind the school.\n伤者还能说话吗？\tShāngzhě hái néng shuōhuà ma?\tCan the injured person still speak?\n他还能说话，但是腿很疼。\tTā hái néng shuōhuà, dànshì tuǐ hěn téng.\tHe can still speak, but his leg hurts badly.\n请不要让他站起来。\tQǐng bú yào ràng tā zhàn qǐlái.\tPlease do not let him stand up.\n如果他失去意识，就告诉医生。\tRúguǒ tā shīqù yìshí, jiù gàosu yīshēng.\tIf he loses consciousness, tell the doctor.\n我已经把现场拍下来了。\tWǒ yǐjīng bǎ xiànchǎng pāi xiàlái le.\tI have photographed the scene.\n但是请不要靠近危险的地方。\tDànshì qǐng bú yào kàojìn wéixiǎn de dìfang.\tBut please do not go near the dangerous area.\n警察已经到了现场。\tJǐngchá yǐjīng dào le xiànchǎng.\tThe police have arrived at the scene.\n警察正在询问目击者。\tJǐngchá zhèngzài xúnwèn mùjīzhě.\tThe police are questioning witnesses.\n我看见车从右边开过来。\tWǒ kànjiàn chē cóng yòubian kāi guòlái.\tI saw a car come from the right.\n我不知道司机的名字。\tWǒ bù zhīdào sījī de míngzi.\tI do not know the driver's name.\n我以前没有遇到过这种事故。\tWǒ yǐqián méiyǒu yù dào guo zhè zhǒng shìgù.\tI have never encountered this kind of accident before.\n请把你的证件给警察看。\tQǐng bǎ nǐ de zhèngjiàn gěi jǐngchá kàn.\tPlease show your identification to the police.\n医院比这里远，但是路很快。\tYīyuàn bǐ zhèlǐ yuǎn, dànshì lù hěn kuài.\tThe hospital is farther from here, but the route is fast.\n我们必须保持冷静。\tWǒmen bìxū bǎochí lěngjìng.\tWe must remain calm.\n请大家站到安全的地方。\tQǐng dàjiā zhàn dào ānquán de dìfang.\tEveryone, please move to a safe place.\n谢谢你的合作，医生马上处理。\tXièxie nǐ de hézuò, yīshēng mǎshàng chǔlǐ.\tThank you for your cooperation; the doctor will handle it immediately.`),
  makeUnit(19, "Incident Reports, Solutions, and Review", "A2", ["reports", "solutions", "review"], "baoyuan", `请先说明事故发生的时间。\tQǐng xiān shuōmíng shìgù fāshēng de shíjiān.\tPlease first state when the accident happened.\n事故发生在下午三点左右。\tShìgù fāshēng zài xiàwǔ sān diǎn zuǒyòu.\tThe accident happened around three in the afternoon.\n然后请说明你在哪里。\tRánhòu qǐng shuōmíng nǐ zài nǎlǐ.\tThen please state where you were.\n我当时在学校门口等车。\tWǒ dāngshí zài xuéxiào ménkǒu děng chē.\tAt that time I was waiting for a vehicle at the school entrance.\n我看见一个人从路上跑过来。\tWǒ kànjiàn yí ge rén cóng lù shàng pǎo guòlái.\tI saw someone run across the road.\n因为路很滑，所以他摔倒了。\tYīnwèi lù hěn huá, suǒyǐ tā shuāidǎo le.\tBecause the road was slippery, he fell.\n我马上叫了救护车。\tWǒ mǎshàng jiào le jiùhùchē.\tI called an ambulance immediately.\n救护车来了以后，我们把他送进医院。\tJiùhùchē lái le yǐhòu, wǒmen bǎ tā sòng jìn yīyuàn.\tAfter the ambulance came, we took him into the hospital.\n医生说他的伤不太严重。\tYīshēng shuō tā de shāng bú tài yánzhòng.\tThe doctor said his injury was not too serious.\n但是他应该休息几天。\tDànshì tā yīnggāi xiūxi jǐ tiān.\tBut he should rest for a few days.\n抱歉，我没有马上看到地上的水。\tBàoqiàn, wǒ méiyǒu mǎshàng kàn dào dì shàng de shuǐ.\tSorry, I did not see the water on the floor immediately.\n没关系，重要的是现在安全了。\tMéi guānxi, zhòngyào de shì xiànzài ānquán le.\tIt is okay; what matters is that it is safe now.\n我们必须把现场清理干净。\tWǒmen bìxū bǎ xiànchǎng qīnglǐ gānjìng.\tWe must clean the scene completely.\n如果以后再下雨，就应该放警告牌。\tRúguǒ yǐhòu zài xià yǔ, jiù yīnggāi fàng jǐnggàopái.\tIf it rains again later, we should put up a warning sign.\n我会把报告发给经理。\tWǒ huì bǎ bàogào fā gěi jīnglǐ.\tI will send the report to the manager.\n经理说我们处理得很好。\tJīnglǐ shuō wǒmen chǔlǐ de hěn hǎo.\tThe manager said we handled it well.\n这次处理比上次快多了。\tZhè cì chǔlǐ bǐ shàng cì kuài duō le.\tThis response was much faster than last time.\n你以前写过事故报告吗？\tNǐ yǐqián xiě guo shìgù bàogào ma?\tHave you written an incident report before?\n我写过，但是这次情况更复杂。\tWǒ xiě guo, dànshì zhè cì qíngkuàng gèng fùzá.\tI have, but this situation is more complicated.\n请把所有重要信息写清楚。\tQǐng bǎ suǒyǒu zhòngyào xìnxī xiě qīngchu.\tPlease write all important information clearly.\n谢谢大家的帮助，我们解决问题了。\tXièxie dàjiā de bāngzhù, wǒmen jiějué wèntí le.\tThanks everyone for the help; we solved the problem.\n以后遇到危险时一定要先保护自己。\tYǐhòu yù dào wéixiǎn shí yídìng yào xiān bǎohù zìjǐ.\tIn the future, when facing danger, always protect yourself first.`)
];

if (units.length !== 20) throw new Error(`Generated ${units.length} units, expected 20.`);
const sentenceCount = units.reduce((total, unit) => total + unit.sentences.length, 0);
if (sentenceCount !== 440) throw new Error(`Generated ${sentenceCount} sentences, expected 440.`);

const grammarGuide = {
  schemaVersion: 1,
  rules: Object.entries(ruleCatalog).map(([id, rule]) => ({
    id,
    title: rule.title,
    overview: rule.overview,
    situations: rule.situations.map(([title, explanation, unitIndexes]) => ({ title, explanation, unitIndexes })),
    contrasts: rule.contrasts,
    commonMistakes: rule.commonMistakes
  }))
};

const pack = {
  type: "fydor_pack",
  schemaVersion: 1,
  id: "humongous-mandarin-daily-life-v1",
  title: "Humongous Mandarin: Daily Life, Work & School",
  description: "A 440-sentence Mandarin course for English speakers, centered on everyday life, workplace and school scenarios, accidents, emergencies, and clear grammar progression.",
  author: { name: "Fydor Community" },
  version: "2.0.0",
  license: "CC BY 4.0",
  language: "zh",
  baseLanguage: "en",
  level: "A0-A2",
  tags: ["mandarin", "chinese", "english", "daily-life", "work", "school", "accidents", "emergency", "grammar", "pinyin"],
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-18T00:00:00.000Z",
  unitManifest: {
    schemaVersion: 1,
    units: units.map((unit, position) => ({ id: `unit-${String(position + 1).padStart(2, "0")}`, title: unit.title, position, lessonIndexes: [position] }))
  },
  grammarGuide,
  lessons: units
};

const output = path.resolve("packs/humongous-mandarin-v1.fydorpack");
fs.writeFileSync(output, `${JSON.stringify(pack, null, 2)}\n`);
console.log(`Wrote ${output}: ${units.length} units, ${sentenceCount} sentences, ${grammarGuide.rules.length} grammar rules.`);

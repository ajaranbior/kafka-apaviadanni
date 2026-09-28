// Automatic conversion from the official orthography (наркамаўка) to
// тарашкевіца and to łacinka. Runs in the browser on the reader's own copy.
//
// Łacinka is built from the тарашкевіца version, so it keeps its softness, its loanword
// forms and the preposition зь: снег → сьнег → śnieh, з ім → зь ім → ź im, клас → кляс → klas.
//
// Тарашкевіца here covers the systematic differences:
//   * assimilative softness written with ь: снег → сьнег, шчасце → шчасьце,
//     дзве → дзьве, насенне → насеньне, вяселле → вясельле, жыццё → жыцьцё
//   * the preposition з → зь before a soft sound: з ім → зь ім
//   * не → ня, без → бяз before a word stressed on its first syllable: ня ведаю, не было.
//     Stress can't be guessed from spelling, so the book brings its own word list
//     (book.json "firstStressed") through setFirstStressed().
//   * loanwords, from a reviewed list: газета → газэта, клас → кляс, камендант → камэндант,
//     калонія → калёнія, сітуацыя → сытуацыя, тэатр → тэатар
// Other lexical and case-ending differences are not attempted.
(() => {
  "use strict";

  const SOFT = "еёюяіь";
  const isSoft = (ch) => !!ch && SOFT.includes(ch);  // "".includes() would be true
  const isApos = (ch) => !!ch && "'’ʼ".includes(ch);
  const LETTER = /[А-Яа-яЁёІіЎўҐґ'’ʼ]/;
  const WORD = /[А-Яа-яЁёІіЎўҐґ]+(?:['’ʼ][А-Яа-яЁёІіЎўҐґ]+)*/g;

  // ---------- тарашкевіца ----------

  // консанант, які перад мяккім зычным атрымлівае ь, і зычныя, што яго змякчаюць
  const ASSIMILATES = {
    "з": ["б", "в", "дз", "з", "л", "м", "н", "п", "с", "ф", "ц"],
    "с": ["б", "в", "дз", "з", "л", "м", "н", "п", "с", "ф", "ц"],
    "ц": ["б", "в", "дз", "з", "л", "м", "н", "п", "с", "ф", "ц"],
    "н": ["н"],
    "л": ["л"],
  };

  function softenWord(word) {
    const low = word.toLowerCase();
    const caps = word.length > 1 && word === word.toUpperCase();
    let out = "";
    for (let i = 0; i < word.length; i++) {
      out += word[i];
      const next = ASSIMILATES[low[i]];
      if (!next || low[i + 1] === "ь") continue;
      if (low.startsWith("канцл", i - 3)) continue;  // канцлер, канцлягер: loans keep a hard ц
      for (const c2 of next) {
        if (low.startsWith(c2, i + 1) && isSoft(low[i + 1 + c2.length])) {
          out += caps ? "Ь" : "ь";
          break;
        }
      }
    }
    return out;
  }

  const startsSoft = (word) => {
    const low = word.toLowerCase();
    if ("іеёюя".includes(low[0])) return true;
    return ASSIMILATES["з"].some((c2) => low.startsWith(c2) && isSoft(low[c2.length]));
  };

  // loanwords: stem → classical stem, only for the listed endings (so "класці" stays)
  const NOUN = "(|а|у|е|ы|аў|ам|амі|ах|ам|ай|аю|ою)";
  const FEM = "(а|ы|е|у|ай|аю|аў|ам|амі|ах)";
  const LOANS = [
    ["газет", FEM, "газэт"],
    ["кабінет", NOUN, "кабінэт"],
    ["кабінец", "(е)", "кабінэц"],
    ["секунд", FEM, "сэкунд"],
    ["камер", FEM, "камэр"],
    ["метад", NOUN, "мэтад"],
    ["метамарфоз", FEM, "мэтамарфоз"],
    ["метафар", FEM, "мэтафар"],
    ["метр", "(а|у|е|ы|аў|ам|амі|ах)", "мэтр"],
    ["метр", "()", "мэтар"],
    ["планет", FEM, "плянэт"],
    ["клас", NOUN, "кляс"],
    ["план", NOUN, "плян"],
    ["ламп", FEM, "лямп"],
    ["навел", "(|а|ы|е|у|ай|аю|аў|ам|амі|ах)", "навэл"],
    ["сістэм", FEM, "сыстэм"],
    ["філасоф", NOUN, "філёзаф"],
    ["філасофі", "(я|і|ю|яй|яў)", "філязофі"],
    ["еўроп", FEM, "эўроп"],
    // words of the reader's own interface
    ["браўзер", NOUN, "браўзэр"],
    ["версі", "(я|і|ю|яй|яў|ям|ямі|ях)", "вэрсі"],
    ["канверсі", "(я|і|ю|яй|яў|ям|ямі|ях)", "канвэрсі"],
    ["рэпазіторы", "(й|я|ю|і|ем|яў|ям|ямі|ях)", "рэпазыторы"],
  ].map(([stem, endings, to]) => [new RegExp(`^${stem}${endings}$`, "i"), stem, to]);

  // loanword stems replaced wherever they occur in a word, so prefixed and derived forms
  // follow (нелагічна → нелягічна, самарэклама → самарэкляма). Each stem is long enough not
  // to occur inside native words; check the whole book after adding one. Found by checking the book against the тарашкевіца hunspell dictionary
  // (github.com/375gnu/spell-be-tarask) and reviewed by hand.
  const STEMS = Object.entries({
    // е → э
    "абанент": "абанэнт", "акампанемент": "акампанэмэнт", "амерык": "амэрык", "апеляв": "апэляв",
    "аперац": "апэрац", "апетыт": "апэтыт", "аргумент": "аргумэнт", "берлін": "бэрлін",
    "борхес": "борхэс", "буфер": "буфэр", "буфет": "буфэт", "велатрэк": "вэлятрэк",
    "венецы": "вэнэцы", "вентылят": "вэнтылят", "вертыкал": "вэртыкал", "газецін": "газэцін",
    "гіпер": "гіпэр", "дэфект": "дэфэкт", "еўрап": "эўрап", "бетон": "бэтон", "кайзер": "кайзэр",
    "камеды": "камэды", "камендант": "камэндант", "камендатур": "камэндатур",
    "камерсант": "камэрсант", "камерцы": "камэрцы", "кампенс": "кампэнс",
    "кампетэнт": "кампэтэнт", "камплімент": "камплімэнт", "кансерватор": "кансэрватор",
    "ліберал": "лібэрал", "манеж": "манэж", "манет": "манэт", "мегафон": "мэгафон",
    "меланх": "мэлянх", "мелод": "мэлёд", "механ": "мэхан", "неапал": "нэапал", "нерв": "нэрв",
    "партупе": "партупэ", "педант": "пэдант", "персан": "пэрсан", "перспект": "пэрспэкт",
    "перымет": "пэрымэт", "перыяд": "пэрыяд", "перыёд": "пэрыёд", "песім": "пэсым",
    "праметэ": "прамэтэ", "прафес": "прафэс", "прэзент": "прэзэнт", "рэкамендац": "рэкамэндац",
    "рэнесанс": "рэнэсанс", "сезон": "сэзон", "сенсац": "сэнсац", "спектакл": "спэктакл",
    "спецыял": "спэцыял", "трапецы": "трапэцы", "тэмператур": "тэмпэратур",
    "універсал": "унівэрсал", "феномен": "фэномэн", "фехтав": "фэхтав", "цэмент": "цэмэнт",
    "экзекуц": "экзэкуц", "экспедыц": "экспэдыц", "энерг": "энэрг", "эсенцы": "эсэнцы",
    "імпер": "імпэр", "інерт": "інэрт", "інжынер": "інжынэр", "інструмент": "інструмэнт",
    "дэперсан": "дэпэрсан", "феліц": "фэліц", "мейрынк": "мэйрынк", "верфел": "вэрфэл",
    "кіламетр": "кілямэтр",
    // л → ль, ля, лё, лю
    "лагічн": "лягічн", "апалагет": "апалягет", "археолаг": "археоляг", "аэраплан": "аэраплян",
    "біплан": "біплян", "манаплан": "манаплян", "баланс": "балянс", "баласт": "баляст",
    "балкон": "балькон", "балон": "балён", "блузк": "блюзк", "дыплам": "дыплям",
    "каларыт": "калярыт", "калон": "калён", "лагер": "лягер", "лабірынт": "лябірынт",
    "плакат": "плякат", "платформ": "плятформ", "рэклам": "рэклям", "салон": "салён",
    "трыкалор": "трыкалёр", "шаблон": "шаблён", "эластычн": "элястычн", "класіч": "клясыч",
    "маналог": "маналёг", "лакіраван": "лякіраван",
    // сі, зі → сы, зы
    "пазіц": "пазыц", "візіт": "візыт", "лексік": "лексык", "максімал": "максымал",
    "сігнал": "сыгнал", "сімпат": "сымпат", "сімптом": "сымптом", "сірэн": "сырэн",
    "сітуац": "сытуац", "фізіч": "фізыч", "рэзідэнц": "рэзыдэнц", "экзістэнц": "экзыстэнц",
    "псіх": "псых", "плісіраван": "плісыраван",
  }).sort((a, b) => b[0].length - a[0].length);
  const STEM_RE = new RegExp(STEMS.map(([from]) => from).join("|"), "gi");
  const STEM_TO = new Map(STEMS);
  // зала → заля: the ending softens too
  const ZALA = { "а": "я", "у": "ю", "ы": "і", "е": "і", "ай": "яй", "аю": "яю", "аў": "яў", "ам": "ям", "амі": "ямі", "ах": "ях" };
  // a vowel or ь after a final р, л: тэатр → тэатар, цыкл → цыкль
  const FINAL = /^(.*(?:тэат|цэнт|аркест|цылінд|мэт))р$|^(цык)л$/i;

  function loanword(word) {
    let out = word;
    for (const [re, stem, to] of LOANS) {
      if (re.test(out)) { out = matchCase(out.slice(0, stem.length), to) + out.slice(stem.length); break; }
    }
    out = out.replace(STEM_RE, (m) => matchCase(m, STEM_TO.get(m.toLowerCase())));
    const z = out.match(/^([Зз][Аа][Лл])([А-Яа-яЎўІі]+)$/);
    if (z && ZALA[z[2].toLowerCase()]) out = z[1] + matchCase(z[2], ZALA[z[2].toLowerCase()]);
    const f = out.match(FINAL);
    if (f) {
      const last = out.slice(-1), up = last !== last.toLowerCase();
      out = f[1] ? f[1] + (up ? "А" : "а") + last : f[2] + last + (up ? "Ь" : "ь");
    }
    return out;
  }

  function matchCase(sample, text) {
    if (sample.length > 1 && sample === sample.toUpperCase()) return text.toUpperCase();
    if (sample[0] === sample[0].toUpperCase()) return text[0].toUpperCase() + text.slice(1);
    return text;
  }

  // words of the reader's interface; the book's words arrive via setFirstStressed()
  let firstStressed = new Set(["знойдзена"]);
  const NE_BEZ = { "не": "ня", "без": "бяз" };
  const normApos = (w) => w.toLowerCase().replace(/[’ʼ]/g, "'");

  function toTarask(text) {
    // не ведаю → ня ведаю, без грошай → бяз грошай (before the softening, which never touches these)
    let out = text.replace(/(^|[^А-Яа-яЁёІіЎў'’ʼ-])(не|Не|НЕ|без|Без|БЕЗ)(\s+)(?=([А-Яа-яЁёІіЎў]+(?:['’ʼ][А-Яа-яЁёІіЎў]+)*))/g,
      (m, pre, word, sp, next) => {
        if (!firstStressed.has(normApos(next))) return m;
        return pre + matchCase(word, NE_BEZ[word.toLowerCase()]) + sp;
      });
    out = out.replace(WORD, (w) => softenWord(loanword(w)));
    // з ім → зь ім, з сябрам → зь сябрам (the preposition only)
    out = out.replace(/(^|[^А-Яа-яЁёІіЎў'’ʼ])([Зз])(\s+)(?=([А-Яа-яЁёІіЎў]+))/g, (m, pre, z, sp, next) =>
      startsSoft(next) ? `${pre}${z}${z === "З" && next === next.toUpperCase() && next.length > 1 ? "Ь" : "ь"}${sp}` : m);
    return out;
  }

  // ---------- łacinka ----------

  const PLAIN = {
    "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "ж": "ž", "з": "z", "й": "j", "к": "k",
    "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ў": "ŭ", "ф": "f",
    "х": "ch", "ц": "c", "ч": "č", "ш": "š", "ы": "y", "э": "e", "і": "i",
  };
  const ACUTE = { "з": "ź", "с": "ś", "н": "ń", "ц": "ć", "л": "l" };  // before ь
  const IOTATED = { "е": "e", "ё": "o", "ю": "u", "я": "a" };
  const CONSONANTS = "бвгґджзйклмнпрстфхцчш";

  function lacinkaWord(word) {
    const low = word.toLowerCase();
    let out = "";
    for (let i = 0; i < low.length; i++) {
      const c = low[i], prev = low[i - 1] || "", next = low[i + 1] || "";
      let t;
      if (isApos(c)) t = "";
      else if (c === "ь") t = "";
      else if (next === "ь" && ACUTE[c]) t = ACUTE[c];
      else if (c === "л") t = isSoft(next) ? "l" : "ł";
      else if (IOTATED[c]) {
        if (prev === "л") t = IOTATED[c];
        else if (prev && CONSONANTS.includes(prev) && prev !== "й") t = "i" + IOTATED[c];
        else t = "j" + IOTATED[c];
      } else if (c === "і") t = isApos(prev) ? "ji" : "i";
      else t = PLAIN[c] ?? c;

      if (word[i] !== c && t) t = t[0].toUpperCase() + t.slice(1);  // keep capitals: Я → Ja, Ч → Č
      out += t;
    }
    const caps = word.length > 1 && word === word.toUpperCase() && /[А-ЯЁІЎҐ]/.test(word);
    return caps ? out.toUpperCase() : out;
  }

  function toLacinka(text) {
    return toTarask(text).replace(/[А-Яа-яЁёІіЎўҐґ'’ʼ]+/g, (w) => {
      // apostrophes between letters belong to the word; quote marks around it do not
      const m = w.match(/^(['’ʼ]*)(.*?)(['’ʼ]*)$/);
      return m[1] + lacinkaWord(m[2]) + m[3];
    });
  }

  const cache = { tarask: new Map(), lacinka: new Map() };
  function convert(text, mode) {
    if (!text || mode === "narkam" || !cache[mode]) return text;
    const memo = cache[mode];
    if (!memo.has(text)) memo.set(text, mode === "tarask" ? toTarask(text) : toLacinka(text));
    return memo.get(text);
  }

  function setFirstStressed(words) {
    firstStressed = new Set(["знойдзена", ...(words || []).map(normApos)]);
    cache.tarask.clear();
    cache.lacinka.clear();
  }

  window.Orthography = { convert, toTarask, toLacinka, setFirstStressed, LETTER };
})();

# kafka-apaviadanni

**Чытанка: <https://ajaranbior.github.io/kafka-apaviadanni/>**

Кафка па-беларуску: «Ператварэнне» («Метамарфозы»), «Прысуд», «У калоніі для зняволеных»,
«Перад законам» і іншыя апавяданні — наркамаўкай, тарашкевіцай або лацінкай.

A web reader for **Франц Кафка, «Прысуд»: апавяданні і мініяцюры**
(Мінск: Мастацкая літаратура, 1996; пераклад Лявона Баршчэўскага, прадмова Пятра Васючэнкі),
opening on «Ператварэнне». The electronic edition of the book is on
[Беларуская Палічка (knihi.com)](https://knihi.com/Franc_Kafka/Prysud_apaviadanni_i_minijaciury.html).

## Running the reader

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

The text is in `book/book.json`. Works are grouped as
in the book in a contents sidebar (`t`, collapsible, with a title search on `/`); `[` / `]`
move between works; multi-part works get part links. Once a work's heading scrolls away,
its title (and current part) appears in the top bar; clicking it returns to the top.
Positions look like `#/pieratvarennie/2`.

The text can be shown as printed (наркамаўка), or converted automatically to тарашкевіца or
łacinka. Łacinka is made from the тарашкевіца version (снег → сьнег → śnieh,
з ім → зь ім → ź im). Тарашкевіца's ня/бяз before a word stressed on its first syllable
(ня ведаю, but не было) needs stress, which spelling doesn't show, so `book.json` carries the
list of such words (`firstStressed`, taken from the
[GrammarDB](https://github.com/Belarus/GrammarDB) stress list, CC BY-SA 4.0). Loanwords
(камендант → камэндант, калонія → калёнія, сітуацыя → сытуацыя, тэатр → тэатар) come from a
hand-reviewed list in `assets/orthography.js`, found by checking the book against the
тарашкевіца Hunspell dictionary ([spell-be-tarask](https://github.com/375gnu/spell-be-tarask),
CC BY-SA). Font size, theme, orthography and the last reading position are remembered per
browser.

## Publishing

GitHub Pages serves the repository root of `main` (Settings → Pages → Deploy from a branch →
`main`, `/ (root)`); `.nojekyll` makes it serve the files as they are. For search engines the
page carries a description, a canonical URL, link-preview tags with `assets/og.png`, and
`robots.txt` / `sitemap.xml`. The works share one address (`#/…` positions aren't separate
pages for search engines), so the page is indexed with «Ператварэнне», which it opens on. The
stylesheet and scripts are linked with `?v=N` in `index.html`; raise the number when they
change, so browsers don't keep a cached old copy next to the new page.

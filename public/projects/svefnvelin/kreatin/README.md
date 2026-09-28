# Kreatín — lifandi líkamsatlas

Kreatínhermirinn er hluti af Svefnvélinni. Opnaðu `OPNA-SVEFNVELINA.command` í rót safnsins og veldu **Kreatínhermir** í aðalvalmyndinni. Síðan er undir `/kreatin/index.html` á sama vefþjóni. Tengill í haus hermisins leiðir aftur í Svefnvélina.

## Það sem fylgir

- Allar 18 samsetningar: 5/10/20 g daglega í viku, tvær vikur, mánuð, þrjá mánuði, hálft ár eða ár.
- Snúanlegt BodyParts3D-líkan: 402 vöðvahlutar, 296 beinakerfishlutar og 105 heilatengdar byggingar.
- Hreyfimyndir fyrir ATP, vatn í vöðvafrumum, þjálfunaraðlögun og bata; fjögur skref fyrir heilastarfsemi.
- `assets/`: öll þjöppuð líkamsgögn sem hermirinn notar, skrá yfir byggingar, viðmiðunarmynd og leyfi.
- `sources.js`, `RESEARCH.md` og `docs/`: 19 heimildir, rannsóknarnótur, myndbandatilvísanir og aðferð.
- `vendor/`: staðbundið Three.js og leyfi; ekkert CDN þarf fyrir þrívíddarkóðann.
- `tests/`: prófanir á sviðsmyndum, viðmóti og hreyfingum.
- `docs/validation/`: niðurstöður og skjámyndir fyrri sannprófunar.
- `DATA_MANIFEST.json`: stærðir og SHA-256 auðkenni allra líkanagagna.

## Keyra sérstaklega

```sh
cd vefur/kreatin
python3 -m http.server 4173 --bind 127.0.0.1
```

Opnaðu http://127.0.0.1:4173. Tengillinn til baka í Svefnvélina er ætlaður sameiginlegu rótarræsingunni að ofan.

## Prófanir

```sh
cd vefur/kreatin
npm ci
npm test
node tests/browser.mjs
node tests/motion.mjs
```

Vafrapróf nota Google Chrome. Vefþjónn þarf að vera í gangi á 4173. Til að prófa herminn sem undirsíðu Svefnvélarinnar má stilla `CREATINE_TEST_URL`, til dæmis `http://127.0.0.1:8777/kreatin/`.

## Endurgerð gagna

Afhentu `.dat` skrárnar innihalda öll rúmfræðigögn sem hermirinn þarf. Upprunalega Blender-vinnusafnið er ekki nauðsynlegt til keyrslu. Ef það er til staðar má endurvinna valdar byggingar:

```sh
python3 scripts/prepare_assets.py /slod/ad/anatomy
```

Þetta endurskrifar valdar skrár í `assets/`. BodyParts3D © DBCLS, CC BY 4.0; birtingargögn aðlöguð úr Human Atlas. Nánar í `assets/ATTRIBUTION.md`.

## Túlkun

Birgðastika, ljósflæði og aflögun yfirborðs eru fræðsluframsetning. Þau spá ekki fyrir um kíló af vöðvum, styrktaraukningu eða betra minni. Valinn skammtur gildir allan tímann; 20 g breytast ekki sjálfkrafa í viðhald. Sjá rannsóknarnóturnar fyrir vísindalegar takmarkanir.

Upprunaleg einkabirting: https://kreatin-likamsatlas.ellithegamer00.chatgpt.site
GitHub-safn: https://github.com/eliasoli09/svefnvelin

## Útlit í verkefni 4

Hermirinn notar liti Svefnvélarinnar: næturblátt `#080e1a`, gyllt `#e8b464` og ísblátt `#9fd0e8`. Sama útgáfa er felld inn í verkefni 4 á Vibe Ísland. Litabreytingin breytir ekki rannsóknargögnum eða reiknilíkani.

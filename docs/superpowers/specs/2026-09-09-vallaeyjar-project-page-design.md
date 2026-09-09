# Hönnun: verkefnasíða fyrir Vallaeyjar

## Markmið

Bæta „Verkefni“ við aðalvalmynd Vibe Ísland og útbúa stækkanlegan verkefnalista. Fyrsta verkefnið er Vallaeyjar, sjálfstæður þrívíddarskoðari fyrir fótboltavelli á svífandi eyjum. Notandi á að geta opnað verkefnið á eigin leið, farið aftur á verkefnalistann og notað alla núverandi virkni skoðarans á tölvu og síma.

## Aðferðir sem voru metnar

1. **Sjálfstæð HTML-skrá í iframe (valið):** fylgir beiðninni, varðveitir alla núverandi virkni og einangrar Three.js, CSS, IndexedDB og viðburðahlustara frá Next.js-síðunni.
2. **Færa skoðarann yfir í React:** gæfi dýpri samþættingu við vefsíðuna en hefði mikla hættu á hegðunarbreytingum og myndi tvöfalda viðhald á 1,76 MB sjálfbærum skoðara.
3. **Opna HTML-skrána í nýjum flipa:** einfalt en gefur verri leiðsögn og uppfyllir ekki kröfuna um sérstaka verkefnasíðu með meginplássi fyrir skoðarann.

## Leiðir og einingar

- Aðalvalmyndin fær áberandi hlekk á `/verkefni` með heitinu „Verkefni“.
- `app/verkefni/projects.ts` geymir verkefnagögnin svo ný verkefni verði bætt við án þess að endurbyggja kortauppsetninguna.
- `app/verkefni/page.tsx` sýnir verkefnalista í núverandi svarta, mintugræna og mónósporaða útliti Vibe Ísland.
- `app/verkefni/vallaeyjar/page.tsx` sýnir heiti, skýra leið til baka, stutta skýringu um staðbundna vistun og iframe-skoðarann.
- `app/verkefni/vallaeyjar/vallaeyjar-viewer.tsx` sér um líftíma iframe og tæmir slóðina við afhleðslu svo teiknilykkjan haldi ekki áfram eftir leiðaskipti.
- `public/projects/vallaeyjar/viewer.html` varðveitir meðfylgjandi `Kaplakriki_3D (2).html`, þar á meðal allan JavaScript-kóða, rúmfræði og merki. Eini viðbótarhlekkurinn vísar á staðbundna `viewer-host.css`, sem gerir upprunalegu stýringarnar aðgengilegar í mjóu iframe. Engar ytri netþjónustur eru nauðsynlegar.

## Sjónræn stefna

Verkefnalistinn fylgir núverandi Vibe Ísland útliti: svartur bakgrunnur, fíngert mintugrænt hnitanet, skarpar línur, Space Grotesk og IBM Plex Mono. Kortið sýnir raunverulegt skjáskot úr Vallaeyjum, vistað sem `preview.png`.

Verkefnasíðan setur skoðarann í forgang. Hausinn er þéttur, til baka-hlekkurinn greinilegur og iframe fær rýmið undir honum með flex-uppsetningu og `dvh`. Lágmarkshæð á stuttum skjám heldur stýringum aðgengilegum með síðuskrolli.

## Hegðun og gagnageymsla

- Iframe-slóðin er `/projects/vallaeyjar/viewer.html` og `allowFullScreen` er virkt.
- Sandkassi verður ekki settur á iframe, því hann gæti lokað á skráaval, niðurhal, clipboard, fullskjá eða IndexedDB.
- `.stadium`-eyjar vistast aðeins í vafra viðkomandi notanda, samkvæmt núverandi IndexedDB-virkni skoðarans.
- Verkefnasíðan útskýrir að notendur deili völlum með því að sækja og senda `.stadium`-skrár. Hún gefur ekki í skyn að innfluttar eyjar birtist hjá öðrum gestum sjálfkrafa.
- Þegar farið er af Vallaeyjar-síðunni er iframe fært á `about:blank` og síðan fjarlægt af Next.js, sem stöðvar WebGL-teikningu og viðburðahlustara.
- Þegar React endurvirkjar vistaða leið setur effect-uppsetningin rétta iframe-slóð aftur; þetta styður líka Strict Mode.

## Aðgengi og aðlögun

- Verkefnakortið hefur lýsandi fyrirsögn, texta og skýran „Opna verkefni“ hlekk.
- Iframe hefur lýsandi `title` og leyfir mús, snertingu, lyklaborð, clipboard, skráaval, niðurhal og fullskjá.
- Fókusmerkingar og litaskil fylgja núverandi hönnunarkerfi.
- Verkefnasíðan notar hærri iframe-hæð á mjóum skjám til að gefa innri farsímastýringum rými, og skjámiðaða hæð á stærri skjám.

## Prófanir

- Sjálfvirk próf staðfesta valmyndartengil, gagnadrifinn verkefnalista, leiðir, iframe-slóð, fullskjáheimild, líftímahreinsun og skýringu á `.stadium`-deilingu.
- Framleiðslubygging og lint staðfesta að Next.js-leiðir og TypeScript séu gild.
- Vafrarpóf staðfestir leiðsögn og endurhleðslu, upphaflegt eyjaval, Kaplakrika og Auðar-merki, hringflug, Top/Side, dróna, þysjun, gæðastillingu, innflutning dæmis, vistun eftir endurhleðslu, niðurhal, afritun prompts og fullskjá.
- Borðtölvu- og farsímastærðir verða skoðaðar og console-villur skráðar.

## Afmörkun

Skoðarinn er ekki þýddur eða tengdur við miðlægan bakenda. Innfluttar eyjar eru áfram staðbundnar fyrir hvern vafra. Viðbótarstílskrá sýnir „Búa til völl“ og fullskjáhnappinn á síma og tryggir að flugstýringar rúmist. Engin önnur síða eða efni vefsins breytist umfram nýja valmyndartengilinn.

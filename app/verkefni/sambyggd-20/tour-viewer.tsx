"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Info, Map, X } from "lucide-react";
import { getNextStation, stations } from "./tour-data";
import styles from "./viewer.module.css";

export function TourViewer() {
  const [activeId, setActiveId] = useState(stations[1].id);
  const [showPlan, setShowPlan] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showWholePhoto, setShowWholePhoto] = useState(false);
  const photoRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const active = stations.find((station) => station.id === activeId) ?? stations[0];
  const index = stations.findIndex((station) => station.id === active.id);

  const step = useCallback((direction: 1 | -1) => {
    setActiveId((current) => getNextStation(current, direction).id);
    setShowWholePhoto(false);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "Escape") {
        setShowPlan(false);
        setShowSources(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !photoRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    photoRef.current.style.setProperty("--photo-x", `${(-x * 12).toFixed(1)}px`);
    photoRef.current.style.setProperty("--photo-y", `${(-y * 8).toFixed(1)}px`);
  }

  function selectStation(id: string) {
    setActiveId(id);
    setShowWholePhoto(false);
    setShowPlan(false);
  }

  return (
    <main lang="is" className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brandRow}>
          <Link href="/verkefni" className={styles.backLink} aria-label="Til baka í verkefni Vibe Ísland">
            <ArrowLeft size={16} /> <span>Vibe Ísland</span>
          </Link>
          <span className={styles.divider} />
          <span className={styles.brand}>Sambyggð <em>20</em></span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.status}><span className={styles.statusDot} /> Gagnvirk myndaganga</span>
          <button type="button" className={styles.headerButton} onClick={() => setShowSources(true)} aria-label="Upplýsingar um heimildir">
            <Info size={17} />
          </button>
        </div>
      </header>

      <div className={styles.mainGrid}>
        <section className={styles.stage} aria-label="Ljósmyndaleiðsögn um Sambyggð 20">
          <div
            className={styles.photoFrame}
            onPointerMove={onPointerMove}
            onPointerLeave={() => {
              photoRef.current?.style.setProperty("--photo-x", "0px");
              photoRef.current?.style.setProperty("--photo-y", "0px");
            }}
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              if (touchStartX.current === null) return;
              const delta = event.changedTouches[0]?.clientX - touchStartX.current;
              if (Math.abs(delta) > 60) step(delta < 0 ? 1 : -1);
              touchStartX.current = null;
            }}
          >
            <div className={styles.photoBlur} style={{ backgroundImage: `url('${active.image}')` }} aria-hidden="true" />
            <div ref={photoRef} className={styles.photoInner} key={active.id}>
              <Image src={active.image} alt={active.alt} fill sizes="(min-width: 1100px) 75vw, 100vw" priority={index === 1} className={`${styles.photo} ${showWholePhoto ? styles.wholePhoto : ""}`} />
            </div>
            <div className={styles.photoVignette} aria-hidden="true" />

            <div className={styles.photoTopline}>
              <span className={styles.photoBadge}>Sambyggð 20 <span>·</span> Íbúð 0305</span>
              <span className={styles.photoCount}>{String(index + 1).padStart(2, "0")} / {String(stations.length).padStart(2, "0")}</span>
            </div>
            <button type="button" className={styles.fitButton} onClick={() => setShowWholePhoto((value) => !value)}>{showWholePhoto ? "Fylla skjá" : "Sjá alla myndina"}</button>

            <div className={styles.photoCaption} aria-live="polite">
              <p>{active.kicker}</p>
              <h1>{active.title}</h1>
              <span>Ljósmynd úr auglýsingu</span>
            </div>

            <div className={styles.walkControls} aria-label="Fara á milli ljósmynda">
              <button type="button" onClick={() => step(-1)} aria-label="Fyrra sjónarhorn"><ArrowLeft size={20} /></button>
              <div className={styles.walkLabel}>Ganga um rýmin <span>Dragðu til hliðar eða notaðu örvatakka</span></div>
              <button type="button" onClick={() => step(1)} aria-label="Næsta sjónarhorn"><ArrowRight size={20} /></button>
            </div>
          </div>
        </section>

        <aside className={`${styles.sidePanel} ${showPlan ? styles.sidePanelOpen : ""}`} aria-label="Grunnmynd og rými">
          <div className={styles.sideHead}>
            <div>
              <span className={styles.eyebrow}>Íbúð 0305</span>
              <h2>Skoðaðu rýmin</h2>
            </div>
            <button type="button" className={styles.closePlan} onClick={() => setShowPlan(false)} aria-label="Loka grunnmynd"><X size={19} /></button>
          </div>

          <p className={styles.sideIntro}>Veldu punkt á grunnmyndinni eða flettu milli sjónarhorna.</p>

          <div className={styles.floorplanWrap}>
            <div className={styles.floorplan}>
              <Image src="/projects/sambyggd-20/floorplan.jpg" alt="Grunnmynd íbúðar 0305 með merktum herbergjum og svölum" fill sizes="300px" className={styles.planImage} />
              {stations.map((station, stationIndex) => (
                <button
                  key={station.id}
                  type="button"
                  style={{ left: `${station.planX}%`, top: `${station.planY}%` }}
                  className={`${styles.planPin} ${station.id === active.id ? styles.planPinActive : ""}`}
                  onClick={() => selectStation(station.id)}
                  aria-label={`Skoða ${station.title}`}
                  aria-current={station.id === active.id ? "location" : undefined}
                  title={station.title}
                >{stationIndex + 1}</button>
              ))}
            </div>
            <span className={styles.planCaption}>Grunnmynd auglýsingar · 0305</span>
          </div>

          <div className={styles.roomList}>
            {stations.map((station, stationIndex) => (
              <button key={station.id} type="button" className={`${styles.room} ${active.id === station.id ? styles.roomActive : ""}`} onClick={() => selectStation(station.id)} aria-current={active.id === station.id ? "step" : undefined}>
                <span>{String(stationIndex + 1).padStart(2, "0")}</span><strong>{station.title}</strong><ArrowRight size={15} />
              </button>
            ))}
          </div>
        </aside>
      </div>

      <footer className={styles.footer}>
        <div className={styles.facts}><span><b>105,9</b> m² skráð</span><i /><span><b>3</b> svefnherbergi</span><i /><span><b>3.</b> hæð</span></div>
        <button type="button" className={styles.mobilePlanButton} onClick={() => setShowPlan(true)}><Map size={17} /> Grunnmynd og rými</button>
        <button type="button" className={styles.sourceButton} onClick={() => setShowSources(true)}>Um ljósmyndir og nákvæmni <ArrowRight size={14} /></button>
      </footer>

      {showPlan && <button type="button" className={styles.planScrim} onClick={() => setShowPlan(false)} aria-label="Loka grunnmynd" />}
      {showSources && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSources(false); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="sources-title">
            <button type="button" className={styles.modalClose} onClick={() => setShowSources(false)} aria-label="Loka upplýsingum"><X size={20} /></button>
            <span className={styles.eyebrow}>Heimildir og nákvæmni</span>
            <h2 id="sources-title">Raunverulegar myndir.<br />Skýrar forsendur.</h2>
            <p>Þessi myndaganga notar óbreyttar innanhússljósmyndir úr fasteignaauglýsingunni og grunnmynd merkta <strong>0305</strong>. Skráarheiti innanhússmyndanna bera hins vegar númerið <strong>0105</strong>; þær staðfesta því ekki að hver mynd sýni einmitt íbúð 0305. Staðsetning punkta á grunnmynd sýnir tegund rýmis, ekki mælda myndavélarstöðu.</p>
            <p>Grunnmyndin er ekki málsett. Þessi skoðun er myndræn leiðsögn og kemur ekki í stað vettvangsskoðunar eða staðfestrar 1:1 mælingar.</p>
            <a href="https://fasteignir.visir.is/property/1113971" target="_blank" rel="noopener noreferrer" className={styles.listingLink}>Opna upprunalega auglýsingu <ExternalLink size={16} /></a>
          </section>
        </div>
      )}
    </main>
  );
}

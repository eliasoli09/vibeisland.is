(function () {
  const $ = (id) => document.getElementById(id);
  const safe = (fn, name) => { try { fn(); } catch (e) { console.error(name, e); } };

  // range sliders: paint the filled part of the track
  function paintRange(el) {
    const p = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.setProperty('--p', p + '%');
  }
  document.querySelectorAll('input[type=range]').forEach(el => {
    paintRange(el);
    el.addEventListener('input', () => paintRange(el));
    el.addEventListener('fill', () => paintRange(el));
  });

  const kpWord = (k) => k < 2 ? 'quiet' : k < 4 ? 'unsettled' : k < 5 ? 'active' : k < 6 ? 'G1 minor storm' : k < 7 ? 'G2 moderate storm' : k < 8 ? 'G3 strong storm' : k < 9 ? 'G4 severe storm' : 'G5 extreme storm';

  // ---------------- hero sky ----------------
  safe(() => {
    const canvas = $('sky');
    const sim = new SkySim(canvas, { kp: 3, pitch: 0.24, scale: 0.75, fov: 1.1 });
    (window.__nl = window.__nl || {}).hero = sim;
    if (sim.failed) { canvas.insertAdjacentHTML('afterend', '<div class="nogl">WebGL 2 is switched off in this browser, so the live sky can\'t be drawn.</div>'); return; }
    const kp = $('kp'), kv = $('kp-val');
    let base = 3, storm = null;
    const setKp = () => {
      base = +kp.value; kv.textContent = `Kp ${base.toFixed(1)} · ${kpWord(Math.floor(base))}`;
      if (!storm) sim.setKp(base);
      $('hero-hint').textContent = base >= 5.5 ? 'The oval now reaches south of Iceland — drag to look south' : base < 1 ? 'Quiet: the oval sits just north of Iceland' : 'Drag the sky to look around';
    };
    kp.addEventListener('input', setKp); setKp();
    const mode = (eye) => {
      sim.eye = eye ? 1 : 0;
      $('mode-cam').setAttribute('aria-pressed', String(!eye));
      $('mode-eye').setAttribute('aria-pressed', String(eye));
      $('hero-mode-pill').textContent = eye ? 'Naked-eye view' : 'Camera view';
    };
    $('mode-cam').addEventListener('click', () => mode(false));
    $('mode-eye').addEventListener('click', () => mode(true));
    const up = $('look-up');
    up.addEventListener('click', () => {
      const looking = sim.camTarget.pitch > 0.9;
      sim.look(looking ? 0 : Math.PI, looking ? 0.24 : 1.33);
      up.textContent = looking ? 'Look straight up' : 'Back to the horizon';
    });
    sim.onLook = (c) => { up.textContent = c.pitch > 0.9 ? 'Back to the horizon' : 'Look straight up'; };
    $('substorm').addEventListener('click', () => {
      if (storm) storm.forEach(clearTimeout);
      sim.preset('growth', 1.2);
      storm = [
        setTimeout(() => { sim.preset('onset', 3); sim.flash = 0.8; }, 2500),
        setTimeout(() => { sim.preset('expansion', 1.4); }, 5000),
        setTimeout(() => { sim.preset('recovery', 0.5); }, 17000),
        setTimeout(() => { storm = null; sim.set(Object.assign({}, sim.target, { pulse: 0 }), .4); sim.setKp(base); }, 30000)
      ];
    });
  }, 'hero');

  // ---------------- substorm lab ----------------
  safe(() => {
    const canvas = $('lab-sky');
    const lab = new SkySim(canvas, { kp: 2, pitch: 0.18, scale: 0.7, fov: 1.0 });
    (window.__nl = window.__nl || {}).lab = lab;
    if (lab.failed) return;
    lab.preset('quiet', 50);
    const TEXT = {
      quiet: ['Before the storm', 'A single calm arc stretches from east to west low in the northern sky, sometimes for an hour or more. It marks where electrons are streaming down the field lines from the magnetotail.'],
      growth: ['Growth phase · ~30–60 minutes', 'The solar wind is loading energy into the stretched magnetotail. The arc slowly brightens and drifts toward the equator — from Iceland, higher up the northern sky. Extra arcs may appear.'],
      onset: ['Onset · within a minute', 'The tail snaps. The arc nearest the equator suddenly brightens, folds and sprouts rays. Energetic electrons reach low enough to paint a pink lower hem.'],
      expansion: ['Expansion · ~20–40 minutes', 'The bright region races poleward and fills the sky. Curtains ripple and fold overhead, and looking straight up you may see a corona. This is the "breakup" photographers wait for.'],
      recovery: ['Recovery · ~1–2 hours', 'The sky calms into a dim, diffuse glow and patches that blink on and off every few seconds: pulsating aurora, common after midnight. Another substorm may follow an hour or two later.']
    };
    const btns = document.querySelectorAll('.phase');
    const show = (name) => {
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.phase === name)));
      $('phase-text').innerHTML = `<span class="when">${TEXT[name][0]}</span><p>${TEXT[name][1]}</p>`;
    };
    const go = (name) => { lab.preset(name, name === 'onset' ? 3 : 1.1); if (name === 'onset') lab.flash = .7; show(name); };
    btns.forEach(b => b.addEventListener('click', () => { stop(); go(b.dataset.phase); }));
    show('quiet');
    let timers = [];
    const play = $('lab-play');
    const stop = () => { timers.forEach(clearTimeout); timers = []; play.textContent = '▶ Play the substorm'; };
    play.addEventListener('click', () => {
      if (timers.length) { stop(); return; }
      play.textContent = '❚❚ Stop';
      const seq = [['quiet', 0], ['growth', 3500], ['onset', 9000], ['expansion', 11500], ['recovery', 24000]];
      timers = seq.map(([n, t]) => setTimeout(() => go(n), t));
      timers.push(setTimeout(stop, 34000));
    });
    const upb = $('lab-up');
    upb.addEventListener('click', () => {
      const looking = lab.camTarget.pitch > 0.9;
      lab.look(looking ? 0 : Math.PI, looking ? 0.18 : 1.33);
      upb.textContent = looking ? 'Look straight up' : 'Back to the horizon';
      $('lab-cap').textContent = looking ? 'Looking north' : 'Looking up at the magnetic zenith';
    });
    const split = (on) => {
      lab.split = on ? 0.5 : 0;
      $('lab-cam').setAttribute('aria-pressed', String(!on));
      $('lab-split').setAttribute('aria-pressed', String(on));
      $('split-cap').hidden = !on;
    };
    $('lab-cam').addEventListener('click', () => split(false));
    $('lab-split').addEventListener('click', () => split(true));
  }, 'lab');

  safe(() => initSun(), 'sun');
  safe(() => initMagneto(), 'magneto');
  safe(() => initAtmos(), 'atmos');
  safe(() => initGlobe(), 'globe');
  safe(() => initPlanner(), 'planner');

  // ---------------- altimeter rail ----------------
  safe(() => {
    const chapters = [...document.querySelectorAll('[data-alt]')];
    const rail = $('rail'), mark = $('rail-mark'), read = $('rail-km'), mob = $('mobile-km');
    const ticks = [[149.6e6, 'Sun'], [1.5e6, 'L1'], [384400, 'Moon'], [64000, 'Magnetopause'], [5000, 'Acceleration'], [420, 'ISS'], [110, 'Aurora'], [0, 'You']];
    const LMAX = Math.log10(2e8), LMIN = 1; // ground is drawn at 10 km on the log scale
    const pos = (km) => { const l = Math.log10(Math.max(10, km)); return (LMAX - l) / (LMAX - LMIN) * 100; };
    $('rail-ticks').innerHTML = ticks.map(([km, n]) => `<div class="rail-tick" style="top:${pos(km)}%"><i></i>${n}</div>`).join('');
    const fmt = (km) => km >= 1e6 ? (km / 1e6).toFixed(km >= 1e7 ? 0 : 1) + ' million km' : km >= 1000 ? Math.round(km).toLocaleString('en-US') + ' km' : Math.round(km) + ' km';
    const onScroll = () => {
      const vh = window.innerHeight, probe = vh * 0.45;
      let km = 0, on = false;
      const tops = chapters.map(c => c.getBoundingClientRect().top);
      const first = tops[0];
      if (first > probe) { km = 0; on = false; }
      else {
        on = true;
        for (let i = 0; i < chapters.length; i++) {
          if (tops[i] <= probe && (i === chapters.length - 1 || tops[i + 1] > probe)) {
            const a = +chapters[i].dataset.alt, b = i < chapters.length - 1 ? +chapters[i + 1].dataset.alt : a;
            const span = i < chapters.length - 1 ? tops[i + 1] - tops[i] : 1;
            const t = Math.min(1, Math.max(0, (probe - tops[i]) / span));
            const la = Math.log10(Math.max(10, a)), lb = Math.log10(Math.max(10, b));
            const l = la + (lb - la) * Math.max(0, (t - 0.55) / 0.45);
            km = l <= 1.0001 ? 0 : Math.pow(10, l);
          }
        }
      }
      if (first > probe) km = 0;
      const endRect = chapters[chapters.length - 1].getBoundingClientRect();
      if (endRect.bottom < probe) on = false;
      rail.classList.toggle('on', on);
      $('mobile-alt').classList.toggle('off', endRect.bottom < 60);
      mark.style.top = (km === 0 ? 100 : pos(km)) + '%';
      const txt = km === 0 ? (first > probe ? 'On the ground, Iceland' : '0 km · Iceland') : fmt(km);
      read.textContent = txt; mob.textContent = txt;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }, 'rail');

  // ---------------- quiz ----------------
  safe(() => {
    const Q = [
      { q: 'What makes the most common, green colour of the aurora?', a: ['Nitrogen molecules near the ground', 'Oxygen atoms about 100–150 km up', 'Sunlight reflecting off sea ice', 'Neon in the upper atmosphere'], c: 1,
        why: 'Excited oxygen atoms emit 557.7 nm green light. They need about 0.7 s undisturbed, which works from roughly 100 km upward.' },
      { q: 'Why is red aurora usually found high up, above ~200 km?', a: ['It is colder up there', 'Red light can only travel upward', 'The oxygen state that makes red needs ~110 s without a collision, and only thin air allows that', 'Nitrogen blocks red light lower down'], c: 2,
        why: 'Lower down, collisions "quench" the excited oxygen before it can emit its red photon.' },
      { q: 'Which solar-wind magnetic field direction lets the most energy into the magnetosphere?', a: ['Pointing north (Bz > 0)', 'Pointing south (Bz < 0)', 'Pointing straight at Earth', 'It makes no difference'], c: 1,
        why: 'A southward field is opposite to Earth\'s field at the day-side magnetopause, so the two reconnect efficiently and drive the Dungey cycle.' },
      { q: 'Why is Iceland such a good place to see aurora?', a: ['It is close to the geographic North Pole', 'Its volcanoes charge the air', 'It lies under the auroral oval, at about 63–67° magnetic latitude', 'Cold air makes the aurora brighter'], c: 2,
        why: 'The oval is centred on the magnetic pole, not the geographic one, and Iceland sits right under its night-side edge.' },
      { q: 'When in the year are geomagnetic storms statistically most common?', a: ['Around midsummer', 'Around the March and September equinoxes', 'Only in December', 'Evenly spread across the year'], c: 1,
        why: 'The Russell–McPherron effect: the geometry between Earth\'s tilted field and the solar wind favours southward Bz near the equinoxes.' },
      { q: 'A "corona" appears overhead during strong aurora. What is it?', a: ['A hole in the atmosphere', 'Perspective: parallel rays along the magnetic field seem to meet at one point', 'A reflection of the Moon', 'The Sun\'s corona seen at night'], c: 1,
        why: 'Like railway tracks meeting at the horizon, rays running along the field lines appear to converge at the magnetic zenith.' },
      { q: 'When the northern lights are shining, what is happening in the Southern Hemisphere?', a: ['Nothing: aurora alternates between hemispheres', 'An aurora australis is usually happening at the same time', 'The southern lights happen only in June', 'Southern aurora is always red'], c: 1,
        why: 'Both ovals are fed by the same magnetosphere, so the northern and southern lights usually happen together.' }
    ];
    const box = $('quiz-box'), score = $('score');
    let right = 0, done = 0;
    box.innerHTML = Q.map((x, i) => `<div class="q" data-i="${i}"><h3>${i + 1}. ${x.q}</h3><div class="opts">${x.a.map((o, j) => `<button type="button" data-j="${j}">${o}</button>`).join('')}</div><div class="why" hidden></div></div>`).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const qd = b.closest('.q'), i = +qd.dataset.i, j = +b.dataset.j, x = Q[i];
      if (qd.dataset.done) return;
      qd.dataset.done = 1; done++;
      qd.querySelectorAll('button').forEach((bb, k) => { bb.disabled = true; if (k === x.c) bb.classList.add('right'); });
      if (j === x.c) right++; else b.classList.add('wrong');
      const w = qd.querySelector('.why'); w.hidden = false; w.textContent = (j === x.c ? 'Correct. ' : 'Not quite. ') + x.why;
      score.textContent = `· ${right}/${done} right`;
    });
  }, 'quiz');
})();

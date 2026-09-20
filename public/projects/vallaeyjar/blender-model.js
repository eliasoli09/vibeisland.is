/* Blender mesh adapter for the existing Vallaeyjar viewer. No external requests. */
(() => {
  const prepared = new WeakMap();
  const seatCatalogs = new WeakMap();
  const labels = {
    pitch: 'Völlur', main_stand: 'Stóra stúkan', roof: 'Þak og burðarvirki',
    small_stand: 'Minni stúkan', booth: 'Bláa húsið', goals: 'Mörk og hornfánar',
    advertising: 'Auglýsingafletir', surroundings: 'Umhverfi',
  };

  // Numbers describe this reconstruction, not the venue's ticketing plan.
  // Sort across material batches so the black FH seats share the white rows.
  function seatCatalog(model) {
    if (seatCatalogs.has(model)) return seatCatalogs.get(model);
    const catalog = new Map();
    const ids = new Set();
    for (const batch of model.batches) {
      if (batch.seats === undefined) continue;
      const validVector = value => Array.isArray(value) && value.length === 3 && value.every(n => Number.isFinite(n) && Math.abs(n) <= 350);
      if (!Array.isArray(batch.seats) || batch.seats.length !== batch.matrices.length) throw new Error('Ógild sætaskipan.');
      for (const seat of batch.seats) {
        if (!seat || typeof seat.id !== 'string' || !/^[A-Z0-9-]{1,40}$/.test(seat.id) || ids.has(seat.id) ||
          typeof seat.label !== 'string' || seat.label.length > 100 ||
          !Number.isInteger(seat.row) || seat.row < 1 || seat.row > 1000 ||
          !Number.isInteger(seat.number) || seat.number < 1 || seat.number > 1000 ||
          !validVector(seat.eyeOffset) || !validVector(seat.lookOffset)) throw new Error('Ógild sætagögn.');
        ids.add(seat.id);
      }
      catalog.set(batch, batch.seats);
    }
    for (const [stand, prefix, title] of [
      ['south', /^South seat R/, 'Stóra stúkan'],
      ['north', /^North (seat R|end short row)/, 'Minni stúkan'],
    ]) {
      const rows = new Map();
      for (const batch of model.batches) {
        if (!prefix.test(batch.name)) continue;
        const entries = new Array(batch.matrices.length);
        catalog.set(batch, entries);
        batch.matrices.forEach((matrix, index) => {
          const height = Math.round(matrix[13] * 1000);
          if (!rows.has(height)) rows.set(height, []);
          rows.get(height).push({ entries, index, x: matrix[12] });
        });
      }
      [...rows.keys()].sort((a, b) => a - b).forEach((height, rowIndex) => {
        rows.get(height).sort((a, b) => a.x - b.x).forEach((seat, index) => {
          const row = rowIndex + 1, number = index + 1;
          seat.entries[seat.index] = { stand, row, number,
            label: `${title} · röð ${row} · sæti ${number}` };
        });
      });
    }
    seatCatalogs.set(model, catalog);
    return catalog;
  }

  function seatPose(instance, world, seat = {}) {
    const transform = (m, [x, y, z]) => [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
    // Seat pan is 0.43 m above the terrace; eyes sit 0.72 m above it.
    // Local -Z faces the pitch on both sides after the instance rotation.
    return {
      position: transform(world, transform(instance, seat.eyeOffset || [0, 1.15, .04])),
      target: transform(world, transform(instance, seat.lookOffset || [0, .7, -35])),
    };
  }

  function seatAt(hit) {
    const mesh = hit?.object, index = hit?.instanceId;
    if (!Number.isInteger(index) || index < 0 || !mesh?.userData.seats?.[index]) return null;
    mesh.updateWorldMatrix(true, false);
    const matrix = mesh.instanceMatrix.array.subarray(index * 16, (index + 1) * 16);
    return { ...mesh.userData.seats[index], ...seatPose(matrix, mesh.matrixWorld.elements, mesh.userData.seats[index]) };
  }

  async function prepare(model, THREE) {
    seatCatalog(model);
    if (prepared.has(model)) return prepared.get(model);
    const pending = (async () => {
      const textures = {};
      for (const geometry of Object.values(model.geometries)) {
        if (geometry.uvs && (geometry.uvs.length !== geometry.vertices.length ||
          !geometry.uvs.every(uv => Array.isArray(uv) && uv.length === 2 && uv.every(v => Number.isFinite(v) && Math.abs(v) <= 1000)))) {
          throw new Error('Ógild myndhnit í Blender-líkaninu.');
        }
      }
      for (const [key, detail] of Object.entries(model.materialDetails || {})) {
        if (!Object.hasOwn(model.materials, key)) throw new Error('Óþekkt efni í Blender-líkaninu.');
        if (detail.opacity !== undefined && (!Number.isFinite(detail.opacity) || detail.opacity < 0 || detail.opacity > 1)) throw new Error('Ógilt gagnsæi efnis.');
        if (!detail.image) continue;
        if (typeof detail.image !== 'string' || detail.image.length > 4 * 1024 * 1024 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(detail.image)) {
          throw new Error('Efnisáferð þarf innfellda mynd, mest 3 MB.');
        }
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Ekki tókst að lesa efnisáferð líkansins.'));
          img.src = detail.image;
        });
        if (img.width > 8192 || img.height > 8192) throw new Error('Efnisáferð er of stór.');
        const texture = new THREE.CanvasTexture(img);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures[key] = texture;
      }
      // Recreate the Blender turf bands in a small, deterministic canvas texture.
      const canvas = document.createElement('canvas');
      canvas.width = 2048; canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      for (let band = 0; band < 20; band++) {
        ctx.fillStyle = band % 2 ? '#688b43' : '#5e813a';
        ctx.fillRect(band * canvas.width / 20, 0, canvas.width / 20 + 1, canvas.height);
      }
      let seed = 97231;
      for (let i = 0; i < 170000; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const x = seed % canvas.width;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const y = seed % canvas.height;
        ctx.fillStyle = i % 2 ? '#ffffff0c' : '#00000010';
        ctx.fillRect(x, y, 1, 2);
      }
      textures.turf = new THREE.CanvasTexture(canvas);
      textures.turf.colorSpace = THREE.SRGBColorSpace;
      textures.turf.anisotropy = 8;
      return textures;
    })();
    prepared.set(model, pending);
    try {
      const textures = await pending;
      prepared.set(model, textures);
      return textures;
    } catch (error) {
      prepared.delete(model);
      throw error;
    }
  }

  function create(model, { grassTexture = null } = {}, THREE) {
    const textures = prepared.get(model);
    if (!textures || textures instanceof Promise) throw new Error('Líkanið er ekki tilbúið.');
    const root = new THREE.Group();
    root.name = model.metadata.name; root.userData = model.metadata;
    const groups = {}, materials = {}, geometries = {};
    const seats = seatCatalog(model);
    for (const [key, label] of Object.entries(labels)) {
      const group = new THREE.Group(); group.name = label; group.userData.group = key;
      groups[key] = group; root.add(group);
    }
    for (const batch of model.batches) {
      const source = model.geometries[batch.geometry];
      const detail = model.materialDetails?.[batch.material] || {};
      if (!geometries[batch.geometry]) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(source.vertices.flat(), 3));
        geometry.setIndex(source.faces.flat());
        geometry.computeVertexNormals();
        if (source.uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(source.uvs.flat(), 2));
        else if (detail.surface) {
          const uv = source.vertices.flatMap(([x, , z]) => detail.surface === 'turf' ? [x / 105 + .5, z / 68 + .5] : [x / 4, z / 4]);
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        }
        geometry.computeBoundingSphere(); geometries[batch.geometry] = geometry;
      }
      const materialKey = batch.material + (batch.smooth ? '_smooth' : '_flat');
      if (!materials[materialKey]) {
        const [color, roughness, metalness] = model.materials[batch.material];
        const map = textures[batch.material] || (detail.surface === 'turf' ? textures.turf : detail.surface === 'grass' ? grassTexture : null);
        materials[materialKey] = new THREE.MeshStandardMaterial({
          color: detail.surface === 'turf' || textures[batch.material] ? '#ffffff' : color,
          roughness, metalness, side: THREE.DoubleSide, flatShading: !batch.smooth,
          map, alphaTest: textures[batch.material] ? .25 : 0, envMapIntensity: .65,
          opacity: detail.opacity ?? 1, transparent: (detail.opacity ?? 1) < 1, depthWrite: (detail.opacity ?? 1) >= 1,
        });
      }
      const mesh = new THREE.InstancedMesh(geometries[batch.geometry], materials[materialKey], batch.matrices.length);
      mesh.name = batch.name; mesh.userData.group = batch.group;
      if (seats.has(batch)) mesh.userData.seats = seats.get(batch);
      batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, new THREE.Matrix4().fromArray(matrix)));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = batch.group !== 'pitch' && !/net cord|field paint/i.test(batch.name);
      mesh.receiveShadow = true; mesh.computeBoundingSphere(); groups[batch.group].add(mesh);
    }
    return { root, groups, materials, geometries };
  }

  function updateCamera(camera, target, mode) {
    if (!camera.isPerspectiveCamera) return;
    // Millimetre layers on the pitch and roofs need precision in distant views.
    const near = mode === 'drone' || mode === 'seat' ? .08 : Math.max(.08, Math.min(4, camera.position.distanceTo(target) / 70));
    if (Math.abs(camera.near - near) > .001) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }

  window.BlenderStadium = { prepare, create, updateCamera, seatCatalog, seatPose, seatAt };
})();

/* Blender mesh adapter for the existing Vallaeyjar viewer. No external requests. */
(() => {
  const prepared = new WeakMap();
  const labels = {
    pitch: 'Völlur', main_stand: 'Stóra stúkan', roof: 'Þak og burðarvirki',
    small_stand: 'Minni stúkan', booth: 'Bláa húsið', goals: 'Mörk og hornfánar',
    advertising: 'Auglýsingafletir', surroundings: 'Umhverfi',
  };

  async function prepare(model, THREE) {
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
        });
      }
      const mesh = new THREE.InstancedMesh(geometries[batch.geometry], materials[materialKey], batch.matrices.length);
      mesh.name = batch.name; mesh.userData.group = batch.group;
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
    const near = mode === 'drone' ? .08 : Math.max(.08, Math.min(4, camera.position.distanceTo(target) / 70));
    if (Math.abs(camera.near - near) > .001) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }

  window.BlenderStadium = { prepare, create, updateCamera };
})();

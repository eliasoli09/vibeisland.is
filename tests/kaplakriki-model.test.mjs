import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const file = new URL('../public/projects/vallaeyjar/kaplakriki-blender.json', import.meta.url);
test('the default island ships the new road-free Blender reconstruction', () => {
  assert.ok(existsSync(file), 'Blender model asset has not been exported');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(pkg.format, 'stadium-islands');
  assert.equal(pkg.units, 'm');
  assert.equal(pkg.stadium.model.metadata.source, 'Blender');
  assert.deepEqual(pkg.stadium.model.metadata.assumed_pitch_m, [105, 68]);
  const objects = pkg.stadium.model.metadata.source_objects;
  assert.ok(objects.some(name => name.includes('five-wave') || name.includes('canopy') || name.includes('Canopy')));
  assert.ok(objects.some(name => name.includes('goal | 7.32')));
  assert.ok(objects.some(name => name.includes('OSM footprint')));
  assert.ok(!objects.some(name => /Unified mapped|Road centre|parking bay|Parked car|Car wheel|Site ground/i.test(name)));
  assert.equal(objects.filter(name => name.startsWith('South seat R') || name.startsWith('North seat R') || name.startsWith('North end short row')).length, 3050);
});

test('export is finite, indexed correctly, instanced and within the viewer limits', () => {
  assert.ok(existsSync(file), 'Blender model asset has not been exported');
  const model = JSON.parse(readFileSync(file, 'utf8')).stadium.model;
  let vertices = 0, triangles = 0, instances = 0;
  for (const geometry of Object.values(model.geometries)) {
    vertices += geometry.vertices.length;
    assert.ok(geometry.vertices.every(v => v.length === 3 && v.every(n => Number.isFinite(n) && Math.abs(n) <= 350)));
    assert.ok(geometry.faces.every(f => f.length === 3 && f.every(i => Number.isInteger(i) && i >= 0 && i < geometry.vertices.length)));
  }
  for (const batch of model.batches) {
    assert.ok(model.geometries[batch.geometry] && model.materials[batch.material]);
    assert.ok(batch.matrices.every(m => m.length === 16 && m.every(Number.isFinite)));
    instances += batch.matrices.length;
    triangles += model.geometries[batch.geometry].faces.length * batch.matrices.length;
  }
  assert.ok(vertices <= 250000, `${vertices} unique vertices exceeds importer limit`);
  assert.ok(triangles <= 2200000, `${triangles} triangles exceeds importer limit`);
  assert.ok(instances <= 30000);
  assert.ok(model.batches.length < 150, 'Static geometry should be merged to keep draw calls low');
  assert.ok(model.batches.some(b => b.matrices.length > 500), 'Spectator seats should share geometry');
});

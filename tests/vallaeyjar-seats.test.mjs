import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const context = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/projects/vallaeyjar/blender-model.js', import.meta.url), 'utf8'), context);
const api = context.window.BlenderStadium;
const model = JSON.parse(readFileSync(new URL('../public/projects/vallaeyjar/kaplakriki-blender.json', import.meta.url))).stadium.model;
const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

test('all 3050 spectator seats have unique model row numbers across material batches', () => {
  const catalog = api.seatCatalog(model);
  const seats = [...catalog.values()].flat();
  assert.equal(seats.length, 3050);
  assert.equal(new Set(seats.map(s => s.label)).size, 3050);
  assert.equal(seats.filter(s => s.stand === 'south').length, 2050);
  assert.equal(seats.filter(s => s.stand === 'north').length, 1000);
  assert.ok(![...catalog.keys()].some(b => b.name === 'Team bench seat'));
});

test('seated eyes follow the actual instance and island transform, facing the pitch', () => {
  for (const [name, sign] of [['South seat', -1], ['North seat', 1], ['North end short row', 1]]) {
    const batch = model.batches.find(b => b.name.startsWith(name));
    const instance = batch.matrices[0];
    const world = [...identity]; world[12] = 500; world[13] = 7; world[14] = -200;
    const pose = api.seatPose(instance, world);
    assert.ok(Math.abs(pose.position[0] - instance[12] - 500) < .001);
    assert.ok(Math.abs(pose.position[1] - instance[13] - 8.15) < .001);
    assert.equal(Math.sign(pose.target[2] - pose.position[2]), sign);
    assert.ok(pose.target[1] < pose.position[1]);
  }
});

test('non-seat and invalid instance hits cannot enter a seat', () => {
  assert.equal(api.seatAt({object: {userData: {}}}), null);
  assert.equal(api.seatAt({object: {userData: {seats: [{}]}}, instanceId: -1}), null);
  assert.equal(api.seatAt({object: {userData: {seats: [{}]}}, instanceId: 20}), null);
});

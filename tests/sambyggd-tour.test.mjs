import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { stations, getNextStation } from '../app/verkefni/sambyggd-20/tour-data.ts';

const assetRoot = join(process.cwd(), 'public', 'projects', 'sambyggd-20');

test('every stop has an authentic listing image and a usable floor-plan position', () => {
  assert.ok(stations.length >= 6);
  for (const station of stations) {
    assert.ok(existsSync(join(assetRoot, station.image.split('/').at(-1))), `${station.id} image missing`);
    assert.ok(station.planX >= 0 && station.planX <= 100);
    assert.ok(station.planY >= 0 && station.planY <= 100);
    assert.ok(station.alt.length > 20);
  }
});

test('walkthrough moves forwards and backwards through every listed stop', () => {
  const visited = new Set();
  let current = stations[0].id;
  for (let i = 0; i < stations.length; i++) {
    visited.add(current);
    current = getNextStation(current, 1).id;
  }
  assert.equal(visited.size, stations.length);
  assert.equal(current, stations[0].id);
  assert.equal(getNextStation(stations[0].id, -1).id, stations.at(-1).id);
});

test('no photograph is presented as a verified photograph of apartment 0305', () => {
  assert.ok(stations.every((station) => station.provenance === 'listing-reference-0105'));
});

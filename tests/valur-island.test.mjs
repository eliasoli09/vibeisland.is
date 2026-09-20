import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const path=new URL('../public/projects/vallaeyjar/valur-blender.json',import.meta.url);
test('Valur is shipped as a Blender island with all 1200 seat viewpoints',()=>{
 assert.ok(existsSync(path),'Valur package must be shipped');
 const pkg=JSON.parse(readFileSync(path));
 assert.equal(pkg.name,'Hlíðarendi · Valur');
 assert.equal(pkg.stadium.model.metadata.source,'Blender');
 const context={window:{}};vm.runInNewContext(readFileSync(new URL('../public/projects/vallaeyjar/blender-model.js',import.meta.url),'utf8'),context);
 const api=context.window.BlenderStadium,model=pkg.stadium.model;
 const entries=[...api.seatCatalog(model).values()].flat();
 assert.equal(entries.length,1200);assert.equal(new Set(entries.map(s=>s.label)).size,1200);
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,500,7,-200,1];
 for(const batch of model.batches.filter(b=>b.seats))batch.seats.forEach((seat,i)=>{
  const pose=api.seatPose(batch.matrices[i],identity,seat);
  assert.ok(Math.abs(pose.position[1]-batch.matrices[i][13]-8.15)<1e-5);
  assert.ok(Math.abs(pose.position[2]-batch.matrices[i][14]+200+.03)<1e-5);
  assert.ok(Math.abs(pose.target[0]-500)<1e-4);
  assert.ok(Math.abs(pose.target[1]-8)<1e-4);
  assert.ok(Math.abs(pose.target[2]+200)<1e-4);
 });
 assert.ok(!model.metadata.source_objects.some(n=>/^(Site|Context |Adjacent pitch|South service road|Eastern road|North forecourt)/.test(n)));
});

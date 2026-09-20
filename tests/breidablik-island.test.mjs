import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const asset=name=>new URL('../public/projects/vallaeyjar/'+name,import.meta.url);
const context={window:{}};vm.runInNewContext(readFileSync(asset('blender-model.js'),'utf8'),context);const api=context.window.BlenderStadium;
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
test('Breidablik island G preserves 1733 selectable Blender seats in both stands',()=>{
 assert.ok(existsSync(asset('breidablik-blender.json')),'Breidablik package missing');
 const pkg=JSON.parse(readFileSync(asset('breidablik-blender.json'))),m=pkg.stadium.model;
 assert.equal(m.metadata.island_label,'G');assert.equal(m.metadata.source,'Blender');
 const seats=[...api.seatCatalog(m).values()].flat();assert.equal(seats.length,1733);assert.equal(new Set(seats.map(s=>s.id)).size,1733);
 assert.equal(seats.filter(s=>s.stand==='west').length,1364);assert.equal(seats.filter(s=>s.stand==='east').length,369);
 const island=[0,0,-1,0,0,1,0,0,1,0,0,0,400,7,-200,1];
 for(const b of m.batches.filter(b=>b.seats))for(let i=0;i<b.seats.length;i++){
  const pose=api.seatPose(b.matrices[i],island,b.seats[i]);
  assert.ok(Math.abs(pose.position[1]-b.matrices[i][13]-8.15)<1e-5);
  assert.ok(Math.abs(pose.target[0]-400)<1e-4);assert.ok(Math.abs(pose.target[1]-8)<1e-4);assert.ok(Math.abs(pose.target[2]+200)<1e-4);
 }
 assert.ok(!m.metadata.source_objects.some(n=>/^(Site|Context|Training field|Parked car)/.test(n)));
});
test('explicit seat offsets are supported and malformed values are rejected',()=>{
 const seat={id:'A-01-01',label:'A · 1 · 1',stand:'west',row:1,number:1,eyeOffset:[0,1.15,0],lookOffset:[0,1,-50]};
 const m={batches:[{name:'Seats',matrices:[identity],seats:[seat]}]};assert.equal([...api.seatCatalog(m).values()].flat().length,1);
 assert.deepEqual(Array.from(api.seatPose(identity,identity,seat).target),[0,1,-50]);
 assert.throws(()=>api.seatCatalog({batches:[{matrices:[identity],seats:[{...seat,eyeOffset:[NaN,1,0]}]}]}));
});

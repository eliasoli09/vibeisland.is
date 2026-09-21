import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const asset=name=>new URL('../public/projects/vallaeyjar/'+name,import.meta.url);
const context={window:{}};
vm.runInNewContext(readFileSync(asset('blender-model.js'),'utf8'),context);
const api=context.window.BlenderStadium;
test('Laugardalsvollur preserves both stands and the shifted pitch in seated views',()=>{
 const pkg=JSON.parse(readFileSync(asset('laugardalsvollur-blender.json'))),m=pkg.stadium.model;
 assert.equal(pkg.units,'m');assert.equal(m.metadata.source,'Blender');
 const seats=[...api.seatCatalog(m).values()].flat();
 assert.equal(seats.length,9636);assert.equal(new Set(seats.map(s=>s.id)).size,9636);
 assert.equal(seats.filter(s=>s.stand==='west').length,6136);
 assert.equal(seats.filter(s=>s.stand==='east').length,3500);
 const island=[0,0,-1,0,0,1,0,0,1,0,0,0,400,7,-200,1];
 for(const b of m.batches.filter(b=>b.seats))for(let i=0;i<b.seats.length;i++){
  const pose=api.seatPose(b.matrices[i],island,b.seats[i]);
  assert.ok(Math.abs(pose.position[1]-b.matrices[i][13]-8.15)<1e-4);
  assert.ok(Math.abs(pose.target[0]-392)<1e-4);
  assert.ok(Math.abs(pose.target[1]-7.5)<1e-4);
  assert.ok(Math.abs(pose.target[2]+200)<1e-4);
 }
 assert.match(m.metadata.notes.join(' '),/áætluð/);
 let triangles=0,instances=0,vertices=0;
 for(const g of Object.values(m.geometries)){
  vertices+=g.vertices.length;
  assert.ok(g.vertices.every(v=>v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=350)));
  assert.ok(g.faces.every(f=>f.length===3&&f.every(i=>Number.isInteger(i)&&i>=0&&i<g.vertices.length)));
 }
 for(const b of m.batches){instances+=b.matrices.length;triangles+=b.matrices.length*m.geometries[b.geometry].faces.length;}
 assert.ok(vertices<=250000);assert.ok(instances<=30000);assert.ok(triangles<=2200000,`${triangles} triangles`);
 assert.ok(m.batches.length<100);
});
test('Laugardalsvollur is a public island alongside the existing grounds',()=>{
 vm.runInNewContext(readFileSync(asset('builtin-islands.js'),'utf8'),context);
 const ids=Array.from(context.window.VallaeyjarBuiltins,b=>b.id);
 for(const id of ['kaplakriki','vikingur','valur','breidablik','laugardalsvollur'])assert.ok(ids.includes(id));
 assert.equal(new Set(ids).size,ids.length);
});

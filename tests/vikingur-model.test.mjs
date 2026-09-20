import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../public/projects/vallaeyjar/blender-model.js',import.meta.url),'utf8'),context);
const api=context.window.BlenderStadium;
const read=()=>JSON.parse(readFileSync(new URL('../public/projects/vallaeyjar/vikingur-blender.json',import.meta.url))).stadium.model;
test('Vikingur is a compact Blender island with 1076 uniquely selectable source seats',()=>{
 const m=read();assert.equal(m.metadata.source,'Blender');const seats=[...api.seatCatalog(m).values()].flat();assert.equal(seats.length,1076);assert.equal(new Set(seats.map(s=>s.id)).size,1076);assert.ok(seats.some(s=>s.id==='D-05-11'));assert.ok(m.batches.length<80);assert.ok(!m.metadata.source_objects.includes('Site'));assert.ok(m.metadata.notes.join(' ').includes('ekki staðfest 1:1'));
});
test('explicit seat records reject malformed metadata',()=>{
 assert.throws(()=>api.seatCatalog({batches:[{name:'Seats',matrices:[[]],seats:[{id:'A',row:-1,number:1,label:'bad'}]}]}));
});

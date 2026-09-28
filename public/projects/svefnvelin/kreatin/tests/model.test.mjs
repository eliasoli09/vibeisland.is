import test from 'node:test';
import assert from 'node:assert/strict';
import {scenario,DOSES,DURATIONS} from '../model.js';
test('all 18 supported choices have bounded illustrative storage and evidence notes',()=>{for(const dose of DOSES)for(const t of DURATIONS){const s=scenario(dose,t.days);assert.ok(s.storage>=0&&s.storage<=1);assert.ok(s.caution);assert.equal(s.cognitiveGain,null);assert.equal(s.predictedKg,null);}});
test('higher doses do not produce endless storage or hypertrophy',()=>{for(const d of DOSES){assert.equal(scenario(d,365).storage,scenario(d,180).storage);assert.equal(scenario(d,365).growth,scenario(d,180).growth);}assert.equal(scenario(5,90).growth,scenario(20,90).growth);});
test('long high-dose scenario is explicit and is not converted to maintenance',()=>{const s=scenario(20,365);assert.equal(s.dose,20);assert.match(s.caution,/20 g/);assert.equal(s.highDose,true);});
test('invalid scenarios are rejected rather than silently interpolated',()=>{assert.throws(()=>scenario(15,7));assert.throws(()=>scenario(5,-7));});

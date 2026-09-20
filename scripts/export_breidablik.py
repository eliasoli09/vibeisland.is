"""Convert the evaluated Blender delivery JSON to the portable Vallaeyjar format.
Usage: python3 scripts/export_breidablik.py /path/to/Breidablik_Blender
The source JSON is exported by build.py from the saved Blender scene.
"""
import sys,json,pathlib,hashlib,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path(sys.argv[1]);src=json.loads((SOURCE/'viewer/model.json').read_text())
I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
C=[1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1]
CI=[1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1]
def mul(a,b):return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def point(m,p):return [round(sum(m[c*4+r]*p[c] for c in range(3))+m[12+r],6) for r in range(3)]
def srgb(v):return 12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055
materials={};matkeys={}
for n,color in src['materials'].items():
 k='mat_'+str(len(materials));matkeys[n]=k;materials[k]=['#'+''.join(f'{min(255,max(0,round(srgb(v)*255))):02x}' for v in color),.7,0]
seats={s['mesh']:s for s in src['seats']};geos={};batches=[];static={};repeated={};names=[]
def group(m):
 n=m['name']
 if m['roof']:return 'roof'
 if n in seats:return 'main_stand' if seats[n]['stand']=='west' else 'small_stand'
 if n.startswith(('East','Old')):return 'small_stand'
 if n.startswith(('Goal','Corner flag','Green pennant')):return 'goals'
 if n.startswith(('Turf','Playing','Touchlines','Halfway','Centre','Box','Penalty','Spot','Corner arc','Track','Six lane','Lane','Extended sprint','Finish','Tartan')):return 'pitch'
 if n.startswith(('Advertising','Club panel','Scoreboard','North scoreboard')):return 'advertising'
 if any(w in n.lower() for w in ['west tier','portal','hospitality','rear','front tunnel','lower level','aisle','white sloping','handrail','external','guardrail','understand','stair','stadium identity','seat pedestal']):return 'main_stand'
 return 'surroundings'
for m in src['meshes']:
 if m['name']=='Site' or m['name'].startswith(('Context','Training field','Fifan','East parking','South parking','Dalsmari','Parking bay','Parked car','Car glazing','Tree trunks')):continue
 names.append(m['name']);g=src['geometries'][m['geo']];layer=group(m);mat=matkeys[m['mat']];seat=seats.get(m['name']);matrix=mul(mul(C,m['matrix']),CI)
 if seat:
  key=(m['geo'],mat)
  if key not in repeated:
   k='geom_'+str(len(geos));geos[k]={'vertices':[point(C,g['v'][i:i+3]) for i in range(0,len(g['v']),3)],'faces':[g['i'][i:i+3] for i in range(0,len(g['i']),3)]}
   batch={'name':'Breidablik seats '+m['mat'],'geometry':k,'material':mat,'group':layer,'smooth':True,'matrices':[],'seats':[]};repeated[key]=batch;batches.append(batch)
  b=repeated[key];b['matrices'].append(matrix)
  delta=[-matrix[12],1-matrix[13],-matrix[14]]
  look=[round(sum(matrix[c*4+r]*delta[r] for r in range(3)),6) for c in range(3)]
  title='Vesturstúka' if seat['stand']=='west' else 'Austurstúka'
  b['seats'].append({'id':seat['id'],'stand':seat['stand'],'row':seat['row'],'number':seat['number'],'label':f"{title} {seat['section']} · röð {seat['row']} · sæti {seat['number']}",'eyeOffset':[0,1.15,0],'lookOffset':look})

 else:
  key=(layer,mat)
  if key not in static:
   k='geom_'+str(len(geos));geos[k]={'vertices':[],'faces':[]};static[key]=k;batches.append({'name':layer+' '+m['mat'],'geometry':k,'material':mat,'group':layer,'smooth':False,'matrices':[I]})
  dest=geos[static[key]];off=len(dest['vertices']);transform=mul(C,m['matrix']);dest['vertices'] += [point(transform,g['v'][i:i+3]) for i in range(0,len(g['v']),3)];dest['faces'] += [[off+x for x in g['i'][i:i+3]] for i in range(0,len(g['i']),3)]
notes=['Eyja G · Kópavogsvöllur, heimavöllur Breiðabliks. Blender-endurgerð úr myndum og kortagögnum; ekki staðfest 1:1 uppmæling.', '1.733 valanleg sæti: A–F í vesturstúku, G–H í austurstúku. Sætaraðir, þrep og númer eru áætluð; ekki opinbert miðasölukort.', 'Leikflötur 105 × 68 m. Augnhæð 1,15 m yfir gólfi raðar; þak, handrið og skýli eru sýnileg úr sæti. Mannfjöldi er ekki með.', 'Myndviðmið: Mansard / StadiumDB 2010 og Nordic Stadiums 2017. Kortagögn © OpenStreetMap contributors, ODbL. Nærumhverfi er einfaldað á eyjunni. Heimildir: /projects/vallaeyjar/breidablik-sources.html']

model={'metadata':{'island_label':'G','name':'Kópavogsvöllur · Breiðablik','source':'Blender','source_blend_sha256':hashlib.sha256((SOURCE/'Kopavogsvollur.blend').read_bytes()).hexdigest(),'assumed_pitch_m':[105,68],'seat_count_model':len(seats),'source_objects':names,'notes':notes},'materials':materials,'geometries':geos,'batches':batches}
pkg={'format':'stadium-islands','version':1,'name':'Kópavogsvöllur · Breiðablik','author':'Vibe Ísland','description':'Eyja G · Heimavöllur Breiðabliks með 1.733 smellanlegum sætum í tveimur stúkum. Mynd- og kortabyggð endurgerð í Blender; sætaskipan að hluta áætluð.','units':'m','island':{'radius':115,'groundColor':'#48633d','rockColor':'#302e36','edgeColor':'#4ade80'},'stadium':{'type':'mesh','model':model}}
out=ROOT/'public/projects/vallaeyjar/breidablik-blender.json';out.write_text(json.dumps(pkg,ensure_ascii=False,separators=(',',':')))
print(out,len(batches),'batches',len(seats),'seats',out.stat().st_size,'bytes')

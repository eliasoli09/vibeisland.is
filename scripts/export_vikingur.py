"""Convert the evaluated Blender delivery JSON to the portable Vallaeyjar format.
Usage: python3 scripts/export_vikingur.py /path/to/Vikingsvollur_Blender
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
 if n.startswith(('Seat_','Terrace','Sloping','Rear wall','Aisle','Front safety')):return 'main_stand'
 if n.startswith(('Commentary','Cabin')):return 'booth'
 if n.startswith(('Open concrete','Timber')):return 'small_stand'
 if n.startswith(('Rear banner','Banner lettering','Perimeter board','End board')):return 'advertising'
 if n.startswith(('Goal','Corner flag','Red pennant')):return 'goals'
 if n.startswith(('Turf band','OSM outer','Playing area','Touchlines','Halfway','Centre','Box','Penalty','Spot','Corner arc')):return 'pitch'
 return 'surroundings'
for m in src['meshes']:
 if m['name']=='Site' or m['name'].startswith('Adjacent field'):continue
 names.append(m['name']);g=src['geometries'][m['geo']];layer=group(m);mat=matkeys[m['mat']];seat=seats.get(m['name']);matrix=mul(mul(C,m['matrix']),CI)
 if seat:
  key=(m['geo'],mat)
  if key not in repeated:
   k='geom_'+str(len(geos));geos[k]={'vertices':[point(C,g['v'][i:i+3]) for i in range(0,len(g['v']),3)],'faces':[g['i'][i:i+3] for i in range(0,len(g['i']),3)]}
   batch={'name':'Vikin seats '+m['mat'],'geometry':k,'material':mat,'group':layer,'smooth':True,'matrices':[],'seats':[]};repeated[key]=batch;batches.append(batch)
  b=repeated[key];b['matrices'].append(matrix);b['seats'].append({'id':seat['id'],'stand':'east','row':seat['row'],'number':seat['number'],'label':f"Austurstúka {seat['section']} · röð {seat['row']} · sæti {seat['number']}",'eyeOffset':[0,1.15,-.03],'lookOffset':[-seat['eye'][0],1-seat['floor'],seat['eye'][1]-.03]})
 else:
  key=(layer,mat)
  if key not in static:
   k='geom_'+str(len(geos));geos[k]={'vertices':[],'faces':[]};static[key]=k;batches.append({'name':layer+' '+m['mat'],'geometry':k,'material':mat,'group':layer,'smooth':False,'matrices':[I]})
  dest=geos[static[key]];off=len(dest['vertices']);transform=mul(C,m['matrix']);dest['vertices'] += [point(transform,g['v'][i:i+3]) for i in range(0,len(g['v']),3)];dest['faces'] += [[off+x for x in g['i'][i:i+3]] for i in range(0,len(g['i']),3)]
notes=['Endurgerð í metrakvarða úr Blender, ljósmyndum og OpenStreetMap; ekki staðfest 1:1 uppmæling.', '1.076 valanleg sæti í áætlaðri skipan. Sætanúmer A–E eru auðkenni líkansins, ekki miðasölunúmer.', 'Leikflötur 105 × 68 m, þrephæðir og augnhæð eru áætluð. Opna suðurstúkan hefur ómerkt bekki.', 'Myndviðmið: Reykjavíkurborg 7. maí 2026, Nordic Stadiums 2022 og Groundhopping.se 2013. Kortagögn © OpenStreetMap contributors, ODbL.']
model={'metadata':{'name':'Víkingsvöllur','source':'Blender','source_blend_sha256':hashlib.sha256((SOURCE/'Vikingsvollur.blend').read_bytes()).hexdigest(),'assumed_pitch_m':[105,68],'seat_count_model':len(seats),'source_objects':names,'notes':notes},'materials':materials,'geometries':geos,'batches':batches}
pkg={'format':'stadium-islands','version':1,'name':'Víkingsvöllur','author':'Vibe Ísland','description':'Víkin í Fossvogi · Blender-endurgerð með smellanlegum sætum. Mál og sætaskipan eru áætluð.','units':'m','island':{'radius':130,'groundColor':'#48633d','rockColor':'#302e36','edgeColor':'#e43e55'},'stadium':{'type':'mesh','model':model}}
out=ROOT/'public/projects/vallaeyjar/vikingur-blender.json';out.write_text(json.dumps(pkg,ensure_ascii=False,separators=(',',':')))
print(out,len(batches),'batches',len(seats),'seats',out.stat().st_size,'bytes')

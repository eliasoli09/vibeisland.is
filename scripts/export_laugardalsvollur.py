"""Run Blender -b SOURCE.blend --python this script; source remains unchanged."""
import bpy, json, pathlib, hashlib
from mathutils import Matrix, Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/projects/vallaeyjar/laugardalsvollur-blender.json'
C=Matrix(((0,1,0,0),(0,0,1,0),(1,0,0,0),(0,0,0,1)))
I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
materials={};details={};geometries={};batches=[];static={};shared={};seat_cache={}
objects=[o for o in bpy.context.scene.objects if o.type in ('MESH','CURVE','FONT') and not o.hide_render and o.users_collection[0].name[:2] in ('01','02','03','04','05','06')]
def group(o):
 c=o.users_collection[0].name[:2]
 if c=='04':return 'main_stand' if o['stand']=='WEST' else 'small_stand'
 return {'01':'pitch','02':'main_stand','03':'small_stand','05':'roof','06':'goals'}[c]
def material(mat):
 mat=bpy.data.materials[mat.name]
 key='m'+str(list(bpy.data.materials).index(mat))
 if key not in materials:
  shader=mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
  color=shader.inputs['Base Color'].default_value if shader else mat.diffuse_color
  srgb=lambda v:12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055
  materials[key]=['#'+''.join(f'{max(0,min(255,round(srgb(v)*255))):02x}' for v in color[:3]),float(shader.inputs['Roughness'].default_value) if shader else .7,float(shader.inputs['Metallic'].default_value) if shader else 0]
  details[key]={'name':mat.name}
 return key
def append(dest,mesh,faces,transform):
 indices=sorted({v for t in faces for v in t.vertices});offset=len(dest['vertices']);mapping={v:i+offset for i,v in enumerate(indices)}
 dest['vertices'].extend([[round(x,6) for x in transform@mesh.vertices[v].co] for v in indices])
 dest['faces'].extend([[mapping[v] for v in t.vertices] for t in faces])
def matrix(m):return [round(m[r][c],7) for c in range(4) for r in range(4)]
# A single cached mesh per chair colour keeps the export and browser efficient.
for ob in objects:
 if not ob.get('is_seat') or ob.data.name in seat_cache:continue
 temp=bpy.data.objects.new('Export chair LOD',ob.data.copy());bpy.context.collection.objects.link(temp)
 mod=temp.modifiers.new('Browser chair simplification','DECIMATE');mod.ratio=.32
 evaluated=temp.evaluated_get(bpy.context.evaluated_depsgraph_get());seat_cache[ob.data.name]=bpy.data.meshes.new_from_object(evaluated)
 bpy.data.objects.remove(temp,do_unlink=True)
deps=bpy.context.evaluated_depsgraph_get()
for ob in objects:
 layer=group(ob);is_seat=bool(ob.get('is_seat'))
 evaluated=None
 if is_seat:mesh=seat_cache[ob.data.name]
 else:
  evaluated=ob.evaluated_get(deps);mesh=evaluated.to_mesh()
 if not mesh:continue
 mesh.calc_loop_triangles()
 seat_attached=False
 for mi,mat in enumerate(mesh.materials):
  if mat is None:continue
  faces=[t for t in mesh.loop_triangles if t.material_index==mi]
  if not faces:continue
  mk=material(mat)
  if is_seat:
   key=(ob.data.name,mi,layer)
   if key not in shared:
    g='g'+str(len(geometries));geometries[g]={'vertices':[],'faces':[]};append(geometries[g],mesh,faces,C)
    b={'name':f'{layer} | {mat.name}','geometry':g,'material':mk,'group':layer,'smooth':False,'matrices':[]}
    shared[key]=b;batches.append(b)
   b=shared[key];b['matrices'].append(matrix(C@ob.matrix_world@C.inverted()))
   if not seat_attached:
    stand='Vesturstúka' if ob['stand']=='WEST' else 'Austurstúka'
    b.setdefault('seats',[]).append({'id':ob['id'],'stand':ob['stand'].lower(),'row':int(ob['row']),'number':int(ob['number']),
     'label':f'{stand} · {ob["block"]} · röð {ob["row"]} · sæti {ob["number"]}',
     'eyeOffset':[0,1.15,0],'lookOffset':[round(v,6) for v in C@(ob.matrix_world.inverted()@Vector((-8,0,.5)))]})
    seat_attached=True
  else:
   key=(layer,mk)
   if key not in static:
    g='g'+str(len(geometries));geometries[g]={'vertices':[],'faces':[]};static[key]=g
    batches.append({'name':f'{layer} | {mat.name}','geometry':g,'material':mk,'group':layer,'smooth':False,'matrices':[I]})
   append(geometries[static[key]],mesh,faces,C@ob.matrix_world)
 if evaluated:evaluated.to_mesh_clear()
metadata={'name':'Laugardalsvöllur','source':'Blender','source_blend_sha256':hashlib.sha256(pathlib.Path(bpy.data.filepath).read_bytes()).hexdigest(),
 'seat_count_model':9636,'assumed_pitch_m':[105,68],'source_objects':[o.name for o in objects],
 'attribution':'Ljósmyndaviðmið: Quintin Soloviev (CC BY 4.0), StadiumDB/Jörg Pochert, Vísir/Anton Brink. Skipulagsgögn Reykjavíkurborgar og KSÍ.',
 'notes':['Ljósmyndabyggt Blender-líkan í metrakvarða. Leikflötur sýndur eftir breytingar 2025, færður 8 m til vesturs.',
 'Stúkur, hæðir og sætaskipan eru áætluð. Sætisnúmer eru auðkenni líkansins, ekki opinber miðasölunúmer. Þetta er ekki landmælt 1:1 afrit.',
 '9.636 sæti í líkaninu. Augnhæð 1,15 m yfir þrepi. Sæti eru létt fyrir vafra og ytra umhverfi sleppt.'],
 'sources_url':'./laugardalsvollur-sources.html'}
pkg={'format':'stadium-islands','version':1,'name':'Laugardalsvöllur','author':'Vibe Ísland','description':'Laugardalsvöllur á svífandi eyju með útsýni úr 9.636 sætum. Ljósmyndabyggð nálgun í metrakvarða.','units':'m',
 'island':{'radius':140,'groundColor':'#56704d','rockColor':'#393847','edgeColor':'#8fb9ff'},
 'stadium':{'type':'mesh','model':{'metadata':metadata,'materials':materials,'materialDetails':details,'geometries':geometries,'batches':batches}}}
OUT.write_text(json.dumps(pkg,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'bytes':OUT.stat().st_size,'objects':len(objects),'batches':len(batches),'vertices':sum(len(g['vertices']) for g in geometries.values()),'triangles':sum(len(geometries[b['geometry']]['faces'])*len(b['matrices']) for b in batches)},indent=2),flush=True)

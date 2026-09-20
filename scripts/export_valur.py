"""Run in Blender with the delivered .blend open. Does not save or alter that file."""
import bpy, bmesh, json, pathlib, collections, math, base64, hashlib
from mathutils import Matrix, Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/projects/vallaeyjar/valur-blender.json'
ROT = Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
deps = bpy.context.evaluated_depsgraph_get()

def group(ob):
    col = ob.users_collection[0].name[:2]
    if col == '01': return 'pitch'
    if col == '02': return 'pitch' if ob.type != 'MESH' or any(x in ob.name for x in ('Touchlines','Halfway','circle','Box','arc','Spot')) else 'goals'
    if col in ('03','04','05','07'): return 'main_stand'
    if col == '06': return 'roof'
    if col == '08':
        if any(x in ob.name for x in ('board','lettering','Scoreboard')): return 'advertising'
        if 'camera' in ob.name.lower(): return 'booth'
        return 'surroundings'
    return 'surroundings'

def include(ob):
    return (ob.type in ('MESH','CURVE','FONT') and not ob.hide_render
            and ob.users_collection[0].name[:2] != '09'
            and ob.name != 'Site')

objects = [o for o in bpy.context.scene.objects if include(o)]
uses = collections.Counter(o.data.name for o in objects if o.type == 'MESH')
materials, material_details, geometries, batches = {}, {}, {}, []
static, repeated, shared_geometry = {}, {}, {}

def srgb(v):
    return 12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055

def material(mat):
    mat = bpy.data.materials[mat.name]
    key = 'mat_' + str(list(bpy.data.materials).index(mat))
    if key in materials: return key
    shader = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
    color = list(mat.diffuse_color[:3])
    if shader:
        color = list(shader.inputs['Base Color'].default_value[:3])
        mixes = [n for n in mat.node_tree.nodes if n.type == 'MIX_RGB' and n.blend_type == 'MIX']
        if mixes: color = [(mixes[0].inputs[1].default_value[i]+mixes[0].inputs[2].default_value[i])/2 for i in range(3)]
    hexcolor = '#' + ''.join(f'{max(0,min(255,round(srgb(v)*255))):02x}' for v in color)
    rough = float(shader.inputs['Roughness'].default_value) if shader else .7
    metal = float(shader.inputs['Metallic'].default_value) if shader else 0
    materials[key] = [hexcolor, rough, metal]
    detail = {'name':mat.name,'opacity':float(mat.diffuse_color[3])}
    if 'Natural turf' in mat.name: detail['surface']='turf'
    elif 'grass' in mat.name.lower(): detail['surface']='grass'
    if 'Official FH crest' in mat.name:
        image = next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE')
        detail['image']='data:image/png;base64,'+base64.b64encode(bytes(image.packed_file.data)).decode()
        detail['alphaTest']=.25
    material_details[key]=detail
    return key

def matrix_values(m):
    return [round(m[row][col],7) for col in range(4) for row in range(4)]

def append_geometry(dest, mesh, faces, transform, with_uv=False):
    # Vertex positions stay shared within each material; flat shading is per batch.
    selected = sorted({i for tri in faces for i in tri.vertices})
    offset = len(dest['vertices']); indices = {old:offset+i for i,old in enumerate(selected)}
    for i in selected:
        p=transform @ mesh.vertices[i].co
        dest['vertices'].append([round(v,6) for v in p])
    dest['faces'].extend([[indices[v] for v in t.vertices] for t in faces])
    if with_uv:
        uv_by_vertex={}
        for tri in faces:
            for loop in tri.loops: uv_by_vertex[mesh.loops[loop].vertex_index]=mesh.uv_layers.active.data[loop].uv
        dest.setdefault('uvs',[]).extend([[round(float(x),6) for x in uv_by_vertex.get(i,(0,0))] for i in selected])

for ob in objects:
    layer = group(ob)
    is_shared = ob.type=='FONT' or (ob.type=='MESH' and uses[ob.data.name] > 3 and not ob.modifiers)
    shared_name = (ob.data.body,ob.data.extrude,ob.data.align_x,ob.data.align_y,ob.data.font.name) if ob.type=='FONT' else ob.data.name
    font_scale = Matrix.Diagonal((ob.data.size,ob.data.size,1,1)) if ob.type=='FONT' else Matrix.Identity(4)
    evaluated = ob.evaluated_get(deps)
    mesh = evaluated.to_mesh()
    if not mesh: continue
    if ob.name.startswith(('South seat R','North seat R','North end short row','Team bench seat')):
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.dissolve_limit(bm,angle_limit=.045,verts=list(bm.verts),edges=list(bm.edges),delimit={'MATERIAL'})
        bm.to_mesh(mesh);bm.free();mesh.update()
    mesh.calc_loop_triangles()
    for mat_index, mat in enumerate(mesh.materials):
        if mat is None: continue
        mat_key = material(mat)
        faces=[t for t in mesh.loop_triangles if t.material_index==mat_index]
        # Retain 40% of individual leaves at browser pixel sizes.
        if ob.name.startswith('Detailed birch'):
            faces=[t for t in faces if (min(t.vertices)//6)%5<2]
        if not faces: continue
        smooth = ob.name.startswith('Seat_')
        with_uv = 'image' in material_details[mat_key] and mesh.uv_layers.active is not None
        if is_shared:
            key = (shared_name,mat_key,layer,smooth)
            if key not in repeated:
                geometry_key=(shared_name,mat_index,smooth)
                if geometry_key not in shared_geometry:
                    geo_key='geom_'+str(len(geometries))
                    data={'vertices':[],'faces':[]}
                    append_geometry(data,mesh,faces,ROT @ font_scale.inverted(),with_uv)
                    geometries[geo_key]=data;shared_geometry[geometry_key]=geo_key
                geo_key=shared_geometry[geometry_key]
                batch={'name':ob.name[:100],'geometry':geo_key,'material':mat_key,'group':layer,'smooth':smooth,'matrices':[]}
                repeated[key]=batch;batches.append(batch)
            repeated[key]['matrices'].append(matrix_values(ROT @ ob.matrix_world @ font_scale @ ROT.inverted()))
            if 'seat_id' in ob:
                section,row,number=ob['seat_id'].split('-')
                repeated[key].setdefault('seats',[]).append({'id':ob['seat_id'],'stand':'east','section':section,'row':int(row),'number':int(number),
                    'label':f'Hluti {section} · röð {int(row)} · sæti {int(number)}',
                    'eyeOffset':[0,1.15,-.03],'lookOffset':[-ob.location.x,1-ob.location.z,ob.location.y]})
        else:
            key=(layer,mat_key,smooth,with_uv)
            if key not in static:
                geo_key='geom_'+str(len(geometries))
                geometries[geo_key]={'vertices':[],'faces':[]}
                static[key]=geo_key
                batches.append({'name':(layer+' | '+mat.name)[:100],'geometry':geo_key,'material':mat_key,'group':layer,'smooth':smooth,'matrices':[IDENTITY]})
            append_geometry(geometries[static[key]],mesh,faces,ROT @ ob.matrix_world,with_uv)
    evaluated.to_mesh_clear()

metadata={'name':'Hlíðarendi · Valur','source':'Blender',
    'source_blend_sha256':hashlib.sha256(pathlib.Path(bpy.data.filepath).read_bytes()).hexdigest(),
    'assumed_pitch_m':[105,68],'seat_count_model':1200,'source_objects':[o.name for o in objects],
    'attribution':'© OpenStreetMap contributors, ODbL. Ljósmyndaviðmið: Groundhopping.se (2012), Nordic Stadiums (2017), Kevin Schimka / Europlan (2023).',
    'notes':['Endurgerð í metrakvarða úr Blender, byggð á netmyndum og kortagögnum. Ekki fullstaðfest 1:1 líkan.',
             'Fjórir hlutar, 12 raðir og 25 sæti í hverri röð eru áætluð skipan. Númerin eru ekki opinber miðasölunúmer.',
             'Augnhæð er 1,15 m yfir gólfi raðar. Þak, handrið og skýli hafa áhrif á útsýnið; mannfjöldi er ekki með.',
             'Umhverfi utan vallar og íþróttahúss er fjarlægt fyrir eyjuna. Heimildir: /projects/vallaeyjar/valur-sources.html']}
pkg={'format':'stadium-islands','version':1,'name':'Hlíðarendi · Valur','author':'Vibe Ísland',
 'description':'N1-völlurinn á Hlíðarenda. Mynd- og kortabyggt Blender-líkan með 1.200 valanlegum sætum; mál og sætaskipan að hluta áætluð.',
 'units':'m','island':{'radius':115,'groundColor':'#426742','rockColor':'#40323b','edgeColor':'#ed4964'},
 'stadium':{'type':'mesh','model':{'metadata':metadata,'materials':materials,'materialDetails':material_details,'geometries':geometries,'batches':batches}}}
OUT.write_text(json.dumps(pkg,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'bytes':OUT.stat().st_size,'objects':len(objects),'batches':len(batches),'seats':sum(len(b.get('seats',[])) for b in batches),'vertices':sum(len(g['vertices']) for g in geometries.values())}),flush=True)

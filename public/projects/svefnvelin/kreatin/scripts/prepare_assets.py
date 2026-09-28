from pathlib import Path
import json,struct,array,shutil,gzip,argparse
parser=argparse.ArgumentParser(description='Rebuild the packaged geometry from the original anatomy reference package.')
parser.add_argument('anatomy',type=Path,help='Path to the original anatomy directory')
src=parser.parse_args().anatomy
out=Path(__file__).resolve().parents[1]/'assets'
a=json.loads((src/'sources/human-atlas-models/atlas.json').read_text());chunks={}
manifest={'source':'BodyParts3D 4.0 / Human Atlas 1c38bf35c254a891200d3cedecfd57abebe83d8d','license':'CC BY 4.0','groups':[]}
for group in ['muscular','skeletal','brain']:
 parts=[p for p in a['parts'] if p['system']==group or (group=='brain' and p['system']=='nervous' and int(''.join(c for c in p['id'] if c.isdigit()))>=1732 and p['bounds'][0][1]>1.43)]
 pos=array.array('f');norm=array.array('f');idx=array.array('I');records=[]
 for p in parts:
  c=p['chunk']
  if c not in chunks:chunks[c]=(src/'sources/human-atlas-models'/f'body-{c}.bin').read_bytes()
  b=chunks[c];n=p['vertexCount'];base=len(pos)//3
  pos.extend(struct.unpack_from('<'+str(n*3)+'f',b,p['positions']))
  norm.extend(v/32767 for v in struct.unpack_from('<'+str(n*3)+'h',b,p['normals']))
  idx.extend(v+base for v in struct.unpack_from('<'+str(p['indexCount'])+'I',b,p['indices']))
  records.append({'id':p['id'],'name':p['name'],'start':base,'count':n,'bounds':p['bounds']})
 blob=pos.tobytes()+norm.tobytes()+idx.tobytes();(out/f'{group}.dat').write_bytes(gzip.compress(blob,compresslevel=6,mtime=0))
 manifest['groups'].append({'name':group,'vertices':len(pos)//3,'indices':len(idx),'bytes':len(blob),'parts':records})
 print(group,len(parts),len(blob))
(out/'anatomy.json').write_text(json.dumps(manifest))
shutil.copy(src/'sources/HUMAN_ATLAS_ATTRIBUTION.md',out/'ATTRIBUTION.md')
shutil.copy(src/'renders/male_front.png',out/'body-fallback.png')

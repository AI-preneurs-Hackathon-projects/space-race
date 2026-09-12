"""Dependency-free verification of the emitted binary GLBs; Python 3.10+."""
import argparse,json,struct,math
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('directory',nargs='?',default='public/models');p.add_argument('--report',default='assets/blender/asset-report.json');p.add_argument('--output');args=p.parse_args()
root=Path(args.directory);report=json.loads(Path(args.report).read_text());results={}
expected={'hull_armor','hull_secondary','accent','structural','vent','gunmetal','cockpit_frame','canopy','engine_nozzle','engine_core'}
for asset,source in report['assets'].items():
    path=root/(asset+'.glb');raw=path.read_bytes()
    magic,version,total=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and total==len(raw)
    n,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
    gltf=json.loads(raw[20:20+n]);binlen,binkind=struct.unpack_from('<II',raw,20+n)
    assert binkind==0x004e4942
    blob=raw[28+n:28+n+binlen]
    primitives=[q for m in gltf['meshes'] for q in m['primitives']]
    triangles=sum(gltf['accessors'][q['indices']]['count']//3 for q in primitives)
    assert triangles==source['triangles']
    for q in primitives:
        for semantic in ('POSITION','NORMAL'):
            ac=gltf['accessors'][q['attributes'][semantic]];view=gltf['bufferViews'][ac['bufferView']]
            assert ac['componentType']==5126 and ac['type']=='VEC3'
            stride=view.get('byteStride',12);base=view.get('byteOffset',0)+ac.get('byteOffset',0)
            for i in range(ac['count']):
                xyz=struct.unpack_from('<3f',blob,base+i*stride)
                assert all(math.isfinite(v) for v in xyz)
                if semantic=='NORMAL':assert .98<sum(v*v for v in xyz)<1.02
    markers={n['name']:n.get('translation',[0,0,0]) for n in gltf['nodes'] if n.get('name','').startswith('exhaust_')}
    if asset.startswith('asteroid'):
        assert triangles<=12000 and len(primitives)==1
        assert 'COLOR_0' in primitives[0]['attributes']
        assert len(gltf['images'])==1 and 'bufferView' in gltf['images'][0]
        assert source['max_radius']<=1.000001
    else:
        assert triangles<=22000 and len(primitives)==10
        assert {m['name'] for m in gltf['materials']}==expected
        assert len(markers)==(3 if asset=='atlas' else 2)
        assert all(v[2]>2.4 for v in markers.values()),'Nozzles must point aft at +Z in glTF'
    results[asset]={'triangles':triangles,'draw_primitives':len(primitives),'materials':len(gltf['materials']),'embedded_images':len(gltf.get('images',[])),'exhaust_nodes_glb_xyz':markers,'bytes':len(raw),'status':'PASS'}
if args.output:Path(args.output).write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))

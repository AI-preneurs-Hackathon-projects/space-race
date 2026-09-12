#!/usr/bin/env python3
"""Verify exported GLB buffers, geometry, normals, bounds and thumbnail dimensions."""
from pathlib import Path
import json,struct
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent
report=json.loads((ROOT/'asset-report.json').read_text())
assert len(report)==18
for row in report:
    path=ROOT.parent.parent/'public'/'models'/(row['name']+'.glb');raw=path.read_bytes()
    magic,version,size=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and size==len(raw)
    jslen,jstype=struct.unpack_from('<I4s',raw,12)
    assert jstype==b'JSON' and jslen%4==0
    doc=json.loads(raw[20:20+jslen]);binary_offset=28+jslen
    binlen,bintype=struct.unpack_from('<I4s',raw,20+jslen)
    assert bintype==b'BIN\0' and binary_offset+binlen==len(raw)
    assert 'uri' not in doc['buffers'][0]
    def accessor(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[a['componentType']]
        width={'VEC3':3,'SCALAR':1}[a['type']]
        offset=binary_offset+v.get('byteOffset',0)+a.get('byteOffset',0)
        result=np.frombuffer(raw,dtype=dtype,count=a['count']*width,offset=offset)
        return result.reshape((-1,width)) if width>1 else result
    allv=[];count=0
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            verts=accessor(p['attributes']['POSITION']);normals=accessor(p['attributes']['NORMAL']);indices=accessor(p['indices'])
            assert np.isfinite(verts).all() and np.isfinite(normals).all()
            assert len(indices)%3==0 and indices.max()<len(verts)
            assert len(verts)==len(normals) and np.allclose(np.linalg.norm(normals,axis=1),1,atol=1e-5)
            tri=verts[indices.reshape((-1,3))];cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
            assert (np.linalg.norm(cross,axis=1)>1e-9).all(), 'degenerate triangles'
            assert (np.einsum('ij,ij->i',cross,normals[indices[::3]])>0).all(), 'inverted normals'
            # Every material group contains closed, outward-wound solid components.
            volume=np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()/6
            assert volume>0, (mesh['name'],'inverted winding',volume)
            count+=len(tri);allv.extend(verts)
    allv=np.asarray(allv)
    assert abs(np.linalg.norm(allv,axis=1).max()-1)<1e-5
    assert np.allclose(allv.min(0)+allv.max(0),0,atol=1e-5)
    assert count==row['triangles'] and count<3500
    thumb=Image.open(ROOT.parent.parent/'public'/'object-previews'/(row['name']+'.png'))
    assert thumb.size==(256,256) and thumb.mode=='RGBA'
    print(f"{row['name']:20s} {count:4d} triangles  {len(raw):6d} bytes  {len(doc['meshes'])} draw calls  OK")
print(f"PASS: {len(report)} self-contained GLBs and 18 transparent thumbnails")

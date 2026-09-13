"""Reproducible editable encounter assets. Blender 4.3: blender -b --python this_file.

Retains original manufactured silhouettes, with attached fittings, bevels and weighted
normals. Natural bodies have coherent displaced surfaces and packed albedo/normal/
roughness maps. No destination planet geometry is authored by this script.
"""
from pathlib import Path
import sys, math, json
import bpy, bmesh, numpy as np
from mathutils import Vector, noise
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
import legacy_geometry as legacy
from hard_surface_details import enhance_model
OUT=ROOT.parent.parent/'public/models'
SOURCE=ROOT/'blender'
SOURCE.mkdir(exist_ok=True)
bpy.context.preferences.filepaths.save_version=0

def activate(o):
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def clear():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.meshes):
        if not data.users:bpy.data.meshes.remove(data)
    bpy.data.orphans_purge(do_recursive=True)

def export(name, objects):
    # Keep named source parts and modifiers editable. Export only evaluated copies.
    for o in objects:o['asset']=name
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(name+'.blend')),compress=True)
    copies=[]
    for o in objects:
        activate(o)
        c=o.copy();c.data=o.data.copy();bpy.context.collection.objects.link(c);activate(c)
        for mod in list(c.modifiers):
            kind=mod.type;bpy.ops.object.modifier_apply(modifier=mod.name)
            if kind=='BEVEL':
                bm=bmesh.new();bm.from_mesh(c.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
                tiny=[f for f in bm.faces if f.calc_area()<2e-9]
                if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
                bm.to_mesh(c.data);bm.free()
        copies.append(c)
    bpy.ops.object.select_all(action='DESELECT')
    for c in copies:c.select_set(True)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();merged=copies[0]
    points=[v.co.copy() for v in merged.data.vertices]
    center=Vector([(min(p[i] for p in points)+max(p[i] for p in points))/2 for i in range(3)])
    radius=max((p-center).length for p in points)
    for v in merged.data.vertices:v.co=(v.co-center)/radius
    merged.name=name;activate(merged)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True)
    tris=sum(len(p.vertices)-2 for p in merged.data.polygons)
    print('ASSET',name,tris,(OUT/(name+'.glb')).stat().st_size,flush=True)
    return {'name':name,'triangles':tris,'bytes':(OUT/(name+'.glb')).stat().st_size,'materials':len(merged.data.materials)}

def hardware():
    oldcyl=legacy.Model.cyl
    def cylinder(self,name,start,end,r,mat,r2=None,n=10):
        return oldcyl(self,name,start,end,r,mat,r2,n=max(n,24) if 'detail_' not in name and n>6 else n)
    legacy.Model.cyl=cylinder
    oldell=legacy.Model.ellipsoid
    def ellipsoid(self,name,pos,scale,mat,detail=1,noise=0,seed=1):
        return oldell(self,name,pos,scale,mat,max(detail,3 if max(scale)>.3 else 2),noise,seed)
    legacy.Model.ellipsoid=ellipsoid
    names=['cargo-crate','fuel-tank','repair-pod','shield-buoy','solar-satellite','missile','saucer-cruiser','twinwing-fighter','wedge-destroyer']
    report=[]
    for name in names:
        clear()
        mats={}
        for material_name,(color,metal,rough,emission) in legacy.MATERIALS.items():
            m=bpy.data.materials.new(material_name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
            p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
            if emission:p.inputs['Emission Color'].default_value=(*emission,1);p.inputs['Emission Strength'].default_value=.5
            mats[material_name]=m
        model=getattr(legacy,name.replace('-','_'))();enhance_model(model,name);objects=[]
        for label,vertices,faces,mat in model.parts:
            mesh=bpy.data.meshes.new(label);mesh.from_pydata([(v[0],-v[2],v[1]) for v in vertices],[],faces.tolist());mesh.update()
            bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
            bmesh.ops.dissolve_limit(bm,angle_limit=.001,verts=bm.verts,edges=bm.edges);bm.to_mesh(mesh);bm.free()
            o=bpy.data.objects.new(label,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mats[mat]);activate(o)
            for p in mesh.polygons:p.use_smooth=True
            # Tiny fittings retain hexagonal fasteners; curved vessels get continuous highlights.
            b=o.modifiers.new('Manufactured edge bevel','BEVEL');b.width=.014 if 'detail_' not in label else .004;b.segments=2;b.limit_method='ANGLE';b.angle_limit=.5
            n=o.modifiers.new('Weighted panel normals','WEIGHTED_NORMAL');n.keep_sharp=True;n.weight=50
            objects.append(o)
        report.append(export(name,objects))
    return report

def value_noise(x,y,z):
    a=np.floor(x);b=np.floor(y);c=np.floor(z);u=x-a;v=y-b;w=z-c
    u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w)
    def h(i,j,k):return np.mod(np.sin(i*127.1+j*311.7+k*74.7)*43758.5453,1)
    def mix(a,b,t):return a+(b-a)*t
    return mix(mix(mix(h(a,b,c),h(a+1,b,c),u),mix(h(a,b+1,c),h(a+1,b+1,c),u),v),mix(mix(h(a,b,c+1),h(a+1,b,c+1),u),mix(h(a,b+1,c+1),h(a+1,b+1,c+1),u),v),w)

def image_map(name,array,color=False):
    h,w=array.shape[:2];im=bpy.data.images.new(name,width=w,height=h,alpha=False)
    im.colorspace_settings.name='sRGB' if color else 'Non-Color'
    rgba=np.ones((h,w,4),np.float32);rgba[:,:,:3]=array if array.ndim==3 else array[:,:,None]
    im.pixels.foreach_set(rgba.ravel());im.pack();return im

def natural(name,seed,kind):
    clear();rng=np.random.default_rng(seed)
    craters=[]
    for i in range(22 if kind=='moon' else 12):
        p=Vector(rng.normal(size=3)).normalized();craters.append((p,.06+rng.random()*.29,.035+rng.random()*.065))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=112,ring_count=56,radius=1)
    o=bpy.context.object;o.name=name+'-sculpt';mesh=o.data
    # UV sphere unwrap is explicit and covers every surface. Coherent noise never jitters vertices independently.
    for v in mesh.vertices:
        d=v.co.normalized();p=d*3.0+Vector((seed,2.3,4.1))
        relief=(noise.noise_vector(p)[0]*.13+noise.noise_vector(p*3.1)[1]*.045+noise.noise_vector(p*8.7)[2]*.018)
        if kind=='moon':relief*=.2
        for center,r,depth in craters:
            t=(d-center).length/r
            if t<1.25:relief+=-depth*max(0,1-(t/.83)**2)+depth*.3*math.exp(-((t-1)*9)**2)
        if kind=='ice':relief+=.045*abs(noise.noise_vector(p*2)[0]);scale=(.82,1,.88)
        elif kind=='moon':scale=(1,1,1)
        else:scale=(1,.8,.91)
        v.co=Vector([d[i]*(1+relief)*scale[i] for i in range(3)])
    for p in mesh.polygons:p.use_smooth=True
    # Sample the same continuous 3D volume on a complete spherical UV chart.
    W,H=1024,512
    u,v=np.meshgrid((np.arange(W)+.5)/W,(np.arange(H)+.5)/H)
    lat=v*np.pi;lon=u*2*np.pi
    x=np.sin(lat)*np.cos(lon);y=np.sin(lat)*np.sin(lon);z=-np.cos(lat)
    n=sum(value_noise(x*f+seed,y*f+2.3,z*f+4.1)*a for f,a in [(3,.5),(9,.25),(28,.15),(85,.07),(220,.03)])
    grain=value_noise(x*160+seed,y*160,z*160);vein=np.abs(value_noise(x*13+n*3+seed,y*13,z*13)-.5)
    h=n*.55+grain*.06
    if kind=='ice':
        seam=np.clip(vein*19,0,1);c=np.stack([.10+seam*.57,.24+seam*.5,.31+seam*.49],-1)*( .72+n[:,:,None]*.5);rough=.22+grain*.25;h+=seam*.12;metal=.08
    elif kind=='volatile':
        fissure=(1-np.clip(vein*80,0,1))*np.clip((n-.43)*8,0,1)
        c=np.stack([n*.32+.08,n*.3+.08,n*.29+.075],-1);c=c*(1-fissure[:,:,None])+np.array([1,.18,.015])*fissure[:,:,None]
        rough=.78+grain*.18;h-=fissure*.08;metal=.08
    elif kind=='moon':
        c=np.stack([n*.46+.20,n*.45+.20,n*.43+.20],-1);rough=.90+grain*.09;metal=.02
        for center,r,depth in craters:
            t=np.sqrt((x-center.x)**2+(y-center.y)**2+(z-center.z)**2)/r
            bowl=-depth*np.maximum(0,1-(t/.83)**2)+depth*.3*np.exp(-((t-1)*9)**2)
            h+=bowl;c*=np.clip(1+bowl[:,:,None]*2,.45,1.2)
    else:
        ore=np.clip((.08-vein)*12,0,.65);c=np.stack([n*.42+.13,n*.39+.13,n*.35+.12],-1);c=c*(1-ore[:,:,None])+np.array([.44,.31,.17])*ore[:,:,None];rough=.6+grain*.35;metal=.38
    # Tangent-space microroughness normal map, longitudinally wrapped and softened at poles.
    du=(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*10;dv=np.gradient(h,axis=0)*20
    du*=np.sin(lat);dv*=np.sin(lat);normal=np.stack([-du,-dv,np.ones_like(h)],-1);normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    maps={'albedo':image_map(name+' albedo',np.clip(c,0,1),True),'normal':image_map(name+' relief',normal*.5+.5),'roughness':image_map(name+' roughness',np.clip(rough,0,1))}
    m=bpy.data.materials.new(name+' surface');m.use_nodes=True;nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF');p.inputs['Metallic'].default_value=metal
    for key,im in maps.items():
        t=nodes.new('ShaderNodeTexImage');t.name=key;t.image=im
        if key=='normal':nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.7;links.new(t.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
        else:links.new(t.outputs['Color'],p.inputs['Base Color' if key=='albedo' else 'Roughness'])
    if kind=='volatile':
        em=image_map(name+' thermal fissures',np.stack([fissure,fissure*.075,fissure*.003],-1),True);t=nodes.new('ShaderNodeTexImage');t.image=em;links.new(t.outputs['Color'],p.inputs['Emission Color']);p.inputs['Emission Strength'].default_value=.7
    o.data.materials.append(m);o['surface_recipe']='coherent multiscale noise + crater bowls; packed complete sphere maps';return export(name,[o])

report=[]
for name,seed,kind in [('iron-asteroid',11,'iron'),('ice-asteroid',42,'ice'),('volatile-rock',82,'volatile'),('rogue-moon',18,'moon')]:report.append(natural(name,seed,kind))
report+=hardware()
(ROOT/'blender-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('FINISHED',len(report),flush=True)

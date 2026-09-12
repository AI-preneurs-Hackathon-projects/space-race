"""Reproducible Blender 4.3+ fleet + asteroid asset production.

blender --background --factory-startup --python build_assets.py -- \
    --output ./generated-assets --texture ./asteroid-albedo.jpg

Modeling coordinates: nose +Y, up +Z. glTF export transforms to nose -Z, up +Y.
"""
import bpy, bmesh, math, random, os, json, argparse, sys
from mathutils import Vector
from mathutils import noise

parser=argparse.ArgumentParser(description='Build the Kestrel, Wraith, Atlas and asteroid game assets in Blender 4.3+.')
parser.add_argument('--output',default=os.path.dirname(os.path.abspath(__file__)),help='Directory for generated GLB, BLEND, PNG and JSON files.')
parser.add_argument('--texture',default=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','textures','asteroid-surface-albedo.png'),help='Rock albedo input image (PNG or JPEG).')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT = os.path.abspath(args.output)
os.makedirs(OUT, exist_ok=True)
TEX = os.path.abspath(args.texture)
if not os.path.isfile(TEX):raise FileNotFoundError('Supply the rock albedo image with --texture: '+TEX)
random.seed(1979)
REPORT = {'coordinate_system': 'GLB: nose -Z, up +Y, right +X. Blender: nose +Y, up +Z.', 'assets': {}}

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        if c.name != 'Collection' and c.users == 0:
            bpy.data.collections.remove(c)

def mat(name, color, metal=0, rough=.4, emission=None):
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal
    bs.inputs['Roughness'].default_value=rough
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1)
        bs.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color,1)
    return m

def mesh(name, verts, faces, material, bevel=0):
    me=bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Manufactured edge fillet', 'BEVEL'); mod.width=bevel; mod.segments=2
        mod.affect='EDGES'
        mod=o.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL'); mod.keep_sharp=True; mod.weight=50
    return o

def apply(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e: print('Modifier warning',o.name,e)
    return o

def box(name, loc, scale, material, bevel=.025, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if rot: o.rotation_euler=rot
    if bevel:
        b=o.modifiers.new('Machined chamfers','BEVEL'); b.width=bevel; b.segments=1 if name=='Cargo latch block' else 2
        w=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); w.keep_sharp=True
    return o

def cyl(name, loc, rad, depth, material, vertices=16, rotation=(math.pi/2,0,0), bevel=.008):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=rad, depth=depth, end_fill_type='NGON', location=loc, rotation=rotation)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new('Lip chamfer','BEVEL'); b.width=bevel; b.segments=1
        w=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); w.keep_sharp=True
    return o

def beam(name, a, b, rad, material, vertices=8):
    d=Vector(b)-Vector(a); mid=(Vector(b)+Vector(a))*.5
    o=cyl(name,mid,rad,d.length,material,vertices,rotation=(0,0,0),bevel=.004)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return o

def ring(name, x,y,z,r,minor, material, major_segments=20):
    bpy.ops.mesh.primitive_torus_add(major_segments=major_segments, minor_segments=6, location=(x,y,z), major_radius=r, minor_radius=minor, rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth=True
    return o

def revolved(name,x,z,profile,material,n=20,cap=False):
    vs=[]
    for y,r in profile:
        for i in range(n):
            t=math.tau*i/n; vs.append((x+r*math.cos(t),y,z+r*math.sin(t)))
    fs=[]
    for j in range(len(profile)-1):
        for i in range(n): fs.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    if cap:
        fs.append(tuple(range(n-1,-1,-1))); fs.append(tuple((len(profile)-1)*n+i for i in range(n)))
    o=mesh(name,vs,fs,material)
    for p in o.data.polygons: p.use_smooth=True
    return o

def prism(name, outline, z, thickness, material, bevel=.015):
    # outline can contain per-vertex z offsets for cambered wing surfaces.
    v=[(p[0],p[1],z+(p[2] if len(p)>2 else 0)+h) for h in (-thickness*.5,thickness*.5) for p in outline]
    n=len(outline)
    f=[tuple(range(n-1,-1,-1)),tuple(n+i for i in range(n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,v,f,material,bevel)

def mirrored_prism(name, coords,z,thick,material,bevel=.015):
    for s in (-1,1):
        outline=[(s*p[0],p[1],*(p[2:] if len(p)>2 else [])) for p in coords]
        if s<0: outline.reverse()
        prism(name+('_port' if s<0 else '_starboard'), outline,z,thick,material,bevel)

def hull(name, stations, material):
    # Twelve-sided aircraft-derived chamfered cross section, varying across the fuselage.
    section=[(-.64,.95),(.64,.95),(.94,.55),(1,.10),(.92,-.48),(.58,-.80),(-.58,-.80),(-.92,-.48),(-1,.10),(-.94,.55)]
    v=[]
    for y,w,h,zc in stations:
        v += [(sx*w,y,zc+sz*h) for sx,sz in section]
    n=len(section); f=[]
    for j in range(len(stations)-1):
        for i in range(n):f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    f.extend([tuple(range(n-1,-1,-1)),tuple((len(stations)-1)*n+i for i in range(n))])
    return mesh(name,v,f,material,.018)

def canopy(materials, width=.40, front=1.85, back=.1, z=.50, peak=.96):
    # Recessed pressure cockpit with visibly separated windshield / roof / side glass facets.
    pts=[(-width*.60,front,z), (width*.60,front,z), (-width,back+.15,z), (width,back+.15,z),
         (-width*.53,front-.62,peak), (width*.53,front-.62,peak), (-width*.66,back,peak*.97),(width*.66,back,peak*.97)]
    faces=[(0,1,5,4),(4,5,7,6),(0,4,6,2),(1,3,7,5),(2,6,7,3)]
    mesh('Faceted smoked pressure glazing',pts,faces,materials['canopy'],.009)
    # Doubled base lip and thin structural uprights: no thick toy bubble.
    for a,b in [(0,1),(0,2),(1,3),(2,3),(0,4),(1,5),(4,5),(4,6),(5,7),(6,7),(2,6),(3,7)]:
        beam('Cockpit titanium mullion',pts[a],pts[b],.020,materials['cockpit_frame'])
    for s in (-1,1):
        box('Cockpit side sill',(s*(width+.045),(front+back)*.5,z-.025),(.08,front-back,.075),materials['hull_secondary'],.018)

def engine(materials,x,y=-1.75,z=.01,r=.3,idx=0,accent=True):
    # y is engine center. Engine nozzle points aft (-Y) before glTF conversion.
    revolved('Faceted ceramic nacelle',x,z,[(y+.82,r*.65),(y+.65,r*.89),(y+.18,r),(y-.33,r*.95),(y-.60,r*.82)],materials['hull_secondary'],n=16,cap=True)
    revolved('Nozzle expansion bell',x,z,[(y-.49,r*.72),(y-.64,r*.92),(y-.85,r*1.08),(y-1.02,r*.97),(y-1.02,r*.73),(y-.71,r*.53)],materials['engine_nozzle'],n=24)
    ring('Outer nozzle armored lip',x,y-.99,z,r*.92,r*.065,materials['gunmetal'],24)
    ring('Inner luminous plasma annulus',x,y-.86,z,r*.62,r*.048,materials['engine_core'],20)
    cyl('engine_core', (x,y-.81,z), r*.52,.018,materials['engine_core'],20,bevel=0)
    cyl('Core shadow center',(x,y-.88,z),r*.16,.06,materials['engine_nozzle'],12)
    ring('Forward intake rim',x,y+.65,z,r*.84,r*.075,materials['gunmetal'],20)
    cyl('Recessed induction grille',(x,y+.675,z),r*.67,.02,materials['vent'],16)
    for a in range(8):
        t=a*math.tau/8
        px=x+math.cos(t)*r*.945; pz=z+math.sin(t)*r*.945
        # Long nacelle reinforcing stringers, inset between armor fields.
        beam('Nacelle longitudinal rib',(px,y+.49,pz),(px,y-.39,pz),.025,materials['structural'])
    if accent:
        ring('Service band',x,y-.35,z,r*.93,.026,materials['accent'],20)
    marker=bpy.data.objects.new('exhaust_'+str(idx),None); bpy.context.collection.objects.link(marker)
    marker.location=(x,y-1.045,z); marker.empty_display_type='PLAIN_AXES'; marker.empty_display_size=.2

def vent_bank(materials, x,y,z,width=.3,length=.6, count=6):
    box('Recessed heat exchanger well',(x,y,z),(width+.065,length+.055,.04),materials['structural'],.017)
    box('Black vent cavity',(x,y,z+.026),(width,length,.018),materials['vent'],.008)
    for i in range(count):
        box('Radiator blade',(x,y-length*.40+length*.8*i/max(count-1,1),z+.041),(width*.89,.034,.023),materials['gunmetal'],.005,rot=(.25,0,0))

def gun(materials,x,y,z,scale=1):
    box('Weapon trunnion',(x,y,z),(.15*scale,.38*scale,.15*scale),materials['structural'],.025)
    cyl('Gun barrel',(x,y+.39*scale,z),.038*scale,.63*scale,materials['gunmetal'],10)
    cyl('Muzzle shroud',(x,y+.72*scale,z),.063*scale,.16*scale,materials['hull_secondary'],10)
    cyl('Muzzle black bore',(x,y+.807*scale,z),.036*scale,.012,materials['vent'],10,bevel=0)

def dorsal_fin(materials,x,y,z,h=.6,l=.9):
    pts=[(x-.025,y,z),(x-.025,y-l,z+.02),(x-.025,y-l*.75,z+h),(x-.025,y-l*.55,z+h),(x+.025,y,z),(x+.025,y-l,z+.02),(x+.025,y-l*.75,z+h),(x+.025,y-l*.55,z+h)]
    mesh('Swept stabilizer',pts,[(0,3,2,1),(4,5,6,7),(0,4,7,3),(3,7,6,2),(2,6,5,1),(1,5,4,0)],materials['hull_secondary'],.012)

def bolts(materials, points):
    for p in points:
        cyl('Flush captive fastener',p,.018,.009,materials['gunmetal'],6,rotation=(0,0,0),bevel=0)

def make_materials(ship):
    palettes={
      'kestrel':((.70,.72,.70),(.30,.36,.41),(.93,.225,.048),(.20,.78,1.0)),
      'wraith':((.07,.095,.12),(.14,.19,.22),(.025,.65,.63),(.06,.87,1.0)),
      'atlas':((.46,.49,.55),(.24,.28,.34),(.54,.40,.72),(.46,.48,1.0))}
    a,b,c,e=palettes[ship]
    return {
      'hull_armor':mat('hull_armor',a,.72,.30),
      'hull_secondary':mat('hull_secondary',b,.75,.37),
      'accent':mat('accent',c,.48,.30),
      'structural':mat('structural',(.055,.07,.083),.65,.42),
      'vent':mat('vent',(.009,.014,.02),.15,.65),
      'gunmetal':mat('gunmetal',(.24,.29,.33),.86,.27),
      'cockpit_frame':mat('cockpit_frame',(.085,.10,.12),.90,.25),
      'canopy':mat('canopy',(.025,.10,.16),.78,.11),
      'engine_nozzle':mat('engine_nozzle',(.07,.085,.095),.86,.31),
      'engine_core':mat('engine_core',e,.25,.27,emission=3.0)
    }

def build_kestrel(m):
    hull('Kestrel pressure fuselage',[(2.75,.06,.09,-.04),(2.32,.28,.18,-.005),(1.55,.45,.30,.025),(.55,.59,.43,.03),(-.50,.67,.42,.03),(-1.5,.63,.37,.015),(-2.43,.45,.27,-.025)],m['hull_secondary'])
    # Top plates follow the taper and leave dark manufacturing seams.
    mirrored_prism('Forebody cheek armor',[(.07,2.62),(.255,2.24),(.42,1.53),(.245,1.53),(.12,2.24)],.205,.075,m['hull_armor'])
    mirrored_prism('Shoulder armor',[(.43,1.35),(.58,.49),(.65,-.48),(.49,-1.35),(.36,-1.16),(.43,.29)],.39,.085,m['hull_armor'])
    mirrored_prism('Primary wing structure',[(.49,.85),(1.05,.35),(2.16,-1.05),(2.20,-1.96),(1.52,-1.82),(.75,-2.3),(.58,-1.07)],-.035,.17,m['structural'],.032)
    mirrored_prism('Forward wing armor',[(.68,.60),(1.00,.25),(2.055,-1.10),(1.57,-1.08),(.89,-.50)],.072,.075,m['hull_armor'])
    mirrored_prism('Outer wing service panel',[(1.66,-1.18),(2.08,-1.20),(2.09,-1.78),(1.65,-1.68)],.072,.08,m['hull_secondary'])
    mirrored_prism('Trailing wing armor',[(.82,-.66),(1.54,-1.18),(1.49,-1.67),(.81,-2.13),(.64,-1.43)],.068,.08,m['hull_armor'])
    mirrored_prism('Burnt orange flight stripe',[(.97,.14),(1.105,-.02),(1.77,-.925),(1.61,-.93)],.12,.024,m['accent'],.004)
    mirrored_prism('Wingtip orange ID panel',[(1.98,-1.34),(2.095,-1.35),(2.095,-1.77),(1.98,-1.75)],.124,.02,m['accent'],.003)
    canopy(m,.36,1.68,.12,.43,.88)
    box('Dorsal avionics armored spine',(0,-1.0,.445),(.54,1.57,.14),m['hull_armor'],.065)
    box('Spine orange recognition strip',(0,-1.12,.53),(.13,1.22,.022),m['accent'],.010)
    for s in (-1,1):
        engine(m,s*1.25,-1.47,-.01,.315,idx=0 if s<0 else 1)
        box('Engine mounting pylon',(s*.95,-1.2,.03),(.5,.61,.24),m['hull_secondary'],.04)
        vent_bank(m,s*.44,-1.33,.378,.19,.72,7)
        gun(m,s*.65,.54,-.15,.88)
        dorsal_fin(m,s*1.25,-1.65,.28,.40,.70)
        box('Retracted landing skid',(s*.47,-.82,-.375),(.105,1.12,.09),m['gunmetal'],.025)
        bolts(m,[(s*.51,-.47,.441),(s*.53,.22,.441),(s*1.9,-1.45,.131),(s*1.05,-1.78,.126)])
        cyl('Navigation lamp',(s*2.17,-1.88,.03),.025,.028,m['engine_core'],8,rotation=(0,math.pi/2,0),bevel=0)

def build_wraith(m):
    hull('Wraith narrow interceptor fuselage',[(3.16,.035,.06,-.025),(2.55,.17,.12,0),(1.6,.31,.21,.015),(.55,.40,.29,.03),(-.65,.48,.30,.025),(-1.62,.42,.25,.0),(-2.35,.25,.18,-.025)],m['hull_secondary'])
    mirrored_prism('Needle forebody facets',[(.025,3.01),(.16,2.49),(.30,1.62),(.19,1.31),(.11,2.25)],.14,.055,m['hull_armor'],.008)
    mirrored_prism('Long cheek scute',[(.32,1.35),(.395,.47),(.46,-.53),(.30,-1.61),(.25,-.62)],.278,.065,m['hull_armor'])
    mirrored_prism('Swept interceptor wing',[(.34,.7),(.67,-.02),(1.59,-.79),(2.28,-.35),(2.18,-1.40),(1.73,-2.21),(.92,-1.81),(.41,-2.51)],-.08,.11,m['structural'],.021)
    mirrored_prism('Front wing edge armor',[(.46,.38),(.75,-.18),(1.62,-.96),(2.185,-.55),(2.106,-.99),(1.72,-1.27),(.89,-.73)],-.004,.067,m['hull_armor'])
    mirrored_prism('Outboard wing blade',[(1.78,-1.34),(2.11,-1.08),(2.046,-1.38),(1.738,-2.07),(1.51,-1.84)],-.011,.06,m['hull_secondary'])
    mirrored_prism('Wing root scute',[(.46,-.66),(.89,-.89),(1.47,-1.36),(1.36,-1.8),(.95,-1.68),(.44,-2.26)],.018,.065,m['hull_armor'])
    mirrored_prism('Teal sweep marking',[(.80,-.36),(.91,-.47),(1.62,-1.13),(1.97,-.89),(1.954,-1.01),(1.63,-1.24)],.04,.019,m['accent'],.002)
    mirrored_prism('Teal tip marking',[(1.88,-1.63),(1.965,-1.54),(1.77,-1.997),(1.715,-1.987)],.033,.016,m['accent'],.002)
    canopy(m,.27,1.53,.12,.31,.68)
    for s in (-1,1):
        engine(m,s*.82,-1.58,-.012,.235,idx=0 if s<0 else 1)
        box('Engine bridge',(s*.57,-1.11,-.012),(.37,.64,.18),m['hull_secondary'],.035)
        vent_bank(m,s*.31,-.99,.278,.15,.56,6)
        gun(m,s*1.55,-.82,-.115,.82)
        dorsal_fin(m,s*.78,-1.70,.16,.42,.66)
        box('Retracted magnetic landing rail',(s*.3,-.70,-.29),(.07,.83,.05),m['gunmetal'],.015)
    box('Dorsal sensor knife',(0,-1.2,.31),(.135,1.08,.06),m['hull_armor'],.018)
    box('Teal dorsal ID',(0,-1.2,.347),(.053,.61,.014),m['accent'],.005)
    for s in (-1,1):
        bolts(m,[(s*.36,-.40,.318),(s*1.79,-1.65,.029),(s*.75,-1.64,.059)])

def build_atlas(m):
    hull('Atlas armored command hull',[(2.6,.30,.22,.0),(2.13,.56,.35,.03),(1.1,.74,.48,.035),(-.15,.78,.49,.04),(-1.35,.73,.46,.02),(-2.58,.57,.35,-.02)],m['structural'])
    mirrored_prism('Atlas bow armor',[(.08,2.53),(.28,2.52),(.54,2.07),(.65,1.33),(.37,1.34),(.18,2.01)],.30,.15,m['hull_armor'],.035)
    mirrored_prism('Shoulder citadel armor',[(.56,1.09),(.725,.93),(.754,-.11),(.705,-1.11),(.53,-1.11),(.47,.1)],.475,.125,m['hull_armor'],.028)
    mirrored_prism('Cargo support outrigger',[(.64,1.15),(1.62,.99),(2.14,.19),(2.14,-1.89),(1.50,-2.41),(.61,-2.23)],-.115,.27,m['structural'],.040)
    # Visible segmented armored containers with raised ribs and recessed end machinery.
    for s in (-1,1):
        x=s*1.39
        box('Armored cargo pod pressure body',(x,-.50,.005),(.89,3.43,.65),m['hull_secondary'],.13)
        for i,y in enumerate((.71,-.09,-.90,-1.70)):
            box('Cargo armor upper plate',(x,y,.371),(.86,.725,.105),m['hull_armor'],.045)
            box('Cargo exterior side armor',(x+s*.454,y,.005),(.07,.723,.49),m['hull_armor'],.025)
            box('Cargo plate lavender edge',(x+s*.315,y,.437),(.105,.61,.020),m['accent'],.009)
            # Corner reinforcing fastening blocks sit above each independently removable plate.
            for dx in (-.34,.34):
                box('Cargo latch block',(x+dx,y+.29,.442),(.095,.075,.047),m['gunmetal'],.013)
        for y in (1.145,.315,-.50,-1.30,-2.09):
            box('Cargo transverse armored rib',(x,y,.332),(.955,.070,.18),m['structural'],.018)
            box('Cargo outer rib',(x+s*.465,y,-.025),(.078,.092,.64),m['gunmetal'],.014)
        vent_bank(m,x,.74,.443,.32,.46,5)
        box('Cargo aft recessed service hatch',(x,-2.226,.015),(.57,.022,.37),m['vent'],.06)
        gun(m,s*.84,1.29,-.165,.94)
        box('Armored landing outrigger',(s*1.14,-.82,-.435),(.18,1.58,.11),m['gunmetal'],.04)
        for y in (-.30,-1.30):
            box('Pod underside equipment box',(x,y,-.363),(.56,.41,.16),m['structural'],.042)
        dorsal_fin(m,s*1.36,-1.77,.43,.31,.59)
    canopy(m,.43,1.70,.27,.49,.98)
    box('Atlas upper reactor cover',(0,-1.28,.529),(.88,1.93,.17),m['hull_armor'],.09)
    for y in (-.54,-1.07,-1.60,-2.07):
        box('Reactor transverse divider',(0,y,.628),(.82,.055,.044),m['structural'],.014)
    box('Lavender reactor registry bar',(0,-1.27,.63),(.2,1.74,.025),m['accent'],.009)
    for s in (-1,1):vent_bank(m,s*.28,-1.33,.63,.19,.76,7)
    for i,x in enumerate((-.68,0,.68)):
        engine(m,x,-1.96,-.115,.25 if x else .30,idx=i,accent=False)
    mirrored_prism('Forward lavender hull stripe',[(.32,2.15),(.46,1.89),(.55,1.45),(.42,1.45)],.39,.02,m['accent'],.009)
    bolts(m,[(x,y,.55) for x in (-.67,.67) for y in (.79,-.06,-.81)])

def group_export(asset):
    originals=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in originals:apply(o)
    mats={}
    for o in originals:
        # Every component authored with one semantic material, so grouping remains deterministic.
        key=o.data.materials[0].name; mats.setdefault(key,[]).append(o)
    for key,obs in mats.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]
        bpy.ops.object.join(); merged=bpy.context.object; merged.name=key
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    obs=[o for o in bpy.context.scene.objects if o.type in {'MESH','EMPTY'}]
    vs=[o.matrix_world@Vector(v) for o in obs if o.type=='MESH' for v in o.bound_box]
    mn=[min(v[i] for v in vs) for i in range(3)]; mx=[max(v[i] for v in vs) for i in range(3)]
    counts={}
    tri=0
    for o in obs:
        if o.type=='MESH':
            o.data.calc_loop_triangles(); n=len(o.data.loop_triangles);tri+=n;counts[o.name]=n
    for o in obs:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,asset+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
    REPORT['assets'][asset]={'triangles':tri,'material_meshes':len(counts),'triangles_by_material':counts,'blender_bounds_min':mn,'blender_bounds_max':mx,'glb_dimensions_xyz':[mx[0]-mn[0],mx[2]-mn[2],mx[1]-mn[1]],'file_bytes':os.path.getsize(os.path.join(OUT,asset+'.glb')),'exhaust_markers':[o.name for o in obs if o.type=='EMPTY']}
    return obs

def point_at(o, pos):o.rotation_euler=(Vector(pos)-o.location).to_track_quat('-Z','Y').to_euler()

def studio(scene, camera_pos, target, ortho=15):
    scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1600; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    scene.world.color=(.13,.13,.13)
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.12,.16,.22,1);bg.inputs[1].default_value=.5
    scene.view_settings.view_transform='AgX'
    def light(name,location,power,size,color):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=location;point_at(ob,target)
    light('Key softbox',(-4,8,14),3300,10,(.80,.89,1.0))
    light('Warm edge softbox',(9,-6,9),2800,8,(1.0,.79,.59))
    light('Front fill',(-9,-4,5),2300,9,(.47,.65,1.0))
    light('Canopy reflection card',(0,7,9),1700,5,(1.0,1.0,1.0))
    camera_data=bpy.data.cameras.new('Studio overview'); camera=bpy.data.objects.new('Studio overview',camera_data);scene.collection.objects.link(camera)
    camera.location=camera_pos;point_at(camera,target);camera_data.type='ORTHO';camera_data.ortho_scale=ortho;scene.camera=camera
    return camera

def render(scene,name):
    scene.render.filepath=os.path.join(OUT,name+'.png');bpy.ops.render.render(write_still=True)

def fleet():
    clear();scene=bpy.context.scene;scene.name='Fleet | Editable geometry and studio'
    all_ships=[]
    for name,fn in [('kestrel',build_kestrel),('wraith',build_wraith),('atlas',build_atlas)]:
        # Ship assembly collection preserves hundreds of editable named construction parts in .blend.
        for ob in list(scene.objects):scene.collection.objects.unlink(ob) if ob.name in scene.collection.objects else None
        # Clear scene links across child collections as previous assets are stored in detached collections.
        bpy.ops.object.select_all(action='DESELECT')
        collection=bpy.data.collections.new(name.upper()+' | Source components');scene.collection.children.link(collection)
        bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[collection.name]
        materials=make_materials(name)
        fn(materials)
        # Save editable component collection separately; export only a duplicate then discard duplicates.
        src=list(collection.objects)
        for ob in src:apply(ob)
        export_col=bpy.data.collections.new(name+' export staging');scene.collection.children.link(export_col)
        for ob in src:
            original_name=ob.name
            ob.name=name+'__'+original_name
            clone=ob.copy()
            if ob.data:clone.data=ob.data.copy()
            clone.name=original_name
            export_col.objects.link(clone)
        scene.collection.children.unlink(collection)
        bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[export_col.name]
        group_export(name)
        for ob in list(export_col.objects):bpy.data.objects.remove(ob,do_unlink=True)
        bpy.data.collections.remove(export_col)
        for material_name,material in materials.items():material.name=name+'_'+material_name
        all_ships.append((name,collection))
    for i,(name,col) in enumerate(all_ships):
        scene.collection.children.link(col)
        for ob in col.objects:ob.location.x+=(i-1)*5.5
    bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection
    camera=studio(scene,(12,16,17),(0,0,0),20)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'fleet.blend'))
    render(scene,'fleet-preview')
    camera.location=(10,-17,13);point_at(camera,(0,0,0));render(scene,'fleet-rear-preview')
    for i,(name,col) in enumerate(all_ships):
        for othername,other in all_ships:other.hide_render=other!=col
        camera.location=((i-1)*5.5+6,9,8);point_at(camera,((i-1)*5.5,0,0));camera.data.ortho_scale=7.8
        scene.render.resolution_x=1200;scene.render.resolution_y=1050
        render(scene,name+'-preview')
    for _,col in all_ships:col.hide_render=False

def make_rock_material():
    image=bpy.data.images.load(TEX,check_existing=True);image.name='Carbonaceous rock albedo 1024'
    image.scale(1024,1024);image.filepath_raw=os.path.join(OUT,'asteroid-albedo.jpg');image.file_format='JPEG';image.save();image.pack()
    m=mat('carbonaceous_rock',(.29,.22,.16),0,.94)
    nodes=m.node_tree.nodes;links=m.node_tree.links;bs=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.label='Packed exported rock surface';links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    # Real GLB vertex colors multiply this albedo in Three.js; micro surface is baked to tangent-space normals below.
    return m

def build_asteroid(index,m):
    seed=40+index*173;rng=random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=6,radius=1)
    o=bpy.context.object;o.name='asteroid-'+str(index);o.data.materials.append(m)
    ellipsoids=[(1.0,.88,.78),(1.0,.68,.61),(.81,.86,1.0)]
    scales=ellipsoids[index-1]
    craters=[]
    # Deep large scars plus smaller impact bowls, deliberately asymmetric.
    for i in range(10):
        d=Vector((rng.uniform(-1,1),rng.uniform(-1,1),rng.uniform(-1,1))).normalized()
        radius=rng.uniform(.13,.38) if i else .50
        craters.append((d,radius,rng.uniform(.06,.14)))
    offset=Vector((seed*.019,seed*.071,seed*.013))
    tones=[]
    for vert in o.data.vertices:
        d=vert.co.normalized();p=d+offset
        coarse=noise.noise(p*2.8,noise_basis='PERLIN_ORIGINAL')*.145
        middle=noise.noise(p*8.5,noise_basis='PERLIN_ORIGINAL')*.061
        fine=noise.noise(p*25.0,noise_basis='PERLIN_ORIGINAL')*.019
        granular=noise.noise(p*62.0,noise_basis='PERLIN_ORIGINAL')*.006
        radial=1+coarse+middle+fine+granular
        for c,cr,depth in craters:
            dist=(d-c).length
            q=dist/cr
            if q<1.32:
                bowl=-depth*max(0,1-q*q)**1.65
                rim=depth*.26*math.exp(-((q-.91)/.16)**2)
                radial+=bowl+rim
        # Flatten one broken side on the elongated rubble fragment.
        pos=Vector((d.x*radial*scales[0],d.y*radial*scales[1],d.z*radial*scales[2]))
        if index==2 and pos.z<-.34:pos.z=-.34+(pos.z+.34)*.5+fine*.4
        if index==3:
            waist=1-.19*math.exp(-((d.z-.12)/.28)**2)
            pos.x*=waist;pos.y*=waist
        vert.co=pos
        tone=.65+.24*(coarse/.145*.5+.5)+rng.uniform(-.025,.025)
        tones.append((tone,tone*.98,tone*.94,1))
    maxr=max(v.co.length for v in o.data.vertices)
    for v in o.data.vertices:v.co/=maxr
    # Material-exported vertex color field deepens actual multi-scale geometric shadowing.
    colors=o.data.color_attributes.new(name='COLOR_0',type='BYTE_COLOR',domain='POINT')
    for i,c in enumerate(tones):colors.data[i].color=c
    o.data.color_attributes.active_color=colors
    uv=o.data.uv_layers.new(name='UVMap')
    for poly in o.data.polygons:
        coords=[]
        for vi in poly.vertices:
            d=o.data.vertices[vi].co.normalized()
            coords.append((math.atan2(d.y,d.x)/math.tau+.5,math.asin(max(-1,min(1,d.z)))/math.pi+.5))
        if max(x[0] for x in coords)-min(x[0] for x in coords)>.5:
            coords=[(u+1 if u<.5 else u,v) for u,v in coords]
        for li,co in zip(poly.loop_indices,coords):uv.data[li].uv=co
        poly.use_smooth=True
    dec=o.modifiers.new('Optimized crater-preserving surface','DECIMATE');dec.ratio=.48;dec.use_collapse_triangulate=True
    apply(o)
    maxr=max(v.co.length for v in o.data.vertices)
    for v in o.data.vertices:v.co/=maxr
    return o

def asteroids():
    clear();scene=bpy.context.scene;scene.name='Asteroids | Editable meshes and studio'
    m=make_rock_material()
    obs=[]
    for i in (1,2,3):
        o=build_asteroid(i,m)
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        path=os.path.join(OUT,f'asteroid-{i}.glb')
        bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_vertex_color='ACTIVE')
        o.data.calc_loop_triangles()
        vs=[v.co for v in o.data.vertices]; mn=[min(v[j] for v in vs) for j in range(3)]; mx=[max(v[j] for v in vs) for j in range(3)]
        REPORT['assets'][f'asteroid-{i}']={'triangles':len(o.data.loop_triangles),'material_meshes':1,'max_radius':max(v.length for v in vs),'blender_bounds_min':mn,'blender_bounds_max':mx,'glb_dimensions_xyz':[mx[0]-mn[0],mx[2]-mn[2],mx[1]-mn[1]],'file_bytes':os.path.getsize(path),'texture':'1024×1024 packed JPEG albedo with exported vertex colors'}
        o.location.x=(i-2)*2.7;obs.append(o)
    camera=studio(scene,(6,8,7),(0,0,0),9.2)
    scene.render.resolution_x=1600;scene.render.resolution_y=850
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'asteroids.blend'))
    render(scene,'asteroids-preview')

fleet()
asteroids()
with open(os.path.join(OUT,'asset-report.json'),'w') as f:json.dump(REPORT,f,indent=2)
print('ASSET_REPORT '+json.dumps(REPORT))

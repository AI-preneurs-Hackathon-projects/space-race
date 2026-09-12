#!/usr/bin/env python3
"""Generate original Space Race encounter GLBs, without external model dependencies.

Requires Python 3, numpy and Pillow. All source geometry is original, deterministic,
centered at the origin, and normalized to a maximum vertex radius of 1. Nose -Z,
up +Y. GLBs use core glTF 2.0 PBR materials, no textures or extensions.
"""
from pathlib import Path
import json, math, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent.parent / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
PI = math.pi

# The emissive surfaces are visibly colored even without a bloom pass.
MATERIALS = {
    'gunmetal': ((.19,.24,.30,1), .78, .37, None),
    'steel': ((.46,.55,.61,1), .82, .31, None),
    'ivory': ((.78,.81,.77,1), .48, .4, None),
    'bronze': ((.49,.28,.12,1), .78, .36, None),
    'amber': ((.94,.48,.09,1), .6, .34, None),
    'black': ((.045,.065,.09,1), .55, .48, None),
    'rock': ((.25,.24,.23,1), .18, .94, None),
    'iron': ((.40,.32,.23,1), .56, .75, None),
    'ice': ((.49,.80,.89,1), .25, .23, None),
    'crystal': ((.25,.50,.74,1), .50, .18, (.06,.21,.40)),
    'blueglass': ((.055,.16,.30,1), .72, .24, None),
    'cyan': ((.20,.84,1,1), .25, .22, (.10,.62,.9)),
    'orange': ((1,.31,.035,1), .25, .28, (.95,.16,.01)),
    'red': ((.75,.095,.065,1), .45, .35, (.32,.015,.005)),
    'green': ((.17,.95,.51,1), .15, .24, (.05,.65,.20)),
    'purple': ((.62,.29,.88,1), .4, .25, (.20,.04,.45)),
    'solar': ((.07,.19,.36,1), .55, .30, None),
}

def unit(v):
    v=np.asarray(v,float)
    return v / max(np.linalg.norm(v),1e-12)

def rot(axis, angle):
    x,y,z=unit(axis); c,s=math.cos(angle),math.sin(angle); t=1-c
    return np.array([[t*x*x+c,t*x*y-s*z,t*x*z+s*y],
                     [t*x*y+s*z,t*y*y+c,t*y*z-s*x],
                     [t*x*z-s*y,t*y*z+s*x,t*z*z+c]])

class Model:
    def __init__(self,name):
        self.name=name; self.parts=[]
    def mesh(self,name, vertices, faces, material, pos=(0,0,0), scale=(1,1,1), rotation=None):
        v=np.asarray(vertices,float)*np.asarray(scale,float)
        if rotation is not None: v=v@rotation.T
        v+=np.asarray(pos,float)
        self.parts.append((name,v,np.asarray(faces,np.uint32),material))
    def box(self,name,pos,size,mat,rotation=None):
        verts=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
               (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
        faces=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),
               (3,7,6),(3,6,2),(1,2,6),(1,6,5),(0,4,7),(0,7,3)]
        self.mesh(name,verts,faces,mat,pos,np.asarray(size)/2,rotation)
    def cyl(self,name,start,end,r,mat,r2=None,n=10):
        start=np.asarray(start,float); end=np.asarray(end,float); w=unit(end-start)
        u=unit(np.cross(w,[0,1,0] if abs(w[1])<.9 else [1,0,0])); v=np.cross(w,u)
        verts=[]
        for center,rad in [(start,r),(end,r if r2 is None else r2)]:
            verts.extend(center+(u*math.cos(i*2*PI/n)+v*math.sin(i*2*PI/n))*rad for i in range(n))
        verts.extend([start,end]); faces=[]
        for i in range(n):
            j=(i+1)%n
            faces.extend([(i,j,n+j),(i,n+j,n+i),(2*n,j,i),(2*n+1,n+i,n+j)])
        self.mesh(name,verts,faces,mat)
    def ellipsoid(self,name,pos,scale,mat,detail=1,noise=0,seed=1):
        t=(1+5**.5)/2
        v=np.array([[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],
                    [0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]],float)
        v=np.array([unit(x) for x in v]).tolist()
        f=[(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),(1,5,9),(5,11,4),
           (11,10,2),(10,7,6),(7,1,8),(3,9,4),(3,4,2),(3,2,6),(3,6,8),
           (3,8,9),(4,9,5),(2,4,11),(6,2,10),(8,6,7),(9,8,1)]
        for _ in range(detail):
            cache={}; new=[]
            def midpoint(a,b):
                key=tuple(sorted((a,b)))
                if key not in cache:
                    cache[key]=len(v);v.append(unit(np.asarray(v[a])+np.asarray(v[b])).tolist())
                return cache[key]
            for a,b,c in f:
                ab,bc,ca=midpoint(a,b),midpoint(b,c),midpoint(c,a)
                new.extend([(a,ab,ca),(b,bc,ab),(c,ca,bc),(ab,bc,ca)])
            f=new
        rng=np.random.default_rng(seed)
        v=np.asarray(v)*(1+rng.uniform(-noise,noise,(len(v),1)))
        self.mesh(name,v,f,mat,pos,scale)
    def prism(self,name,polygon,y0,y1,mat,rotation=None,pos=(0,0,0)):
        # Normalize winding to CCW in the X/Z plane.
        area=sum(polygon[i][0]*polygon[(i+1)%len(polygon)][1]-polygon[(i+1)%len(polygon)][0]*polygon[i][1] for i in range(len(polygon)))
        if area<0:polygon=list(reversed(polygon))
        n=len(polygon); verts=[(x,y,z) for y in [y0,y1] for x,z in polygon]
        faces=[]
        # Ear clipping supports the fighter's concave swept fins as well as convex hulls.
        left=list(range(n)); flat=np.asarray(polygon)
        def cross2(a,b):return float(a[0]*b[1]-a[1]*b[0])
        while len(left)>3:
            for i,b in enumerate(left):
                a,c=left[i-1],left[(i+1)%len(left)]
                if cross2(flat[b]-flat[a],flat[c]-flat[b])<=1e-9:continue
                def inside(p):
                    return (cross2(flat[b]-flat[a],p-flat[a])>=-1e-9 and
                            cross2(flat[c]-flat[b],p-flat[b])>=-1e-9 and
                            cross2(flat[a]-flat[c],p-flat[c])>=-1e-9)
                if any(inside(flat[k]) for k in left if k not in (a,b,c)):continue
                faces.extend([(a,b,c),(n+a,n+c,n+b)]);left.pop(i);break
            else:raise ValueError('Invalid CCW polygon: '+name)
        a,b,c=left;faces.extend([(a,b,c),(n+a,n+c,n+b)])
        for i in range(n):
            j=(i+1)%n; faces.extend([(i,n+i,n+j),(i,n+j,j)])
        self.mesh(name,verts,faces,mat,pos,rotation=rotation)
    def torus(self,name,pos,R,r,mat,n=24,m=6,rotation=None):
        verts=[];faces=[]
        for i in range(n):
            a=2*PI*i/n
            for j in range(m):
                b=2*PI*j/m
                verts.append(((R+r*math.cos(b))*math.cos(a),r*math.sin(b),(R+r*math.cos(b))*math.sin(a)))
        for i in range(n):
            for j in range(m):
                a=i*m+j;b=((i+1)%n)*m+j;c=((i+1)%n)*m+(j+1)%m;d=i*m+(j+1)%m
                faces.extend([(a,b,c),(a,c,d)])
        # Parametric order above is inward; reverse for outward normals.
        self.mesh(name,verts,[(c,b,a) for a,b,c in faces],mat,pos,rotation=rotation)
    def normalize(self):
        allv=np.concatenate([p[1] for p in self.parts]); center=(allv.min(0)+allv.max(0))/2
        radius=np.linalg.norm(allv-center,axis=1).max()
        self.parts=[(n,(v-center)/radius,f,m) for n,v,f,m in self.parts]
        return self

def rock_model(name,kind):
    m=Model(name)
    if kind=='iron':
        m.ellipsoid('dense-faceted-core',(0,0,0),(1,.82,.91),'rock',2,.18,11)
        for i,p in enumerate([(-.58,.35,-.48),(.45,.6,.27),(.51,-.15,-.58),(-.43,-.52,.31)]):
            m.ellipsoid('metal-seam-'+str(i),p,(.31,.16,.28),'iron',0,.2,i)
    elif kind=='ice':
        m.ellipsoid('ice-core',(0,0,0),(.83,.9,.75),'ice',1,.19,42)
        for i,(p,e) in enumerate([((.31,.23,0),(.55,1.1,-.1)),((-.3,.1,.2),(-.74,.74,.47)),((0,-.2,-.2),(.1,-.91,-.55))]):
            m.cyl('ice-spire-'+str(i),p,e,.27,'cyan',0,n=5)
    else:
        m.ellipsoid('volatile-core',(0,0,0),(.97,.83,.94),'rock',2,.19,82)
        for i,p in enumerate([(.67,.15,.1),(-.61,.4,-.1),(.04,.72,-.2),(-.25,-.62,.2),(.2,.1,-.81),(0,.1,.82)]):
            m.ellipsoid('exposed-plasma-'+str(i),p,(.24,.19,.25),'orange',1,.08,i)
    return m

def crystal_cluster():
    m=Model('crystal-cluster')
    for i,(x,z,h,r) in enumerate([(0,0,1.55,.28),(-.42,.1,.93,.22),(.39,.13,1.13,.22),(.02,.4,.79,.2),(-.2,-.37,.9,.18)]):
        m.cyl('hexagonal-crystal-'+str(i),(x,-.5,z),(x,h*.52,z),r,'crystal' if i%2 else 'purple',r*.78,n=6)
        m.cyl('crystal-point-'+str(i),(x,h*.52,z),(x,h*.52+r*.95,z),r*.78,'cyan' if i==0 else 'purple',0,n=6)
    m.ellipsoid('mineral-base',(0,-.49,0),(.63,.26,.64),'gunmetal',1,.14,8)
    return m

def comet():
    m=Model('comet');m.ellipsoid('comet-nucleus',(0,0,-.55),(.58,.51,.69),'ice',1,.16,17)
    for i,(x,y,z) in enumerate([(-.33,.2,1.55),(.29,-.16,1.94),(.12,.33,1.26),(-.13,-.23,1.46),(0,.05,2.12)]):
        m.cyl('ion-tail-'+str(i),(x*.5,y*.5,-.12),(x,y,z),.13 if i!=4 else .18,'cyan' if i%2 else 'crystal',0,n=5)
    return m

def derelict():
    m=Model('derelict')
    m.prism('broken-fuselage',[(-.38,-.9),(.3,-.75),(.42,.28),(.15,.47),(-.34,.1)],-.20,.22,'gunmetal')
    m.box('charred-hull-section',(.03,.04,.66),(.5,.36,.40),'black',rot((0,1,0),.22))
    m.prism('torn-port-wing',[(-.28,-.1),(-1.05,.33),(-.88,.65),(-.31,.23)],-.055,.055,'steel',rot((0,0,1),.22))
    m.prism('torn-starboard-wing',[(.3,-.03),(.75,.2),(.69,.41),(.31,.26)],-.06,.06,'bronze',rot((0,0,1),-.24))
    m.box('bent-spine',(-.18,.3,.24),(.10,.13,.94),'bronze',rot((1,0,0),-.19))
    m.cyl('exposed-engine',(0,0,.76),(0,0,1.07),.22,'steel',n=8)
    m.cyl('dark-exhaust',(0,0,1.07),(0,0,1.1),.16,'black',n=8)
    for i,p in enumerate([(-.24,.22,.32),(.24,.15,.47)]):m.ellipsoid('exposed-sparking-core-'+str(i),p,(.08,.08,.1),'orange',0)
    return m

def cargo_crate():
    m=Model('cargo-crate');m.box('cargo-shell',(0,0,0),(1.25,1.0,1.15),'bronze')
    for x in [-.63,.63]:
        for y in [-.5,.5]:m.box('corner-rail',(x,y,0),(.15,.15,1.32),'gunmetal')
    for z in [-.61,.61]:
        m.box('vertical-lock-left',(-.47,0,z),(.11,.92,.1),'steel');m.box('vertical-lock-right',(.47,0,z),(.11,.92,.1),'steel')
        m.box('reinforced-lid',(0,0,z),(.73,.70,.09),'amber')
        m.box('cargo-seal',(0,0,z*1.1),(.36,.09,.035),'cyan')
    m.box('top-spine',(0,.53,0),(.2,.1,1.19),'gunmetal')
    return m

def fuel_tank():
    m=Model('fuel-tank');m.cyl('tank-vessel',(0,0,-.71),(0,0,.71),.41,'ivory',n=14)
    for z in [-.70,.70]:
        m.ellipsoid('pressure-dome',(0,0,z),(.41,.41,.19),'amber',1)
        m.torus('tank-band',(0,0,z*.65),.414,.035,'gunmetal',n=14,m=4,rotation=rot((1,0,0),PI/2))
    for x in [-.29,.29]:m.cyl('supply-line',(x,.35,-.71),(x,.35,.6),.048,'bronze',n=6)
    m.box('pressure-gauge',(0,.43,-.2),(.23,.075,.23),'gunmetal');m.box('gauge-light',(0,.475,-.2),(.15,.025,.12),'cyan')
    m.cyl('filler-nozzle',(0,0,.83),(0,0,1.02),.13,'gunmetal',n=8)
    return m

def proximity_mine():
    m=Model('proximity-mine');m.ellipsoid('armored-mine-core',(0,0,0),(.51,.51,.51),'gunmetal',1)
    directions=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1),(.65,.65,.65),(-.65,-.65,-.65)]
    for i,d in enumerate(directions):
        d=unit(d);m.cyl('detonator-spike-'+str(i),d*.40,d*.96,.14,'bronze',.025,n=5)
        m.ellipsoid('armed-warning-'+str(i),d*.96,(.067,.067,.067),'red',0)
    m.torus('warning-equator',(0,0,0),.485,.043,'orange',n=16,m=4)
    return m

def repair_pod():
    m=Model('repair-pod');m.ellipsoid('rescue-capsule',(0,0,0),(.48,.38,.72),'ivory',1)
    m.box('medical-cross-horizontal',(0,.35,-.11),(.57,.08,.15),'green')
    m.box('medical-cross-vertical',(0,.36,-.11),(.15,.08,.53),'green')
    for x in [-.53,.53]:
        m.box('stabilizer-pod',(x,0,.15),(.17,.18,.67),'gunmetal')
        m.cyl('pod-thruster',(x,0,.46),(x,0,.55),.075,'cyan',n=8)
        m.box('pod-arm',(x*.55,0,.15),(.35,.1,.12),'bronze')
    m.cyl('rescue-beacon',(0,.28,.43),(0,.66,.43),.043,'steel',n=6)
    m.ellipsoid('beacon-light',(0,.68,.43),(.09,.09,.09),'green',0)
    return m

def shield_buoy():
    m=Model('shield-buoy');orient=rot((1,0,0),PI/2)
    m.torus('projector-ring',(0,0,0),.69,.13,'steel',n=18,m=6,rotation=orient)
    m.torus('shield-emitter',(0,0,-.08),.69,.035,'cyan',n=24,m=4,rotation=orient)
    m.cyl('hexagonal-core',(0,0,-.20),(0,0,.23),.31,'gunmetal',n=6)
    m.cyl('shield-lens',(0,0,-.21),(0,0,-.25),.23,'cyan',n=6)
    for a in [PI/2,PI*7/6,PI*11/6]:
        p=np.array([math.cos(a),math.sin(a),0]);m.cyl('emitter-support',p*.26,p*.72,.065,'bronze',n=6)
    return m

def sputnik():
    m=Model('sputnik');m.ellipsoid('polished-satellite-body',(0,0,-.3),(.44,.44,.44),'steel',2)
    m.torus('body-seam',(0,0,-.3),.44,.018,'bronze',n=20,m=4,rotation=rot((1,0,0),PI/2))
    for i,(x,y) in enumerate([(-1,-.48),(1,-.48),(-.63,.7),(.63,.7)]):
        start=(x*.24,y*.24,-.08);end=(x*.82,y*.82,1.18)
        m.cyl('long-antenna-'+str(i),start,end,.019,'ivory',.009,n=5)
        m.ellipsoid('antenna-root-'+str(i),start,(.085,.085,.085),'bronze',0)
    m.ellipsoid('transmitter-light',(0,.4,-.37),(.055,.055,.055),'cyan',0)
    return m

def solar_satellite():
    m=Model('solar-satellite');m.box('gold-foil-bus',(0,0,0),(.45,.48,.49),'bronze')
    for side in [-1,1]:
        m.cyl('solar-arm',(side*.2,0,0),(side*1.18,0,0),.035,'steel',n=6)
        m.box('solar-panel-frame',(side*.85,0,0),(.9,.065,.79),'steel')
        for row in range(3):
            for col in range(4):m.box('photovoltaic-cell',(side*.85+(col-1.5)*.21,.04,(row-1)*.23),(.185,.02,.205),'solar')
    m.cyl('dish-mast',(0,.23,0),(0,.5,0),.034,'steel',n=6)
    m.cyl('antenna-dish',(0,.48,0),(0,.61,0),.21,'ivory',.07,n=12)
    m.cyl('antenna-receiver',(0,.58,0),(0,.73,0),.014,'bronze',n=5)
    m.box('status-indicator',(0,.08,-.253),(.23,.075,.015),'cyan')
    return m

def missile():
    m=Model('missile');m.cyl('missile-body',(0,0,-.61),(0,0,.65),.16,'ivory',n=10)
    m.cyl('seeker-cone',(0,0,-.61),(0,0,-1.03),.16,'red',0,n=10)
    m.cyl('warhead-collar',(0,0,-.45),(0,0,-.24),.165,'amber',n=10)
    for a in [0,PI/2,PI,PI*1.5]:
        m.prism('guidance-fin',[(.1,.2),(.5,.67),(.12,.6)],-.035,.035,'gunmetal',rotation=rot((0,0,1),a))
    m.cyl('rocket-nozzle',(0,0,.64),(0,0,.77),.18,'gunmetal',.13,n=10)
    m.cyl('rocket-flame',(0,0,.76),(0,0,1.11),.11,'orange',0,n=7)
    return m

def saucer_cruiser():
    m=Model('saucer-cruiser')
    m.ellipsoid('broad-command-disc',(0,.12,-.42),(.9,.17,.71),'ivory',2)
    m.ellipsoid('upper-disc',(0,.27,-.38),(.43,.12,.38),'steel',1)
    m.box('bridge-window',(0,.29,-.72),(.36,.065,.07),'cyan')
    m.prism('engineering-hull',[(-.23,-.1),(.23,-.1),(.3,.82),(-.3,.82)],-.18,.10,'gunmetal')
    for side in [-1,1]:
        m.box('swept-engine-pylon',(side*.47,.025,.52),(.67,.07,.16),'bronze',rot((0,1,0),-side*.3))
        m.cyl('long-drive-nacelle',(side*.78,.08,.05),(side*.78,.08,1.05),.13,'steel',n=10)
        m.cyl('engine-cap',(side*.78,.08,-.09),(side*.78,.08,.05),.08,'orange',.13,n=10)
        m.cyl('ion-exhaust',(side*.78,.08,1.05),(side*.78,.08,1.11),.1,'cyan',n=10)
    m.box('dorsal-stripe',(0,.14,.49),(.085,.035,.52),'amber')
    return m

def twinwing_fighter():
    m=Model('twinwing-fighter')
    m.cyl('armored-central-cockpit',(0,0,-.37),(0,0,.31),.24,'gunmetal',n=10)
    m.cyl('faceted-cockpit-glass',(0,0,-.38),(0,0,-.43),.18,'cyan',.13,n=8)
    for side in [-1,1]:
        m.cyl('wing-crossbar',(side*.16,0,.05),(side*.6,0,.05),.075,'bronze',n=8)
        # Swept shield wings with distinctive forked lower silhouettes.
        p=[(-.70,-.49),(.49,-.34),(.72,.28),(.1,.62),(-.31,.47),(-.64,.63)]
        # X/Z polygon transforms into Y/Z plane at constant X.
        orient=rot((0,0,1),PI/2)
        m.prism('tall-swept-wing',p,-.075,.075,'steel',rotation=orient,pos=(side*.66,0,0))
        p2=[(x*.8,z*.8) for x,z in p]
        m.prism('dark-wing-inset',p2,-.083,.083,'blueglass',rotation=orient,pos=(side*.66,0,0))
        m.cyl('wing-emitter',(side*.66,-.24,-.28),(side*.66,-.24,-.58),.032,'red',n=6)
    m.cyl('fighter-engine',(0,0,.31),(0,0,.47),.16,'orange',.11,n=8)
    return m

def wedge_destroyer():
    m=Model('wedge-destroyer')
    m.prism('angular-destroyer-hull',[(0,-1.24),(1,.66),(.82,1.0),(-.82,1.0),(-1,.66)],-.14,.09,'steel')
    m.prism('tiered-command-deck',[(0,-.67),(.63,.74),(-.63,.74)],.10,.24,'gunmetal')
    m.prism('central-armor-stripe',[(-.06,-.67),(.06,-.67),(.17,.77),(-.17,.77)],.243,.27,'bronze')
    m.box('bridge-tower',(0,.35,.56),(.25,.22,.23),'steel');m.box('bridge-crown',(0,.48,.56),(.55,.09,.2),'gunmetal')
    m.box('bridge-windows',(0,.48,.45),(.44,.034,.03),'cyan')
    for x in [-.53,0,.53]:
        m.cyl('destroyer-thruster',(x,-.01,.94),(x,-.01,1.15),.13 if x else .18,'gunmetal',n=10)
        m.cyl('destroyer-exhaust',(x,-.01,1.15),(x,-.01,1.19),.105 if x else .15,'cyan',n=10)
    for x in [-.40,.40]:m.cyl('deck-turret',(x,.17,.39),(x,.25,.39),.10,'bronze',n=8)
    return m

def ring_station():
    m=Model('ring-station');m.torus('habitat-ring',(0,0,0),.83,.12,'steel',n=24,m=6)
    m.torus('navigation-track',(0,.09,0),.83,.025,'cyan',n=24,m=4)
    m.cyl('central-docking-hub',(0,-.28,0),(0,.3,0),.22,'gunmetal',n=10)
    m.cyl('upper-beacon',(0,.3,0),(0,.39,0),.12,'amber',n=8)
    for i in range(6):
        a=2*PI*i/6;p=np.array([math.cos(a),0,math.sin(a)])
        m.cyl('radial-support',p*.18,p*.8,.045,'bronze',n=6)
        m.cyl('habitat-module',p*.84+np.array([0,-.2,0]),p*.84+np.array([0,.2,0]),.12,'ivory',n=8)
        m.ellipsoid('docking-lamp',p*.91+np.array([0,.22,0]),(.036,.036,.036),'orange',0)
    return m

def export_glb(model):
    buf=bytearray(); views=[];accessors=[];meshes=[];nodes=[]
    material_names=list(MATERIALS)
    def add_array(a,component,kind,target):
        while len(buf)%4:buf.append(0)
        start=len(buf);buf.extend(a.tobytes())
        vi=len(views);views.append({'buffer':0,'byteOffset':start,'byteLength':a.nbytes,'target':target})
        acc={'bufferView':vi,'componentType':component,'count':len(a),'type':kind}
        if kind=='VEC3':acc.update(min=a.min(0).tolist(),max=a.max(0).tolist())
        accessors.append(acc);return len(accessors)-1
    # Merge disconnected pieces that share a material to keep runtime draw calls low.
    groups={}
    for name,v,f,mat in model.parts:
        vertices,faces=groups.setdefault(mat,([],[]));offset=sum(len(a) for a in vertices)
        vertices.append(v);faces.append(f+offset)
    total_faces=0
    for mat,(vertices,faces) in groups.items():
        name=model.name+'-'+mat;v=np.concatenate(vertices);f=np.concatenate(faces)
        tri=v[f]; normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]); lens=np.linalg.norm(normals,axis=1)
        good=lens>1e-9;tri=tri[good];normals=normals[good]/lens[good,None]
        p=tri.reshape((-1,3)).astype('<f4');n=np.repeat(normals,3,axis=0).astype('<f4')
        ix=np.arange(len(p),dtype='<u2' if len(p)<65536 else '<u4')
        pi=add_array(p,5126,'VEC3',34962);ni=add_array(n,5126,'VEC3',34962);ii=add_array(ix,5123 if ix.dtype.itemsize==2 else 5125,'SCALAR',34963)
        meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':pi,'NORMAL':ni},'indices':ii,'material':material_names.index(mat)}]})
        nodes.append({'name':name,'mesh':len(meshes)-1});total_faces+=len(tri)
    mats=[]
    for name,(color,metal,rough,emissive) in MATERIALS.items():
        mat={'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':metal,'roughnessFactor':rough}}
        if emissive:mat['emissiveFactor']=emissive
        mats.append(mat)
    doc={'asset':{'version':'2.0','generator':'Space Race original encounter generator'},'scene':0,
         'scenes':[{'name':model.name,'nodes':list(range(len(nodes)))}],'nodes':nodes,'meshes':meshes,'materials':mats,
         'buffers':[{'byteLength':len(buf)}],'bufferViews':views,'accessors':accessors,
         'extras':{'license':'Original project artwork','forward':'-Z','up':'+Y','normalizedRadius':1}}
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);buf+=b'\0'*((-len(buf))%4)
    glb=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(buf))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(buf),b'BIN\0')+buf
    path=OUT/(model.name+'.glb');path.write_bytes(glb)
    verts=np.concatenate([p[1] for p in model.parts])
    return {'name':model.name,'triangles':total_faces,'bytes':len(glb),'sourceParts':len(model.parts),'drawCalls':len(groups),
            'min':np.round(verts.min(0),5).tolist(),'max':np.round(verts.max(0),5).tolist(),
            'radius':round(float(np.linalg.norm(verts,axis=1).max()),6)}

def render_model(model,size=256):
    # Deterministic orthographic CPU render, supersampled for crisp transparent cards.
    ss=3;canvas=Image.new('RGBA',(size*ss,size*ss),(0,0,0,0));draw=ImageDraw.Draw(canvas)
    view=unit([2.6,2.1,-3.6]);right=unit(np.cross([0,1,0],view));up=np.cross(view,right)
    light=unit([-1,2,-2]);keylight=unit([2,1,1]);polys=[];zoom=size*.435*ss;center=size*ss/2
    for _,v,f,mat in model.parts:
        color,metal,rough,emissive=MATERIALS[mat]
        for face in f:
            tri=v[face];normal=unit(np.cross(tri[1]-tri[0],tri[2]-tri[0]))
            if np.dot(normal,view)<=0:continue
            points=[(float(center+np.dot(p,right)*zoom),float(center-np.dot(p,up)*zoom)) for p in tri]
            lit=.27+.56*max(0,np.dot(normal,light))+.24*max(0,np.dot(normal,keylight))
            rgb=np.array(color[:3])*lit
            if emissive is not None:rgb+=np.array(emissive)*.45
            rgb=np.clip(rgb,0,1)**.8
            polys.append((float(tri.mean(0)@view),points,tuple((rgb*255).astype(int))+(255,)))
    for _,points,color in sorted(polys,key=lambda p:p[0]):draw.polygon(points,fill=color)
    return canvas.resize((size,size),Image.Resampling.LANCZOS)

def preview(models):
    W,H=1600,1600;cols=4;cw,ch=400,300
    im=Image.new('RGB',(W,H),(7,13,22));draw=ImageDraw.Draw(im)
    font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    try: title=ImageFont.truetype(font,27);label=ImageFont.truetype(font,18);small=ImageFont.truetype(font,14)
    except OSError:title=label=small=ImageFont.load_default()
    draw.text((30,20),'SPACE RACE / INTERACTIVE ENCOUNTERS',font=title,fill=(217,230,239))
    draw.text((30,57),'18 original low-poly models  •  PBR + emissive surfaces  •  All normalized to radius 1',font=small,fill=(123,155,180))
    preview_dir=ROOT.parent.parent/'public'/'object-previews';preview_dir.mkdir(exist_ok=True)
    for mi,model in enumerate(models):
        col=mi%cols;row=mi//cols;ox=col*cw;oy=90+row*ch
        draw.rounded_rectangle((ox+10,oy+8,ox+cw-10,oy+ch-5),radius=15,fill=(13,24,36),outline=(25,44,59),width=1)
        cx=ox+cw/2
        thumb=render_model(model);thumb.save(preview_dir/(model.name+'.png'));im.paste(thumb,(ox+72,oy-3),thumb)
        name=model.name.replace('-',' ').upper();bbox=draw.textbbox((0,0),name,font=label)
        draw.text((cx-(bbox[2]-bbox[0])/2,oy+248),name,font=label,fill=(220,230,235))
        triangles=sum(int(np.count_nonzero(np.linalg.norm(np.cross(v[f][:,1]-v[f][:,0],v[f][:,2]-v[f][:,0]),axis=1)>1e-9)) for _,v,f,_ in model.parts)
        sub=f'{triangles:,} triangles';bbox=draw.textbbox((0,0),sub,font=small)
        draw.text((cx-(bbox[2]-bbox[0])/2,oy+274),sub,font=small,fill=(109,141,162))
    im.save(ROOT/'encounter-contact-sheet.png')

def main():
    models=[rock_model('iron-asteroid','iron'),rock_model('ice-asteroid','ice'),rock_model('volatile-rock','volatile'),
            crystal_cluster(),comet(),derelict(),cargo_crate(),fuel_tank(),proximity_mine(),repair_pod(),shield_buoy(),
            sputnik(),solar_satellite(),missile(),saucer_cruiser(),twinwing_fighter(),wedge_destroyer(),ring_station()]
    stats=[export_glb(m.normalize()) for m in models]
    (ROOT/'asset-report.json').write_text(json.dumps(stats,indent=2)+'\n')
    preview(models)
    print(json.dumps({'models':len(stats),'triangles':sum(s['triangles'] for s in stats),'bytes':sum(s['bytes'] for s in stats),'max_triangles':max(s['triangles'] for s in stats)},indent=2))

if __name__=='__main__':main()

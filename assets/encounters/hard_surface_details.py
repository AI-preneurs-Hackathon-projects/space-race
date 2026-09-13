"""Attached detail pass for the nine manufactured Space Race encounter models.

Call enhance_model(model, model.name) on the generator's unnormalized Model,
before the owner converts parts to Blender meshes and normalizes the export.
This module has no file IO, imports no asset generator and generates no models.
Original silhouette parts are retained. Existing material groups are reused.
The owner supplies bevels, smooth/weighted normals and final export validation.
"""
import math
import numpy as np

PI = math.pi


def rot(axis, angle):
    axis = np.asarray(axis, float)
    axis /= max(float(np.linalg.norm(axis)), 1e-12)
    x, y, z = axis
    c, s, t = math.cos(angle), math.sin(angle), 1 - math.cos(angle)
    return np.array([[t*x*x+c, t*x*y-s*z, t*x*z+s*y],
                     [t*x*y+s*z, t*y*y+c, t*y*z-s*x],
                     [t*x*z-s*y, t*y*z+s*x, t*z*z+c]])


def _bolt(m, name, point, normal, radius=.018, material='steel'):
    p, n = np.asarray(point, float), np.asarray(normal, float)
    n /= max(float(np.linalg.norm(n)), 1e-12)
    # Shallow hexagonal heads, rooted in the mounting surface.
    m.cyl('detail_' + name, p-n*.003, p+n*.006, radius, material, n=6)


def _z_ring(m, name, x, y, z, radius, thickness, material='gunmetal', n=16):
    m.torus('detail_' + name, (x, y, z), radius, thickness, material,
            n=n, m=4, rotation=rot((1, 0, 0), PI/2))


def _louvers(m, name, center, width, length, count=5, material='gunmetal'):
    x, y, z = center
    for i in range(count):
        m.box('detail_' + name + '_' + str(i),
              (x, y, z + (i-(count-1)/2)*length/count),
              (width, .018, length/count*.48), material)


def _cargo(m):
    # Recessed-looking panels are solid plates seated in the original rails.
    for side in (-1, 1):
        z = side*.659
        for x in (-.47, .47):
            for y in (-.26, .26):
                m.box('detail_captive_latch_housing', (x, y, z),
                      (.15, .15, .045), 'gunmetal')
                m.box('detail_captive_latch_handle', (x, y, z+side*.021),
                      (.09, .065, .017), 'steel')
            for y in (-.39, .39):
                _bolt(m, 'lid_rail_fastener', (x, y, side*.665),
                      (0, 0, side), .018)
        for y in (-.31, .31):
            m.box('detail_lid_perimeter_rib', (0, y, side*.663),
                  (.61, .045, .032), 'bronze')
        for x in (-.23, .23):
            m.box('detail_seal_guard', (x, 0, side*.673),
                  (.043, .14, .025), 'gunmetal')
        # Side access faces stop short of the corner protection silhouette.
        m.box('detail_side_access_panel', (side*.63, 0, 0),
              (.026, .62, .86), 'amber')
        for z_side in (-.39, .39):
            m.box('detail_side_panel_border', (side*.645, 0, z_side),
                  (.018, .60, .035), 'steel')
        for y in (-.26, .26):
            for z_side in (-.32, .32):
                _bolt(m, 'side_panel_screw', (side*.648, y, z_side),
                      (side, 0, 0), .016)
    for x in (-.31, .31):
        m.box('detail_top_panel', (x, .511, 0), (.32, .022, 1.04), 'amber')
        for z in (-.43, .43):
            m.box('detail_top_hinge', (x, .535, z), (.21, .035, .09), 'steel')


def _fuel(m):
    for z in (-.455, .455):
        m.box('detail_band_clamp_block', (0, .425, z), (.17, .065, .105), 'gunmetal')
        for x in (-.051, .051):
            _bolt(m, 'band_clamp_screw', (x, .46, z), (0, 1, 0), .016, 'bronze')
    for x in (-.29, .29):
        for z in (-.58, .53):
            m.cyl('detail_pipe_compression_fitting', (x, .35, z-.045),
                  (x, .35, z+.045), .063, 'gunmetal', n=8)
        m.box('detail_pipe_saddle', (x, .31, .02), (.12, .08, .10), 'gunmetal')
    _z_ring(m, 'filler_thread_collar', 0, 0, .94, .133, .021, 'bronze', 16)
    m.cyl('detail_filler_recess', (0, 0, 1.007), (0, 0, 1.021), .085, 'bronze', n=12)
    for z in (-.69, .69):
        _z_ring(m, 'pressure_end_flange', 0, 0, z, .393, .018, 'gunmetal', 20)
    # Gauge gets a metal frame; preserve its existing cyan display.
    for x in (-.103, .103):
        m.box('detail_gauge_frame', (x, .476, -.2), (.019, .027, .23), 'bronze')
    for z in (-.304, -.096):
        m.box('detail_gauge_frame', (0, .476, z), (.20, .027, .019), 'bronze')
    for side in (-1, 1):
        m.box('detail_pressure_vessel_longitudinal_rib', (side*.411, 0, 0),
              (.016, .06, .80), 'gunmetal')


def _repair(m):
    # Protective seams and service hatch fit between the cross and thrusters.
    for x in (-.36, .36):
        m.box('detail_capsule_side_seam', (x, .085, .04), (.025, .065, .79), 'bronze')
    m.box('detail_aft_service_hatch_frame', (0, .307, .32), (.28, .045, .20), 'gunmetal')
    m.box('detail_aft_service_hatch', (0, .335, .32), (.23, .022, .15), 'ivory')
    for x in (-.089, .089):
        _bolt(m, 'service_hatch_screw', (x, .349, .32), (0, 1, 0), .012)
    for side in (-1, 1):
        x = side*.53
        m.box('detail_stabilizer_armor', (x, .097, .11), (.145, .022, .48), 'steel')
        for z in (-.10, .31):
            m.box('detail_stabilizer_end_band', (x, .105, z), (.16, .029, .05), 'bronze')
        _louvers(m, 'stabilizer_cooling', (x, .115, .12), .105, .25, 4)
        _z_ring(m, 'thruster_armored_collar', x, 0, .508, .079, .018, 'steel', 12)
        m.cyl('detail_thruster_root', (x, 0, .405), (x, 0, .463), .090, 'gunmetal', n=12)
        for z in (-.075, .29):
            _bolt(m, 'pod_retaining_bolt', (x, .125, z), (0, 1, 0), .012)
    m.cyl('detail_beacon_socket', (0, .28, .43), (0, .40, .43), .064, 'bronze', n=10)
    m.cyl('detail_beacon_insulator', (0, .56, .43), (0, .60, .43), .050, 'ivory', n=8)


def _shield(m):
    # Clamp segments sit on the physical projector ring, never in free space.
    for i in range(8):
        a = i*PI/4
        x, y = .692*math.cos(a), .692*math.sin(a)
        m.box('detail_ring_segment_clamp', (x, y, -.112),
              (.13, .065, .060), 'gunmetal', rotation=rot((0, 0, 1), a))
        _bolt(m, 'ring_segment_bolt', (x, y, -.146), (0, 0, -1), .016, 'bronze')
    _z_ring(m, 'lens_retaining_frame', 0, 0, -.225, .247, .020, 'steel', 18)
    _z_ring(m, 'rear_core_collar', 0, 0, .199, .282, .018, 'bronze', 18)
    for a in (PI/2, PI*7/6, PI*11/6):
        p = np.array([math.cos(a), math.sin(a), 0.0])
        m.cyl('detail_spoke_root_joint', p*.285, p*.375, .083, 'steel', n=8)
        m.cyl('detail_spoke_ring_joint', p*.586, p*.676, .080, 'gunmetal', n=8)
    for i in range(6):
        a = i*PI/3
        _bolt(m, 'core_cover_fastener', (.275*math.cos(a), .275*math.sin(a), -.205),
              (0, 0, -1), .012, 'bronze')


def _solar(m):
    for side in (-1, 1):
        x = side*.85
        for z in (-.374, .374):
            m.box('detail_panel_edge_rail', (x, .039, z), (.887, .031, .024), 'steel')
        for edge in (-1, 1):
            m.box('detail_panel_edge_rail', (x+edge*.434, .039, 0), (.023, .031, .76), 'steel')
        for z in (-.115, .115):
            m.box('detail_panel_cell_busbar', (x, .054, z), (.823, .007, .012), 'bronze')
        for col in (-1.5, -.5, .5, 1.5):
            m.box('detail_cell_current_collector', (x+col*.21, .054, 0),
                  (.008, .007, .655), 'steel')
        m.cyl('detail_deployment_hinge', (side*.30, -.065, 0),
              (side*.30, .065, 0), .072, 'steel', n=10)
        m.cyl('detail_arm_compression_sleeve', (side*.32, 0, 0),
              (side*.43, 0, 0), .052, 'bronze', n=10)
        for z in (-.183, .183):
            m.box('detail_bus_corner_protection', (side*.213, 0, z),
                  (.031, .455, .048), 'steel')
        m.box('detail_bus_access_cover', (side*.231, 0, 0),
              (.022, .24, .235), 'ivory')
    m.box('detail_front_equipment_panel', (0, -.077, -.254), (.30, .14, .020), 'ivory')
    for x in (-.104, .104):
        _bolt(m, 'bus_panel_fastener', (x, -.075, -.267), (0, 0, -1), .013, 'bronze')
    m.cyl('detail_mast_mount', (0, .23, 0), (0, .30, 0), .08, 'bronze', n=10)
    # A narrow rim refines the dish without adding another orbital ring.
    m.torus('detail_dish_rim', (0, .486, 0), .196, .012, 'steel', n=20, m=4)


def _missile(m):
    for z in (-.54, -.19, .15, .59):
        _z_ring(m, 'fuselage_joint_collar', 0, 0, z, .159, .012, 'gunmetal', 16)
    # Small optical aperture is seated inside the original pointed red nose.
    m.cyl('detail_seeker_aperture_housing', (0, 0, -.895), (0, 0, -.941),
          .048, 'gunmetal', .033, n=12)
    for a in (0, PI/2, PI, PI*1.5):
        r = rot((0, 0, 1), a)
        m.box('detail_fin_root_shoe', (0, 0, 0), (.07, .068, .34), 'amber', rotation=r)
        # Move the just-created shoe into the base of the corresponding fin.
        part_name, vertices, faces, mat = m.parts[-1]
        m.parts[-1] = (part_name, vertices + r@np.array([.159, 0, .40]), faces, mat)
        for z in (.28, .52):
            p = r@np.array([.185, 0, z])
            _bolt(m, 'fin_root_fastener', p, r@np.array([1, 0, 0]), .012, 'gunmetal')
    _z_ring(m, 'nozzle_armored_lip', 0, 0, .737, .146, .018, 'gunmetal', 16)
    for a in (PI/4, PI*3/4, PI*5/4, PI*7/4):
        n = np.array([math.cos(a), math.sin(a), 0])
        p = n*.158 + np.array([0, 0, -.33])
        _bolt(m, 'warhead_collar_fastener', p, n, .011, 'gunmetal')


def _saucer(m):
    # Secondary deck plates fit on the engineering hull; the disc stays round.
    for side in (-1, 1):
        m.prism('detail_engineering_armor_plate',
                [(side*.055, .10), (side*.24, .20), (side*.255, .72), (side*.06, .72)],
                .104, .129, 'steel')
        _louvers(m, 'engineering_radiator', (side*.156, .144, .46), .135, .34, 5)
        x = side*.78
        for z in (.13, .49, .91):
            _z_ring(m, 'nacelle_section_collar', x, .08, z, .13, .014, 'gunmetal', 16)
        m.box('detail_nacelle_dorsal_armor', (x, .21, .54), (.14, .023, .70), 'ivory')
        _louvers(m, 'nacelle_radiator', (x, .228, .60), .09, .28, 4)
        _z_ring(m, 'nacelle_exhaust_rim', x, .08, 1.071, .112, .016, 'gunmetal', 16)
        # Mounted cannon assemblies sit in the original command-disc envelope.
        m.box('detail_pulse_cannon_mount', (side*.48, .165, -.78),
              (.15, .10, .16), 'steel')
        m.cyl('detail_pulse_cannon_shroud', (side*.48, .17, -.79),
              (side*.48, .17, -.92), .045, 'gunmetal', n=12)
        m.cyl('detail_pulse_cannon_barrel', (side*.48, .17, -.90),
              (side*.48, .17, -.967), .023, 'bronze', n=10)
        m.box('detail_bridge_side_frame', (side*.184, .293, -.722),
              (.021, .081, .083), 'gunmetal')
    for z in (-.752, -.69):
        m.box('detail_bridge_window_frame', (0, .293, z), (.377, .013, .019), 'gunmetal')
    for x in (-.06, .06):
        m.box('detail_bridge_window_mullion', (x, .292, -.757), (.012, .067, .012), 'steel')
    # Flush service sockets on the upper command dome.
    for side in (-1, 1):
        m.cyl('detail_command_service_socket', (side*.18, .340, -.35),
              (side*.18, .365, -.35), .069, 'gunmetal', n=12)
        m.cyl('detail_command_service_cover', (side*.18, .362, -.35),
              (side*.18, .370, -.35), .051, 'steel', n=12)


def _fighter(m):
    # Retain the faceted canopy shape but let it read as glass, not a lamp.
    m.parts = [(n, v, f, 'blueglass' if n == 'faceted-cockpit-glass' else material)
               for n, v, f, material in m.parts]
    _z_ring(m, 'cockpit_front_retaining_ring', 0, 0, -.393, .19, .019, 'steel', 16)
    for a in (0, PI/2, PI, PI*1.5):
        p = np.array([math.cos(a), math.sin(a), 0])
        m.cyl('detail_canopy_radial_frame', p*.13+np.array([0, 0, -.434]),
              p*.184+np.array([0, 0, -.395]), .009, 'gunmetal', n=6)
    _z_ring(m, 'cockpit_aft_frame', 0, 0, .25, .24, .017, 'steel', 16)
    _z_ring(m, 'engine_retaining_lip', 0, 0, .398, .137, .017, 'gunmetal', 16)
    for side in (-1, 1):
        for x in (.28, .53):
            m.cyl('detail_wing_joint_collar', (side*(x-.034), 0, .05),
                  (side*(x+.034), 0, .05), .096, 'steel', n=10)
        # Both wing faces receive narrow inset stiffeners, within the fork outline.
        for face in (-1, 1):
            x = side*.66 + face*.088
            for y in (-.22, .10, .38):
                m.box('detail_wing_inset_transverse_rib', (x, y, .08),
                      (.015, .029, .43), 'gunmetal')
            m.box('detail_wing_inset_longitudinal_rib', (x, .065, .08),
                  (.015, .56, .026), 'steel')
            for y in (-.22, .38):
                for z in (-.13, .27):
                    _bolt(m, 'wing_frame_fastener', (x, y, z), (face, 0, 0), .011, 'bronze')
        x = side*.66
        m.cyl('detail_wing_cannon_casing', (x, -.24, -.30),
              (x, -.24, -.49), .059, 'gunmetal', n=12)
        _z_ring(m, 'wing_cannon_muzzle_collar', x, -.24, -.493, .041, .009, 'steel', 12)
        m.box('detail_cannon_wing_mount', (x, -.24, -.285), (.13, .11, .105), 'bronze')
    for y in (-.155, .155):
        m.box('detail_cockpit_sensor_inset', (0, y, -.398), (.072, .025, .018), 'cyan')


def _destroyer(m):
    for side in (-1, 1):
        # Shallow interlocking armor islands follow the original wedge edges.
        for index, (z0, z1, outer0, outer1) in enumerate((
                (-.58, -.18, .25, .47), (-.12, .30, .49, .71), (.36, .72, .74, .91))):
            m.prism('detail_outer_hull_armor_'+str(index),
                    [(side*(outer0-.14), z0), (side*outer0, z0),
                     (side*outer1, z1), (side*(outer1-.14), z1)],
                    .094, .116, 'gunmetal')
        m.prism('detail_upper_deck_plate',
                [(side*.145, -.15), (side*.225, -.06),
                 (side*.46, .59), (side*.24, .59)], .244, .266, 'steel')
        _louvers(m, 'dorsal_heat_exchanger', (side*.315, .278, .405), .10, .235, 5)
        x = side*.40
        _z_ring(m, 'turret_barrel_collar', x, .235, .277, .041, .010, 'steel', 12)
        m.cyl('detail_pulse_turret_breech', (x, .231, .39),
              (x, .231, .27), .052, 'gunmetal', n=12)
        m.cyl('detail_pulse_turret_barrel', (x, .235, .27),
              (x, .235, .10), .025, 'steel', n=12)
        for z in (.28, .50):
            _bolt(m, 'deck_access_fastener', (side*.52, .122, z), (0, 1, 0), .016, 'bronze')
        m.box('detail_bridge_side_protection', (side*.145, .347, .56),
              (.044, .17, .22), 'gunmetal')
    for x in (-.53, 0, .53):
        r = .13 if x else .18
        _z_ring(m, 'engine_root_flange', x, -.01, .986, r, .018, 'steel', 16)
        _z_ring(m, 'engine_armored_exit', x, -.01, 1.141, r*.88, .019, 'steel', 16)
        for side in (-1, 1):
            m.box('detail_engine_mount_rail', (x+side*r*.60, .075, .965),
                  (.037, .050, .21), 'gunmetal')
    for x in (-.147, 0, .147):
        m.box('detail_bridge_window_mullion', (x, .48, .431), (.013, .043, .016), 'steel')
    m.box('detail_bridge_roof_access', (0, .529, .56), (.25, .014, .14), 'bronze')


_PASSES = {
    'cargo-crate': _cargo,
    'fuel-tank': _fuel,
    'repair-pod': _repair,
    'shield-buoy': _shield,
    'solar-satellite': _solar,
    'missile': _missile,
    'saucer-cruiser': _saucer,
    'twinwing-fighter': _fighter,
    'wedge-destroyer': _destroyer,
}


def enhance_model(model, name):
    """Add attached manufactured details in raw coordinates; return the same Model.

    Unknown names are untouched. Repeated calls on the same instance do nothing.
    Final bevels, normals, centered radius-one normalization and preview export
    belong to the owner pipeline, not this helper.
    """
    if name not in _PASSES or getattr(model, '_surface_details_applied', False):
        return model
    _PASSES[name](model)
    model._surface_details_applied = True
    return model

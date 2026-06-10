"""Headless Blender repaint of the bunker vessel GLB.

Run with:
  D:\\blender.exe --background --python frontend/scripts/repaint_vessel.py

Edits material base colors to give the bunker barge a black hull,
white superstructure, red boot stripe + funnel, blue tinted glass.
Re-exports to the same path so the FE picks it up automatically.
"""
import bpy
import os

GLB_IN  = r"D:/bunkerguard-ai/frontend/public/models/bunkering_vessel_complete.glb"
GLB_OUT = GLB_IN  # overwrite in place

PALETTE = {
    'Hull_Material':   (0.05, 0.06, 0.09),
    'Tank_DarkRed':    (0.55, 0.10, 0.10),
    'Window_Blue':     (0.10, 0.20, 0.42),
    'BridgeGlass':     (0.18, 0.28, 0.48),
    'DeckGrey':        (0.34, 0.34, 0.33),
    'SuperWhite':      (0.92, 0.92, 0.90),
    'DeckHouse_White': (0.92, 0.92, 0.90),
    'Name_White':      (0.96, 0.96, 0.94),
    'WhiteMat':        (0.94, 0.94, 0.94),
    'DarkBlue':        (0.10, 0.15, 0.25),
    'FunnelRed':       (0.62, 0.10, 0.10),
    'YellowSafety':    (0.95, 0.78, 0.10),
    'LifeboatOrange':  (0.95, 0.40, 0.05),
}


def main():
    # Start from an empty scene so re-runs don't accumulate copies.
    bpy.ops.wm.read_factory_settings(use_empty=True)

    bpy.ops.import_scene.gltf(filepath=GLB_IN)

    changed = 0
    for mat in bpy.data.materials:
        if mat.name not in PALETTE:
            continue
        rgb = PALETTE[mat.name]
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        bsdf.inputs['Base Color'].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        if mat.name in ('BridgeGlass', 'Window_Blue'):
            bsdf.inputs['Roughness'].default_value = 0.15
            bsdf.inputs['Metallic'].default_value  = 0.0
        elif mat.name in ('Hull_Material', 'Tank_DarkRed', 'FunnelRed'):
            bsdf.inputs['Roughness'].default_value = 0.55
            bsdf.inputs['Metallic'].default_value  = 0.05
        else:
            bsdf.inputs['Roughness'].default_value = 0.65
        changed += 1
    print(f"[repaint_vessel] palette applied to {changed} materials")

    bpy.ops.export_scene.gltf(
        filepath=GLB_OUT,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
        export_yup=True,
    )
    sz = os.path.getsize(GLB_OUT) / (1024 * 1024)
    print(f"[repaint_vessel] re-exported {GLB_OUT} ({sz:.2f} MB)")


if __name__ == '__main__':
    main()

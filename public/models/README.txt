Real car models (optional)
==========================
Put up to 4 binary glTF files here:  car0.glb  car1.glb  car2.glb  car3.glb
(car0 = Falcon GT, car1 = Vortex RS, car2 = Titan V8, car3 = Nova X)
Any slot without a file keeps the built-in procedural car.

Tips
- Free CC0 / properly licensed models only (e.g. kenney.nl, poly.pizza, quaternius.com). CC-BY needs a credit line in the README.
- Keep each file under ~5 MB and under ~100k triangles so mid-range phones stay smooth. Draco-compressed .glb works.
- The model is auto-centred, put on the ground and scaled to car length (~4.5 m).
- Body paint: materials whose name contains body / paint / carpaint / exterior / shell take the colour picked in the Garage.

Optional config.json (same folder):
{ "0": { "rotY": 180, "scale": 1, "length": 4.6, "y": 0, "spin": false } }
- rotY: 180 if the car drives backwards. length: target length in metres. y: lift/lower. spin: spin wheels named *wheel*/*tire* (try only if it looks right).

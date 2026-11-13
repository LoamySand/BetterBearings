"""KAN-42: packs build.mjs's favicon-16/32/48.png into favicon.ico (each size drawn, not scaled), then removes them."""
import sys
from pathlib import Path
from PIL import Image

out = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "../public")
imgs = [Image.open(out / f"favicon-{s}.png").convert("RGBA") for s in (48, 32, 16)]
imgs[0].save(out / "favicon.ico", sizes=[(48, 48), (32, 32), (16, 16)], append_images=imgs[1:])
for s in (16, 32, 48):
    (out / f"favicon-{s}.png").unlink()
print("wrote", out / "favicon.ico")

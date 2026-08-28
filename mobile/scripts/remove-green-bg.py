"""
remove-green-bg.py -- Xoa nen xanh la (chroma key) khoi PNG mascot
"""
import sys
from PIL import Image
import numpy as np

def remove_green_background(input_path, output_path, tolerance=60):
    img = Image.open(input_path).convert("RGBA")
    arr = np.array(img, dtype=np.int32)

    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    # Mask: green channel >> red and blue => chroma key pixels
    mask = (g > r + tolerance) & (g > b + tolerance) & (g > 100)
    arr[:,:,3] = np.where(mask, 0, a)

    result = Image.fromarray(arr.astype(np.uint8), "RGBA")
    result.save(output_path, "PNG")
    print("Saved:", output_path)

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else r"C:\QuangHy\Mogu\mobile\src\assets\images\home\mogu-budget.png"
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    remove_green_background(src, dst)
    print("Done!")

"""
remove-black-bg.py -- Xoa nen den (flood-fill tu goc) khoi PNG mascot
"""
import sys
from PIL import Image
import numpy as np
from collections import deque

def remove_black_bg(input_path, output_path, threshold=40):
    img = Image.open(input_path).convert("RGBA")
    arr = np.array(img, dtype=np.uint8)
    h, w = arr.shape[:2]
    alpha = arr[:, :, 3].copy()

    # Tao mask: pixel "toi" (r,g,b ca 3 < threshold)
    r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)
    is_dark = (r < threshold) & (g < threshold) & (b < threshold)

    # BFS flood fill tu 4 goc
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()
    seeds = [(0,0),(0,w-1),(h-1,0),(h-1,w-1)]
    for sy, sx in seeds:
        if is_dark[sy, sx] and not visited[sy, sx]:
            queue.append((sy, sx))
            visited[sy, sx] = True

    while queue:
        y, x = queue.popleft()
        alpha[y, x] = 0
        for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_dark[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    arr[:, :, 3] = alpha
    result = Image.fromarray(arr, "RGBA")
    result.save(output_path, "PNG")
    print("Saved:", output_path)

if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    remove_black_bg(src, dst)
    print("Done!")

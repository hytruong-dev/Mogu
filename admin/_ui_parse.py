import re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
xml = open(r"c:\QuangHy\Mogu\mobile\ui-verify.xml", encoding="utf-8", errors="ignore").read()
seen = set()
for m in re.finditer(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml):
    t, x1, y1, x2, y2 = m.group(1), *map(int, m.groups()[1:])
    if not t.strip():
        continue
    key = (t, x1, y1)
    if key in seen:
        continue
    seen.add(key)
    print(f"{t} | mid=({(x1+x2)//2},{(y1+y2)//2})")

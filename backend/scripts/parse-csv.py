import csv, json, re, sys

# Read with latin-1 to preserve bytes, then fix common Vietnamese diacritics patterns
with open(r'c:\Users\PC\Downloads\1000_nguyen_lieu_am_thuc_viet_nam.csv', encoding='latin-1', errors='replace') as f:
    content = f.read()

lines = content.split('\n')
print(f'Total lines: {len(lines)}', file=sys.stderr)

rows = []
reader = csv.reader(lines)
header = next(reader)
print(f'Header: {header}', file=sys.stderr)

for row in reader:
    if len(row) >= 3 and row[0].strip().isdigit():
        stt = int(row[0].strip())
        nhom = row[1].strip()
        ten = row[2].strip()
        rows.append({'stt': stt, 'nhom': nhom, 'ten': ten})

print(f'Total valid rows: {len(rows)}', file=sys.stderr)

# Show first 20
for r in rows[:20]:
    print(f"  [{r['nhom']}] {r['ten']}", file=sys.stderr)

print('...', file=sys.stderr)

# Show unique groups
groups = sorted(set(r['nhom'] for r in rows))
print(f'\nGroups ({len(groups)}):', file=sys.stderr)
for g in groups:
    count = sum(1 for r in rows if r['nhom'] == g)
    print(f'  [{count:3d}] {g}', file=sys.stderr)

# Output JSON
print(json.dumps(rows, ensure_ascii=False))

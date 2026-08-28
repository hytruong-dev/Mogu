import csv, sys
from urllib.parse import unquote

with open(r'c:\Users\PC\Downloads\1000_nguyen_lieu_link_anh_online (1).csv', encoding='latin-1', errors='replace') as f:
    reader = csv.reader(f)
    header = next(reader)
    print('Header:', header)
    print()
    rows = list(reader)

print(f'Total rows: {len(rows)}')
print()

# Check if "Ảnh" column has real image URLs or Google search URLs
img_col = 0  # index
real_img = 0
google_search = 0
empty = 0
other = 0

for r in rows:
    if not r or len(r) < 1:
        continue
    url = r[0].strip()
    if not url:
        empty += 1
    elif 'google.com/search' in url:
        google_search += 1
    elif url.startswith('http') and any(ext in url for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
        real_img += 1
    elif url.startswith('http'):
        other += 1
    else:
        empty += 1

print(f'Google search URLs: {google_search}')
print(f'Real image URLs: {real_img}')
print(f'Other HTTP URLs: {other}')
print(f'Empty: {empty}')
print()

# Show columns
print('Columns:', header)
print()

# Show 5 with decoded query
for r in rows[:5]:
    if len(r) >= 4:
        url = r[0].strip()
        name = r[1].strip()
        code = r[2].strip()
        unit = r[3].strip()
        allergen = r[4].strip() if len(r) > 4 else ''
        # Decode Google search query
        if 'tbm=isch&q=' in url:
            q = url.split('tbm=isch&q=')[1].split('&')[0]
            q_decoded = unquote(q)
        else:
            q_decoded = ''
        print(f'  name={name!r} code={code!r} unit={unit!r} allergen={allergen!r}')
        print(f'  search_query={q_decoded!r}')
        print()

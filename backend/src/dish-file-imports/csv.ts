export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) return { headers: [], rows: [] }
  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const rec: Record<string, string> = {}
    headers.forEach((h, i) => {
      rec[h] = (cols[i] ?? '').trim()
    })
    return rec
  })
  return { headers, rows }
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else cur += ch
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

export const DISH_IMPORT_TEMPLATE = `name,alternateNames,region,categories,mealTypes,ingredients,calories,proteinG,carbsG,fatG,fiberG,sodiumMg,shortDescription,prepMinutes,cookMinutes
Pho bo,Pho,"Mien Bac","Mon nuoc;Pho","Bua sang;Bua trua","Banh pho 400g;Thit bo 200g",520,26,63,14,2,900,"Pho bo truyen thong Ha Noi",20,45
`
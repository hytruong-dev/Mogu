import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parses header and rows', () => {
    const { headers, rows } = parseCsv('name,calories\nPho,520\nBun cha,480\n')
    expect(headers).toEqual(['name', 'calories'])
    expect(rows).toHaveLength(2)
    expect(rows[0].name).toBe('Pho')
    expect(rows[1].calories).toBe('480')
  })

  it('handles quoted commas', () => {
    const { rows } = parseCsv('name,desc\n"Pho, Ha Noi","A, B"\n')
    expect(rows[0].name).toBe('Pho, Ha Noi')
    expect(rows[0].desc).toBe('A, B')
  })
})

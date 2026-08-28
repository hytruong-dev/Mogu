import * as XLSX from 'xlsx'

/** Chuyển file Excel sang CSV text để gửi lên API import */
export async function fileToCsvText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    return file.text()
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.SheetNames[0]
    if (!sheet) throw new Error('File Excel không có sheet nào.')
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet])
    return csv
  }
  throw new Error('Chỉ hỗ trợ CSV hoặc Excel (.xlsx, .xls).')
}

export function listExcelSheets(file: File): Promise<string[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: 'array' })
    return wb.SheetNames
  })
}

export async function excelSheetToCsv(file: File, sheetName: string): Promise<string> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new Error(`Không tìm thấy sheet "${sheetName}"`)
  return XLSX.utils.sheet_to_csv(sheet)
}

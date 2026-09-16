import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { DishCommandService } from '../dishes/services/dish-command.service'
import { PrismaService } from '../prisma/prisma.service'
import { DISH_IMPORT_TEMPLATE, parseCsv } from './csv'

type MapCol = { source: string; target: string }

export interface ImportOptionsSnapshot {
  duplicateMode: 'SKIP' | 'CREATE_NEW' | 'UPDATE_DRAFT_ONLY'
  imageImportMode?: 'DOWNLOAD_TO_R2' | 'URL_ONLY'
  unknownIngredientMode?: 'CREATE_SUGGESTION' | 'SKIP'
  failureMode?: 'PARTIAL_SUCCESS' | 'ROLLBACK_ALL'
  outputStatus?: 'DRAFT'
}

export interface ImportSessionState {
  id: string
  createdById: string
  originalFileName: string
  csvText: string
  headers: string[]
  rawRows: Record<string, string>[]
  mapping: MapCol[]
  headerRow: number
  sheetName?: string
  multiValueSeparator: string
  options: ImportOptionsSnapshot
  duplicateMode: 'SKIP' | 'CREATE_NEW' | 'UPDATE_DRAFT_ONLY'
  status: string
  cancelRequested: boolean
  createdCount: number
  skippedCount: number
  failedCount: number
  warningCount: number
  processedRows: number
  jobId?: string
  rowPatches: Record<number, Record<string, string>>
  normalized?: Array<{
    rowNumber: number
    status: string
    mapped: Record<string, string>
    duplicateDishId?: string
    issues: any[]
    createdDishId?: string
  }>
  validationSummary?: {
    total: number
    valid: number
    warning: number
    error: number
    duplicate: number
    eligibleRows: number
  }
}

@Injectable()
export class DishFileImportsService {
  private readonly memory = new Map<string, ImportSessionState>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly dishes: DishCommandService,
  ) {}

  getTemplate() {
    return DISH_IMPORT_TEMPLATE
  }

  async createSession(actorId: string, fileName: string, csvText: string) {
    if (!csvText?.trim()) {
      throw new BadRequestException({ error: { code: 'IMPORT_FILE_UNSUPPORTED', message: 'File rỗng hoặc không đọc được.' } })
    }
    const { headers, rows } = parseCsv(csvText)
    if (rows.length > 10000) {
      throw new BadRequestException({ error: { code: 'IMPORT_FILE_TOO_LARGE', message: 'Tối đa 10.000 dòng.' } })
    }
    const id = randomUUID()
    const mapping = this.autoMap(headers)
    const session: ImportSessionState = {
      id,
      createdById: actorId,
      originalFileName: fileName || 'upload.csv',
      csvText,
      headers,
      rawRows: rows,
      mapping,
      headerRow: 1,
      multiValueSeparator: ';',
      options: { duplicateMode: 'SKIP', outputStatus: 'DRAFT', failureMode: 'PARTIAL_SUCCESS' },
      duplicateMode: 'SKIP',
      status: 'UPLOADED',
      cancelRequested: false,
      createdCount: 0,
      skippedCount: 0,
      failedCount: 0,
      warningCount: 0,
      processedRows: 0,
      rowPatches: {},
    }
    this.memory.set(id, session)
    await this.persistSession(session).catch(() => undefined)
    return this.sessionPayload(session)
  }

  async getSession(id: string) {
    const s = await this.loadSession(id)
    return this.sessionPayload(s)
  }

  saveMapping(id: string, mapping: MapCol[], extra?: { headerRow?: number; sheetName?: string; multiValueSeparator?: string }) {
    const s = this.getSessionSync(id)
    const targets = mapping.map((m) => m.target).filter(Boolean)
    if (new Set(targets).size !== targets.length) {
      throw new BadRequestException({ error: { code: 'IMPORT_MAPPING_INVALID', message: 'Mỗi trường đích chỉ map một cột.' } })
    }
    if (!targets.includes('name')) {
      throw new BadRequestException({ error: { code: 'IMPORT_MAPPING_INVALID', message: 'Bắt buộc map cột name.' } })
    }
    s.mapping = mapping
    if (extra?.headerRow) s.headerRow = extra.headerRow
    if (extra?.sheetName) s.sheetName = extra.sheetName
    if (extra?.multiValueSeparator) s.multiValueSeparator = extra.multiValueSeparator
    s.status = 'MAPPING'
    void this.persistSession(s)
    return { sessionId: id, mapping, headerRow: s.headerRow, sheetName: s.sheetName }
  }

  async validate(id: string) {
    const s = this.getSessionSync(id)
    const result = await this.computeValidation(s)
    s.normalized = result.issues
    s.validationSummary = result.summary
    s.status = 'READY'
    void this.persistSession(s)
    return {
      summary: result.summary,
      canStart: result.summary.eligibleRows > 0,
      eligibleRows: result.summary.eligibleRows,
      sampleIssues: result.issues.filter((i) => i.status !== 'VALID').slice(0, 20),
      issues: result.issues,
    }
  }

  patchRow(id: string, rowNumber: number, patch: Record<string, string>) {
    const s = this.getSessionSync(id)
    s.rowPatches[rowNumber] = { ...(s.rowPatches[rowNumber] ?? {}), ...patch }
    return this.revalidateRow(id, rowNumber)
  }

  async revalidateRow(id: string, rowNumber: number) {
    const s = this.getSessionSync(id)
    const byName = await this.getNameIndex()
    const row = this.revalidateSingleRow(s, rowNumber, undefined, byName)
    if (s.normalized) {
      const idx = s.normalized.findIndex((r) => r.rowNumber === rowNumber)
      if (idx >= 0) s.normalized[idx] = row
    }
    return row
  }

  saveOptions(id: string, options: Partial<ImportOptionsSnapshot>) {
    const s = this.getSessionSync(id)
    s.options = { ...s.options, ...options }
    if (options.duplicateMode) s.duplicateMode = options.duplicateMode
    void this.persistSession(s)
    return { sessionId: id, options: s.options }
  }

  async start(id: string, actorId: string) {
    const s = this.getSessionSync(id)
    if (s.status === 'IMPORTING' || s.status === 'DONE') {
      throw new BadRequestException({ error: { code: 'IMPORT_ALREADY_STARTED', message: 'Session đã chạy job.' } })
    }
    if (!s.normalized?.length) {
      await this.validate(id)
    }
    const jobId = randomUUID()
    s.jobId = jobId
    s.status = 'QUEUED'
    void this.persistSession(s)
    setTimeout(() => {
      void this.runJob(s, actorId)
    }, 50)
    return {
      jobId,
      status: 'PENDING',
      totalRows: s.validationSummary?.eligibleRows ?? s.rawRows.length,
      statusUrl: `/v1/admin/dish-imports/jobs/${jobId}`,
    }
  }

  getJob(jobId: string) {
    const s = this.findJobSession(jobId)
    const total = s.rawRows.length
    const summary = s.validationSummary
    return {
      id: jobId,
      sessionId: s.id,
      status: s.status,
      progressPercent: total ? Math.round((s.processedRows / total) * 100) : 0,
      currentPhase: s.status,
      processedRows: s.processedRows,
      totalRows: total,
      createdCount: s.createdCount,
      warningCount: s.warningCount,
      skippedCount: s.skippedCount,
      failedCount: s.failedCount,
      eligibleRows: summary?.eligibleRows ?? 0,
      cancelAllowed: s.status === 'QUEUED' || s.status === 'IMPORTING',
      updatedAt: new Date().toISOString(),
    }
  }

  getJobRows(jobId: string, status?: string, limit = 100, offset = 0) {
    const s = this.findJobSession(jobId)
    let rows = s.normalized ?? []
    if (status) rows = rows.filter((r) => r.status === status)
    const slice = rows.slice(offset, offset + limit)
    return { total: rows.length, items: slice, limit, offset }
  }

  cancel(jobId: string) {
    const s = this.findJobSession(jobId)
    if (s.status === 'DONE' || s.status === 'FINALIZING') {
      throw new BadRequestException({ error: { code: 'IMPORT_CANCEL_NOT_ALLOWED', message: 'Job đã gần hoàn tất.' } })
    }
    s.cancelRequested = true
    s.status = 'CANCEL_REQUESTED'
    return { id: jobId, status: 'CANCEL_REQUESTED' }
  }

  report(jobId: string) {
    const s = this.findJobSession(jobId)
    const header = 'row,name,status,createdDishId,message\n'
    const normalized = s.normalized ?? []
    const body = normalized
      .map((r) => {
        const msg = (r.issues?.[0]?.message ?? '').replace(/"/g, '""')
        return `${r.rowNumber},"${(r.mapped?.name ?? '').replace(/"/g, '""')}",${r.status},${r.createdDishId ?? ''},"${msg}"`
      })
      .join('\n')
    return header + body
  }

  private sessionPayload(s: ImportSessionState) {
    return {
      sessionId: s.id,
      fileName: s.originalFileName,
      headers: s.headers,
      rowCount: s.rawRows.length,
      sample: s.rawRows.slice(0, 3),
      mapping: s.mapping,
      status: s.status,
      headerRow: s.headerRow,
      sheetName: s.sheetName,
      options: s.options,
      validationSummary: s.validationSummary,
    }
  }

  private async loadSession(id: string): Promise<ImportSessionState> {
    const cached = this.memory.get(id)
    if (cached) return cached
    const row = await this.prisma.db.dishFileImportSession.findUnique({ where: { id } })
    if (!row?.csvText) {
      throw new NotFoundException({ error: { code: 'IMPORT_SESSION_EXPIRED', message: 'Không tìm thấy phiên import.' } })
    }
    const { headers, rows } = parseCsv(row.csvText)
    const mapping = (row.mappingSnapshot as MapCol[]) ?? this.autoMap(headers)
    const options = (row.optionsSnapshot as unknown as ImportOptionsSnapshot) ?? { duplicateMode: 'SKIP' }
    const session: ImportSessionState = {
      id: row.id,
      createdById: row.createdById,
      originalFileName: row.originalFileName,
      csvText: row.csvText,
      headers,
      rawRows: rows,
      mapping,
      headerRow: row.headerRow ?? 1,
      sheetName: row.sheetName ?? undefined,
      multiValueSeparator: ';',
      options,
      duplicateMode: options.duplicateMode ?? 'SKIP',
      status: row.status,
      cancelRequested: row.cancelRequested,
      createdCount: row.createdCount,
      skippedCount: row.skippedCount,
      failedCount: row.failedCount,
      warningCount: row.warningCount,
      processedRows: 0,
      jobId: row.jobId ?? undefined,
      rowPatches: {},
    }
    this.memory.set(id, session)
    return session
  }

  private getSessionSync(id: string): ImportSessionState {
    const s = this.memory.get(id)
    if (!s) {
      throw new NotFoundException({ error: { code: 'IMPORT_SESSION_EXPIRED', message: 'Không tìm thấy phiên import. Hãy tải lại file.' } })
    }
    return s
  }

  private findJobSession(jobId: string) {
    const s = [...this.memory.values()].find((x) => x.jobId === jobId)
    if (!s) throw new NotFoundException({ error: { code: 'IMPORT_JOB_NOT_FOUND', message: 'Không tìm thấy job.' } })
    return s
  }

  private async persistSession(s: ImportSessionState) {
    await this.prisma.db.dishFileImportSession.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        createdById: s.createdById,
        originalFileName: s.originalFileName,
        mimeType: 'text/csv',
        fileSizeBytes: Buffer.byteLength(s.csvText),
        csvText: s.csvText,
        sheetName: s.sheetName,
        headerRow: s.headerRow,
        mappingSnapshot: s.mapping,
        optionsSnapshot: s.options as object,
        status: s.status as any,
        totalRows: s.rawRows.length,
        eligibleRows: s.validationSummary?.eligibleRows ?? 0,
        errorCount: s.validationSummary?.error ?? 0,
        warningCount: s.validationSummary?.warning ?? s.warningCount,
        duplicateCount: s.validationSummary?.duplicate ?? 0,
        createdCount: s.createdCount,
        skippedCount: s.skippedCount,
        failedCount: s.failedCount,
        jobId: s.jobId,
        cancelRequested: s.cancelRequested,
      },
      update: {
        mappingSnapshot: s.mapping,
        optionsSnapshot: s.options as object,
        status: s.status as any,
        eligibleRows: s.validationSummary?.eligibleRows ?? 0,
        errorCount: s.validationSummary?.error ?? 0,
        warningCount: s.validationSummary?.warning ?? s.warningCount,
        duplicateCount: s.validationSummary?.duplicate ?? 0,
        createdCount: s.createdCount,
        skippedCount: s.skippedCount,
        failedCount: s.failedCount,
        jobId: s.jobId,
        cancelRequested: s.cancelRequested,
        sheetName: s.sheetName,
        headerRow: s.headerRow,
      },
    })
  }

  private async computeValidation(s: ImportSessionState) {
    const existing = await this.prisma.db.dish.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, status: true },
      take: 5000,
    })
    const byName = new Map(existing.map((d) => [d.name.trim().toLowerCase(), d]))
      let valid = 0
      let warning = 0
      let error = 0
      let duplicate = 0
      const issues: ImportSessionState['normalized'] = []

      s.rawRows.forEach((raw, idx) => {
        const row = this.revalidateSingleRow(s, idx + 2, raw, byName)
        issues!.push(row)
        if (row.status === 'VALID') valid++
        else if (row.status === 'WARNING') warning++
        else if (row.status === 'ERROR') error++
        else if (row.status === 'DUPLICATE') duplicate++
      })

      const eligibleRows = issues!.filter(
        (i) => i.status === 'VALID' || i.status === 'WARNING' || (i.status === 'DUPLICATE' && s.duplicateMode === 'CREATE_NEW'),
      ).length

      return {
        summary: { total: s.rawRows.length, valid, warning, error, duplicate, eligibleRows },
        issues: issues!,
      }
  }

  private async getNameIndex() {
    const existing = await this.prisma.db.dish.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, status: true },
      take: 5000,
    })
    return new Map(existing.map((d) => [d.name.trim().toLowerCase(), d]))
  }

  private revalidateSingleRow(
    s: ImportSessionState,
    rowNumber: number,
    rawOverride?: Record<string, string>,
    byName?: Map<string, { id: string; name: string; status: string }>,
  ) {
    const raw = rawOverride ?? s.rawRows[rowNumber - 2]
    if (!raw) {
      return { rowNumber, status: 'ERROR', mapped: {}, issues: [{ field: 'row', code: 'INVALID', message: 'Dòng không tồn tại.' }], duplicateDishId: undefined }
    }
    const patch = s.rowPatches[rowNumber] ?? {}
    const mergedRaw = { ...raw, ...patch }
    const mapped = this.applyMapping(mergedRaw, s.mapping)
    const name = (mapped.name ?? '').trim()
    const rowIssues: any[] = []
    let status: 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE' = 'VALID'

    if (!name) {
      status = 'ERROR'
      rowIssues.push({ field: 'name', code: 'REQUIRED', message: 'Tên món là bắt buộc.', rawValue: '' })
    }

    const dup = name && byName ? byName.get(name.toLowerCase()) : undefined
    if (dup && status !== 'ERROR') {
      status = 'DUPLICATE'
      rowIssues.push({ field: 'name', code: 'DUPLICATE', message: `Trùng với món ${dup.name}`, rawValue: name })
    }

    if (mapped.calories && Number.isNaN(Number(mapped.calories))) {
      status = 'ERROR'
      rowIssues.push({ field: 'calories', code: 'INVALID_NUMBER', message: 'Calories phải là số.', rawValue: mapped.calories })
    } else if (mapped.calories && Number(mapped.calories) > 5000 && status === 'VALID') {
      status = 'WARNING'
      rowIssues.push({ field: 'calories', code: 'NUTRITION_OUT_OF_RANGE', message: 'Calories vượt ngưỡng.', rawValue: mapped.calories })
    }

    if (status === 'VALID' && rowIssues.length === 0) status = 'VALID'

    return { rowNumber, status, dishName: name, mapped, issues: rowIssues, duplicateDishId: dup?.id }
  }

  private async runJob(s: ImportSessionState, actorId: string) {
    s.status = 'IMPORTING'
    const existing = await this.prisma.db.dish.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, status: true },
      take: 8000,
    })
    const byName = new Map(existing.map((d) => [d.name.trim().toLowerCase(), d]))
    const rows = s.normalized ?? []

    for (let i = 0; i < rows.length; i++) {
      if (s.cancelRequested) {
        s.status = 'CANCELLED'
        void this.persistSession(s)
        return
      }
      const row = rows[i]
      s.processedRows = i + 1

      if (row.status === 'ERROR') {
        s.failedCount++
        continue
      }
      if (row.status === 'DUPLICATE' && s.duplicateMode === 'SKIP') {
        s.skippedCount++
        continue
      }

      const name = (row.mapped?.name ?? '').trim()
      if (!name) {
        s.failedCount++
        continue
      }

      const dup = byName.get(name.toLowerCase())
      if (dup) {
        if (s.duplicateMode === 'SKIP') {
          s.skippedCount++
          continue
        }
        if (s.duplicateMode === 'UPDATE_DRAFT_ONLY' && dup.status === 'DRAFT') {
          try {
            await this.dishes.update(dup.id, { shortDescription: row.mapped.shortDescription }, actorId)
            row.createdDishId = dup.id
            s.createdCount++
          } catch {
            s.failedCount++
          }
          continue
        }
        if (s.duplicateMode !== 'CREATE_NEW') {
          s.skippedCount++
          continue
        }
      }

      try {
        const created = await this.dishes.create(
          {
            name,
            createMissingIngredients: true,
            shortDescription: row.mapped.shortDescription,
            prepMinutes: row.mapped.prepMinutes ? Number(row.mapped.prepMinutes) : undefined,
            cookMinutes: row.mapped.cookMinutes ? Number(row.mapped.cookMinutes) : undefined,
            nutrition: row.mapped.calories
              ? {
                  calories: Number(row.mapped.calories) || undefined,
                  proteinG: row.mapped.proteinG ? Number(row.mapped.proteinG) : undefined,
                  carbsG: row.mapped.carbsG ? Number(row.mapped.carbsG) : undefined,
                  fatG: row.mapped.fatG ? Number(row.mapped.fatG) : undefined,
                  fiberG: row.mapped.fiberG ? Number(row.mapped.fiberG) : undefined,
                  sodiumMg: row.mapped.sodiumMg ? Number(row.mapped.sodiumMg) : undefined,
                }
              : undefined,
            ingredients: (row.mapped.ingredients ?? '')
              .split(/;|\n/)
              .map((x) => x.trim())
              .filter(Boolean)
              .map((rawText, idx) => ({
                rawText,
                canonicalNameCandidate: rawText,
                clientRef: `file-${row.rowNumber}-${idx}`,
                sortOrder: idx,
              })),
          },
          actorId,
        )
        row.createdDishId = created.id
        byName.set(name.toLowerCase(), { id: created.id, name, status: 'DRAFT' })
        if (row.status === 'WARNING') s.warningCount++
        s.createdCount++
      } catch {
        s.failedCount++
        row.status = 'FAILED'
      }
    }
    s.status = 'DONE'
    void this.persistSession(s)
  }

  private applyMapping(raw: Record<string, string>, mapping: MapCol[]) {
    const out: Record<string, string> = {}
    for (const m of mapping) {
      if (!m.target) continue
      out[m.target] = raw[m.source] ?? ''
    }
    return out
  }

  private autoMap(headers: string[]): MapCol[] {
    const aliases: Record<string, string[]> = {
      name: ['name', 'ten', 'ten mon', 'dish', 'dish_name'],
      alternateNames: ['aka', 'ten khac'],
      region: ['region', 'vung'],
      categories: ['category', 'danh mục', 'danh muc'],
      mealTypes: ['meal', 'bua', 'meal_types'],
      ingredients: ['ingredients', 'nguyen lieu'],
      calories: ['calories', 'kcal', 'nang luong'],
      proteinG: ['protein', 'dam'],
      carbsG: ['carbs', 'carb'],
      fatG: ['fat', 'beo'],
      fiberG: ['fiber', 'xo'],
      sodiumMg: ['sodium', 'natri'],
      shortDescription: ['description', 'mo ta', 'short_desc', 'short_description'],
      prepMinutes: ['prep', 'chuan bi'],
      cookMinutes: ['cook', 'nau', 'cook_time'],
      imageUrl: ['image_url', 'image', 'anh'],
    }
    return headers.map((h) => {
      const norm = h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const target = Object.keys(aliases).find((k) => aliases[k].some((a) => norm.includes(a))) ?? ''
      return { source: h, target }
    })
  }
}

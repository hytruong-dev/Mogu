import { Body, Controller, Get, Header, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { FastifyReply } from 'fastify'
import { SystemRole } from '@prisma/client'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { DishFileImportsService } from './dish-file-imports.service'

@ApiTags('admin/dish-imports')
@Controller('admin/dish-imports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles(SystemRole.CONTENT_ADMIN, SystemRole.SUPER_ADMIN)
export class DishFileImportsController {
  constructor(private readonly service: DishFileImportsService) {}

  @Get('template')
  @ApiOperation({ summary: 'Tải template CSV nhập món' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="mogu-dish-import-template.csv"')
  template() {
    return this.service.getTemplate()
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Tạo session từ nội dung CSV' })
  createSession(
    @Body() body: Record<string, string>,
    @CurrentUser('sub') actorId: string,
  ) {
    const csvText = body.csvText ?? ''
    const fileName = body.fileName ?? 'upload.csv'
    return this.service.createSession(actorId, fileName, csvText)
  }

  @Get('sessions/:id')
  getSession(@Param('id') id: string) {
    return this.service.getSession(id)
  }

  @Put('sessions/:id/mapping')
  saveMapping(
    @Param('id') id: string,
    @Body() body: { mapping?: MapCol[]; headerRow?: number; sheetName?: string; multiValueSeparator?: string },
  ) {
    const mapping = (body.mapping ?? []).map((m) => ({
      source: m.source ?? '',
      target: m.target ?? '',
    }))
    return this.service.saveMapping(id, mapping, {
      headerRow: body.headerRow,
      sheetName: body.sheetName,
      multiValueSeparator: body.multiValueSeparator,
    })
  }

  @Post('sessions/:id/validate')
  validate(@Param('id') id: string) {
    return this.service.validate(id)
  }

  @Patch('sessions/:id/rows/:rowNumber')
  patchRow(
    @Param('id') id: string,
    @Param('rowNumber') rowNumber: string,
    @Body() body: Record<string, string>,
  ) {
    return this.service.patchRow(id, Number(rowNumber), body)
  }

  @Post('sessions/:id/rows/:rowNumber/revalidate')
  revalidateRow(@Param('id') id: string, @Param('rowNumber') rowNumber: string) {
    return this.service.revalidateRow(id, Number(rowNumber))
  }

  @Put('sessions/:id/options')
  saveOptions(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const raw = String(body.duplicateMode ?? 'SKIP')
    const duplicateMode =
      raw === 'CREATE_NEW' ? 'CREATE_NEW' : raw === 'UPDATE_DRAFT_ONLY' ? 'UPDATE_DRAFT_ONLY' : 'SKIP'
    return this.service.saveOptions(id, {
      duplicateMode,
      imageImportMode: body.imageImportMode as any,
      unknownIngredientMode: body.unknownIngredientMode as any,
      failureMode: body.failureMode as any,
      outputStatus: 'DRAFT',
    })
  }

  @Post('sessions/:id/start')
  start(@Param('id') id: string, @CurrentUser('sub') actorId: string) {
    return this.service.start(id, actorId)
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string) {
    return this.service.getJob(jobId)
  }

  @Get('jobs/:jobId/rows')
  getJobRows(
    @Param('jobId') jobId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getJobRows(jobId, status, limit ? Number(limit) : 100, offset ? Number(offset) : 0)
  }

  @Post('jobs/:jobId/cancel')
  cancel(@Param('jobId') jobId: string) {
    return this.service.cancel(jobId)
  }

  @Get('jobs/:jobId/report')
  async report(@Param('jobId') jobId: string, @Res() reply: FastifyReply) {
    const csv = this.service.report(jobId)
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="import-${jobId}.csv"`)
    return reply.send(csv)
  }
}

type MapCol = { source: string; target: string }

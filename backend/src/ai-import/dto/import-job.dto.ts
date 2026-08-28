import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ImportJobStatus =
  | 'PENDING'
  | 'SEARCHING'
  | 'EXTRACTING'
  | 'NORMALIZING'
  | 'RECONCILING'
  | 'ENRICHING'
  | 'DRAFTING'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED';

export class ImportJobDto {
  @ApiProperty() id: string;
  @ApiProperty() query: string;
  @ApiProperty() status: ImportJobStatus;
  @ApiProperty() currentStep: number;
  @ApiProperty() totalSteps: number;
  @ApiProperty() progress: number;
  @ApiPropertyOptional() currentStepName?: string;
  @ApiPropertyOptional() currentStepMessage?: string;
  @ApiPropertyOptional() resultDishId?: string;
  @ApiPropertyOptional() suggestedImageUrl?: string;
  @ApiPropertyOptional() errorMessage?: string;
  @ApiProperty() sourceTypes: string[];
  @ApiPropertyOptional() regionHint?: string;
  @ApiPropertyOptional() actorId?: string;
  @ApiPropertyOptional({ type: [String] }) relatedKeywords?: string[];
  @ApiPropertyOptional() cancelRequested?: boolean;
  @ApiProperty() createdAt: string;
  @ApiPropertyOptional() completedAt?: string;
  @ApiPropertyOptional() logs?: ImportJobLogDto[];
}

export class ImportJobLogDto {
  @ApiProperty() step: string;
  @ApiProperty() stepIndex: number;
  @ApiProperty() message: string;
  @ApiPropertyOptional() detail?: string;
  @ApiProperty() timestamp: string;
}

export class ImportJobListDto {
  @ApiProperty({ type: [ImportJobDto] }) data: ImportJobDto[];
  @ApiPropertyOptional() nextCursor?: string;
  @ApiProperty() total: number;
}

/** Emitted via WebSocket */
export interface WsJobProgress {
  eventId: string;
  sequence: number;
  occurredAt: string;
  jobId: string;
  status: ImportJobStatus;
  step: string;
  stepIndex: number;
  totalSteps: number;
  progress: number;
  message: string;
  resultDishId?: string;
  suggestedImageUrl?: string;
  errorMessage?: string;
}

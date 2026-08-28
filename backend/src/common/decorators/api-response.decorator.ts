import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/** Wraps Swagger response in { success, data, timestamp } envelope */
export const ApiDataResponse = <T extends Type>(model: T) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: { $ref: getSchemaPath(model) },
          timestamp: { type: 'string', example: new Date().toISOString() },
        },
      },
    }),
  );

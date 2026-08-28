import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * GET /health — Health check endpoint cho staging/production monitoring
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({
    status: 200,
    description: 'Service đang hoạt động bình thường',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
        version: '1.0.0',
        uptime: 3600,
      },
    },
  })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
    };
  }
}

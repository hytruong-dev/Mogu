import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WeatherQueryDto, WeatherResponseDto } from './dto/weather.dto';
import { WeatherService } from './weather.service';

@ApiTags('Weather')
@ApiBearerAuth()
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get()
  @ApiOperation({
    summary: 'Thời tiết hiện tại theo vị trí',
    description:
      'Lấy nhiệt độ và mô tả thời tiết từ Open-Meteo theo lat/lon. Kết quả cache 10 phút. Không cần API key.',
  })
  @ApiOkResponse({ type: WeatherResponseDto })
  async getWeather(@Query() query: WeatherQueryDto): Promise<WeatherResponseDto> {
    return this.weatherService.getWeather(query.lat, query.lon);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CreateAnalyticsDto } from './dto/create-analytics.dto';
import { UpdateAnalyticsDto } from './dto/update-analytics.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post()
  create(@Body() createAnalyticsDto: CreateAnalyticsDto) {
    return this.analyticsService.create(createAnalyticsDto);
  }

  @Get('dashboard-summary/:idSucursal')
  async getDashboardSummary(
    @Param('idSucursal', ParseIntPipe) idSucursal: number,
  ) {
    return this.analyticsService.getDashboardSummary(idSucursal);
  }

  @Get('dashboard-summary/:userId')
  async getVendedorDashboardData(
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.analyticsService.getVendedorDashboardData(userId);
  }

  @Get('/venta-dia/:idSucursal')
  async getVentasDiaII(@Param('idSucursal', ParseIntPipe) idSucursal: number) {
    const totalDeHoy = await this.analyticsService.getVentasDiaII(idSucursal);
    return {
      totalDeHoy,
    };
  }

  @Get('sucursales-summary')
  async getSucursalesSummary() {
    return this.analyticsService.getSucursalesSummary();
  }

  @Get('/get-ventas/mes/:id')
  getVentasMes(@Param('id', ParseIntPipe) id: number) {
    return this.analyticsService.getVentasMes(id);
  }

  @Get('/get-ventas/dia/:id')
  getVentasSemana(@Param('id', ParseIntPipe) id: number) {
    return this.analyticsService.getVentasDia(id);
  }

  @Get('/get-ventas/semana/:id')
  getVentasDia(@Param('id', ParseIntPipe) id: number) {
    return this.analyticsService.getTotalVentasMontoSemana(id);
  }

  //PARA EL CHART DEL DASHBOARD:
  @Get('/get-ventas/semanal-chart/:id')
  getVentasSemanalChart(@Param('id', ParseIntPipe) id: number) {
    return this.analyticsService.getVentasSemanalChart(id);
  }

  //PRODUCTOSD MÁS VENDIDOS
  @Get('/get-productos-mas-vendidos/')
  getProductosMasVendidos() {
    return this.analyticsService.getProductosMasVendidos();
  }

  @Get('/get-ventas-recientes/')
  getVentasRecientes() {
    return this.analyticsService.getVentasRecientes();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.analyticsService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnalyticsDto: UpdateAnalyticsDto,
  ) {
    return this.analyticsService.update(+id, updateAnalyticsDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.analyticsService.remove(+id);
  }
}

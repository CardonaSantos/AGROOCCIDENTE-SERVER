import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { GetPedidosQueryDto } from './Querys/getPedidosQuery.dto';
import { GetProductosToPedidosQuery } from './Querys/get-pedidos-query.dto';
import { UpdatePedidoDto } from './dto/update-pedidos.dto';
import { ReceivePedidoComprasDto } from './dto/sendPedidoToCompras';

@Controller('pedidos')
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post('create-pedido')
  create(@Body() dto: CreatePedidoDto) {
    return this.pedidosService.createPedidoMain(dto);
  }

  @Post('send-pedido-to-compras')
  sendPedidoToCompras(@Body() dto: ReceivePedidoComprasDto) {
    return this.pedidosService.sendPedidoToCompras(dto);
  }

  @Get()
  // @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  getToTable(@Query() query: GetPedidosQueryDto) {
    return this.pedidosService.getPedidos(query);
  }
  @Get('get-pedido/:id')
  getPedido(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.getPedidoByIdToShow(id);
  }

  @Get('productos-to-pedido')
  getProductsToPedidos(@Query() query: GetProductosToPedidosQuery) {
    return this.pedidosService.getProductsToPedidos(query);
  }

  @Delete('delete-regist-pedido/:id')
  deletePedido(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.deletePedidoRegist(id);
  }

  @Delete('delete-all')
  deleteAll() {
    return this.pedidosService.deleteAll();
  }

  // GET Y UPDATE

  // GET /pedidos/:id
  @Get(':id')
  async getPedidoToEdit(@Param('id', ParseIntPipe) id: number) {
    return this.pedidosService.getPedidoById(id);
  }

  // PATCH /pedidos/:id
  @Patch(':id')
  async updatePedido(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePedidoDto,
  ) {
    return this.pedidosService.updatePedido(id, dto);
  }
}

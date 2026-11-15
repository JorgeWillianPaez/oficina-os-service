import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TokenPayload } from '../../application/ports/gateways';
import { DeliverServiceOrder } from '../../application/use-cases/deliver-service-order';
import { OpenServiceOrder } from '../../application/use-cases/open-service-order';
import { ServiceOrderQueries } from '../../application/use-cases/service-order-queries';
import { ServiceOrderSaga } from '../../application/use-cases/service-order-saga';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { CancelServiceOrderDto, OpenServiceOrderDto } from '../dto/service-order.dto';
import { presentSaga, presentServiceOrder, presentServiceOrderStatus } from '../presenters';

@ApiTags('service-orders')
@ApiBearerAuth()
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly openServiceOrder: OpenServiceOrder,
    private readonly deliverServiceOrder: DeliverServiceOrder,
    private readonly queries: ServiceOrderQueries,
    private readonly saga: ServiceOrderSaga,
  ) {}

  @Post()
  async open(@Body() body: OpenServiceOrderDto) {
    const order = await this.openServiceOrder.execute(body);
    return { id: order.id, status: order.status, totalAmount: order.totalAmount };
  }

  @Get()
  async listActive() {
    return (await this.queries.listActive()).map(presentServiceOrder);
  }

  @Get('metrics')
  metrics() {
    return this.queries.executionMetrics();
  }

  @Get(':id')
  @Roles('ADMIN', 'CUSTOMER')
  async findById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: TokenPayload) {
    return presentServiceOrder(await this.queries.findById(id, user));
  }

  @Get(':id/status')
  @Roles('ADMIN', 'CUSTOMER')
  async status(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: TokenPayload) {
    return presentServiceOrderStatus(await this.queries.findById(id, user));
  }

  @Get(':id/saga')
  async sagaState(@Param('id', ParseUUIDPipe) id: string) {
    return presentSaga(await this.queries.findSaga(id));
  }

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  async deliver(@Param('id', ParseUUIDPipe) id: string) {
    return presentServiceOrderStatus(await this.deliverServiceOrder.execute(id));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() body: CancelServiceOrderDto) {
    return presentServiceOrderStatus(await this.saga.cancel(id, body.reason));
  }
}

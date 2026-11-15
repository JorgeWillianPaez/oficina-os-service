import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthenticateAdmin } from '../../application/use-cases/authenticate-admin';
import { ManageCatalogServices } from '../../application/use-cases/manage-catalog-services';
import { ManageCustomers } from '../../application/use-cases/manage-customers';
import { ManageParts } from '../../application/use-cases/manage-parts';
import { ManageVehicles } from '../../application/use-cases/manage-vehicles';
import { ServiceOrderQueries } from '../../application/use-cases/service-order-queries';
import { Public } from '../auth/auth.decorators';
import {
  AdjustStockDto,
  CreateCatalogServiceDto,
  CreateCustomerDto,
  CreatePartDto,
  CreateVehicleDto,
  LoginDto,
  UpdateCatalogServiceDto,
  UpdateCustomerDto,
  UpdatePartDto,
  UpdateVehicleDto,
} from '../dto/registry.dto';
import {
  presentCatalogService,
  presentCustomer,
  presentPart,
  presentServiceOrder,
  presentVehicle,
} from '../presenters';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authenticateAdmin: AuthenticateAdmin) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authenticateAdmin.execute(body.email, body.password);
  }
}

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: ManageCustomers,
    private readonly orders: ServiceOrderQueries,
  ) {}

  @Post()
  async create(@Body() body: CreateCustomerDto) {
    return presentCustomer(await this.customers.create(body));
  }

  @Get()
  @ApiQuery({ name: 'document', required: false })
  async list(@Query('document') document?: string) {
    const customers = document
      ? [await this.customers.findByDocument(document)]
      : await this.customers.list();
    return customers.map(presentCustomer);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return presentCustomer(await this.customers.findById(id));
  }

  @Get(':id/service-orders')
  async serviceOrders(@Param('id', ParseUUIDPipe) id: string) {
    await this.customers.findById(id);
    return (await this.orders.listByCustomer(id)).map(presentServiceOrder);
  }

  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCustomerDto) {
    return presentCustomer(await this.customers.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.remove(id);
  }
}

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: ManageVehicles) {}

  @Post()
  async create(@Body() body: CreateVehicleDto) {
    return presentVehicle(await this.vehicles.create(body));
  }

  @Get()
  @ApiQuery({ name: 'customerId', required: false })
  async list(@Query('customerId') customerId?: string) {
    return (await this.vehicles.list(customerId)).map(presentVehicle);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return presentVehicle(await this.vehicles.findById(id));
  }

  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateVehicleDto) {
    return presentVehicle(await this.vehicles.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.remove(id);
  }
}

@ApiTags('services')
@ApiBearerAuth()
@Controller('services')
export class CatalogServicesController {
  constructor(private readonly services: ManageCatalogServices) {}

  @Post()
  async create(@Body() body: CreateCatalogServiceDto) {
    return presentCatalogService(await this.services.create(body));
  }

  @Get()
  async list() {
    return (await this.services.list()).map(presentCatalogService);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return presentCatalogService(await this.services.findById(id));
  }

  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCatalogServiceDto) {
    return presentCatalogService(await this.services.update(id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.services.remove(id);
  }
}

@ApiTags('parts')
@ApiBearerAuth()
@Controller('parts')
export class PartsController {
  constructor(private readonly parts: ManageParts) {}

  @Post()
  async create(@Body() body: CreatePartDto) {
    return presentPart(await this.parts.create(body));
  }

  @Get()
  async list() {
    return (await this.parts.list()).map(presentPart);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return presentPart(await this.parts.findById(id));
  }

  @Put(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdatePartDto) {
    return presentPart(await this.parts.update(id, body));
  }

  @Patch(':id/stock')
  async adjustStock(@Param('id', ParseUUIDPipe) id: string, @Body() body: AdjustStockDto) {
    return presentPart(await this.parts.adjustStock(id, body.delta));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.parts.remove(id);
  }
}

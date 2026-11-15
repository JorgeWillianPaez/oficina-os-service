import { PartialType, PickType } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  document: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateCustomerDto extends PartialType(
  PickType(CreateCustomerDto, ['name', 'email', 'phone'] as const),
) {}

export class CreateVehicleDto {
  @IsUUID()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsInt()
  year: number;
}

export class UpdateVehicleDto extends PartialType(
  PickType(CreateVehicleDto, ['brand', 'model', 'year'] as const),
) {}

export class CreateCatalogServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsInt()
  @Min(1)
  estimatedMinutes: number;
}

export class UpdateCatalogServiceDto extends PartialType(CreateCatalogServiceDto) {}

export class CreatePartDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;
}

export class UpdatePartDto extends PartialType(PickType(CreatePartDto, ['name', 'price'] as const)) {}

export class AdjustStockDto {
  @IsInt()
  delta: number;
}

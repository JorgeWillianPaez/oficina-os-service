import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderCustomerDto {
  @IsString()
  @IsNotEmpty()
  document: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class OrderVehicleDto {
  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  year?: number;
}

export class OrderServiceDto {
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class OrderPartDto {
  @IsUUID()
  partId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class OpenServiceOrderDto {
  @ValidateNested()
  @Type(() => OrderCustomerDto)
  customer: OrderCustomerDto;

  @ValidateNested()
  @Type(() => OrderVehicleDto)
  vehicle: OrderVehicleDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderServiceDto)
  services: OrderServiceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderPartDto)
  parts?: OrderPartDto[];
}

export class CancelServiceOrderDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

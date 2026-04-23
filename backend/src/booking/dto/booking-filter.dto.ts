import { IsOptional, IsString, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';

export class BookingFilterDto {
  @IsOptional()
  @IsString()
  searchKey?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsString()
  vendorName?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  weekStart?: string;

  @IsOptional()
  @IsString()
  weekEnd?: string;

  @IsOptional()
  @IsString()
  isForBooking?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'updatedAt' | 'bookingDate';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  dockId?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  hasArrived?: string;
}

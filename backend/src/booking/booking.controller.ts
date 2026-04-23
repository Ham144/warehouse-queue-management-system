import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Put,
} from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Auth } from 'src/common/auth.decorator';
import { BookingforVendorService } from './booking-vendor.service';
import { Authorization } from 'src/common/authorization.decorator';
import { BookingWarehouseService } from './booking.service';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { TokenPayload } from 'src/user/dto/token-payload.dto';
import { BookingGateway } from './booking.gateway';

import { BookingFilterDto } from './dto/booking-filter.dto';

@Controller('booking')
export class BookingController {
  constructor(
    private readonly bookingWarehouseService: BookingWarehouseService,
    private readonly bookingForVendorService: BookingforVendorService,
    private readonly gateway: BookingGateway,
  ) {}

  @Authorization('ADMIN_ORGANIZATION', 'ADMIN_VENDOR')
  @Post()
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @Auth() userInfo: any,
  ) {
    const response = await this.bookingForVendorService.create(
      createBookingDto,
      userInfo,
    );
    if (response.success && response.warehouseId) {
      this.gateway.emitWarehouseUpdate(response.warehouseId);
    }
    return response;
  }

  @Authorization()
  @Get('/list')
  async findAll(@Query() filter: BookingFilterDto, @Auth() userInfo: any) {
    const response = await this.bookingWarehouseService.findAll(
      filter,
      userInfo,
    );
    return response;
  }

  @Authorization(
    'ADMIN_ORGANIZATION',
    'ADMIN_GUDANG',
    'USER_ORGANIZATION',
    'ADMIN_VENDOR',
  )
  @Get('/semi-detail-list')
  semiDetailList(@Query() filter, @Auth() userInfo: any) {
    return this.bookingWarehouseService.semiDetailList(filter, userInfo);
  }

  @Authorization()
  @Get('/detail/:id')
  findOne(@Param('id') id: string) {
    return this.bookingForVendorService.findOne(id);
  }

  @Authorization('ADMIN_ORGANIZATION', 'ADMIN_GUDANG', 'USER_ORGANIZATION')
  @Put('/justify/:id')
  async justify(
    @Param('id') id: string,
    @Body() body: any,
    @Auth() userInfo: TokenPayload,
  ) {
    const response = await this.bookingWarehouseService.justifyBooking(
      id,
      body,
      userInfo,
    );
    if (response.warehouseId) {
      this.gateway.emitWarehouseUpdate(response.warehouseId);
    }
    return response;
  }

  @Authorization('ADMIN_ORGANIZATION', 'ADMIN_GUDANG', 'USER_ORGANIZATION')
  @Put('/drag-and-drop/:id')
  async dragAndDrop(
    @Param('id') id: string,
    @Body() body: any,
    @Auth() userInfo: TokenPayload,
  ) {
    const response = await this.bookingWarehouseService.dragAndDrop(
      id,
      body,
      userInfo,
    );
    if (response.warehouseId) {
      this.gateway.emitWarehouseUpdate(response.warehouseId);
    }
    return response;
  }

  @Authorization()
  @Patch('/updateStatus/:id')
  async updateStatus(
    @Param('id') id: string,
    @Body() payload: UpdateBookingDto,
    @Auth() userInfo: TokenPayload,
  ) {
    const response = await this.bookingWarehouseService.updateBookingStatus(
      id,
      payload,
      userInfo,
    );
    if (response.warehouseId) {
      this.gateway.emitWarehouseUpdate(response.warehouseId);
    }
    return response;
  }

  @Authorization(
    'ADMIN_GUDANG',
    'USER_ORGANIZATION',
    'ADMIN_ORGANIZATION',
    'ADMIN_VENDOR',
  )
  @Delete('/cancel/:id')
  async cancelBook(@Param('id') id: string, @Auth() userInfo, @Body() body) {
    const response = await this.bookingForVendorService.cancelBook(
      id,
      userInfo,
      body,
    );
    if (response.success && response.warehouseId) {
      this.gateway.emitWarehouseUpdate(response.warehouseId);
    }
    return response;
  }

  @Authorization('ADMIN_VENDOR', 'ADMIN_ORGANIZATION')
  @Get('/stats/stats-for-admin-vendor')
  getStatsForAdminVendor(@Auth() userInfo: TokenPayload) {
    return this.bookingForVendorService.getStatsForAdminVendor(userInfo);
  }

  // @Authorization('ADMIN_ORGANIZATION', "ADMIN_GUDANG", 'USER_ORGANIZATION')
  // @Get('/stats/stats-for-organization')
  // getStatsForUserOrganizations() {
  //   return this.bookingWarehouseService.getStatsForUserOrganizations();
  // }

  @Authorization('ADMIN_ORGANIZATION', 'ADMIN_GUDANG', 'USER_ORGANIZATION')
  @Get('/admin-warehouse-reports')
  getStatsForVendor(
    @Query()
    filter: { startDate: string; endDate: string; isKpiInclude: boolean },
    @Auth() userinfo: TokenPayload,
  ) {
    return this.bookingWarehouseService.adminReports(
      userinfo,
      filter.startDate,
      filter.endDate,
      filter.isKpiInclude,
    );
  }

  @Authorization(
    'ADMIN_ORGANIZATION',
    'ADMIN_GUDANG',
    'USER_ORGANIZATION',
    'ADMIN_VENDOR',
    'ADMIN_GUDANG',
  )
  @Get('/get-move-trace/:id')
  getDetailMoveTrace(@Param('id') id: string) {
    return this.bookingWarehouseService.getDetailMoveTrace(id);
  }

  @Authorization('ADMIN_ORGANIZATION', 'ADMIN_GUDANG', 'USER_ORGANIZATION')
  @Get('/admin-warehouse-dashboard')
  adminDashboard(@Auth() userinfo: TokenPayload) {
    return this.bookingWarehouseService.adminDashboard(userinfo);
  }
}

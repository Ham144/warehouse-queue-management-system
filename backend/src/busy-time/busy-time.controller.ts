import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { BusyTimeService } from './busy-time.service';
import { CreateBusyTimeDto } from './dto/create-busy-time.dto';
import { UpdateBusyTimeDto } from './dto/update-busy-time.dto';
import { Authorization } from 'src/common/authorization.decorator';

@Controller('busy-time')
export class BusyTimeController {
  constructor(private readonly busyTimeService: BusyTimeService) {}

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION')
  @Post()
  create(@Body() createBusyTimeDto: CreateBusyTimeDto) {
    return this.busyTimeService.create(createBusyTimeDto);
  }

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION', 'ADMIN_VENDOR')
  @Get(':dockId')
  findAll(@Param('dockId') dockId: string) {
    return this.busyTimeService.findAll(dockId);
  }

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateBusyTimeDto: UpdateBusyTimeDto,
  ) {
    return this.busyTimeService.update(id, updateBusyTimeDto);
  }

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.busyTimeService.remove(id);
  }
}

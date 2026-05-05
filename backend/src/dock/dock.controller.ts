import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DockService } from './dock.service';
import { CreateDockDto } from './dto/create-dock.dto';
import { UpdateDockDto } from './dto/update-dock.dto';
import { Auth } from 'src/common/auth.decorator';
import { Authorization } from 'src/common/authorization.decorator';

@Controller('dock')
export class DockController {
  constructor(private readonly dockService: DockService) {}

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION')
  @Post()
  create(@Body() createDockDto: CreateDockDto, @Auth() userInfo) {
    return this.dockService.create(createDockDto, userInfo);
  }

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION')
  @Post('bulk')
  bulkUpload(@Body() body: CreateDockDto[], @Auth() userInfo) {
    return this.dockService.bulkUpload(body, userInfo);
  }

  @Authorization(
    'USER_ORGANIZATION',
    'ADMIN_ORGANIZATION',
    'ADMIN_VENDOR',
    'ADMIN_GUDANG',
  )
  @Get('/warehouse/:id')
  getDocksByWarehouseId(@Param('id') id: string) {
    return this.dockService.getDocksByWarehouseId(id);
  }

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION', 'ADMIN_VENDOR')
  @Get('/detail/:id')
  findOne(@Param('id') id: string) {
    return this.dockService.findOne(id);
  }

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDockDto: UpdateDockDto) {
    return this.dockService.update(id, updateDockDto);
  }

  @Authorization('USER_ORGANIZATION', 'ADMIN_ORGANIZATION')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dockService.remove(id);
  }
}

import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateDockDto } from './dto/create-dock.dto';
import { UpdateDockDto } from './dto/update-dock.dto';
import { PrismaService } from 'src/common/prisma.service';
import { LoginResponseDto } from 'src/user/dto/login.dto';
import { DockFilter, ResponseDockDto, Vacant } from './dto/response-dock.dto';
import { plainToInstance } from 'class-transformer';
import { TokenPayload } from 'src/user/dto/token-payload.dto';
import { VehicleType, Days, BookingStatus } from 'src/common/shared-enum';

@Injectable()
export class DockService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createDockDto: CreateDockDto, userInfo: TokenPayload) {
    const {
      vacants,
      warehouseId,
      allowedTypes,
      photos = [],
      ...rest
    } = createDockDto;

    try {
      await this.prismaService.dock.create({
        data: {
          ...rest,
          photos: photos || [],
          warehouse: {
            connect: {
              id: warehouseId,
            },
          },
          allowedTypes: allowedTypes as VehicleType[],
          vacants: {
            createMany: {
              data: vacants.map((vacant) => ({
                availableFrom: vacant.availableFrom,
                availableUntil: vacant.availableUntil,
                day: vacant.day as Days,
              })),
            },
          },
          organization: {
            connect: {
              name: userInfo.organizationName,
            },
          },
        },
      });

      return HttpStatus.CREATED;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async bulkUpload(createDockDto: CreateDockDto[], userInfo: TokenPayload) {
    try {
      const warehouseId = userInfo.homeWarehouseId;
      const days = Object.values(Days);
      const vacants: Vacant[] = days.map((day) => ({
        day,
        availableFrom: day === Days.MINGGU ? null : '08:00',
        availableUntil: day === Days.MINGGU ? null : '15:50',
      }));

      await Promise.all(
        createDockDto.map(async (dock) => {
          const {
            name,
            warehouseId: _whId,
            allowedTypes: allowedTypesKey = [],
            vacants: _vacants,
            ...rest
          } = dock;
          const allowedTypesMatched = Object.values(VehicleType).filter(
            (type) =>
              (allowedTypesKey || []).some(
                (a) => String(a).toUpperCase() === type,
              ),
          );
          const whId = dock.warehouseId || warehouseId;

          const existing = await this.prismaService.dock.findFirst({
            where: { name, warehouseId: whId },
          });

          if (existing) {
            await this.prismaService.dock.update({
              where: { id: existing.id },
              data: { ...rest, allowedTypes: allowedTypesMatched },
            });
          } else {
            await this.prismaService.dock.create({
              data: {
                name,
                ...rest,
                warehouse: {
                  connect: { id: whId },
                },
                allowedTypes: allowedTypesMatched,
                vacants: {
                  createMany: {
                    data: vacants.map((vacant) => ({
                      availableFrom: vacant.availableFrom,
                      availableUntil: vacant.availableUntil,
                      day: vacant.day as Days,
                    })),
                  },
                },
                organization: {
                  connect: { name: userInfo.organizationName },
                },
              },
            });
          }
        }),
      );
      return { message: 'Berhasil mengupload' };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  //vendor
  async findAll(filter: DockFilter, userInfo: LoginResponseDto) {
    const { page, searchKey } = filter;

    const where: any = {
      organizationName: userInfo.organizationName,
    };

    if (searchKey) {
      where.name = {
        contains: searchKey,
        mode: 'insensitive', // case-insensitive
      };
    }

    const safePage = Number(page) || 1;
    const docks = await this.prismaService.dock.findMany({
      where,
      take: 20,
      skip: (safePage - 1) * 20,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        priority: 'desc',
      },
    });

    return plainToInstance(ResponseDockDto, docks, {
      excludeExtraneousValues: true,
    });
  }

  //admin/docks
  async getDocksByWarehouseId(id: string) {
    const docks = await this.prismaService.dock.findMany({
      where: {
        warehouseId: id,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
      orderBy: {
        priority: 'desc',
      },
    });

    return plainToInstance(ResponseDockDto, docks, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(id: string) {
    const dock = await this.prismaService.dock.findUnique({
      where: {
        id: id,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        bookings: {
          include: {
            Vehicle: {
              select: {
                brand: true,
                vehicleType: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        busyTimes: {
          orderBy: {
            from: 'asc',
          },
        },
        vacants: true,
      },
    });

    if (!dock) {
      throw new NotFoundException(`Dock dengan id ${id} tidak ditemukan`);
    }

    return plainToInstance(ResponseDockDto, dock, {
      excludeExtraneousValues: true,
      groups: ['detail'],
    });
  }

  async update(id: string, updateDockDto: UpdateDockDto) {
    const { allowedTypes, vacants, ...rest } = updateDockDto;
    const existingDock = await this.prismaService.dock.findUnique({
      where: { id },
    });

    if (!existingDock) {
      throw new NotFoundException(`Dock dengan id ${id} tidak ditemukan`);
    }

    if (existingDock.isActive == false) {
      const now = new Date();
      const from = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
      );
      const bookings = await this.prismaService.booking.findMany({
        where: {
          dockId: id,
          status: {
            in: [BookingStatus.IN_PROGRESS, BookingStatus.UNLOADING],
          },
          arrivalTime: {
            gte: from,
          },
        },
      });
      // if (bookings.length) {
      //   const bookingCodes = bookings.map((booking) => booking.code).join(', ');
      //   throw new BadRequestException(
      //     'Ada booking yang sedang berlangsung di dock ini hari ini : ' +
      //       bookingCodes,
      //   );
      // }
    }
    
    try {
      await this.prismaService.dock.update({
        where: {
          id: id,
        },
        data: {
          ...rest,
          vacants: {
            deleteMany: {},
            createMany: {
              data: vacants.map((vacant) => ({
                availableFrom: vacant.availableFrom,
                availableUntil: vacant.availableUntil,
                day: vacant.day as Days,
              })),
            },
          },
          allowedTypes: allowedTypes as VehicleType[],
        },
      });

      return HttpStatus.ACCEPTED;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async remove(id: string) {
    try {
      await this.prismaService.dock.delete({
        where: {
          id,
        },
      });

      return HttpStatus.ACCEPTED;
    } catch (error) {
      throw new InternalServerErrorException('Gagal menghapus dock');
    }
  }
}

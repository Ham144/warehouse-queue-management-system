import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBookingDto } from './dto/create-booking.dto';
import { PrismaService } from 'src/common/prisma.service';
import { plainToInstance } from 'class-transformer';
import { ResponseBookingDto } from './dto/response-booking.dto';
import { TokenPayload } from 'src/user/dto/token-payload.dto';
import { BookingStatus, Days } from 'src/common/shared-enum';
import { MoveTraceService } from 'src/move-trace/move-trace.service';
import { ResponseVendorDashboardDto } from './dto/response-vendor-dashboard.dto';

@Injectable()
export class BookingforVendorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly moveTraceService: MoveTraceService,
  ) {}

  async create(createBookingDto: CreateBookingDto, userInfo: TokenPayload) {
    const {
      vehicleId,
      warehouseId,
      dockId,
      arrivalTime,
      estimatedFinishTime,
      driverUsername,
      ...rest
    } = createBookingDto;

    function HHMM_to_minutes(hhmm: string): number {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    }
    const vehicle = await this.prismaService.vehicle.findFirst({
      where: {
        id: vehicleId,
      },
    });

    const bookingFrom = arrivalTime.getHours() * 60 + arrivalTime.getMinutes();
    const bookingTo =
      estimatedFinishTime.getHours() * 60 + estimatedFinishTime.getMinutes();

    const busyTimes = await this.prismaService.dockBusyTime.findMany({
      where: { dockId },
    });

    const overLapIdx = busyTimes.findIndex((busy) => {
      const busyFrom = HHMM_to_minutes(busy.from);
      const busyTo = HHMM_to_minutes(busy.to);
      return busyFrom < bookingTo && busyTo > bookingFrom;
    });

    if (overLapIdx != -1) {
      if (
        busyTimes[overLapIdx].recurring === 'MONTHLY' &&
        busyTimes[overLapIdx].recurringStep === arrivalTime.getDate()
      ) {
        throw new BadRequestException(
          `Waktu terkait overlap busy time ${busyTimes[overLapIdx].reason}, antara ${busyTimes[overLapIdx].from} sampai ${busyTimes[overLapIdx].to}`,
        );
      } else if (
        busyTimes[overLapIdx].recurring === 'WEEKLY' &&
        busyTimes[overLapIdx].recurringCustom.includes(
          Days[arrivalTime.getDay()],
        )
      ) {
        throw new BadRequestException(
          `Waktu terkait overlap busy time ${busyTimes[overLapIdx].reason}, antara ${busyTimes[overLapIdx].from} sampai ${busyTimes[overLapIdx].to}`,
        );
      } else
        throw new BadRequestException(
          `Waktu terkait overlap busy time ${busyTimes[overLapIdx].reason}, antara ${busyTimes[overLapIdx].from} sampai ${busyTimes[overLapIdx].to}`,
        );
    }

    //cek apakah boleh allowedTypes
    const allowedTypesSuccess = await this.prismaService.dock.findFirst({
      where: {
        id: dockId,
        allowedTypes: {
          has: vehicle.vehicleType,
        },
      },
    });
    if (!allowedTypesSuccess) {
      throw new BadRequestException(
        'tipe kendaraan tidak didukung di gate ini',
      );
    }

    const arrival = new Date(arrivalTime);

    const durationMinutes = vehicle.durasiBongkar;
    const end = new Date(arrival);
    end.setMinutes(end.getMinutes() + durationMinutes);

    //cek overlap to another booking
    const overlapDockedHour = await this.prismaService.booking.findFirst({
      where: {
        dockId: dockId,
        // id: { not: createBookingDto.id },//untuk update
        status: {
          notIn: [
            BookingStatus.CANCELED,
            BookingStatus.FINISHED,
            BookingStatus.UNLOADING,
          ],
        },
        AND: [
          {
            arrivalTime: {
              lt: end, // booking lain mulai sebelum booking ini selesai
            },
          },
          {
            arrivalTime: {
              gt: new Date(arrival.getTime()),
            },
          },
        ],
      },
    });

    if (overlapDockedHour) {
      throw new BadRequestException(
        `Waktu terkait overlap booking ${overlapDockedHour.code}, antara ${overlapDockedHour.arrivalTime} sampai ${estimatedFinishTime}`,
      );
    }

    const randomStr = Array.from({ length: 2 }, () =>
      String.fromCharCode(65 + Math.floor(Math.random() * 26)),
    ).join('');

    const code = `${createBookingDto.notes.slice(0, 7)}-${vehicle.brand}-${driverUsername}-${randomStr}`;

    //penentuan status awal
    const organizationSettings =
      await this.prismaService.organization.findFirst({
        where: {
          name: userInfo.organizationName,
        },
      });
    const initialStatus = organizationSettings.isConfirmBookRequired
      ? BookingStatus.PENDING
      : BookingStatus.IN_PROGRESS;

    const created = await this.prismaService.booking.create({
      data: {
        status: initialStatus,
        arrivalTime: arrivalTime,
        estimatedFinishTime: estimatedFinishTime,
        code: code,
        actualFinishTime: null,
        Vehicle: { connect: { id: vehicleId } },
        Warehouse: { connect: { id: warehouseId } },
        Dock: { connect: { id: dockId } },
        createdBy: {
          connect: {
            username: userInfo.username,
          },
        },
        driver: {
          connect: {
            username: driverUsername,
          },
        },
        organization: {
          connect: {
            name: userInfo.organizationName,
          },
        },
        ...rest,
      },
    });

    await this.moveTraceService.create({
      bookingId: created.id,
      doer: userInfo.username,
      fromStatus: 'CREATED',
      toStatus: initialStatus,
      fromArrivalTime: new Date(arrivalTime).toISOString(),
      toArrivalTime: new Date(arrivalTime).toISOString(),
      detailMovement: 'create booking',
    });

    return {
      success: true,
      warehouseId: warehouseId,
      id: created.id,
    };
  }

  async findOne(id: string) {
    const booking = await this.prismaService.booking.findUnique({
      where: {
        id,
      },
      include: {
        Vehicle: true,
        Warehouse: true,
        Dock: true,
        driver: true,
        organization: true,
      },
    });
    return plainToInstance(ResponseBookingDto, booking, {
      excludeExtraneousValues: true,
      groups: ['detail'],
    });
  }

  async cancelBook(
    id: string,
    userinfo: TokenPayload,
    body: { canceledReason: string },
  ) {
    const { canceledReason } = body;
    const existingBooking = await this.prismaService.booking.findFirst({
      where: {
        id,
      },
    });

    if (!existingBooking) {
      throw new BadRequestException(
        'tidak bisa menghapus booking yang bukan buatan anda',
      );
    }

    const updated = await this.prismaService.booking.update({
      where: {
        id,
      },
      data: {
        status: 'CANCELED',
        canceledReason: canceledReason + ' by ' + userinfo.username,
      },
    });

    await this.moveTraceService.create({
      bookingId: id,
      doer: userinfo.username,
      fromStatus: existingBooking.status,
      toStatus: 'CANCELED',
      fromArrivalTime: existingBooking.arrivalTime.toISOString(),
      toArrivalTime: existingBooking.arrivalTime.toISOString(),
      detailMovement: 'cancel booking' + ' cancel reason -> ' + canceledReason,
    });

    return {
      success: true,
      warehouseId: updated.warehouseId,
    };
  }

  async getStatsForAdminVendor(
    userInfo: TokenPayload,
  ): Promise<ResponseVendorDashboardDto> {
    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    // Default range: 30 hari terakhir
    const rangeDays = 30;
    const rangeStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - rangeDays,
      0,
      0,
      0,
      0,
    );

    const bookings = await this.prismaService.booking.findMany({
      where: {
        organizationName: userInfo.organizationName,
        arrivalTime: {
          gte: rangeStart,
          lte: todayEnd,
        },
      },
      include: {
        Warehouse: true,
        Dock: true,
        Vehicle: true,
        driver: true,
      },
    });

    const bookingsToday = bookings.filter(
      (b) => b.arrivalTime >= todayStart && b.arrivalTime <= todayEnd,
    );

    // Summary metrics
    const totalBookingsInRange = bookings.length;
    const warehouseIds = new Set(bookings.map((b) => b.warehouseId));
    const totalWarehouses = warehouseIds.size;

    const activeStatuses = [
      BookingStatus.PENDING,
      BookingStatus.IN_PROGRESS,
      BookingStatus.UNLOADING,
    ];

    const activeToday = bookingsToday.filter((b) =>
      activeStatuses.includes(b.status as BookingStatus),
    ).length;

    const completedInRange = bookings.filter(
      (b) => b.status === BookingStatus.FINISHED,
    );

    const canceledInRange = bookings.filter(
      (b) => b.status === BookingStatus.CANCELED,
    );

    const completedCount = completedInRange.length;

    const completedWithTimes = completedInRange.filter(
      (b) => b.actualFinishTime && b.estimatedFinishTime,
    );

    const onTimeCount = completedWithTimes.filter(
      (b) => b.actualFinishTime.getTime() <= b.estimatedFinishTime.getTime(),
    ).length;

    const onTimeRatePercent =
      completedWithTimes.length > 0
        ? Math.round((onTimeCount / completedWithTimes.length) * 100)
        : 100;

    const processingSamples = completedInRange.filter(
      (b) => b.actualStartTime && b.actualFinishTime,
    );

    const avgUnloadingMinutes =
      processingSamples.length > 0
        ? Math.round(
            processingSamples.reduce((acc, b) => {
              const duration =
                b.actualFinishTime.getTime() - b.actualStartTime.getTime();
              return acc + duration / (1000 * 60);
            }, 0) / processingSamples.length,
          )
        : 0;

    // Breakdown per warehouse
    const warehouseMetricsMap = new Map<
      string,
      {
        warehouseId: string;
        warehouseName: string;
        totalBookings: number;
        activeToday: number;
        completedInRange: number;
        canceledInRange: number;
        onTimeSamples: number;
        onTimeCount: number;
        processingSamples: number;
        processingMinutesTotal: number;
      }
    >();

    bookings.forEach((b) => {
      const key = b.warehouseId;
      if (!warehouseMetricsMap.has(key)) {
        warehouseMetricsMap.set(key, {
          warehouseId: b.warehouseId,
          warehouseName: b.Warehouse?.name ?? 'Unknown Warehouse',
          totalBookings: 0,
          activeToday: 0,
          completedInRange: 0,
          canceledInRange: 0,
          onTimeSamples: 0,
          onTimeCount: 0,
          processingSamples: 0,
          processingMinutesTotal: 0,
        });
      }
      const agg = warehouseMetricsMap.get(key);
      if (!agg) return;

      agg.totalBookings += 1;

      if (
        b.arrivalTime >= todayStart &&
        b.arrivalTime <= todayEnd &&
        activeStatuses.includes(b.status as BookingStatus)
      ) {
        agg.activeToday += 1;
      }

      if (b.status === BookingStatus.FINISHED) {
        agg.completedInRange += 1;
      }

      if (b.status === BookingStatus.CANCELED) {
        agg.canceledInRange += 1;
      }

      if (b.actualFinishTime && b.estimatedFinishTime) {
        agg.onTimeSamples += 1;
        if (b.actualFinishTime.getTime() <= b.estimatedFinishTime.getTime()) {
          agg.onTimeCount += 1;
        }
      }

      if (b.actualStartTime && b.actualFinishTime) {
        agg.processingSamples += 1;
        agg.processingMinutesTotal +=
          (b.actualFinishTime.getTime() - b.actualStartTime.getTime()) /
          (1000 * 60);
      }
    });

    const warehouseBreakdown = Array.from(warehouseMetricsMap.values()).map(
      (w) => ({
        warehouseId: w.warehouseId,
        warehouseName: w.warehouseName,
        totalBookings: w.totalBookings,
        activeToday: w.activeToday,
        completedInRange: w.completedInRange,
        canceledInRange: w.canceledInRange,
        onTimeRatePercent:
          w.onTimeSamples > 0
            ? Math.round((w.onTimeCount / w.onTimeSamples) * 100)
            : 100,
        avgUnloadingMinutes:
          w.processingSamples > 0
            ? Math.round(w.processingMinutesTotal / w.processingSamples)
            : 0,
      }),
    );

    // Operational snapshot (hari ini)
    const todayActiveBookings = bookingsToday.filter((b) =>
      activeStatuses.includes(b.status as BookingStatus),
    );

    const snapshotItems = todayActiveBookings.map((b) => {
      const isOverdue =
        b.estimatedFinishTime &&
        now.getTime() > b.estimatedFinishTime.getTime() &&
        [BookingStatus.IN_PROGRESS, BookingStatus.UNLOADING].includes(
          b.status as BookingStatus,
        );

      const overdueMinutes = isOverdue
        ? Math.round(
            (now.getTime() - b.estimatedFinishTime.getTime()) / (1000 * 60),
          )
        : undefined;

      const waitingMinutes =
        b.arrivalTime && now.getTime() > b.arrivalTime.getTime()
          ? Math.round((now.getTime() - b.arrivalTime.getTime()) / (1000 * 60))
          : undefined;

      return {
        bookingId: b.id,
        code: b.code,
        warehouseName: b.Warehouse?.name ?? '',
        dockName: b.Dock?.name,
        arrivalTime: b.arrivalTime.toISOString(),
        estimatedFinishTime: b.estimatedFinishTime.toISOString(),
        status: b.status,
        vehicleBrand: b.Vehicle?.brand,
        vehicleType: b.Vehicle?.vehicleType,
        driverName: b.driver?.displayName ?? b.driverUsername,
        isOverdue: !!isOverdue,
        overdueMinutes,
        waitingMinutes,
        priority: undefined,
      };
    });

    const todayQueue = snapshotItems.sort((a, b) => {
      return (
        new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime()
      );
    });

    const nextArrivals = todayQueue
      .filter((item) => new Date(item.arrivalTime).getTime() >= now.getTime())
      .slice(0, 5);

    // KPI data untuk range
    const bookingsPerDayMap = new Map<
      string,
      {
        total: number;
        completed: number;
        canceled: number;
        onTimeSamples: number;
        onTimeCount: number;
      }
    >();

    bookings.forEach((b) => {
      const key = b.arrivalTime.toISOString().slice(0, 10);
      if (!bookingsPerDayMap.has(key)) {
        bookingsPerDayMap.set(key, {
          total: 0,
          completed: 0,
          canceled: 0,
          onTimeSamples: 0,
          onTimeCount: 0,
        });
      }
      const agg = bookingsPerDayMap.get(key);
      if (!agg) return;

      agg.total += 1;
      if (b.status === BookingStatus.FINISHED) {
        agg.completed += 1;
      }
      if (b.status === BookingStatus.CANCELED) {
        agg.canceled += 1;
      }
      if (b.actualFinishTime && b.estimatedFinishTime) {
        agg.onTimeSamples += 1;
        if (b.actualFinishTime.getTime() <= b.estimatedFinishTime.getTime()) {
          agg.onTimeCount += 1;
        }
      }
    });

    const sortedDates = Array.from(bookingsPerDayMap.keys()).sort();

    const bookingsPerDay = sortedDates.map((date) => {
      const agg = bookingsPerDayMap.get(date)!;
      return {
        date,
        total: agg.total,
        completed: agg.completed,
        canceled: agg.canceled,
      };
    });

    const onTimeRateTimeline = sortedDates.map((date) => {
      const agg = bookingsPerDayMap.get(date)!;
      const percent =
        agg.onTimeSamples > 0
          ? Math.round((agg.onTimeCount / agg.onTimeSamples) * 100)
          : 100;
      return {
        date,
        percent,
      };
    });

    const warehouseDistributionMap = new Map<string, number>();
    bookings.forEach((b) => {
      const name = b.Warehouse?.name ?? 'Unknown Warehouse';
      warehouseDistributionMap.set(
        name,
        (warehouseDistributionMap.get(name) ?? 0) + 1,
      );
    });

    const warehouseDistribution = Array.from(
      warehouseDistributionMap.entries(),
    ).map(([warehouseName, total]) => ({
      warehouseName,
      total,
    }));

    const result: ResponseVendorDashboardDto = {
      summaryMetrics: {
        totalBookingsInRange,
        totalWarehouses,
        activeToday,
        completedInRange: completedCount,
        canceledInRange: canceledInRange.length,
        onTimeRatePercent,
        avgUnloadingMinutes,
        lastUpdated: now.toISOString(),
      },
      warehouseBreakdown,
      operationalSnapshotToday: {
        todayQueue,
        nextArrivals,
      },
      kpiData: {
        bookingsPerDay,
        onTimeRateTimeline,
        warehouseDistribution,
      },
      filters: {
        selectedRange: {
          from: rangeStart.toISOString(),
          to: todayEnd.toISOString(),
          type: 'LAST_30_DAYS',
        },
        selectedWarehouseIds: [],
        statusFilter: 'ALL',
      },
    };

    return result;
  }
}

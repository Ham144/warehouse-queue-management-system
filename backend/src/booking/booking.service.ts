import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/common/prisma.service';
import { plainToInstance } from 'class-transformer';
import { ResponseBookingDto } from './dto/response-booking.dto';
import {
  BookingStatus,
  Days,
  DragAndDropPayload,
  ROLE,
} from 'src/common/shared-enum';
import { Booking, DockBusyTime, Prisma } from '@prisma/client';
import { TokenPayload } from 'src/user/dto/token-payload.dto';
import { BookingFilter } from 'src/common/shared-interface';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { ResponseReportsBookingDto } from './dto/response-reports-boking.dto';
import { ResponseDashboardBookingDto } from './dto/response-dashboard-booking.dto';
import { MoveTraceService } from 'src/move-trace/move-trace.service';

@Injectable()
export class BookingWarehouseService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly moveTraceService: MoveTraceService,
  ) {}

  private mapDayIndexToEnum(dayIndex: number): string {
    const dayMapping = [
      Days.SENIN, // 1 = Monday
      Days.SELASA, // 2 = Tuesday
      Days.RABU, // 3 = Wednesday
      Days.KAMIS, // 4 = Thursday
      Days.JUMAT, // 5 = Friday
      Days.SABTU, // 6 = Saturday
      Days.MINGGU, // 0 = Sunday
    ];
    return dayMapping[dayIndex];
  }

  private isBookingConflict(bookingDate: Date, busy: DockBusyTime): boolean {
    const b = bookingDate;

    // MONTHLY → cek tanggal
    if (busy.recurring === 'MONTHLY') {
      return b.getDate() === busy.recurringStep;
    }

    // WEEKLY → cek hari
    if (busy.recurring === 'WEEKLY') {
      const bookingDay = b.getDay(); // 0=Sun ... 6=Sat
      const bookingDayStr = this.mapDayIndexToEnum(bookingDay);
      return busy.recurringCustom.includes(bookingDayStr);
    }

    // DAILY → cek step
    if (busy.recurring === 'DAILY') {
      const start = new Date(busy.from);
      // beda hari dari start → hitung kelipatan
      const diffDays = Math.floor(
        (b.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      return diffDays >= 0 && diffDays % busy.recurringStep === 0;
    }

    return false;
  }

  private async getApplicableBusyTimesForDate(
    dockId: string,
    date: Date,
  ): Promise<DockBusyTime[]> {
    const allBusyTimes = await this.prismaService.dockBusyTime.findMany({
      where: { dockId },
    });

    const dayEnum = this.mapDayIndexToEnum(date.getDay());

    return allBusyTimes.filter((bt) => {
      if (bt.recurring === 'DAILY') return true;
      if (bt.recurring === 'WEEKLY') {
        return bt.recurringCustom.includes(dayEnum);
      }
      if (bt.recurring === 'MONTHLY') {
        return date.getDate() === bt.recurringStep;
      }
      return false;
    });
  }

  //user|admin organization
  async justifyBooking(
    id: string,
    updateDto: UpdateBookingDto,
    userInfo: TokenPayload,
  ) {
    const { arrivalTime, dockId } = updateDto;

    // Pastikan menggunakan cara import yang aman dari error sebelumnya
    const Holidays = require('date-holidays');
    const holidays = new Holidays('ID'); // ID untuk Indonesia

    // 1.2 cek hari libur nasional
    const isHoliday = holidays?.isHoliday(updateDto.arrivalTime);
    if (isHoliday) {
      throw new BadRequestException(
        `Tanggal ${updateDto.arrivalTime.toLocaleDateString('id-ID')} adalah hari libur nasional: ${isHoliday[0]?.name || 'Libur'}`,
      );
    }

    // Get existing booking
    const existingBooking = await this.prismaService.booking.findUnique({
      where: { id },
      include: {
        Vehicle: true,
        Dock: true,
      },
    });

    if (!existingBooking) {
      throw new NotFoundException(`Booking dengan id ${id} tidak ditemukan`);
    }
    //cegah yang aneh2
    if (
      existingBooking.status == BookingStatus.UNLOADING ||
      existingBooking.status == BookingStatus.FINISHED
    ) {
      throw new BadRequestException(
        `Booking yang ditemukan berstatus yang tidak bisa diubah [unloading, finished]`,
      );
    }

    // Use provided values or fallback to existing values

    // Helper function to convert HH:MM to minutes
    function HHMM_to_minutes(hhmm: string): number {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    }
    const newDockId = dockId || existingBooking.dockId;
    const newArrivalTime = new Date(arrivalTime);
    const newEstimatedFinishTime = new Date(
      newArrivalTime.getTime() + existingBooking.Vehicle.durasiBongkar * 60000,
    );

    const bookingFrom =
      newArrivalTime.getHours() * 60 + newArrivalTime.getMinutes();
    const bookingTo =
      newEstimatedFinishTime.getHours() * 60 +
      newEstimatedFinishTime.getMinutes();

    // Check busy times overlap
    const busyTimes = await this.prismaService.dockBusyTime.findMany({
      where: { dockId: newDockId },
    });

    const overLapIdx = busyTimes.findIndex((busy) => {
      const busyFrom = HHMM_to_minutes(busy.from);
      const busyTo = HHMM_to_minutes(busy.to);
      const isTimeOverlap = busyFrom < bookingTo && busyTo > bookingFrom;

      if (!isTimeOverlap) return false;

      // Check recurring pattern
      return this.isBookingConflict(newArrivalTime, busy);
    });

    if (overLapIdx !== -1) {
      throw new BadRequestException(
        `Waktu terkait overlap busy time ${busyTimes[overLapIdx].reason}, antara ${busyTimes[overLapIdx].from} sampai ${busyTimes[overLapIdx].to}`,
      );
    }

    // Check vehicle type compatibility with dock
    const allowedTypesSuccess = await this.prismaService.dock.findFirst({
      where: {
        id: newDockId,
        allowedTypes: {
          has: existingBooking.Vehicle.vehicleType,
        },
      },
    });

    if (!allowedTypesSuccess) {
      throw new BadRequestException(
        'tipe kendaraan tidak didukung di gate ini',
      );
    }

    // Check overlap with other bookings (excluding current booking)
    const overlapDockedHour = await this.prismaService.booking.findFirst({
      where: {
        dockId: newDockId,
        id: { not: id },
        status: { not: 'CANCELED' },
        AND: [
          {
            arrivalTime: {
              lt: newEstimatedFinishTime, // booking lain mulai sebelum booking ini selesai
            },
          },
          {
            estimatedFinishTime: {
              gt: newArrivalTime, // booking lain selesai setelah booking ini mulai
            },
          },
        ],
      },
    });

    if (overlapDockedHour) {
      throw new BadRequestException(
        `Waktu terkait overlap dengan booking ${overlapDockedHour.code}, antara ${overlapDockedHour.arrivalTime} sampai ${overlapDockedHour.estimatedFinishTime}`,
      );
    }

    // Update booking
    const updatedBooking = await this.prismaService.booking.update({
      where: { id },
      data: {
        arrivalTime: newArrivalTime,
        estimatedFinishTime: newEstimatedFinishTime,
        dockId: newDockId,
        ...updateDto,
      },
      include: {
        Vehicle: true,
        Warehouse: true,
        Dock: true,
        driver: true,
      },
    });

    await this.moveTraceService.create({
      bookingId: id,
      doer: userInfo.username,
      fromStatus: existingBooking.status,
      toStatus: updatedBooking.status,
      fromArrivalTime: existingBooking.arrivalTime.toISOString(),
      toArrivalTime: updatedBooking.arrivalTime.toISOString(),
      detailMovement:
        'justify - ' +
        existingBooking?.Dock?.name +
        ' to ' +
        updatedBooking?.Dock?.name,
    });

    return plainToInstance(ResponseBookingDto, updatedBooking, {
      excludeExtraneousValues: true,
      groups: ['detail'],
    });
  }

  //user|admin organization
  async dragAndDrop(
    id: string,
    payload: DragAndDropPayload,
    userInfo: TokenPayload,
  ) {
    /* ======================================
     * 1. VALIDASI DASAR & AMBIL DATA
     * ====================================== */
    const booking = await this.prismaService.booking.findUnique({
      where: { id },
      include: {
        Vehicle: true,
        Warehouse: true,
        Dock: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking tidak ditemukan');
    }

    const { action, toStatus, dockId, relativePositionTarget } = payload;
    const targetDockId = dockId || booking.dockId;

    const bookingBody: Prisma.BookingUpdateInput = {
      status: toStatus,
    };

    /* ======================================
     * 2. VALIDASI TIPE KENDARAAN DENGAN DOCK
     * ====================================== */
    if (targetDockId !== booking.dockId) {
      const dock = await this.prismaService.dock.findUnique({
        where: { id: targetDockId },
      });

      if (!dock || !dock.isActive) {
        throw new BadRequestException('Dock Tidak Aktif');
      }

      if (!dock.allowedTypes.includes(booking.Vehicle.vehicleType)) {
        throw new BadRequestException(
          `Tipe kendaraan ${booking.Vehicle.vehicleType} tidak didukung di gate ${dock.name}`,
        );
      }
    }

    /* ======================================
     * 3. HANDLE STATUS CANCELED (SIMPLE)
     * ====================================== */
    if (toStatus === 'CANCELED') {
      await this.prismaService.booking.update({
        where: { id },
        data: {
          status: 'CANCELED',
        },
      });
      await this.moveTraceService.create({
        bookingId: id,
        doer: userInfo.username,
        fromStatus: booking.status,
        toStatus: 'CANCELED',
        fromArrivalTime: booking.arrivalTime.toISOString(),
        toArrivalTime: booking.arrivalTime.toISOString(),
        detailMovement:
          'drag and drop - cancel' + ' reason: -> ' + booking?.canceledReason,
      });
      return { success: true, warehouseId: booking.warehouseId };
    }

    /* ======================================
     * 3. HANDLE STATUS UNLOADING (SIMPLE)
     * ====================================== */
    if (toStatus === 'UNLOADING') {
      const existingQueueUnloading = await this.prismaService.booking.findFirst(
        {
          where: {
            dockId: targetDockId,
            status: 'UNLOADING',
            actualStartTime: {
              gte: new Date(new Date(new Date()).setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
            actualArrivalTime: {
              gte: new Date(new Date(new Date()).setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
          include: {
            Dock: {
              select: {
                name: true,
              },
            },
          },
        },
      );
      if (existingQueueUnloading) {
        const message = `Pembongkaran sedang ada di ${existingQueueUnloading.Dock.name}`;
        return { success: false, message };
      }

      const updatingBooking = await this.prismaService.booking.findFirst({
        where: { id },
        include: {
          Dock: true,
        },
      });

      const bookingData: Prisma.BookingUpdateInput = {
        status: 'UNLOADING',
        actualStartTime: new Date().toISOString(),
        actualFinishTime: null,
        canceledReason: null,
        Dock: {
          connect: {
            id: targetDockId,
          },
        },
      };
      //jika langsung drag ke unloading tanpa konfirmasi telah datang
      if (!updatingBooking.actualArrivalTime) {
        bookingData.actualArrivalTime = new Date().toISOString();
      }
      await this.prismaService.booking.update({
        where: {
          id: id,
        },
        data: bookingData,
      });
      await this.moveTraceService.create({
        bookingId: id,
        doer: userInfo.username,
        fromStatus: booking.status,
        toStatus: 'UNLOADING',
        fromArrivalTime: booking.arrivalTime.toISOString(),
        toArrivalTime: booking.arrivalTime.toISOString(),
        detailMovement:
          'drag and drop - to unloading from ' +
          booking.Dock.name +
          ' to ' +
          updatingBooking.Dock.name,
      });
      return { success: true, warehouseId: booking.warehouseId };
    }

    /* ======================================
     * 3.SELEBIHNYA CODINGAN UNTUK IN_PROGRESS
     * ====================================== */

    /* ======================================
     * 5. TENTUKAN TANGGAL & AMBIL SCHEDULE
     * ====================================== */
    // PASTIKAN DRAG & DROP HANYA UNTUK HARI INI!
    const now = new Date();

    // UTC hari ini (IMMUTABLE)
    const startOfTodayUTC = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const endOfTodayUTC = new Date(
      startOfTodayUTC.getTime() + 24 * 60 * 60 * 1000,
    );

    // Ambil schedule untuk hari ini
    const scheduleQueryDate = new Date(now);
    scheduleQueryDate.setUTCHours(0, 0, 0, 0); // Gunakan UTC untuk query

    const schedule = await this.getScheduleForDockDay(
      targetDockId,
      scheduleQueryDate,
    );

    if (!schedule) {
      throw new BadRequestException(
        'Tidak ada jadwal untuk gate pada hari ini',
      );
    }

    const scheduleStartHour = schedule.startHour;
    const scheduleEndHour = schedule.endHour;
    const scheduleStartMinutes = Math.round(scheduleStartHour * 60);
    const scheduleEndMinutes = Math.round(scheduleEndHour * 60);

    /* ======================================
     * 6. AMBIL ANTRIAN YANG ADA (HANYA UNTUK HARI INI!)
     *  Note:  CANCELED, FINISHED, arrivalTime < now : di ignore
     * ====================================== */

    const existingQueue = await this.prismaService.booking.findMany({
      where: {
        dockId: targetDockId,
        id: { not: booking.id },
        // ❌ IGNORE
        status: {
          notIn: [
            BookingStatus.CANCELED,
            BookingStatus.FINISHED,
            BookingStatus.PENDING,
          ],
        },

        OR: [
          // ✅ UNLOADING → dock masih terpakai
          {
            status: BookingStatus.UNLOADING,
            arrivalTime: {
              gte: startOfTodayUTC,
              lt: endOfTodayUTC,
            },
          },

          // ✅ IN_PROGRESS → SUDAH DATANG
          {
            status: BookingStatus.IN_PROGRESS,
            actualArrivalTime: {
              not: null,
            },
            arrivalTime: {
              gte: startOfTodayUTC,
              lt: endOfTodayUTC,
            },
          },

          // ✅ IN_PROGRESS → BELUM DATANG tapi BELUM TERLAMBAT
          {
            status: BookingStatus.IN_PROGRESS,
            actualArrivalTime: null,
            arrivalTime: {
              gt: new Date(
                now.getTime() - booking.Warehouse.delayTolerance * 60_000,
              ),
              lt: endOfTodayUTC,
            },
          },
        ],
      },
      include: { Vehicle: true },
      orderBy: { arrivalTime: 'asc' },
    });

    /* ======================================
     * 7. TENTUKAN effectiveArrivalTime BERDASARKAN POSISI
     * ====================================== */
    const durationMinutes = booking.Vehicle.durasiBongkar;
    const intervalMinutes = booking.Warehouse?.isAutoEfficientActive
      ? booking.Warehouse.intervalMinimalQueueu
      : 0;

    let effectiveArrivalTime: Date;
    let insertIndex = existingQueue.length;

    // Helper untuk validasi waktu
    const validateTimeFitsInSchedule = (startTime: Date): boolean => {
      const startMins = this.toLocalMinutes(startTime);
      const finishMins = startMins + durationMinutes;
      return finishMins <= scheduleEndMinutes;
    };

    // CASE A: LAST - Ambil booking terakhir atau mulai dari schedule start
    if (
      relativePositionTarget.bookingId.startsWith('drop-after-last') ||
      relativePositionTarget.bookingId.startsWith('inprogress-empty')
    ) {
      if (existingQueue.length === 0) {
        //kondisi tidak ada booking
        const now = new Date();
        const currentLocalMinutes = this.toLocalMinutes(now);
        let candidateStartMinutes = currentLocalMinutes + intervalMinutes;
        // Jangan mulai sebelum schedule start
        candidateStartMinutes = Math.max(
          candidateStartMinutes,
          scheduleStartMinutes,
        );
        let candidateEndMinutes = currentLocalMinutes + durationMinutes;

        // Cek apakah bertabrakan dengan busy times candidateEndMinutes-nya jika ya majuin candidateStartMinutes
        const applicableBusyTimes = await this.getApplicableBusyTimesForDate(
          targetDockId,
          startOfTodayUTC,
        );
        //loooooping mencari jam yang tidak tabrakan dengan busytimes
        const loopingAvoidResult = this.loopingAvoidBusyTime(
          candidateStartMinutes,
          durationMinutes,
          applicableBusyTimes,
        );
        candidateStartMinutes = loopingAvoidResult.candidateStartMinutes;
        candidateEndMinutes = loopingAvoidResult.candidateEndMinutes;

        // Cek apakah arrivalTime dibawah jam pulang
        effectiveArrivalTime = this.checkOutOfRangeVacant(
          candidateStartMinutes,
          durationMinutes,
          scheduleEndMinutes,
        );
      } else {
        // Ada antrian
        const lastBooking = existingQueue[existingQueue.length - 1];
        const lastFinishTime = new Date(lastBooking.estimatedFinishTime);
        const lastFinishLocalMinutes = this.toLocalMinutes(lastFinishTime);

        const applicableBusyTimes = await this.getApplicableBusyTimesForDate(
          targetDockId,
          startOfTodayUTC,
        );

        // Hitung waktu mulai setelah booking terakhir
        let candidateStartMinutes = lastFinishLocalMinutes + intervalMinutes;

        const nowMinutes = (now.getUTCHours() + 7) * 60 + now.getUTCMinutes();
        candidateStartMinutes = Math.max(candidateStartMinutes, nowMinutes);
        let candidateEndMinutes = candidateStartMinutes + durationMinutes;

        //loooooping mencari jam yang tidak tabrakan dengan busytimes
        const loopingAvoidResult = this.loopingAvoidBusyTime(
          candidateStartMinutes,
          durationMinutes,
          applicableBusyTimes,
        );
        candidateStartMinutes = loopingAvoidResult.candidateStartMinutes;
        candidateEndMinutes = loopingAvoidResult.candidateEndMinutes;

        // Cek apakah arrivalTime dibawah jam pulang
        effectiveArrivalTime = this.checkOutOfRangeVacant(
          candidateStartMinutes,
          durationMinutes,
          scheduleEndMinutes,
        );
      }
    }
    // CASE B: BEFORE/AFTER/SWAP booking tertentu
    else {
      const targetBooking = await this.prismaService.booking.findUnique({
        where: { id: relativePositionTarget.bookingId },
        include: { Vehicle: true },
      });

      if (!targetBooking) {
        throw new BadRequestException('Target booking tidak ditemukan');
      }

      if (targetBooking.dockId !== targetDockId) {
        throw new BadRequestException(
          'Target booking berada di dock yang berbeda',
        );
      }

      const targetIndex = existingQueue.findIndex(
        (b) => b.id === targetBooking.id,
      );

      if (targetIndex === -1) {
        throw new BadRequestException(
          'Target booking tidak ada dalam antrian hari ini',
        );
      }

      // SWAP LOGIC
      if (relativePositionTarget.type === 'SWAP') {
        const targetDuration = targetBooking.Vehicle?.durasiBongkar || 0;
        if (durationMinutes !== targetDuration) {
          throw new BadRequestException(
            'Tidak bisa swap karena durasi bongkar berbeda',
          );
        }

        // Tukar waktu
        const tempArrivalTime = targetBooking.arrivalTime;
        const tempFinishTime = targetBooking.estimatedFinishTime;

        await this.prismaService.booking.update({
          where: { id: targetBooking.id },
          data: {
            arrivalTime: booking.arrivalTime,
            estimatedFinishTime: booking.estimatedFinishTime,
            actualArrivalTime: null,
            canceledReason: null,
          },
        });

        await this.prismaService.booking.update({
          where: { id },
          data: {
            dockId: targetDockId,
            status: toStatus,
            arrivalTime: tempArrivalTime,
            estimatedFinishTime: tempFinishTime,
            actualStartTime: toStatus === 'IN_PROGRESS' ? new Date() : null,
          },
        });

        await this.moveTraceService.create({
          bookingId: id,
          doer: userInfo.username,
          fromStatus: booking.status,
          toStatus: toStatus,
          fromArrivalTime: booking.arrivalTime.toISOString(),
          toArrivalTime: tempArrivalTime.toISOString(),
          detailMovement:
            'drag and drop - swap with booking ' + targetBooking.code,
        });

        return { success: true, warehouseId: booking.warehouseId };
      }

      // BEFORE/AFTER LOGIC
      if (relativePositionTarget.type === 'BEFORE') {
        insertIndex = targetIndex;

        if (targetIndex === 0) {
          // Sebelum booking pertama
          const firstArrivalTime = new Date(existingQueue[0].arrivalTime);
          const firstArrivalLocalMinutes =
            this.toLocalMinutes(firstArrivalTime);

          // Hitung waktu sebelum booking pertama
          const candidateStartMinutes =
            firstArrivalLocalMinutes - durationMinutes - intervalMinutes;

          if (candidateStartMinutes >= scheduleStartMinutes) {
            const candidateTime = this.createDateWithLocalTime(
              firstArrivalTime,
              candidateStartMinutes,
            );

            if (validateTimeFitsInSchedule(candidateTime)) {
              effectiveArrivalTime = candidateTime;
            } else {
              throw new BadRequestException(
                'Tidak dapat menempatkan sebelum booking pertama',
              );
            }
          } else {
            throw new BadRequestException(
              'Tidak ada ruang sebelum booking pertama',
            );
          }
        } else {
          // Di antara dua booking
          const prevFinishTime = new Date(
            existingQueue[targetIndex - 1].estimatedFinishTime,
          );
          const nextArrivalTime = new Date(
            existingQueue[targetIndex].arrivalTime,
          );

          const prevFinishLocal = this.toLocalMinutes(prevFinishTime);
          const nextArrivalLocal = this.toLocalMinutes(nextArrivalTime);

          const gapMinutes = nextArrivalLocal - prevFinishLocal;
          const requiredMinutes = durationMinutes + intervalMinutes;

          if (gapMinutes >= requiredMinutes) {
            const candidateStartMinutes = prevFinishLocal + intervalMinutes;
            const candidateTime = this.createDateWithLocalTime(
              prevFinishTime,
              candidateStartMinutes,
            );

            if (validateTimeFitsInSchedule(candidateTime)) {
              effectiveArrivalTime = candidateTime;
            } else {
              throw new BadRequestException(`Tidak cukup waktu antara booking`);
            }
          } else {
            throw new BadRequestException(
              `Tidak ada cukup waktu antara booking`,
            );
          }
        }
      } else if (relativePositionTarget.type === 'AFTER') {
        insertIndex = targetIndex + 1;
        const targetFinishTime = new Date(targetBooking.estimatedFinishTime);
        const targetFinishLocal = this.toLocalMinutes(targetFinishTime);

        if (targetIndex === existingQueue.length - 1) {
          // Setelah booking terakhir
          const candidateStartMinutes = targetFinishLocal + intervalMinutes;
          const candidateTime = this.createDateWithLocalTime(
            targetFinishTime,
            candidateStartMinutes,
          );

          if (validateTimeFitsInSchedule(candidateTime)) {
            effectiveArrivalTime = candidateTime;
          } else {
            throw new BadRequestException(
              `Tidak dapat menempatkan setelah booking terakhir`,
            );
          }
        } else {
          // Di antara booking
          const nextArrivalTime = new Date(
            existingQueue[targetIndex + 1].arrivalTime,
          );
          const nextArrivalLocal = this.toLocalMinutes(nextArrivalTime);

          const gapMinutes = nextArrivalLocal - targetFinishLocal;
          const requiredMinutes = durationMinutes + intervalMinutes;

          if (gapMinutes >= requiredMinutes) {
            const candidateStartMinutes = targetFinishLocal + intervalMinutes;
            const candidateTime = this.createDateWithLocalTime(
              targetFinishTime,
              candidateStartMinutes,
            );

            if (validateTimeFitsInSchedule(candidateTime)) {
              effectiveArrivalTime = candidateTime;
            } else {
              throw new BadRequestException(
                `Tidak cukup waktu setelah booking`,
              );
            }
          } else {
            throw new BadRequestException(
              `Tidak ada cukup waktu setelah booking`,
            );
          }
        }
      }
    }

    /* ======================================
     * 8. VALIDASI WAKTU DENGAN SCHEDULE
     * ====================================== */
    const estimatedFinishTimeMs =
      effectiveArrivalTime.getTime() + durationMinutes * 60_000;
    const estimatedFinishTime = new Date(estimatedFinishTimeMs);

    const arrivalLocalMinutes = this.toLocalMinutes(effectiveArrivalTime);
    const finishLocalMinutes = this.toLocalMinutes(estimatedFinishTime);
    // Validasi schedule start
    if (arrivalLocalMinutes < scheduleStartMinutes) {
      throw new BadRequestException(
        `Waktu mulai (${this.formatMinutes(arrivalLocalMinutes)}) sebelum jam operasional mulai (${this.formatMinutes(scheduleStartMinutes)})`,
      );
    }

    // Validasi schedule end
    if (finishLocalMinutes > scheduleEndMinutes) {
      throw new BadRequestException(
        `Waktu selesai (${this.formatMinutes(finishLocalMinutes)}) melewati jam operasional berakhir (${this.formatMinutes(scheduleEndMinutes)})`,
      );
    }

    // Validasi overnight schedule
    if (scheduleEndMinutes < scheduleStartMinutes) {
      const isOvernightFinish = finishLocalMinutes < arrivalLocalMinutes;
      if (isOvernightFinish && finishLocalMinutes > scheduleEndMinutes) {
        throw new BadRequestException(
          'Waktu selesai melewati jam operasional untuk schedule overnight',
        );
      }
    }

    /* ======================================
     * 9. VALIDASI DENGAN BUSY TIMES
     * ====================================== */
    const applicableBusyTimes = await this.getApplicableBusyTimesForDate(
      targetDockId,
      startOfTodayUTC,
    );

    for (const busyTime of applicableBusyTimes) {
      const busyStart = this.parseTimeToHours(busyTime.from);
      const busyEnd = this.parseTimeToHours(busyTime.to);

      if (busyStart !== null && busyEnd !== null) {
        const busyStartMinutes = busyStart * 60;
        const busyEndMinutes = busyEnd * 60;

        const overlaps =
          (arrivalLocalMinutes >= busyStartMinutes &&
            arrivalLocalMinutes < busyEndMinutes) ||
          (finishLocalMinutes > busyStartMinutes &&
            finishLocalMinutes <= busyEndMinutes) ||
          (arrivalLocalMinutes <= busyStartMinutes &&
            finishLocalMinutes >= busyEndMinutes);

        if (overlaps) {
          throw new BadRequestException(
            `Waktu bertabrakan dengan busy time: ${busyTime.reason} (${busyTime.from} - ${busyTime.to})`,
          );
        }
      }
    }

    /* ======================================
     * 10. VALIDASI TABRAKAN DENGAN BOOKING LAIN
     * ====================================== */
    const validationQueue = [...existingQueue];
    const newBookingSlot = {
      id: booking.id,
      arrivalTime: effectiveArrivalTime,
      estimatedFinishTime: estimatedFinishTime,
    };

    validationQueue.splice(insertIndex, 0, newBookingSlot as any);

    // Urutkan dan validasi overlap
    validationQueue.sort(
      (a, b) =>
        new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime(),
    );

    for (let i = 0; i < validationQueue.length - 1; i++) {
      const currentFinish = new Date(validationQueue[i].estimatedFinishTime);
      const nextArrival = new Date(validationQueue[i + 1].arrivalTime);

      if (currentFinish.getTime() > nextArrival.getTime()) {
        throw new BadRequestException(
          'Terjadi tabrakan waktu dengan booking lain',
        );
      }
    }

    /* ======================================
     * 11. UPDATE BOOKING for UNLOADING
     * ====================================== */
    bookingBody.actualStartTime = null;
    bookingBody.actualFinishTime = null;
    bookingBody.Dock = {
      connect: { id: targetDockId },
    };
    bookingBody.canceledReason = null;
    bookingBody.status = BookingStatus.IN_PROGRESS;
    bookingBody.arrivalTime = effectiveArrivalTime;
    bookingBody.estimatedFinishTime = estimatedFinishTime;
    const updatedBooking = await this.prismaService.booking.update({
      where: { id },
      data: bookingBody,
      include: {
        Dock: true,
      },
    });

    await this.moveTraceService.create({
      bookingId: id,
      doer: userInfo.username,
      fromStatus: booking.status,
      toStatus: BookingStatus.IN_PROGRESS,
      fromArrivalTime: booking.arrivalTime.toISOString(),
      toArrivalTime: effectiveArrivalTime.toISOString(),
      detailMovement:
        'drag and drop - to in progress from ' +
        booking.Dock.name +
        ' to ' +
        updatedBooking.Dock.name,
    });

    return { success: true, warehouseId: booking.warehouseId };
  }

  async findAll(filter: BookingFilter, userInfo: TokenPayload) {
    const { page, searchKey, status, weekStart, weekEnd, date } = filter;

    const where: Prisma.BookingWhereInput = {
      organizationName: userInfo.organizationName,
    };

    if (
      date &&
      date !== 'null' &&
      weekEnd &&
      weekEnd !== 'null' &&
      weekStart &&
      weekStart !== 'null'
    ) {
      throw new BadRequestException(
        'filter date and weekEnd tidak dapat digunakan bersamaan',
      );
    }

    if (status && status != 'all') {
      where.status = status;
    }

    // Filter Range Tanggal (Arrival Time)
    if (weekStart && weekStart !== 'null' && weekEnd && weekEnd !== 'null') {
      const gteDate = new Date(weekStart);
      const lteDate = new Date(weekEnd);

      if (!isNaN(gteDate.getTime()) && !isNaN(lteDate.getTime())) {
        where.arrivalTime = {
          gte: new Date(gteDate.setHours(0, 0, 0, 0)),
          lte: new Date(lteDate.setHours(23, 59, 59, 999)),
        };
      }
    } else if (date && date !== 'null') {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        where.arrivalTime = {
          gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
          lte: new Date(parsedDate.setHours(23, 59, 59, 999)),
        };
      }
    }

    if (userInfo.role == ROLE.ADMIN_VENDOR) {
      where.driver = {
        vendorName: {
          equals: userInfo.vendorName,
          mode: 'insensitive',
        },
      };
    } else if (userInfo.role == ROLE.DRIVER_VENDOR) {
      where.driverUsername = userInfo.username;
    } else {
      where.warehouseId = userInfo.homeWarehouseId;
    }

    if (filter.dockId && filter.dockId != 'all') {
      where.dockId = filter.dockId;
    }

    if (filter.vehicleType && filter.vehicleType !== 'all') {
      where.Vehicle = {
        ...(where.Vehicle as any),
        vehicleType: filter.vehicleType,
      };
    }

    if (filter.vendorName && filter.vendorName !== 'all') {
      where.driver = {
        ...(where.driver as any),
        vendorName: {
          equals: filter.vendorName,
          mode: 'insensitive',
        },
      };
    }

    if (filter.hasArrived === 'true') {
      where.actualArrivalTime = { not: null };
    } else if (filter.hasArrived === 'false') {
      where.actualArrivalTime = null;
    }

    if (searchKey) {
      where.OR = [
        {
          code: {
            contains: searchKey,
            mode: 'insensitive',
          },
        },
        {
          notes: {
            contains: searchKey,
            mode: 'insensitive',
          },
        },
        {
          driverUsername: {
            contains: searchKey,
            mode: 'insensitive',
          },
        },
        {
          Vehicle: {
            brand: {
              contains: searchKey,
              mode: 'insensitive',
            },
          },
        },
      ];
    }
    const orderBy: Prisma.BookingOrderByWithRelationInput = {};
    if (filter.sortBy && filter.sortOrder) {
      orderBy[filter.sortBy] = filter.sortOrder;
    } else {
      orderBy.updatedAt = 'desc';
    }

    const bookings = await this.prismaService.booking.findMany({
      where,
      orderBy,
      take: 10,
      skip: (page - 1) * 10,
      include: {
        Vehicle: {
          select: {
            durasiBongkar: true,
            brand: true,
            vehicleType: true,
            description: true,
          },
        },
        driver: {
          select: {
            username: true,
            displayName: true,
            vendorName: true,
          },
        },
        Dock: {
          select: {
            name: true,
          },
        },
        Warehouse: {
          select: {
            name: true,
          },
        },
      },
    });

    return plainToInstance(ResponseBookingDto, bookings, {
      excludeExtraneousValues: true,
      groups: ['detail'],
    });
  }

  //unutk queue
  async semiDetailList(filter: BookingFilter, userInfo: TokenPayload) {
    const { date, isForBooking } = filter;

    const where: Prisma.BookingWhereInput = {
      organizationName: userInfo.organizationName,
    };

    if (date) {
      const parsed = new Date(date);
      const base = isNaN(parsed.getTime()) ? new Date() : parsed;

      const from = new Date(base);
      const to = new Date(base);

      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);

      where.AND = [
        {
          arrivalTime: {
            gte: from,
            lte: to,
          },
        },
      ];
    }
    //FINISHED tidak dikeluarkan karena sudah selesai!
    //CANCELED tetap dikeluarkan karena itu perlu tampil di live queue!

    //periksa apakah layer konfirmasi
    if (isForBooking) {
      const organization = await this.prismaService.organization.findUnique({
        where: {
          name: userInfo.organizationName,
        },
      });
      if (organization?.isConfirmBookRequired) {
        where.status = {
          in: [
            BookingStatus.IN_PROGRESS,
            BookingStatus.UNLOADING,
            BookingStatus.PENDING,
          ],
        };
      } else {
        where.status = {
          in: [BookingStatus.IN_PROGRESS, BookingStatus.UNLOADING],
        };
      }
    } else {
      //ini admin gudang
      where.status = {
        notIn: [BookingStatus.FINISHED, BookingStatus.PENDING],
      };
    }

    const bookings = await this.prismaService.booking.findMany({
      where,
      orderBy: {
        arrivalTime: 'asc',
      },
      include: {
        Vehicle: {
          select: {
            durasiBongkar: true,
            brand: true,
            vehicleType: true,
            description: true,
          },
        },
        driver: {
          select: {
            username: true,
            displayName: true,
            vendorName: true,
          },
        },
      },
    });
    return plainToInstance(ResponseBookingDto, bookings, {
      excludeExtraneousValues: true,
    });
  }

  async updateBookingStatus(
    id: string,
    payload: UpdateBookingDto,
    userInfo: TokenPayload,
  ) {
    const existingBooking = await this.prismaService.booking.findUnique({
      where: { id },
    });

    if (!existingBooking) {
      throw new NotFoundException(`Booking dengan id ${id} tidak ditemukan`);
    }

    const updateData: Prisma.BookingUpdateInput = {
      status: payload.status,
    };
    if (
      payload.status === BookingStatus.IN_PROGRESS &&
      payload.actualArrivalTime
    ) {
      updateData.actualArrivalTime = payload.actualArrivalTime;
      updateData.actualStartTime = null;
    }
    if (
      payload.status === BookingStatus.IN_PROGRESS &&
      !payload.actualArrivalTime
    ) {
      updateData.actualArrivalTime = null;
      updateData.actualStartTime = null;
    }

    if (payload.status === 'FINISHED' && payload.actualFinishTime) {
      updateData.actualFinishTime = payload.actualFinishTime;
      if (
        !existingBooking.actualArrivalTime ||
        !existingBooking.actualStartTime
      ) {
        throw new BadRequestException(
          'Kesalahan sistem : actualArrivalTime dan actualStartTime belum tercatat',
        );
      }
    }

    const updatedBooking = await this.prismaService.booking.update({
      where: { id },
      data: updateData,
      include: {
        Vehicle: true,
        Warehouse: true,
        Dock: true,
        driver: true,
      },
    });

    await this.moveTraceService.create({
      bookingId: id,
      doer: userInfo.username,
      fromStatus: existingBooking.status,
      toStatus: updatedBooking.status,
      fromArrivalTime: existingBooking.arrivalTime.toISOString(),
      toArrivalTime: updatedBooking.arrivalTime.toISOString(),
      detailMovement: 'update status',
    });

    return plainToInstance(ResponseBookingDto, updatedBooking, {
      excludeExtraneousValues: true,
      groups: ['detail'],
    });
  }

  async getStatsForUserOrganizations() {}

  async adminReports(
    userinfo: TokenPayload,
    startDate: string,
    endDate: string,
    isKpiInclude: boolean,
  ) {
    // Convert input dates
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    // Get bookings within date range - FIX: gunakan createdAt seperti kode yang berhasil
    const bookings = await this.prismaService.booking.findMany({
      where: {
        organizationName: userinfo.organizationName,
        warehouseId: userinfo.homeWarehouseId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        Vehicle: true,
        Warehouse: true,
        Dock: true,
        driver: true,
        organization: true,
      },
    });

    // Calculate on-time delivery rate - menggunakan status 'FINISHED' untuk completed
    const finishedBookings = bookings.filter((b) => b.status === 'FINISHED');

    const onTimeBookings = finishedBookings.filter((b) => {
      // Check jika ada waktu aktual dan waktu kedatangan
      if (!b.actualStartTime || !b.arrivalTime) {
        return false;
      }

      const arrivalTime = new Date(b.arrivalTime);
      const actualStartTime = new Date(b.actualStartTime);
      const timeDifference = actualStartTime.getTime() - arrivalTime.getTime();
      const toleranceMinutes = 30; // 30 minutes tolerance

      const isOnTime = timeDifference <= toleranceMinutes * 60000;

      return isOnTime;
    });

    const onTimeDeliveryRate =
      finishedBookings.length > 0
        ? (onTimeBookings.length / finishedBookings.length) * 100
        : 0;

    // Calculate average unload time (in minutes)
    const bookingsWithFinishTime = finishedBookings.filter(
      (b) => b.actualStartTime && b.actualFinishTime,
    );

    let averageUnloadTime = 0;
    if (bookingsWithFinishTime.length > 0) {
      const totalUnloadTime = bookingsWithFinishTime.reduce((sum, b) => {
        const start = new Date(b.actualStartTime).getTime();
        const finish = new Date(b.actualFinishTime).getTime();
        const minutes = (finish - start) / (1000 * 60); // convert to minutes
        return sum + minutes;
      }, 0);

      averageUnloadTime = totalUnloadTime / bookingsWithFinishTime.length;
    }

    // Calculate no-shows - booking yang dijadwalkan datang tapi tidak pernah muncul
    const noShows = bookings.filter((b) => {
      if (!b.arrivalTime) return false;
      const arrivalTime = new Date(b.arrivalTime);
      const now = new Date();
      // 1. Jadwal kedatangan harus sudah lewat (sudah melewati waktu sekarang)
      const isPastSchedule = arrivalTime < now;
      // 2. Tidak ada actualArrivalTime (tidak pernah datang)
      const neverArrived = !b.actualArrivalTime;
      // 3. Status bukan FINISHED atau UNLOADING (tidak sedang/sudah diproses)
      const isNotProcessing =
        b.status !== 'FINISHED' && b.status !== 'UNLOADING';
      // 4. Jadwal dalam periode yang difilter
      const periodStart = new Date(start);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(end);
      periodEnd.setHours(23, 59, 59, 999);
      const isInPeriod = arrivalTime >= periodStart && arrivalTime <= periodEnd;
      const isNoShow =
        isPastSchedule && neverArrived && isNotProcessing && isInPeriod;
      return isNoShow;
    }).length;
    // Group by dock for dock performances
    const dockMap = new Map<string, any>();

    bookings.forEach((booking) => {
      if (booking.Dock) {
        const dockId = booking.Dock.id;

        if (!dockMap.has(dockId)) {
          dockMap.set(dockId, {
            id: booking.Dock.id,
            name: booking.Dock.name || `Dock ${booking.Dock.id}`,
            totalBooking: 0,
            finishedBookings: [],
            onTimeBookings: [],
            canceled: 0,
            unloadTimes: [],
          });
        }

        const dockData = dockMap.get(dockId);
        dockData.totalBooking++;

        if (booking.status === 'FINISHED') {
          dockData.finishedBookings.push(booking);

          // Hitung waktu bongkar jika ada
          if (booking.actualStartTime && booking.actualFinishTime) {
            const start = new Date(booking.actualStartTime).getTime();
            const finish = new Date(booking.actualFinishTime).getTime();
            const minutes = (finish - start) / (1000 * 60);
            dockData.unloadTimes.push(minutes);
          }

          // Check if on-time for this dock
          if (booking.actualStartTime && booking.arrivalTime) {
            const arrivalTime = new Date(booking.arrivalTime);
            const actualStartTime = new Date(booking.actualStartTime);
            const timeDifference =
              actualStartTime.getTime() - arrivalTime.getTime();
            const toleranceMinutes = 30;

            if (timeDifference <= toleranceMinutes * 60000) {
              dockData.onTimeBookings.push(booking);
            }
          }
        } else if (booking.status === 'CANCELED') {
          dockData.canceled++;
        }
      }
    });

    // Calculate metrics for each dock
    const dockPerformances = Array.from(dockMap.values()).map((dock) => {
      const dockOnTimeRate =
        dock.finishedBookings.length > 0
          ? (dock.onTimeBookings.length / dock.finishedBookings.length) * 100
          : 0;

      let dockAvgUnloadTime = 0;
      if (dock.unloadTimes.length > 0) {
        dockAvgUnloadTime =
          dock.unloadTimes.reduce((sum, time) => sum + time, 0) /
          dock.unloadTimes.length;
      }

      return {
        id: dock.id,
        name: dock.name,
        totalBooking: dock.totalBooking,
        onTimeDeliveryRate: Math.round(dockOnTimeRate * 100) / 100,
        averageUnloadTime: Math.round(dockAvgUnloadTime * 10) / 10,
        noShows: 0,
        canceled: dock.canceled,
      };
    });

    let kpi = null;

    if (
      [ROLE.USER_ORGANIZATION, ROLE.ADMIN_ORGANIZATION].includes(
        userinfo.role,
      ) &&
      String(isKpiInclude) === 'true'
    ) {
      kpi = await this.prismaService.$queryRaw`
        SELECT 
            u."username",
        COALESCE(u."vendorName", 'INTERNAL') AS "vendor",
            mt."lastActivity",
            CAST(COALESCE(mt."totalMovements", 0) AS INTEGER) AS "perubahan",
            CAST(COUNT(b."id") AS INTEGER) AS "totalCreated",
            CAST(COUNT(b."id") FILTER (WHERE b."status" = 'FINISHED') AS INTEGER) AS "completed",
            CAST(COUNT(b."id") FILTER (WHERE b."status" = 'CANCELED') AS INTEGER) AS "canceled",
            CAST(COUNT(b."id") FILTER (WHERE b."status" IN ('PENDING', 'IN_PROGRESS', 'UNLOADING')) AS INTEGER) AS "onProgress"
        FROM "User" u
        -- Menggunakan INNER JOIN agar hanya user yang ada di MoveTrace (punya aktivitas) yang muncul
        INNER JOIN (
            SELECT 
                "doer", 
                MAX("createdAt") AS "lastActivity",
                COUNT(*) AS "totalMovements"
            FROM "MoveTrace"
            WHERE "createdAt" >= ${start}
              AND "createdAt" <= ${end}
            GROUP BY "doer"
        ) mt ON u."username" = mt."doer"
        LEFT JOIN "Booking" b ON u."username" = b."createByUsername" 
            AND b."createdAt" >= ${start}
            AND b."createdAt" <= ${end}
        GROUP BY u."username", u."vendorName", mt."lastActivity", mt."totalMovements"
        -- Mengurutkan berdasarkan total gabungan (QTY ALL)
        ORDER BY (COALESCE(mt."totalMovements", 0) + COUNT(b."id")) DESC;
      `;

      if (kpi && kpi.length > 0) {
        kpi = kpi
          .map((item) => {
            // Pastikan lastActivity ada sebelum diolah
            if (!item.lastActivity) return null;

            const dateObj = new Date(item.lastActivity);

            // Format Tanggal (YYYY-MM-DD)
            const tanggalAktifitasTerakhir = dateObj
              .toISOString()
              .split('T')[0];

            // Format Jam (HH:mm) WIB
            const jamAktifitasTerakhir = dateObj
              .toLocaleString('id-ID', {
                timeZone: 'Asia/Jakarta',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
              .replace('.', ':');

            // Kalkulasi total
            const created = item.totalCreated || 0;
            const perubahan = item.perubahan || 0;
            const myTask_totalActivity = created + perubahan;

            return {
              username: item.username,
              vendor: item.vendor, // Sudah dihandle COALESCE di SQL
              tanggalAktifitasTerakhir,
              jamAktifitasTerakhir,
              FINISHED: item.completed || 0,
              CANCELED: item.canceled || 0,
              IN_PROGRESS: item.onProgress || 0,
              totalCreated: created,
              perubahanLapangan: perubahan,
              qtyAll: myTask_totalActivity,
            };
          })
          // Filter untuk membuang null jika ada data tanpa lastActivity
          .filter((item) => item !== null)
          // Urutkan berdasarkan QTY ALL Terbanyak
          .sort((a, b) => b['QTY ALL'] - a['QTY ALL']);
      }
    }

    return plainToInstance(
      ResponseReportsBookingDto,
      {
        onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 100) / 100,
        averageUnloadTime: Math.round(averageUnloadTime * 10) / 10,
        noShows,
        totalBooking: bookings?.length || 0,
        dockPerformances,
        kpi,
      },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  async adminDashboard(
    userInfo: TokenPayload,
  ): Promise<ResponseDashboardBookingDto> {
    // Dashboard hanya untuk waktu hari ini
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

    // Ambil semua booking untuk organization user saat ini
    const bookings = await this.prismaService.booking.findMany({
      where: {
        organizationName: userInfo.organizationName,
        warehouseId: userInfo.homeWarehouseId,
        arrivalTime: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        Vehicle: true,
        Warehouse: true,
        Dock: true,
        driver: {
          include: {
            vendor: true,
          },
        },
        createdBy: {
          select: {
            displayName: true,
          },
        },
      },
    });

    // Ambil hanya dock dari warehouse nya
    const docks = await this.prismaService.dock.findMany({
      where: {
        organizationName: userInfo.organizationName,
        warehouseId: userInfo.homeWarehouseId,
      },
      include: {
        vacants: true,
        busyTimes: {
          where: {
            createdAt: {
              gte: todayStart,
            },
          },
        },
        bookings: {
          where: {
            createdAt: {
              gte: todayStart,
              lte: todayEnd,
            },
            status: {
              in: [
                BookingStatus.IN_PROGRESS,
                BookingStatus.FINISHED,
                BookingStatus.UNLOADING,
              ],
            },
          },
          include: {
            driver: {
              include: {
                vendor: true,
              },
            },
            Vehicle: true,
          },
        },
        warehouse: {
          select: {
            name: true,
          },
        },
      },
    });

    // Hitung metrics
    const totalBookingsToday = bookings.length;
    const pending = bookings.filter((b) => b.status == BookingStatus.PENDING);

    // booking yang telah datang sedang menungggu
    const activeBookings = bookings.filter(
      (b) =>
        [BookingStatus.IN_PROGRESS].includes(BookingStatus[b.status]) &&
        b.actualArrivalTime,
    ).length;

    // Hitung delayed bookings (melebihi estimatedFinishTime)
    const delayedBookings = bookings.filter((b) => {
      const late =
        b.arrivalTime.getTime() >
        new Date(
          new Date().getTime() + b.Warehouse.delayTolerance * 60_000,
        ).getTime();
      if (b.status == 'IN_PROGRESS' && !b.actualArrivalTime && late) {
        return true;
      }
    }).length;

    const completedToday = bookings.filter((b) =>
      [BookingStatus.FINISHED].includes(BookingStatus[b.status]),
    ).length;

    // Hitung rata-rata processing time
    const completedBookings = bookings.filter(
      (b) =>
        b.status === BookingStatus.FINISHED &&
        b.actualStartTime &&
        b.actualFinishTime,
    );

    const avgProcessingMinutes =
      completedBookings.length > 0
        ? Math.round(
            completedBookings.reduce((acc, b) => {
              const duration =
                b.actualFinishTime.getTime() - b.actualStartTime.getTime();
              return acc + duration / (1000 * 60);
            }, 0) / completedBookings.length,
          )
        : 0;

    const STATUS_WEIGHT: Record<BookingStatus, number> = {
      [BookingStatus.UNLOADING]: 1,
      [BookingStatus.IN_PROGRESS]: 0.8,
      [BookingStatus.FINISHED]: 0,
      [BookingStatus.CANCELED]: 0,
      [BookingStatus.PENDING]: 0,
    };
    const getDockWeight = (bookings: Booking[]): number => {
      if (!bookings || bookings.length === 0) return 0; // Jika ini kena, berarti dock.bookings kosong

      return bookings.reduce((max, booking) => {
        const weight = STATUS_WEIGHT[booking.status as BookingStatus];
        return Math.max(max, weight ?? 0);
      }, 0);
    }; // 1. Pastikan kita punya list dock yang unik
    // 2. Map setiap dock untuk mengambil booking-nya dari data JSON yang kamu punya
    const dockScores = docks.map((dock) => {
      // Cari booking di data JSON yang dockId-nya sama dengan id dock ini
      const bookingsForThisDock = bookings.filter((b) => b.dockId === dock.id);

      // Hitung weight untuk dock ini
      return getDockWeight(bookingsForThisDock);
    });

    // 3. Hitung rata-rata
    const score =
      dockScores.length > 0
        ? dockScores.reduce((sum, weight) => sum + weight, 0) / docks.length
        : 0;

    const dockUtilizationPercent = Math.round(score * 100);

    const timeStringToMinutes = (time: string): number => {
      if (!time) return 0;
      const parts = time.split(':');
      if (parts.length < 2) return 0;
      const [hour, minute] = parts.map(Number);
      return (hour || 0) * 60 + (minute || 0);
    };

    const dockStatuses = docks.map((dock) => {
      let status:
        | 'KOSONG'
        | 'TIDAK AKTIF'
        | 'SEDANG MEMBONGKAR'
        | 'SIBUK/ISTIRAHAT'
        | 'DILUAR JAM KERJA';

      let vendorName = '';
      let remainingMinutes = 0;

      const now = new Date();
      // Geser ke WIB
      const jakartaTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);

      // AMBIL DARI jakartaTime!
      const nowMinutes =
        jakartaTime.getUTCHours() * 60 + jakartaTime.getUTCMinutes();
      const nowTime = jakartaTime.getTime();

      const days = [
        Days.MINGGU, // 0
        Days.SENIN, // 1
        Days.SELASA, // 2
        Days.RABU, // 3
        Days.KAMIS, // 4
        Days.JUMAT, // 5
        Days.SABTU, // 6
      ];

      const todayVacant = dock?.vacants?.find((v) => {
        return Days[v.day] === days[now.getDay()];
      });

      if (!dock?.isActive) {
        status = 'TIDAK AKTIF';
        return { dockId: dock.id, dockName: dock.name, status };
      }

      if (!todayVacant) {
        status = 'DILUAR JAM KERJA';
        return { dockId: dock.id, dockName: dock.name, status };
      }

      // Asumsi todayVacant.availableFrom isinya "08:00"
      const startMinutes = timeStringToMinutes(todayVacant.availableFrom);
      const endMinutes = timeStringToMinutes(todayVacant.availableUntil);

      // Pastikan membandingkan menit dengan menit
      if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
        status = 'DILUAR JAM KERJA';
        return { dockId: dock.id, dockName: dock.name, status };
      }
      const onBusyTime = dock.busyTimes.find((bt) => {
        const from = timeStringToMinutes(bt.from);
        const to = timeStringToMinutes(bt.to);
        const inRange = nowMinutes >= from && nowMinutes <= to;

        if (bt.recurring === 'DAILY') return inRange;
        if (bt.recurring === 'WEEKLY')
          return (
            bt.recurringCustom?.includes(
              this.mapDayIndexToEnum(now.getDay()),
            ) && inRange
          );

        if (bt.recurring === 'MONTHLY')
          return now.getDate() === bt.recurringStep && inRange;
        return false;
      });

      if (onBusyTime) {
        status = 'SIBUK/ISTIRAHAT';
        remainingMinutes = timeStringToMinutes(onBusyTime.to) - nowMinutes;
      }

      const unloading = dock.bookings.find((b) => {
        return b.status === 'UNLOADING';
      });

      if (unloading) {
        status = 'SEDANG MEMBONGKAR';
        remainingMinutes = Math.max(
          0,
          Math.round(
            (unloading.actualStartTime.getTime() +
              unloading.Vehicle.durasiBongkar * 60000 -
              nowTime) /
              60000,
          ),
        );
        vendorName = unloading.driver.vendorName;
      }

      if (!status) {
        status = 'KOSONG';
      }

      return {
        dockId: dock.id,
        dockName: dock.name,
        status,
        vendorName,
        remainingMinutes,
      };
    });
    // Prepare queue snapshot (top 5 waiting bookings)
    const queueSnapshot = bookings
      .filter((b) => b.arrivalTime.getTime() > now.getTime())
      .sort((a, b) => {
        if (BookingStatus[b.status] === BookingStatus.IN_PROGRESS) {
          return -1;
        }
        const aTime = a.arrivalTime.getTime();
        const bTime = b.arrivalTime.getTime();
        return aTime - bTime;
      })
      .slice(0, 5);

    // Generate KPI data
    const kpiData = this.generateKPIData(bookings, docks, now);

    // Generate busy time data
    const busyTimeData = this.generateBusyTimeData(docks, now);

    // Generate alerts
    const alerts = this.generateAlerts(bookings, docks, now);

    return {
      summaryMetrics: {
        totalBookingsToday,
        pending: pending.length,
        activeQueue: activeBookings,
        completedToday,
        delayedBookings,
        avgProcessingMinutes,
        dockUtilizationPercent,
        lastUpdated: now.toISOString(),
      },
      dockStatuses,
      queueSnapshot,
      busyTimeData,
      alerts,
      filters: {
        searchQuery: '',
        selectedStatuses: [],
        selectedDocks: [],
        timeRange: {
          start: todayStart.toISOString(),
          end: todayEnd.toISOString(),
        },
        priorityFilter: 'ALL',
      },
      selectedDock: null,
      selectedBooking: null,
      quickActionPanel: {
        reassignModalOpen: false,
        noteModalOpen: false,
        autoEfficiencyEnabled: true,
      },
      connection: {
        isConnected: true,
        lastMessageTime: now.toISOString(),
        error: null,
      },
    };
  }

  private generateKPIData(bookings: any[], docks: any[], now: Date) {
    // Generate data untuk 5 jam terakhir
    const hours = [];
    for (let i = 4; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      hours.push(hour.getHours().toString().padStart(2, '0') + ':00');
    }

    // Hitung queue length per jam (dummy calculation - ganti dengan data real)
    const queueLengthTimeline = hours.map((time, index) => {
      // Dalam implementasi nyata, query database untuk booking per jam
      const hourBookings = bookings.filter((b) => {
        const bookingHour = new Date(b.createdAt).getHours();
        return bookingHour === parseInt(time.split(':')[0]);
      });
      return {
        time,
        value: hourBookings.length || Math.floor(Math.random() * 15) + 5,
      };
    });

    // Hitung dock throughput
    const dockThroughput = docks.slice(0, 6).map((dock) => {
      const dockCompleted = bookings.filter(
        (b) => b.dockId === dock.id && b.status === 'COMPLETED',
      ).length;

      return {
        dock: dock.name,
        completed: dockCompleted || Math.floor(Math.random() * 10) + 5,
      };
    });

    return {
      queueLengthTimeline,
      dockThroughput,
    };
  }

  private generateBusyTimeData(docks: any[], now: Date) {
    const busyDocks = docks.filter(
      (d) =>
        d.busyTimes.length > 0 ||
        d.bookings.some((b: any) =>
          ['IN_PROGRESS', 'ARRIVED'].includes(b.status),
        ),
    );

    if (busyDocks.length === 0) {
      return {
        currentBusyWindow: undefined,
        nextBusyWindow: undefined,
      };
    }

    // Cari current busy window berdasarkan busyTimes
    const currentBusyTimes = docks.flatMap((d) => d.busyTimes);

    let currentBusyWindow = undefined;
    if (currentBusyTimes.length > 0) {
      const busiest = currentBusyTimes[0]; // Ambil yang pertama
      currentBusyWindow = {
        from: busiest.from,
        to: busiest.to,
        affectedDocks: docks
          .filter((d) => d.busyTimes.length > 0)
          .map((d) => d.name)
          .slice(0, 3),
        intensity: 'HIGH' as const,
      };
    } else {
      // Jika tidak ada busyTimes, cari berdasarkan booking density
      const busyHour = new Date(now);
      busyHour.setHours(now.getHours() - 1);

      const hourDocks = docks.filter((d) =>
        d.bookings.some((b: any) => {
          const bookingTime = new Date(b.createdAt);
          return bookingTime > busyHour;
        }),
      );

      if (hourDocks.length > 0) {
        currentBusyWindow = {
          from: `${now.getHours() - 1}:00`,
          to: `${now.getHours()}:00`,
          affectedDocks: hourDocks.slice(0, 3).map((d) => d.name),
          intensity: hourDocks.length > 2 ? 'HIGH' : 'MEDIUM',
        };
      }
    }

    // Prediksi next busy window (dummy - bisa diimplementasi dengan machine learning)
    const nextBusyWindow = {
      from: `${now.getHours() + 2}:00`,
      to: `${now.getHours() + 4}:00`,
      predictedIntensity: Math.min(
        Math.floor((busyDocks.length / docks.length) * 100) + 20,
        100,
      ),
    };

    return {
      currentBusyWindow,
      nextBusyWindow,
    };
  }

  private generateAlerts(bookings: any[], docks: any[], now: Date) {
    const alerts = [];

    // 1. OVERDUE alerts
    const overdueBookings = bookings.filter((b) => {
      if (
        (b.status === 'IN_PROGRESS' || b.status === 'ARRIVED') &&
        b.estimatedFinishTime
      ) {
        return now.getTime() > b.estimatedFinishTime.getTime();
      }
      return false;
    });

    overdueBookings.forEach((booking, index) => {
      const overdueMinutes = Math.round(
        (now.getTime() - booking.estimatedFinishTime.getTime()) / (1000 * 60),
      );

      alerts.push({
        id: `alert-overdue-${booking.id}`,
        type: 'OVERDUE' as const,
        severity: overdueMinutes > 30 ? 'HIGH' : 'MEDIUM',
        bookingCode: booking.code,
        message: `Booking ${booking.code} exceeded estimated finish time by ${overdueMinutes} minutes`,
        timestamp: now.toISOString(),
        acknowledged: false,
        actionRequired: true,
      });
    });

    // 2. NO_SHOW alerts
    const noShowBookings = bookings.filter((b) => {
      if (b.status === 'WAITING' || b.status === 'ASSIGNED') {
        const scheduledArrival = new Date(b.arrivalTime);
        const gracePeriod = 30; // menit
        const noShowTime = scheduledArrival.getTime() + gracePeriod * 60 * 1000;
        return now.getTime() > noShowTime;
      }
      return false;
    });

    noShowBookings.forEach((booking, index) => {
      const lateMinutes = Math.round(
        (now.getTime() - booking.arrivalTime.getTime()) / (1000 * 60),
      );

      alerts.push({
        id: `alert-noshow-${booking.id}`,
        type: 'NO_SHOW' as const,
        severity: 'MEDIUM',
        bookingCode: booking.code,
        message: `Booking ${booking.code} driver has not arrived ${lateMinutes} minutes after scheduled time`,
        timestamp: now.toISOString(),
        acknowledged: false,
        actionRequired: true,
      });
    });

    // 3. DOCK_BLOCKED alerts
    const blockedDocks = docks.filter((d) => d.busyTimes.length > 0);

    blockedDocks.forEach((dock, index) => {
      alerts.push({
        id: `alert-blocked-${dock.id}`,
        type: 'DOCK_BLOCKED' as const,
        severity: 'MEDIUM',
        dockId: dock.id,
        message: `Dock ${dock.name} is blocked due to scheduled maintenance`,
        timestamp: now.toISOString(),
        acknowledged: index > 0,
        actionRequired: false,
      });
    });

    // 4. SLA_BREACH alerts (untuk booking yang sudah selesai tapi terlambat)
    const slaBreachBookings = bookings.filter((b) => {
      if (
        b.status === 'COMPLETED' &&
        b.actualFinishTime &&
        b.estimatedFinishTime
      ) {
        const breachMinutes =
          (b.actualFinishTime.getTime() - b.estimatedFinishTime.getTime()) /
          (1000 * 60);
        return breachMinutes > 60; // SLA breach > 60 minutes
      }
      return false;
    });

    slaBreachBookings.forEach((booking, index) => {
      const breachMinutes = Math.round(
        (booking.actualFinishTime.getTime() -
          booking.estimatedFinishTime.getTime()) /
          (1000 * 60),
      );

      alerts.push({
        id: `alert-sla-${booking.id}`,
        type: 'SLA_BREACH' as const,
        severity: 'HIGH',
        bookingCode: booking.code,
        message: `SLA breach: Booking ${booking.code} completion time exceeded by ${breachMinutes} minutes`,
        timestamp: now.toISOString(),
        acknowledged: false,
        actionRequired: true,
      });
    });

    return alerts;
  }
  // Helper untuk membuat Date dengan waktu lokal
  private createDateWithLocalTime = (
    baseDate: Date,
    localMinutes: number,
  ): Date => {
    // Convert local minutes back to UTC
    const localHours = Math.floor(localMinutes / 60);
    const localMins = localMinutes % 60;

    // Local to UTC: UTC = Local - 7
    let utcHours = localHours - 7;
    if (utcHours < 0) utcHours += 24;

    const date = new Date(baseDate);
    date.setUTCHours(utcHours, localMins, 0, 0);
    return date;
  };

  private checkOutOfRangeVacant(
    candidateStartMinutes: number,
    durationMinutes: number,
    scheduleEndMinutes: number,
  ) {
    let effectiveArrivalTime;
    const now = new Date();
    if (candidateStartMinutes + durationMinutes <= scheduleEndMinutes) {
      // MASIH MUAT - buat waktu dengan UTC yang benar
      effectiveArrivalTime = this.createDateWithLocalTime(
        now,
        candidateStartMinutes,
      );
      return effectiveArrivalTime;
    } else {
      throw new BadRequestException(
        `Tidak ada slot tersisa hari ini untuk booking ${durationMinutes} menit. ` +
          `Jam operasional berakhir ${this.formatMinutes(scheduleEndMinutes)}, ` +
          `slot terakhir harus mulai sebelum ${this.formatMinutes(scheduleEndMinutes - durationMinutes)}`,
      );
    }
  }
  // Helper functions untuk waktu lokal
  private getLocalHours = (date: Date): number => {
    // Convert UTC ke WIB (UTC+7)
    return (date.getUTCHours() + 7) % 24;
  };

  private getLocalMinutes = (date: Date): number => {
    return date.getUTCMinutes();
  };

  private toLocalMinutes = (date: Date): number => {
    return this.getLocalHours(date) * 60 + this.getLocalMinutes(date);
  };

  private formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  private loopingAvoidBusyTime = (
    candidateStartMinutes: number,
    durationMinutes: number,
    applicableBusyTimes: Array<{ from: string; to: string }>,
  ) => {
    // 1️⃣ Sort busy times
    const sortedBusyTimes = applicableBusyTimes
      .map((bt) => {
        const start = this.parseTimeToHours(bt.from);
        const end = this.parseTimeToHours(bt.to);
        if (start === null || end === null) return null;
        return {
          start: start * 60,
          end: end * 60,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a!.start - b!.start) as Array<{
      start: number;
      end: number;
    }>;

    let safe = false;

    while (!safe) {
      safe = true;
      const candidateEndMinutes = candidateStartMinutes + durationMinutes;

      for (const busy of sortedBusyTimes) {
        const overlaps =
          candidateStartMinutes < busy.end && candidateEndMinutes > busy.start;

        if (overlaps) {
          // 🚀 Lompat ke AKHIR busyTime
          candidateStartMinutes = busy.end;
          safe = false;
          break; // ⬅️ PENTING: ulang dari awal
        }
      }
    }

    return {
      candidateStartMinutes,
      candidateEndMinutes: candidateStartMinutes + durationMinutes,
    };
  };

  private parseTimeToHours(timeString: string): number | null {
    if (!timeString) return null;

    const match = timeString.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);

    return hours + minutes / 60;
  }

  private async getScheduleForDockDay(
    dockId: string,
    date: Date,
  ): Promise<{ startHour: number; endHour: number }> {
    const dayEnum = this.mapDayIndexToEnum(date.getDay() - 1);

    const vacant = await this.prismaService.vacant.findUnique({
      where: {
        dockId_day: {
          dockId,
          day: dayEnum,
        },
      },
    });

    if (vacant && vacant.availableFrom && vacant.availableUntil) {
      const startHour = this.parseTimeToHours(vacant.availableFrom);
      const endHour = this.parseTimeToHours(vacant.availableUntil);

      if (startHour !== null && endHour !== null) {
        return { startHour, endHour };
      }
    }

    // Fallback to default 06:00-18:00
    return { startHour: 6, endHour: 18 };
  }

  async getDetailMoveTrace(id: string) {
    return this.moveTraceService.findAll(id);
  }
}

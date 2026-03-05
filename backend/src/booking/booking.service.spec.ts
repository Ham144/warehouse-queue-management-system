import { Test, TestingModule } from '@nestjs/testing';
import { BookingWarehouseService } from './booking.service';
import { PrismaService } from 'src/common/prisma.service';
import { MoveTraceService } from 'src/move-trace/move-trace.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from 'src/common/shared-enum';

jest.mock('date-holidays', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        isHoliday: jest.fn().mockReturnValue(false),
      };
    }),
  };
});

describe('BookingWarehouseService', () => {
  let service: BookingWarehouseService;
  let prismaService: PrismaService;
  let moveTraceService: MoveTraceService;

  const mockPrismaService = {
    booking: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    dockBusyTime: {
      findMany: jest.fn(),
    },
    dock: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    warehouse: {
      findUnique: jest.fn(),
    },
  };

  const mockMoveTraceService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingWarehouseService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MoveTraceService, useValue: mockMoveTraceService },
      ],
    }).compile();

    service = module.get<BookingWarehouseService>(BookingWarehouseService);
    prismaService = module.get<PrismaService>(PrismaService);
    moveTraceService = module.get<MoveTraceService>(MoveTraceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('justifyBooking', () => {
    const id = 'b1';
    const updateDto: any = {
      arrivalTime: new Date('2026-03-10T10:00:00Z'),
      dockId: 'd2',
    };
    const userInfo: any = { username: 'user1' };

    it('should justify a booking successfully', async () => {
      const existingBooking = {
        id: 'b1',
        status: 'PENDING',
        arrivalTime: new Date('2026-03-10T09:00:00Z'),
        dockId: 'd1',
        Vehicle: { durasiBongkar: 60, vehicleType: 'VAN' },
        Dock: { name: 'Gate 1' },
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(existingBooking);
      mockPrismaService.dockBusyTime.findMany.mockResolvedValue([]);
      mockPrismaService.dock.findFirst.mockResolvedValue({ id: 'd2' });
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.update.mockResolvedValue({
        ...existingBooking,
        arrivalTime: updateDto.arrivalTime,
        dockId: updateDto.dockId,
        Dock: { name: 'Gate 2' },
      });

      const result = await service.justifyBooking(id, updateDto, userInfo);

      expect(result).toBeDefined();
      expect(mockPrismaService.booking.update).toHaveBeenCalled();
      expect(mockMoveTraceService.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue(null);

      await expect(service.justifyBooking(id, updateDto, userInfo)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if status is UNLOADING or FINISHED', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValue({
        status: BookingStatus.UNLOADING,
      });

      await expect(service.justifyBooking(id, updateDto, userInfo)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('dragAndDrop', () => {
    const id = 'b1';
    const userInfo: any = { username: 'user1' };

    it('should handle CANCELED status', async () => {
      const payload: any = {
        toStatus: 'CANCELED',
        relativePositionTarget: { bookingId: 'some' },
      };
      const booking = { id: 'b1', status: 'PENDING', arrivalTime: new Date(), warehouseId: 'w1', Dock: { name: 'Gate 1' } };
      mockPrismaService.booking.findUnique.mockResolvedValue(booking);

      const result = await service.dragAndDrop(id, payload, userInfo);

      expect(result).toEqual({ success: true, warehouseId: 'w1' });
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith({
        where: { id },
        data: { status: 'CANCELED' },
      });
    });

    it('should handle UNLOADING status', async () => {
      const payload: any = {
        toStatus: 'UNLOADING',
        dockId: 'd1',
        relativePositionTarget: { bookingId: 'some' },
      };
      const booking = {
        id: 'b1',
        status: 'IN_PROGRESS',
        arrivalTime: new Date(),
        warehouseId: 'w1',
        Dock: { name: 'Gate 1' },
        Vehicle: { vehicleType: 'VAN' },
      };
      mockPrismaService.booking.findUnique.mockResolvedValue(booking);
      mockPrismaService.dock.findUnique.mockResolvedValue({ id: 'd1', isActive: true, allowedTypes: ['VAN'], name: 'Gate 1' });
      mockPrismaService.booking.findFirst.mockResolvedValueOnce(null); // No one else unloading
      mockPrismaService.booking.findFirst.mockResolvedValueOnce({ ...booking, id: 'b1', actualArrivalTime: new Date() }); // updatingBooking

      const result = await service.dragAndDrop(id, payload, userInfo);

      expect(result).toEqual({ success: true, warehouseId: 'w1' });
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({ status: 'UNLOADING' }),
        }),
      );
    });
  });
});

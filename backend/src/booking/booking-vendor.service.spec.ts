import { Test, TestingModule } from '@nestjs/testing';
import { BookingforVendorService } from './booking-vendor.service';
import { PrismaService } from 'src/common/prisma.service';
import { MoveTraceService } from 'src/move-trace/move-trace.service';
import { BadRequestException } from '@nestjs/common';

describe('BookingforVendorService', () => {
  let service: BookingforVendorService;
  let prismaService: PrismaService;
  let moveTraceService: MoveTraceService;

  const mockPrismaService = {
    vehicle: {
      findFirst: jest.fn(),
    },
    dockBusyTime: {
      findMany: jest.fn(),
    },
    dock: {
      findFirst: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
  };

  const mockMoveTraceService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingforVendorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MoveTraceService, useValue: mockMoveTraceService },
      ],
    }).compile();

    service = module.get<BookingforVendorService>(BookingforVendorService);
    prismaService = module.get<PrismaService>(PrismaService);
    moveTraceService = module.get<MoveTraceService>(MoveTraceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createBookingDto: any = {
      vehicleId: 'v1',
      warehouseId: 'w1',
      dockId: 'd1',
      arrivalTime: new Date('2026-03-10T10:00:00Z'),
      estimatedFinishTime: new Date('2026-03-10T11:00:00Z'),
      driverUsername: 'driver1',
      notes: 'test notes',
    };

    const userInfo: any = {
      username: 'user1',
      organizationName: 'org1',
    };

    it('should create a booking successfully', async () => {
      mockPrismaService.vehicle.findFirst.mockResolvedValue({
        id: 'v1',
        vehicleType: 'VAN',
        durasiBongkar: 60,
        brand: 'TOYOTA',
      });
      mockPrismaService.dockBusyTime.findMany.mockResolvedValue([]);
      mockPrismaService.dock.findFirst.mockResolvedValue({ id: 'd1' });
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({
        isConfirmBookRequired: false,
      });
      mockPrismaService.booking.create.mockResolvedValue({ id: 'b1', warehouseId: 'w1' });

      const result = await service.create(createBookingDto, userInfo);

      expect(result).toEqual({
        success: true,
        warehouseId: 'w1',
        id: 'b1',
      });
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
      expect(mockMoveTraceService.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if vehicle type is not allowed at dock', async () => {
      mockPrismaService.vehicle.findFirst.mockResolvedValue({
        id: 'v1',
        vehicleType: 'VAN',
        durasiBongkar: 60,
        brand: 'TOYOTA',
      });
      mockPrismaService.dockBusyTime.findMany.mockResolvedValue([]);
      mockPrismaService.dock.findFirst.mockResolvedValue(null); // Not allowed

      await expect(service.create(createBookingDto, userInfo)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if there is a busy time overlap', async () => {
      mockPrismaService.vehicle.findFirst.mockResolvedValue({
        id: 'v1',
        vehicleType: 'VAN',
        durasiBongkar: 60,
        brand: 'TOYOTA',
      });
      mockPrismaService.dockBusyTime.findMany.mockResolvedValue([
        {
          from: '10:00',
          to: '11:00',
          recurring: 'NONE',
          reason: 'Maintenance',
        },
      ]);

      await expect(service.create(createBookingDto, userInfo)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelBook', () => {
    it('should cancel a booking successfully', async () => {
      const id = 'b1';
      const userInfo: any = { username: 'user1' };
      const body = { canceledReason: 'No longer needed' };
      const existingBooking = { id: 'b1', status: 'PENDING', arrivalTime: new Date() };

      mockPrismaService.booking.findFirst.mockResolvedValue(existingBooking);
      mockPrismaService.booking.update.mockResolvedValue({ warehouseId: 'w1' });

      const result = await service.cancelBook(id, userInfo, body);

      expect(result).toEqual({ success: true, warehouseId: 'w1' });
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          status: 'CANCELED',
          canceledReason: expect.stringContaining(body.canceledReason),
        },
      });
    });

    it('should throw BadRequestException if booking not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelBook('invalid', {} as any, { canceledReason: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

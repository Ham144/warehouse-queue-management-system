import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma.service';
import { CreateAppUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginResponseDto } from './dto/login.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateAppUserDto } from './dto/update-user.dto';
import { TokenPayload } from './dto/token-payload.dto';
import { Prisma } from '@prisma/client';
import { ROLE } from 'src/common/shared-enum';
import { UploadUserDto } from './dto/upload-user.dto';
import { Roles } from 'src/common/Role.decorator';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  async createAppUser(body: CreateAppUserDto, userInfo: TokenPayload) {
    const { password, homeWarehouseId, vendorName, ...rest } = body;
    if (!homeWarehouseId && !vendorName) {
      throw new BadRequestException(
        'homeWarehouseId atau vendorName salah satu diperlukan',
      );
    } else if (homeWarehouseId && vendorName) {
      throw new BadRequestException(
        'homeWarehouseId atau vendorName tidak boleh digunakan bersamaan',
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let homeWarehouse;
    if (!rest.role.includes('VENDOR')) {
      homeWarehouse = await this.prismaService.warehouse.findUnique({
        where: {
          id: body.homeWarehouseId,
        },
      });
    }

    await this.prismaService.user.create({
      data: {
        ...rest,
        passwordHash: passwordHash,
        accountType: 'APP',
        vendorName: vendorName || null,
        homeWarehouseId: homeWarehouse?.id || null,
        organizations: {
          connect: {
            name: userInfo.organizationName,
          },
        },
      },
    });
    return { message: 'berhasil membuat user app' };
  }

  //get myDriver
  async getMyDrivers(page: number, searchKey: string, userInfo: TokenPayload) {
    const where: Prisma.UserWhereInput = {
      vendorName: userInfo.vendorName,
      role: ROLE.DRIVER_VENDOR,
      isActive: true,
    };

    if (searchKey) {
      where.username = {
        contains: searchKey,
        mode: 'insensitive',
      };
    }

    const drivers = await this.prismaService.user.findMany({
      where,
      take: 10,
      skip: (page - 1) * 10,
      orderBy: {
        createdAt: 'desc', // optional tapi recommended
      },
    });

    return plainToInstance(LoginResponseDto, drivers, {
      excludeExtraneousValues: true,
    });
  }

  /** Escape karakter _, %, \ agar di Prisma/PostgreSQL ILIKE dianggap literal (bukan wildcard) */
  private escapeForContains(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
  }

  //untuk admin_organization
  async getAllAccountForMemberManagement(
    page: number,
    searchKey: string | string[] | undefined,
    userInfo: TokenPayload,
    vendorName?: string,
    role?: string,
  ) {
    const where: Prisma.UserWhereInput = {
      organizations: {
        some: {
          name: userInfo.organizationName,
        },
      },
    };

    if (vendorName && vendorName != 'all') {
      where.OR = [
        {
          vendorName: vendorName,
        },
        {
          warehouseAccess: {
            some: {
              name: vendorName,
            },
          },
        },
      ];
    }
    if (role && role != 'all') {
      where.role = role;
    }

    const key =
      typeof searchKey === 'string'
        ? searchKey
        : Array.isArray(searchKey)
          ? searchKey[0]
          : '';
    const trimmed = key?.trim();
    if (trimmed) {
      where.username = {
        contains: this.escapeForContains(trimmed),
        mode: 'insensitive',
      };
    }
    const accounts = await this.prismaService.user.findMany({
      where,
      include: {
        homeWarehouse: true,
        warehouseAccess: {
          select: { name: true },
        },
        organizations: {
          select: { name: true },
        },
      },
      skip: (page - 1) * 50,
      take: 50,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return accounts.map((account) =>
      plainToInstance(LoginResponseDto, account, {
        excludeExtraneousValues: true,
      }),
    );
  }

  async getVendorMemberOnly(
    page: number,
    searchKey: string,
    userInfo: TokenPayload,
  ) {
    const where: Prisma.UserWhereInput = searchKey
      ? {
          username: {
            contains: searchKey,
            mode: 'insensitive',
          },
        }
      : {};

    if (userInfo?.vendorName) {
      where.vendorName = userInfo.vendorName;
    } else {
      return new BadRequestException('Anda bukan vendor');
    }

    const accounts = await this.prismaService.user.findMany({
      where,
      include: {
        organizations: {
          select: { name: true },
        },
      },
      skip: (page - 1) * 10,
      take: 10,
    });

    return accounts.map((account) =>
      plainToInstance(LoginResponseDto, account, {
        excludeExtraneousValues: true,
        groups: ['detail'],
      }),
    );
  }

  async updateAccount(body: UpdateAppUserDto) {
    const { username, password, ...rest } = body;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      rest.passwordHash = passwordHash;
    }

    const updated = await this.prismaService.user.update({
      where: {
        username: username,
      },
      data: rest,
    });

    return plainToInstance(LoginResponseDto, updated, {
      excludeExtraneousValues: true,
    });
  }

  async deleteAppUser(username: string) {
    return await this.prismaService.$transaction(async (tx) => {
      // 1. RAW QUERY: Hapus/Kosongkan Booking yang nyangkut di user ini
      // Ini langsung tembak ke Database, bypass validasi skema Prisma yang ribet itu
      await tx.$executeRawUnsafe(
        `UPDATE "Booking" SET "driverUsername" = NULL, "createByUsername" = NULL 
         WHERE "driverUsername" = $1 OR "createByUsername" = $1`,
        username,
      );

      // 2. Bersihkan relasi many-to-many (ini biasanya lancar)
      await tx.user.update({
        where: { username: username },
        data: {
          organizations: { set: [] },
          warehouseAccess: { set: [] },
        },
      });

      // 3. Hapus User-nya
      return await tx.user.delete({
        where: { username: username },
      });
    });
  }

  async bulkUploadUser(uploadUserDto: UploadUserDto[], userInfo: TokenPayload) {
    try {
      const warehouses = await this.prismaService.warehouse.findMany({
        where: { organization: { name: userInfo.organizationName } },
        select: { id: true, name: true },
      });

      // Gunakan loop biasa atau pastikan throw error, bukan return error
      const results = await Promise.all(
        uploadUserDto.map(async (data) => {
          const {
            password,
            homeWarehouse: warehouseName,
            vendorName,
            ...rest
          } = data;

          const passwordHash = await bcrypt.hash(password, 10);
          const matchedWarehouse = warehouses.find(
            (w) => w.name.toLowerCase() === warehouseName?.toLowerCase(),
          );

          if (!matchedWarehouse && !vendorName) {
            // THROW, jangan RETURN. Agar masuk ke catch block
            throw new Error(
              `Home Warehouse ${warehouseName} tidak ditemukan untuk user ${rest.username}`,
            );
          }

          if (!Object.values(Roles).includes(rest.role) === false) {
            throw new Error(
              `Role ${rest.role} tidak ditemukan untuk user ${rest.username}`,
            );
          }

          const userData = {
            username: rest.username,
            displayName: rest.displayName,
            description: rest.description,
            role: rest.role,
            isActive: rest.isActive,
            passwordHash: passwordHash,
            accountType: 'APP',
            vendor: vendorName
              ? {
                  connectOrCreate: {
                    where: { name: vendorName },
                    create: {
                      name: vendorName,
                      organizationName: userInfo.organizationName,
                    },
                  },
                }
              : undefined,
            homeWarehouse: matchedWarehouse
              ? { connect: { id: matchedWarehouse.id } }
              : undefined,

            // 2. Warehouse Access (Many-to-Many Relation)
            // Karena ini array, jika tidak ada warehouse, kita kirim array kosong saja.
            warehouseAccess: matchedWarehouse
              ? { connect: [{ id: matchedWarehouse.id }] }
              : { connect: [] },
            organizations: {
              connect: { name: userInfo.organizationName },
            },
          };

          // UPSERT MANUAL
          return this.prismaService.user.upsert({
            where: { username: rest.username },
            update: userData,
            create: userData,
          });
        }),
      );

      return { message: `Berhasil mengupload ${results.length} user` };
    } catch (error) {
      console.error('Gagal Bulk Upload:', error.message);
      // Jika ada satu saja yang gagal, semua akan masuk ke sini
      throw new BadRequestException(error.message);
    }
  }
}

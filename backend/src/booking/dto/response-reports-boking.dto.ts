import { Expose, Type } from 'class-transformer';

class DockPerformanceDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  totalBooking: number;

  @Expose()
  onTimeDeliveryRate: number;

  @Expose()
  averageUnloadTime: number;

  @Expose()
  noShows: number;

  @Expose()
  canceled: number;
}

class TrendDto {
  @Expose()
  value: number;

  @Expose()
  direction: 'up' | 'down';
}

export class ResponseReportsBookingDto {
  @Expose()
  onTimeDeliveryRate: number;

  @Expose()
  averageUnloadTime: number;

  @Expose()
  noShows: number;

  @Expose()
  totalBooking: number;

  @Expose()
  @Type(() => DockPerformanceDto)
  dockPerformances: DockPerformanceDto[];

  @Expose()
  @Type(() => TrendDto)
  trends: {
    totalBooking: TrendDto;
    onTimeDeliveryRate: TrendDto;
    averageUnloadTime: TrendDto;
    noShows: TrendDto;
  };

  @Expose()
  kpi?: {
    username: string;
    vendor: string;
    tanggalAktifitasTerakhir: Date;
    jamAktifitasTerakhir: string;
    FINISHED: number;
    CANCELED: number;
    IN_PROGRESS: number;
    totalCreated: number;
    perubahanLapangan: number;
    qtyAll: number;
  };
}

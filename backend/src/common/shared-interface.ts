export interface BaseProps {
  page?: number;
  searchKey?: string;
}

export interface BookingFilter {
  searchKey?: string | null;
  warehouseId?: string | null; //untuk admin warehouse
  page?: number;
  vendorName?: string | null; //untuk admin vendor
  date?: string | null;
  status?: string;
  weekStart?: string; //jangan dihapus, emang begini
  weekEnd?: string; //jangan dihapus, emang begini
  isForBooking?: string; //ini untuk layering
  sortBy?: 'updatedAt' | 'bookingDate';
  sortOrder?: 'asc' | 'desc';
  dockId?: string;
  vehicleType?: string; // filter by Vehicle.vehicleType
  hasArrived?: string; // 'true' | 'false' - actualArrivalTime not null vs null
}

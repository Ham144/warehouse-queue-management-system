import axiosInstance from "@/lib/axios";
import {
  Booking,
  BookingFilter,
  UpdateBookingStatus,
} from "@/types/booking.type";
import { DragAndDropPayload } from "@/types/shared.type";
import { DashboardState } from "@/app/admin/dashboard/page";
import { VendorDashboardState } from "@/types/vendor-dashboard.type";

export const BookingApi = {
  createBooking: async (formData: Booking) => {
    const res = await axiosInstance.post("/api/booking", formData);
    return res.data;
  },
  getAllBookingsList: async (filter: BookingFilter): Promise<Booking[]> => {
    const params = new URLSearchParams();
    if (filter.page !== undefined) params.set("page", filter.page.toString());
    if (filter.searchKey !== undefined)
      params.set("searchKey", filter.searchKey);
    if (filter.status !== undefined) params.set("status", filter.status);
    if (filter.weekStart !== undefined)
      params.set("weekStart", filter.weekStart);
    if (filter.weekEnd !== undefined) params.set("weekEnd", filter.weekEnd);
    if (filter.date !== undefined) params.set("date", filter.date);
    if (filter.isForBooking)
      params.set("isForBooking", filter.isForBooking.toString());
    if (filter.sortBy) params.set("sortBy", filter.sortBy);
    if (filter.sortOrder) params.set("sortOrder", filter.sortOrder);
    if (filter.dockId) params.set("dockId", filter.dockId);

    const res = await axiosInstance.get("/api/booking/list", { params });
    return res.data;
  },
  semiDetailList: async (filter: BookingFilter) => {
    const params = new URLSearchParams();
    if (filter.date) params.set("date", filter.date);
    if (filter.isForBooking)
      params.set("isForBooking", filter.isForBooking.toString());

    const res = await axiosInstance.get("/api/booking/semi-detail-list", {
      params,
    });
    return res.data;
  },
  getDetailById: async (id: string): Promise<Booking> => {
    const res = await axiosInstance.get(`/api/booking/detail/${id}`);
    return res.data;
  },
  unload: async (id: string) => {
    const res = await axiosInstance.patch(`api/booking/unload/${id}`);
    return res.data;
  },
  finish: async (id: string) => {
    const res = await axiosInstance.patch(`/api/booking/finish/${id}`);
    return res.data;
  },
  getUpcomingBookings: async () => {
    const res = await axiosInstance.get("/api/booking/upcoming");
    return res.data;
  },
  cancelBooking: async (id: string, canceledReason: string) => {
    const res = await axiosInstance.delete(`/api/booking/cancel/${id}`, {
      data: { canceledReason },
    });
    return res.data;
  },
  justifyBooking: async (id: string, data: Partial<Booking>) => {
    const res = await axiosInstance.put(`/api/booking/justify/${id}`, data);
    return res.data;
  },
  dragAndDrop: async (id: string, data: DragAndDropPayload) => {
    const res = await axiosInstance.put(
      `/api/booking/drag-and-drop/${id}`,
      data,
    );
    return res.data;
  },
  updateBookingStatus: async (payload: UpdateBookingStatus) => {
    const res = await axiosInstance.patch(
      `/api/booking/updateStatus/${payload.id}`,
      payload,
    );
    return res.data;
  },

  getStatsForDriver: async () => {
    const res = await axiosInstance.get("/api/booking/stats/stats-for-driver");
    return res.data;
  },
  getStatsForAdminVendor: async (): Promise<VendorDashboardState> => {
    const res = await axiosInstance.get<VendorDashboardState>(
      "/api/booking/stats/stats-for-admin-vendor",
    );
    return res.data;
  },
  getStatsForUserOrganizations: async () => {
    const res = await axiosInstance.get(
      "/api/booking/stats/stats-for-user-organizations",
    );
    return res.data;
  },
  //ini untuk /admin/reports
  adminWarehouseReports: async (params?: {
    startDate?: string;
    endDate?: string;
    isKpiInclude: boolean;
  }) => {
    const res = await axiosInstance.get(
      "/api/booking/admin-warehouse-reports",
      {
        params,
      },
    );
    return res.data;
  },
  getMoveTraceList: async (id) => {
    if (!id) return;
    const res = await axiosInstance.get("/api/booking/get-move-trace/" + id);
    return res.data;
  },
  //ini untuk admin/dashboards
  adminWarehouseDashboard: async (): Promise<DashboardState> => {
    const res = await axiosInstance.get<DashboardState>(
      "/api/booking/admin-warehouse-dashboard",
    );
    return res.data;
  },
};

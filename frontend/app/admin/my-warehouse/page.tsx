"use client";
import React, { Suspense, useEffect, useState } from "react";
import { Calendar, Search, X, Pencil } from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { WarehouseApi } from "@/api/warehouse.api";
import { toast } from "sonner";
import { useUserInfo } from "@/components/UserContext";
import WarehouseModalForm from "@/components/admin/warehouseModalForm";
import { Warehouse } from "@/types/warehouse";
import { Booking, BookingFilter } from "@/types/booking.type";
import { BookingApi } from "@/api/booking.api";
import QueueDetailModal from "@/components/admin/QueueDetailModal";
import PaginationFullTable from "@/components/shared-common/PaginationFullTable";
import MyWarehouseActionModal from "@/components/admin/my-warehouse-action-modal";
import BookingRow from "@/components/shared-common/BookingRow";
import Loading from "@/components/shared-common/Loading";
import { IDock } from "@/types/dock.type";
import { VendorApi } from "@/api/vendor.api";
import { VehicleType } from "@/types/shared.type";

const MyWarehousePage = () => {
  const { userInfo, socket } = useUserInfo();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );

  const bookingFilterQueueInit: BookingFilter = {
    date: null,
    page: 1,
    searchKey: "",
    warehouseId: userInfo?.homeWarehouse?.id,
    status: "PENDING",
    sortBy: "updatedAt",
    isForBooking: true,
    sortOrder: "desc",
    dockId: "all",
  };

  const [filter, setFilter] = useState<BookingFilter>(bookingFilterQueueInit);

  const [formData, setFormData] = React.useState<Warehouse>({
    name: "",
    location: "",
    description: "",
    userWarehouseAccesses: [],
    isActive: true,
  });

  const { data: myWarehouse, isLoading } = useQuery({
    queryKey: ["my-warehouse", userInfo?.homeWarehouse],
    queryFn: WarehouseApi.getMyWarehouseDetail,
    enabled: !!userInfo?.homeWarehouse?.id,
  });

  const { data: bookings, isLoading: isLoadingBookings } = useQuery({
    queryKey: ["bookings", filter],
    queryFn: async () => {
      return await BookingApi.getAllBookingsList(filter);
    },
    enabled: !!userInfo,
    placeholderData: keepPreviousData,
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: VendorApi.getAllVendors,
  });

  const handleClose = () => {
    setIsModalOpen(false);
    if (myWarehouse) {
      setFormData({
        name: myWarehouse.name || "",
        location: myWarehouse.location || "",
        description: myWarehouse.description || "",
        userWarehouseAccesses: myWarehouse.userWarehouseAccesses || [],
        isActive: myWarehouse.isActive ?? true,
      });
    }
  };

  const handleOpenEdit = () => {
    if (myWarehouse) {
      setFormData({
        name: myWarehouse.name || "",
        location: myWarehouse.location || "",
        description: myWarehouse.description || "",
        userWarehouseAccesses: myWarehouse.userWarehouseAccesses || [],
        isActive: myWarehouse.isActive ?? true,
      });
      setIsModalOpen(true);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Warehouse) => {
      if (!filter.warehouseId) throw new Error("Warehouse ID tidak ditemukan");
      return await WarehouseApi.updateWarehouse({
        id: filter.warehouseId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-warehouse"] });
      toast.success("Warehouse berhasil diperbarui");
      handleClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Gagal memperbarui warehouse";
      toast.error(errorMessage);
    },
  });

  const createMutation = {
    isPending: false,
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateMutation.mutate(formData);
  };

  const statusOptions = [
    { value: "all", label: "Semua" },
    { value: "PENDING", label: "PENDING" },
    { value: "IN_PROGRESS", label: "IN_PROGRESS" },
    { value: "UNLOADING", label: "UNLOADING" },
    { value: "FINISHED", label: "FINISHED" },
    { value: "CANCELED", label: "CANCELED" },
  ];

  const sortOptions = [
    { value: "updatedAt-desc", label: "Terbaru Berubah" },
    { value: "updatedAt-asc", label: "Terlama Berubah" },
    { value: "arrivalTime-desc", label: "Tanggal Booking (Terbaru)" },
    { value: "arrivalTime-asc", label: "Tanggal Booking (Terlama)" },
  ];

  const arrivalStatusOptions = [
    { value: "all", label: "Semua Kedatangan" },
    { value: "true", label: "Sudah Sampai" },
    { value: "false", label: "Belum Sampai" },
  ];

  const clearAllFilters = () => {
    setFilter(bookingFilterQueueInit);
  };

  const handleStatusChange = (status: string) => {
    setFilter({
      ...filter,
      status: status as BookingFilter["status"],
      page: 1,
    });
  };

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split("-") as [
      BookingFilter["sortBy"],
      BookingFilter["sortOrder"],
    ];
    setFilter({ ...filter, sortBy, sortOrder });
  };

  const handleDateChange = (type: "weekStart" | "weekEnd", value: string) => {
    setFilter({
      ...filter,
      [type]: value,
      page: 1,
    });
  };

  const clearDateFilter = () => {
    setFilter({
      ...filter,
      weekStart: undefined,
      weekEnd: undefined,
      page: 1,
    });
  };

  const clearSearchFilter = () => {
    setFilter({
      ...filter,
      searchKey: null,
      page: 1,
    });
  };

  const hasActiveFilters =
    filter.searchKey ||
    (filter.status && filter.status !== "all") ||
    filter.weekStart ||
    filter.weekEnd ||
    filter.sortBy !== "updatedAt" ||
    filter.sortOrder !== "desc" ||
    (filter.dockId && filter.dockId !== "all") ||
    (filter.vehicleType && filter.vehicleType !== "all") ||
    (filter.vendorName && filter.vendorName !== "all") ||
    (filter.hasArrived && filter.hasArrived !== "all");

  //socket
  useEffect(() => {
    if (!socket || !userInfo?.homeWarehouse?.id) return;

    const warehouseId = userInfo.homeWarehouse.id;

    const handleConnect = () => {
      socket.emit("join_warehouse", {
        warehouseId,
      });
    };

    const handleFindAllRefetch = () => {
      queryClient.invalidateQueries({
        queryKey: ["bookings"],
      });
    };

    if (socket.connected) {
      socket.emit("join_warehouse", {
        warehouseId,
      });
    }

    socket.on("connect", handleConnect);
    socket.on("find-all", handleFindAllRefetch);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("find-all", handleFindAllRefetch);
      if (socket.connected) {
        socket.emit("leave_warehouse", {
          warehouseId,
        });
      }
    };
  }, [socket, queryClient, userInfo?.homeWarehouse?.id]);

  if (isLoading || (isLoadingBookings && !bookings)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="flex-1 w-full p-3 md:p-6">
        <div className="max-w-[1600px] mx-auto space-y-4">
          {/* FILTER section with Glassmorphism */}
          {/* Header + Tombol Aksi */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold bg-gradient-to-r from-gray-900 to-indigo-900 bg-clip-text text-transparent">
                  Warehouse Bookings
                </h2>
                <p className="text-[11px] text-gray-500">
                  Total:{" "}
                  <span className="font-bold text-blue-600">
                    {bookings?.length ?? 0}
                  </span>{" "}
                  entries
                </p>
              </div>
            </div>

            {myWarehouse && (
              <button
                onClick={handleOpenEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
              >
                <Pencil />
                Edit
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden ">
            {/* Baris 1: Status Tabs */}
            <div className="flex flex-wrap gap-1 p-2 border-b justify-between border-gray-100 bg-gray-50/30">
              <div className="flex flex-wrap">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`px-3 py-1 text-xs font-medium rounded-md ${
                      filter.status === option.value
                        ? "bg-white text-blue-600 shadow-sm border border-blue-100"
                        : "text-gray-500 hover:text-gray-900 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-x-2 items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-gray-600">Arrival:</span>
                  <input
                    type="date"
                    value={filter.weekStart || ""}
                    onChange={(e) =>
                      handleDateChange("weekStart", e.target.value)
                    }
                    className="px-2 py-1 text-xs border border-gray-200 rounded-lg"
                  />
                  <span className="text-xs text-gray-400">→</span>
                  <input
                    type="date"
                    value={filter.weekEnd || ""}
                    onChange={(e) =>
                      handleDateChange("weekEnd", e.target.value)
                    }
                    className="px-2 py-1 text-xs border border-gray-200 rounded-lg"
                  />
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs text-red-500 flex items-center gap-1"
                  >
                    <X size={12} /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Baris 2: Search + Sort (sendiri, tidak berbagi dengan gate) */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-gray-100 bg-white">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari code/driver..."
                  value={filter.searchKey || ""}
                  onChange={(e) =>
                    setFilter((prev) => ({
                      ...prev,
                      searchKey: e.target.value,
                    }))
                  }
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {filter.searchKey && (
                  <button
                    onClick={() =>
                      setFilter((prev) => ({ ...prev, searchKey: "" }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X size={12} className="text-gray-400" />
                  </button>
                )}
              </div>

              <select
                value={`${filter.sortBy || "createdAt"}-${filter.sortOrder || "desc"}`}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Baris Baru: Advanced Filters (Vehicle Type, Vendor, Arrival Status) */}
            <div className="flex flex-wrap items-center gap-3 p-2 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Vehicle:
                </span>
                <select
                  value={filter.vehicleType || "all"}
                  onChange={(e) =>
                    setFilter((prev) => ({
                      ...prev,
                      vehicleType: e.target.value,
                      page: 1,
                    }))
                  }
                  className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white min-w-[120px]"
                >
                  <option value="all">Semua Tipe</option>
                  {Object.values(VehicleType).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Vendor:
                </span>
                <select
                  value={filter.vendorName || "all"}
                  onChange={(e) =>
                    setFilter((prev) => ({
                      ...prev,
                      vendorName: e.target.value,
                      page: 1,
                    }))
                  }
                  className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white min-w-[120px]"
                >
                  <option value="all">Semua Vendor</option>
                  {vendors?.map((vendor: any) => (
                    <option key={vendor.name} value={vendor.name}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Arrived:
                </span>
                <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
                  {arrivalStatusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setFilter((prev) => ({
                          ...prev,
                          hasArrived: opt.value as any,
                          page: 1,
                        }))
                      }
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                        (filter.hasArrived || "all") === opt.value
                          ? "bg-blue-500 text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Baris 3: GATE/DOCK - FULL WIDTH, SENDIRI, TIDAK ADA YANG DISAMPINGNYA */}
            <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 bg-white">
              <button
                onClick={() => setFilter({ ...filter, dockId: "all" })}
                className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                  filter.dockId === "all"
                    ? "bg-purple-50 text-purple-600 border border-purple-100"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Semua Gate
              </button>
              {myWarehouse?.docks.map((dock: Partial<IDock>) => (
                <button
                  key={dock.id}
                  onClick={() => setFilter({ ...filter, dockId: dock.id })}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                    filter.dockId === dock.id
                      ? "bg-purple-50 text-purple-600 border border-purple-100"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {dock.name}
                </button>
              ))}
            </div>

            {/* Baris 4: Filter Tanggal */}
            <div className="flex flex-wrap items-center gap-4 p-2 bg-white">
              {/* additional filters */}
            </div>
          </div>
          {/* TABLE Section with Modern Design */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {bookings?.length > 0 ? (
              <div>
                {/* Header Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Booking Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Vendor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Vehicle & Driver
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Schedule
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Dock
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>

                {/* Body Table (Scrollable) */}
                <div className="overflow-x-auto max-h-[calc(100vh-480px)] min-h-[300px] overflow-y-auto">
                  <table className="min-w-full">
                    <tbody className="bg-white divide-y divide-gray-100">
                      {bookings?.map((booking: Booking) => (
                        <BookingRow
                          key={booking.id}
                          booking={booking}
                          setSelectedBookingId={setSelectedBookingId}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-gray-600 font-semibold text-lg">
                  No bookings available
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Start by creating a new booking
                </p>
              </div>
            )}
          </div>

          <PaginationFullTable
            data={bookings}
            filter={filter}
            isLoading={isLoadingBookings}
            setFilter={setFilter}
            key={"my-warehouse-pagination"}
          />
        </div>
      </main>

      <WarehouseModalForm
        createMutation={createMutation}
        editingId={filter.warehouseId || null}
        formData={formData}
        handleClose={handleClose}
        handleSubmit={handleSubmit}
        isModalOpen={isModalOpen}
        setFormData={setFormData}
        updateMutation={updateMutation}
        key={"my-warehouse-modal"}
      />

      <Suspense fallback={<Loading />}>
        <MyWarehouseActionModal
          selectedBooking={
            bookings && selectedBookingId
              ? (bookings as Booking[]).find((b) => b.id === selectedBookingId)
              : undefined
          }
          onModifyAndConfirm={() => {
            if (!selectedBookingId) return;
            (
              document.getElementById("create") as HTMLDialogElement
            )?.showModal();
          }}
        />
      </Suspense>

      <QueueDetailModal
        selectedBookingId={selectedBookingId || ""}
        setSelectedBookingId={setSelectedBookingId}
        key={"QueueDetailModalCreate"}
        mode="create"
      />
    </div>
  );
};

export default MyWarehousePage;

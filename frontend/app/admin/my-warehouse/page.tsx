"use client";
import React, { Suspense, useEffect, useState } from "react";
import { Filter, Calendar, Search, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { IDock } from "@/types/dock.type";
import BookingRow from "@/components/shared-common/BookingRow";
import Loading from "@/components/shared-common/Loading";

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

  const [showFilters, setShowFilters] = useState(false);

  const statusDisplayMap: Record<string, string> = {
    all: "Semua",
    PENDING: "PENDING",
    CANCELED: "CANCELED",
    FINISHED: "FINISHED",
    IN_PROGRESS: "IN_PROGRESS",
    UNLOADING: "UNLOADING",
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
    filter.sortOrder !== "desc";

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

  if (isLoading || isLoadingBookings) {
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
          <div className="backdrop-blur-xl bg-white/80 rounded-2xl shadow-lg border border-white/40 p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-indigo-900 bg-clip-text text-transparent">
                    Warehouse Bookings
                  </h2>
                  <p className="text-xs text-gray-500">
                    Total:{" "}
                    <span className="font-bold text-blue-600">
                      {bookings?.length ?? 0}
                    </span>{" "}
                    entries found
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`group relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                    showFilters
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                      : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm hover:shadow-md border border-gray-200"
                  }`}
                >
                  <Filter
                    size={16}
                    className="transition-transform group-hover:scale-110"
                  />
                  {showFilters ? "Sembunyikan Filter" : "Tampilkan Filter"}
                </button>

                {myWarehouse && (
                  <button
                    onClick={handleOpenEdit}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    <svg
                      className="w-4 h-4 transition-transform group-hover:rotate-12"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Warehouse
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Status Tabs with Modern Design */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex flex-wrap gap-1 p-1.5 bg-gray-50/50">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`px-4 py-1.5 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 ${
                    filter.status === option.value
                      ? "bg-white text-blue-600 shadow-sm border border-blue-100 ring-1 ring-blue-500/10"
                      : "text-gray-500 hover:text-gray-900 hover:bg-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Dock Tabs */}
            <div className="flex flex-wrap gap-1 p-1.5 border-t border-gray-100 bg-white">
              <button
                onClick={(e) =>
                  setFilter({
                    ...filter,
                    dockId: "all",
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  filter.dockId === "all"
                    ? "bg-purple-50 text-purple-600 border border-purple-100 ring-1 ring-purple-500/10"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Semua Gate
              </button>
              {myWarehouse?.docks.map((dock: Partial<IDock>) => (
                <button
                  key={dock.id}
                  onClick={(e) =>
                    setFilter({
                      ...filter,
                      dockId: dock.id,
                    })
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                    filter.dockId === dock.id
                      ? "bg-purple-50 text-purple-600 border border-purple-100 ring-1 ring-purple-500/10"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {dock.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Quick Actions Row */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-blue-500" />
              <input
                type="text"
                placeholder="Cari berdasarkan code atau Driver Username..."
                value={filter.searchKey || ""}
                onChange={(e) => {
                  setFilter((prev) => ({
                    ...prev,
                    searchKey: e.target.value,
                  }));
                }}
                className="w-full pl-12 pr-12 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white shadow-sm hover:shadow-md"
                autoFocus
              />
              {filter.searchKey && (
                <button
                  onClick={() =>
                    setFilter((prev) => ({
                      ...prev,
                      searchKey: "",
                    }))
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <select
                value={`${filter.sortBy || "createdAt"}-${
                  filter.sortOrder || "desc"
                }`}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced Filters with Modern Cards */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-md animate-fadeIn">
              {/* Date Range */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Rentang Tanggal (Arrival Time)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <input
                      type="date"
                      value={filter.weekStart || ""}
                      onChange={(e) =>
                        handleDateChange("weekStart", e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <span className="text-xs text-gray-500">Mulai</span>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="date"
                      value={filter.weekEnd || ""}
                      onChange={(e) =>
                        handleDateChange("weekEnd", e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <span className="text-xs text-gray-500">Sampai</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700">
                  Status Saat Ini
                </label>
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Filter aktif:</span>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        hasActiveFilters
                          ? "bg-green-500 text-white shadow-sm"
                          : "bg-gray-300 text-gray-700"
                      }`}
                    >
                      {hasActiveFilters ? "Aktif" : "Tidak aktif"}
                    </span>
                  </div>
                  {filter.status && filter.status !== "all" && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        Status terpilih:
                      </span>
                      <span className="px-3 py-1 text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-sm">
                        {statusDisplayMap[filter.status]}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Filters */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700">
                  Filter Terpakai
                </label>
                <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-white rounded-xl border border-gray-200">
                  {filter.status && filter.status !== "all" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 rounded-full border border-blue-200">
                      {statusDisplayMap[filter.status]}
                      <button
                        onClick={() => handleStatusChange("all")}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {filter.searchKey && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-green-100 to-emerald-50 text-green-700 rounded-full border border-green-200">
                      {filter.searchKey}
                      <button
                        onClick={clearSearchFilter}
                        className="text-green-600 hover:text-green-800 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {filter.weekStart && filter.weekEnd && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-50 text-purple-700 rounded-full border border-purple-200">
                      {filter.weekStart} → {filter.weekEnd}
                      <button
                        onClick={clearDateFilter}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {!hasActiveFilters && (
                    <span className="text-sm text-gray-400 italic self-center">
                      Tidak ada filter yang aktif
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

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

"use client";

import { BookingApi } from "@/api/booking.api";
import { DockApi } from "@/api/dock.api";
import { useUserInfo } from "@/components/UserContext";
import { BookingFilter, Booking } from "@/types/booking.type";
import { BookingStatus } from "@/types/shared.type";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import QueueDetailModal from "@/components/admin/QueueDetailModal";
import ConfirmationWithInput from "@/components/shared-common/ConfirmationWithInput";
import DockOptionModal from "@/components/admin/DockOptionModal";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  closestCorners,
} from "@dnd-kit/core";
import DraggableBookingCard from "@/components/admin/DraggableBookingCard";
import isDelayed from "@/lib/IsDelayed";
import { SortableContainer } from "@/components/admin/SortableContainer";
import { DropZoneLine } from "@/components/admin/DropConeLine";
import FullDroppableInventory from "@/components/admin/FullDroppableInventory";
import { IDock } from "@/types/dock.type";
import WarehouseSettingPreview from "@/components/admin/WarehouseSettingPreview";

export default function LiveQueuePage() {
  const { userInfo, socket } = useUserInfo();
  const queryClient = useQueryClient();
  const [selectedDockId, setSelectedDockId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(() => new Date());

  const [dockPageStart, setDockPageStart] = useState<number>();
  const [isDekstop, setIsDesktop] = useState<boolean>();

  // Kategori
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  // UI/UX interaction
  const [isDragOverCanceled, setIsDragOverCanceled] = useState(false);
  const [isDragOverDelayed, setIsDragOverDelayed] = useState(false);
  const [onFloatingBooking, setOnFloatingBooking] = useState<Booking>();
  const [height, setHeight] = useState(120); // height inventory

  // Sensor untuk drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  // Handle drag events
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const booking = active.data.current?.booking;

    setActiveBooking(booking);
  };

  function getRelativePosition(
    sourceIndex: number,
    targetIndex: number,
  ): "BEFORE" | "AFTER" {
    if (sourceIndex === targetIndex) return "AFTER";
    return sourceIndex < targetIndex ? "AFTER" : "BEFORE";
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveBooking(null);

    if (!over) return;

    const sourceBooking: Booking = active.data.current?.booking;
    const targetData = over.data.current;

    if (!sourceBooking) return;
    if (!targetData) return;

    const targetBookingId =
      (targetData as any)?.bookingId ??
      (targetData as any)?.booking?.id ??
      (typeof over.id === "string" && String(over.id).startsWith("booking-")
        ? String(over.id).slice(7)
        : over.id);
    const targetDockId =
      (targetData as any)?.dockId ??
      (targetData as any)?.booking?.dockId ??
      (targetData as any)?.sourceDockId;
    const targetType = (targetData as any)?.type;
    const targetBookingStatus =
      (targetData as any)?.bookingStatus ??
      (targetData as any)?.booking?.status;

    const sameDock = sourceBooking.dockId === targetDockId;
    const dock: IDock | undefined = docks.find(
      (d: IDock) => d.id === targetDockId,
    );
    if (targetDockId && dock && !dock.isActive) {
      return toast.error("Dock sedang tidak aktif");
    }
    if (
      targetDockId &&
      dock?.allowedTypes &&
      !dock.allowedTypes.includes(sourceBooking.Vehicle?.vehicleType)
    ) {
      return toast.error(
        `Gate ${dock.name} Tidak menerima tipe kendaraan ${sourceBooking.Vehicle?.vehicleType}`,
      );
    }
    /* =====================================================
     * 1. REORDER: SWAP IN_PROGRESS (antar booking di dock yang sama)
     * ===================================================== */
    const dockGroupForSwap = sourceBooking.dockId
      ? filteredBookings[sourceBooking.dockId]
      : null;
    const canSwap =
      targetType === "booking-card" &&
      sourceBooking.status === BookingStatus.IN_PROGRESS &&
      targetBookingStatus === BookingStatus.IN_PROGRESS &&
      sameDock &&
      dockGroupForSwap != null &&
      dockGroupForSwap.inprogress.length > 1;
    if (canSwap) {
      const dockGroup = dockGroupForSwap;

      const sourceIndex = dockGroup.inprogress.findIndex(
        (b) => b.id === sourceBooking.id,
      );
      const targetIndex = dockGroup.inprogress.findIndex(
        (b) => b.id === targetBookingId,
      );

      if (
        sourceIndex === -1 ||
        targetIndex === -1 ||
        sourceIndex === targetIndex
      ) {
        return;
      }

      try {
        await BookingApi.dragAndDrop(sourceBooking.id!, {
          action: "MOVE_WITHIN_DOCK",
          toStatus: "IN_PROGRESS",
          dockId: sourceBooking.dockId,
          relativePositionTarget: {
            bookingId: String(targetBookingId),
            type: "SWAP",
          },
        });
        queryClient.invalidateQueries({ queryKey: ["bookings"] });
        return;
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Gagal memperbarui booking",
        );
      }
    }

    /* =====================================================
     * 2. KE UNLOADING (IN_PROGRESS | DELAYED | CANCELED)
     * ===================================================== */
    if (targetBookingStatus === BookingStatus.UNLOADING) {
      const existingUnloading =
        targetDockId && filteredBookings[targetDockId]
          ? filteredBookings[targetDockId].unloading
          : [];

      if (existingUnloading.length > 0) {
        return toast.error(
          "Unloading di Gate" + (dock?.name ?? "") + " sedang dilakukan",
        );
      }
      try {
        await BookingApi.dragAndDrop(sourceBooking.id!, {
          action: sameDock ? "MOVE_WITHIN_DOCK" : "MOVE_OUTSIDE_DOCK",
          toStatus: "UNLOADING",
          dockId: targetDockId || sourceBooking.dockId,
          relativePositionTarget: targetBookingId
            ? { bookingId: String(targetBookingId), type: "AFTER" }
            : { bookingId: "LAST", type: "AFTER" },
        });
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Gagal memperbarui booking",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      return;
    }

    /* =====================================================
     * 3. KE CANCELED (inventory) - support both old and new drop area ID
     * ===================================================== */
    if (
      targetType === "inventory" &&
      targetBookingStatus === BookingStatus.CANCELED &&
      sourceBooking.status !== BookingStatus.CANCELED
    ) {
      setSelectedBookingId(sourceBooking.id!);
      setCanceledReason(
        `Dipindahkan via drag & drop - ${new Date().toLocaleString("id-ID")}`,
      );

      (
        document.getElementById("cancel-confirmation") as HTMLDialogElement
      )?.showModal();
      return;
    }

    // Handle canceled wrapper drop area
    if (
      over?.id === "inventory-CANCELED-wrapper" &&
      sourceBooking.status !== BookingStatus.CANCELED
    ) {
      setSelectedBookingId(sourceBooking.id!);
      setCanceledReason(
        `Dipindahkan via drag & drop - ${new Date().toLocaleString("id-ID")}`,
      );

      (
        document.getElementById("cancel-confirmation") as HTMLDialogElement
      )?.showModal();
      return;
    }

    /* =====================================================
     * 4. KE IN_PROGRESS (DELAYED | CANCELED | UNLOADING)
     * ===================================================== */
    if (targetBookingStatus === BookingStatus.IN_PROGRESS) {
      try {
        await BookingApi.dragAndDrop(sourceBooking.id!, {
          action: sameDock ? "MOVE_WITHIN_DOCK" : "MOVE_OUTSIDE_DOCK",
          toStatus: "IN_PROGRESS",
          dockId: targetDockId || sourceBooking.dockId,
          relativePositionTarget: targetBookingId
            ? { bookingId: String(targetBookingId), type: "AFTER" }
            : { bookingId: "LAST", type: "AFTER" },
        });
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Gagal memperbarui booking",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      return;
    }

    /* =====================================================
     * 5. PINDAH DOCK (IN_PROGRESS → dock lain)
     * ===================================================== */
    if (
      targetType === "dock-section" &&
      sourceBooking.status === BookingStatus.IN_PROGRESS &&
      sourceBooking.dockId !== targetDockId
    ) {
      try {
        await BookingApi.dragAndDrop(sourceBooking.id!, {
          action: "MOVE_OUTSIDE_DOCK",
          toStatus: "IN_PROGRESS",
          dockId: targetDockId!,
          relativePositionTarget: {
            bookingId: "LAST",
            type: "AFTER",
          },
        });
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || "Gagal memperbarui booking",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      return;
    }
  };

  // Di handleDragOver atau custom hook
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (over?.data.current?.bookingStatus === BookingStatus.CANCELED) {
      setIsDragOverCanceled(true);
      setIsDragOverDelayed(false);
    } else if (over?.data.current?.bookingStatus === BookingStatus.DELAYED) {
      setIsDragOverDelayed(true);
      setIsDragOverCanceled(false);
    } else {
      setIsDragOverCanceled(false);
      setIsDragOverDelayed(false);
    }
  };

  const handleDragCancel = () => {
    setOnFloatingBooking(null);
  };

  const [canceledReason, setCanceledReason] = useState<string>("");
  const qq = useQueryClient();

  const bookingFilterQueueInit: BookingFilter = {
    warehouseId: userInfo?.homeWarehouse?.id,
    date: new Date().toISOString().split("T")[0],
  };

  const filter = bookingFilterQueueInit;

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", filter],
    queryFn: async () => await BookingApi.semiDetailList(filter),
    enabled: !!userInfo,
  });

  // Get all docks for warehouse
  const {
    data: docks = [],
    isLoading: loadingDocks,
    refetch: refecthDock,
  } = useQuery({
    queryKey: ["docks", userInfo?.homeWarehouse?.id],
    queryFn: async () =>
      await DockApi.getDocksByWarehouseId(userInfo?.homeWarehouse?.id!),
    enabled: !!userInfo?.homeWarehouse?.id,
  });

  // Update status mutation
  const { mutateAsync: handleUpdateStatus } = useMutation({
    mutationFn: async ({
      id,
      status,
      actualFinishTime,
    }: {
      id: string;
      status: BookingStatus;
      actualFinishTime?: Date;
    }) => {
      return await BookingApi.updateBookingStatus({
        id,
        status,
        actualFinishTime,
      });
    },
    onSuccess: () => {
      toast.success("Status booking berhasil diupdate");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setSelectedBookingId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Gagal mengupdate status");
    },
  });

  // Cancel booking mutation
  const { mutateAsync: handleCancel } = useMutation({
    mutationKey: ["bookings"],
    mutationFn: async () => {
      if (!selectedBookingId || !canceledReason) {
        toast.error("Mohon isi alasan pembatalan");
        throw new Error("Mohon isi alasan pembatalan");
      }
      await BookingApi.cancelBooking(selectedBookingId, canceledReason);
    },
    onSuccess: async () => {
      qq.invalidateQueries({
        queryKey: ["bookings"],
      });
      setCanceledReason("");
      setSelectedBookingId(null);
      (
        document.getElementById("cancel-confirmation") as HTMLDialogElement
      )?.close();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message);
    },
  });

  /* groups booking by dock dan kelompokkan booking menjadi  : 
  IN_PROGRESS,
  UNLOADING,
  FINISHED,
  CANCELED
  "DELAYED",
  - 
  */
  type DockBookingGroup = {
    unloading: Booking[];
    inprogress: Booking[];
    finished: Booking[];
    canceled: Booking[];
    delayed: Booking[];
  };

  type GroupedBookingsByDock = Record<string, DockBookingGroup>;

  const filteredBookings = useMemo<GroupedBookingsByDock>(() => {
    const delayTolerance = userInfo?.homeWarehouse?.delayTolerance || 0;

    const result: GroupedBookingsByDock = {};

    docks.forEach((dock) => {
      result[dock.id] = {
        unloading: [],
        inprogress: [],
        finished: [],
        canceled: [],
        delayed: [],
      };
    });

    bookings?.forEach((booking: Booking) => {
      if (!booking.dockId) return;

      const dockGroup = result[booking.dockId];
      if (!dockGroup) return;

      if (isDelayed(booking, now, delayTolerance)) {
        dockGroup.delayed.push({
          ...booking,
          status: BookingStatus.DELAYED,
        });
        return;
      }

      switch (booking.status) {
        case BookingStatus.UNLOADING:
          dockGroup.unloading.push(booking);
          break;

        case BookingStatus.IN_PROGRESS:
          dockGroup.inprogress.push(booking);
          break;

        case BookingStatus.FINISHED:
          dockGroup.finished.push(booking);
          break;

        case BookingStatus.CANCELED:
          dockGroup.canceled.push(booking);
          break;
      }
    });

    return result as GroupedBookingsByDock;
  }, [bookings, docks, filter, now]);

  const { delayedBookings, canceledBookings } = useMemo(() => {
    const delayed: Booking[] = [];
    const canceled: Booking[] = [];

    Object.values(filteredBookings).forEach((group) => {
      delayed.push(...group.delayed);
      canceled.push(...group.canceled);
    });

    return {
      delayedBookings: delayed,
      canceledBookings: canceled,
    };
  }, [filteredBookings]);

  // Open justify modal
  const onDetail = (booking: Booking) => {
    setSelectedBookingId(booking.id!);
    (document.getElementById("justify") as HTMLDialogElement)?.showModal();
  };

  // Mutation untuk konfirmasi datang
  const { mutateAsync: confirmArrival } = useMutation({
    mutationFn: async (booking: Booking) =>
      await BookingApi.updateBookingStatus({
        id: booking.id,
        status: BookingStatus.IN_PROGRESS,
        actualArrivalTime: booking?.actualArrivalTime ? null : new Date(),
        actualFinishTime: null,
      }),
    onSuccess: () => {
      qq.invalidateQueries({
        queryKey: ["bookings", filter],
      });
    },
  });

  //socket
  useEffect(() => {
    if (!socket || !userInfo?.homeWarehouse?.id) return;

    const warehouseId = userInfo.homeWarehouse.id;

    const handleConnect = () => {
      socket.emit("join_warehouse", {
        warehouseId,
      });
    };

    const handleSemiDetailList = () => {
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
    socket.on("semi-detail-list", handleSemiDetailList);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("semi-detail-list", handleSemiDetailList);
      if (socket.connected) {
        socket.emit("leave_warehouse", {
          warehouseId,
        });
      }
    };
  }, [socket, queryClient, userInfo?.homeWarehouse?.id]);

  //triger kategorisasi ulang filteredBookings
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000); // tiap 30 detik (atau 1 menit)

    return () => clearInterval(timer);
  }, []);

  //width check
  useEffect(() => {
    //dock page
    const parsed = Number(localStorage.getItem("dockPageStart"));
    const value = Number.isNaN(parsed) ? 0 : parsed;
    localStorage.setItem("dockPageStart", String(value));

    //isDekstop
    const media = window.matchMedia("(min-width: 768px)");
    setIsDesktop(media.matches);

    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    media.addEventListener("change", handler);

    setDockPageStart(value);
    return () => media.removeEventListener("change", handler);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30">
      <div className="flex flex-col">
        <WarehouseSettingPreview />
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="space-y-6">
            {/* Queue Grid by Dock */}
            {isLoading || loadingDocks ? (
              <div className="flex justify-center items-center py-32">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-12 h-12 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <p className="text-gray-500 text-sm">Memuat data dock...</p>
                </div>
              </div>
            ) : docks.length === 0 ? (
              <div className="card bg-white/80 backdrop-blur-sm shadow-xl border border-gray-100">
                <div className="card-body text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">
                    Tidak ada dock tersedia
                  </p>
                  <p className="text-gray-400 text-sm">
                    Silahkan tambah dock terlebih dahulu
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Navigation Buttons - Modern Style */}
                <div className="flex justify-center gap-3 mb-6">
                  <button
                    disabled={dockPageStart === 0}
                    onClick={() => {
                      setDockPageStart((prev) => {
                        const value = prev - 1;
                        window.localStorage.setItem(
                          "dockPageStart",
                          value.toString(),
                        );
                        return value;
                      });
                    }}
                    className="group px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:border-primary hover:text-primary hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                  >
                    <ArrowLeft
                      size={18}
                      className="group-hover:-translate-x-0.5 transition-transform"
                    />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <span className="px-4 py-2 text-sm text-gray-500">
                    Page {dockPageStart + 1} of{" "}
                    {Math.ceil(docks.length / (isDekstop ? 4 : 2))}
                  </span>

                  <button
                    disabled={
                      isLoading ||
                      dockPageStart + (isDekstop ? 4 : 2) >= docks.length
                    }
                    className="group px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:border-primary hover:text-primary hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                    onClick={() =>
                      setDockPageStart((prev) => {
                        const value = prev + 1;
                        window.localStorage.setItem(
                          "dockPageStart",
                          value.toString(),
                        );
                        return value;
                      })
                    }
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ArrowRight
                      size={18}
                      className="group-hover:translate-x-0.5 transition-transform"
                    />
                  </button>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragCancel={handleDragCancel}
                >
                  {/* MAIN GRID */}
                  <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(filteredBookings)
                      .splice(dockPageStart, isDekstop ? 4 : 2)
                      .map(([dockId, bookingGroup]) => {
                        const dock: IDock = docks.find((d) => d.id === dockId);
                        if (!dock) return null;

                        const unloadingBookings = bookingGroup.unloading;
                        const inProgressBookings = bookingGroup.inprogress;

                        return (
                          <div
                            key={dockId}
                            className="flex flex-col gap-y-4 bg-white/40 backdrop-blur-sm rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300"
                          >
                            {/* Dock Header - Modern & Elegant */}
                            <div
                              className={`relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 
                                ${
                                  dock?.isActive
                                    ? "bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25"
                                    : "bg-gradient-to-r from-gray-500 to-gray-400"
                                } text-white hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group`}
                              onClick={() => {
                                setSelectedDockId(dock.id!);
                                (
                                  document.getElementById(
                                    "dock-option-modal",
                                  ) as HTMLDialogElement
                                )?.showModal();
                              }}
                            >
                              {/* Animated gradient overlay */}
                              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                              <div className="relative p-4">
                                <div className="flex items-center justify-between">
                                  {/* Left: Dock Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-bold text-lg truncate">
                                        {dock.name}
                                      </h3>
                                      <div
                                        className={`w-2 h-2 rounded-full ${
                                          dock.isActive
                                            ? "bg-emerald-400 animate-pulse"
                                            : "bg-gray-300"
                                        }`}
                                      />
                                    </div>
                                    <p className="text-xs text-white/70">
                                      {dock.isActive ? "Active" : "Inactive"}
                                    </p>
                                  </div>

                                  {/* Right: Stats */}
                                  <div className="flex items-center gap-3">
                                    <div className="text-center">
                                      <div className="flex items-center gap-1">
                                        <Users
                                          size={14}
                                          className="text-white/70"
                                        />
                                        <span className="font-bold text-lg">
                                          {inProgressBookings.length}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-white/70 uppercase">
                                        Queue
                                      </span>
                                    </div>

                                    <div className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                                      <Pencil size={14} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* UNLOADING SECTION */}
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-4 bg-warning rounded-full"></div>
                                <span className="text-xs font-semibold text-warning uppercase tracking-wide">
                                  Unloading Area
                                </span>
                              </div>

                              <SortableContainer
                                id={`unloading-section-${dockId}`}
                                type="dock-section"
                                bookingStatus={BookingStatus.UNLOADING}
                                dockId={dockId}
                                className="space-y-2 min-h-[120px] bg-warning/5 rounded-lg p-2 transition-all"
                                acceptFrom={[
                                  BookingStatus.IN_PROGRESS,
                                  BookingStatus.DELAYED,
                                  BookingStatus.CANCELED,
                                ]}
                              >
                                {unloadingBookings.length === 0 ? (
                                  <SortableContainer
                                    id={`unloading-empty-${dockId}`}
                                    type="dock-section"
                                    bookingStatus={BookingStatus.UNLOADING}
                                    dockId={dockId}
                                    acceptFrom={[
                                      BookingStatus.IN_PROGRESS,
                                      BookingStatus.DELAYED,
                                    ]}
                                    isEmptyZone={true}
                                  />
                                ) : (
                                  <div className="space-y-2">
                                    {unloadingBookings.map(
                                      (booking: Booking) => (
                                        <React.Fragment key={booking.id}>
                                          <SortableContainer
                                            id={`before-unloading-${booking.id}`}
                                            type="dock-section"
                                            bookingStatus={
                                              BookingStatus.UNLOADING
                                            }
                                            dockId={dockId}
                                            className="h-1"
                                            acceptFrom={[
                                              BookingStatus.IN_PROGRESS,
                                              BookingStatus.DELAYED,
                                            ]}
                                          >
                                            <DraggableBookingCard
                                              booking={booking}
                                              onDetail={() => onDetail(booking)}
                                              droppable={false}
                                              onMarkFinished={() =>
                                                handleUpdateStatus({
                                                  id: booking.id!,
                                                  status:
                                                    BookingStatus.FINISHED,
                                                  actualFinishTime: new Date(),
                                                })
                                              }
                                            />
                                          </SortableContainer>
                                        </React.Fragment>
                                      ),
                                    )}
                                  </div>
                                )}
                              </SortableContainer>
                            </div>

                            {/* IN_PROGRESS SECTION */}
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-4 bg-info rounded-full"></div>
                                  <span className="text-xs font-semibold text-info uppercase tracking-wide">
                                    Queue
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                  {inProgressBookings.length}
                                </span>
                              </div>

                              <div className="bg-info/5 rounded-lg p-2 min-h-[200px] transition-all">
                                {inProgressBookings.length === 0 ? (
                                  <SortableContainer
                                    id={`inprogress-empty-${dockId}`}
                                    type="dock-section"
                                    bookingStatus={BookingStatus.IN_PROGRESS}
                                    dockId={dockId}
                                    className="min-h-[180px] flex items-center justify-center"
                                    isEmptyZone={true}
                                    acceptFrom={[
                                      BookingStatus.IN_PROGRESS,
                                      BookingStatus.DELAYED,
                                      BookingStatus.CANCELED,
                                    ]}
                                  >
                                    <div className="text-center py-8">
                                      <Users
                                        size={32}
                                        className="text-gray-300 mx-auto mb-2"
                                      />
                                      <p className="text-xs text-gray-400">
                                        No queue
                                      </p>
                                    </div>
                                  </SortableContainer>
                                ) : (
                                  <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {inProgressBookings.map(
                                      (booking: Booking) => (
                                        <React.Fragment key={booking.id}>
                                          <SortableContainer
                                            id={`before-inprogress-${booking.id}`}
                                            type="dock-section"
                                            bookingStatus={
                                              BookingStatus.IN_PROGRESS
                                            }
                                            dockId={dockId}
                                            acceptFrom={[
                                              BookingStatus.IN_PROGRESS,
                                              BookingStatus.DELAYED,
                                              BookingStatus.CANCELED,
                                            ]}
                                          />
                                          <DraggableBookingCard
                                            booking={booking}
                                            onDetail={() => onDetail(booking)}
                                            onCancel={() =>
                                              handleUpdateStatus({
                                                id: booking.id!,
                                                status: BookingStatus.CANCELED,
                                              })
                                            }
                                            onActualArrived={() =>
                                              confirmArrival(booking)
                                            }
                                          />
                                        </React.Fragment>
                                      ),
                                    )}
                                    <DropZoneLine
                                      id={`drop-after-last-${dockId}`}
                                      bookingStatus={BookingStatus.IN_PROGRESS}
                                      dockId={dockId}
                                      acceptFrom={[
                                        BookingStatus.IN_PROGRESS,
                                        BookingStatus.DELAYED,
                                        BookingStatus.CANCELED,
                                      ]}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* INVENTORY SECTION - Modern Drawer Style */}
                  <div
                    className="fixed left-0 right-0 bottom-0 bg-white/95 backdrop-blur-xl border-t border-gray-200 shadow-2xl transition-all duration-300 z-20"
                    style={{
                      transform: `translateY(${height === 100 ? "calc(100% - 40px)" : "0"})`,
                    }}
                  >
                    {/* Handle */}
                    <div
                      className="h-8 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 cursor-ns-resize flex justify-center items-center hover:bg-gray-100 transition-colors group"
                      onMouseDown={(e) => {
                        const startY = e.clientY;
                        const startHeight = height;
                        e.preventDefault();
                        e.stopPropagation();

                        const handleMouseMove = (moveEvent) => {
                          const delta = startY - moveEvent.clientY;
                          setHeight(
                            Math.max(100, Math.min(600, startHeight + delta)),
                          );
                        };

                        const handleMouseUp = () => {
                          document.removeEventListener(
                            "mousemove",
                            handleMouseMove,
                          );
                          document.removeEventListener(
                            "mouseup",
                            handleMouseUp,
                          );
                        };

                        document.addEventListener("mousemove", handleMouseMove);
                        document.addEventListener("mouseup", handleMouseUp);
                      }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-1 bg-gray-400 rounded-full group-hover:bg-primary transition-colors" />
                        <span className="text-xs text-gray-400 group-hover:text-primary transition-colors">
                          {height === 100 ? "Drag to expand" : "Drag to resize"}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div
                      style={{ height: `${height}px` }}
                      className="overflow-auto custom-scrollbar"
                    >
                      <div className="container mx-auto px-4 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* DELAYED */}
                          <FullDroppableInventory
                            bookings={delayedBookings}
                            status={BookingStatus.DELAYED}
                            title="Delayed Bookings"
                            onDetail={(booking) => onDetail(booking)}
                            badgeColor="badge-warning"
                            bgColor="bg-amber-50/80"
                            borderColor="border-amber-200"
                            icon={
                              <Clock className="w-5 h-5 mr-2 text-amber-600" />
                            }
                          />

                          {/* CANCELED */}
                          <FullDroppableInventory
                            bookings={canceledBookings}
                            status={BookingStatus.CANCELED}
                            title="Canceled Bookings"
                            onDetail={(booking) => onDetail(booking)}
                            badgeColor="badge-error"
                            bgColor="bg-red-50/80"
                            borderColor="border-rose-200"
                            icon={
                              <Trash2 className="w-5 h-5 mr-2 text-red-600" />
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DragOverlay */}
                  <DragOverlay style={{ zIndex: 9999 }}>
                    {activeBooking && (
                      <div className="card shadow-2xl scale-105 rotate-1 border-2 border-primary/50 pointer-events-none">
                        <DraggableBookingCard
                          booking={activeBooking}
                          draggable={false}
                        />
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal components */}
      <ConfirmationWithInput
        modalId="cancel-confirmation"
        message="Konfirmasi Pembatalan. tuliskan suatu alasan"
        onConfirm={handleCancel}
        title={"Apakah kamu yakin akan membatalkan Booking ini?"}
        input={canceledReason}
        setInput={setCanceledReason}
        key={"cancel-confirmation"}
      />
      <QueueDetailModal
        selectedBookingId={selectedBookingId}
        setSelectedBookingId={setSelectedBookingId}
        setNow={setNow}
        key={"justify"}
        mode="justify"
      />
      <DockOptionModal
        key={"dock-option-modal"}
        selectedDockId={selectedDockId}
        refecthDock={refecthDock}
      />
    </div>
  );
}

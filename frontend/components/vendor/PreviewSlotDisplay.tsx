import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Booking } from "@/types/booking.type";
import { BookingApi } from "@/api/booking.api";
import { DockApi } from "@/api/dock.api";
import { Vacant } from "@/types/vacant.type";
import { IDockBusyTime } from "@/types/busyTime.type";
import { BookingStatus, Days, ROLE } from "@/types/shared.type";
import { IDock } from "@/types/dock.type";
import { normalizeDate } from "@/lib/constant";
import { Calendar, Clock } from "lucide-react";
import { useUserInfo } from "../UserContext";
import { OrganizationApi } from "@/api/organization.api";
import Holidays from "date-holidays";

interface PreviewSlotDisplayProps {
  formData: Booking;
  onUpdateFormData: (updates: Partial<Booking>) => void;
  mode?: "create" | "justify";
  currentBookingId?: string;
}

const PreviewSlotDisplay = ({
  formData,
  onUpdateFormData,
  mode = "create",
  currentBookingId,
}: PreviewSlotDisplayProps) => {
  const [isAdminMode, setIsAdminMode] = useState(false);

  const holidays = new Holidays("ID"); // ID untuk Indonesia

  const { userInfo, socket } = useUserInfo();
  const isAdmin =
    userInfo?.role == ROLE.USER_ORGANIZATION ||
    userInfo?.role == ROLE.ADMIN_ORGANIZATION;

  // States
  const [visualStartTime, setVisualStartTime] = useState<string | null>(null);
  const [visualEndTime, setVisualEndTime] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>();
  const [selectedWeek, setSelectedWeek] = useState<Date | null>();
  const [notes, setNotes] = useState(formData?.notes || "");

  const queryClient = useQueryClient();

  const { data: myOrganization } = useQuery({
    queryKey: ["oraganization-settings"],
    queryFn: async () => {
      const data = await OrganizationApi.getMyOrganizationSettings();
      return data;
    },
    enabled: !!selectedWeek,
  });

  // Queries
  const { data: availableDocks } = useQuery({
    queryKey: ["docks", formData?.warehouseId],
    queryFn: () => DockApi.getDocksByWarehouseId(formData.warehouseId!),
    enabled: !!formData?.warehouseId && mode === "justify",
  });

  const { data: dockDetail, isLoading: loadingDock } = useQuery({
    queryKey: ["dock-detail", formData?.dockId],
    queryFn: () => DockApi.getDockDetail(formData.dockId!),
    enabled: !!formData?.dockId,
  });

  const { data: allBookings } = useQuery({
    queryKey: ["bookings", formData?.warehouseId],
    queryFn: () =>
      BookingApi.semiDetailList({
        warehouseId: formData.warehouseId,
        page: 1,
        isForBooking: mode === "create" ? true : false,
      }),
    enabled: !!formData?.warehouseId,
  });

  // Helper functions
  const parseTimeToHours = (timeString: string | null): number | null => {
    if (!timeString) return null;
    const match = timeString.match(/^(\d{1,2}):(\d{2})/);
    return match ? parseInt(match[1]) + parseInt(match[2]) / 60 : null;
  };

  const formatHoursToTimeString = (decimalHours: number): string => {
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:00`;
  };

  const formatDateToString = (date: Date): string =>
    date.toISOString().split("T")[0];

  const getDayNameFromDate = (date: Date): string => {
    return ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][
      date.getDay()
    ];
  };

  const mapDayIndexToEnum = (dayIndex: number): Days => {
    return [
      Days.MINGGU,
      Days.SENIN,
      Days.SELASA,
      Days.RABU,
      Days.KAMIS,
      Days.JUMAT,
      Days.SABTU,
    ][dayIndex];
  };

  const getStartOfWeek = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getApplicableBusyTimesForDate = (date: Date): IDockBusyTime[] => {
    if (!busyTimes) return [];
    const dayEnum = mapDayIndexToEnum(date.getDay());
    return busyTimes.filter((bt: IDockBusyTime) => {
      if (bt.recurring === "DAILY") return true;
      if (bt.recurring === "WEEKLY")
        return bt.recurringCustom?.includes(dayEnum);
      if (bt.recurring === "MONTHLY")
        return date.getDate() === bt.recurringStep;
      return false;
    });
  };

  const getDateBookingsForDate = (date: Date): any[] => {
    if (!filteredDockBookings) return [];
    const dateString = formatDateToString(date);
    return filteredDockBookings.filter(
      (b: any) =>
        b?.arrivalTime &&
        formatDateToString(new Date(b.arrivalTime)) === dateString,
    );
  };

  // Computed values
  const busyTimes: IDockBusyTime[] =
    (dockDetail?.busyTimes as IDockBusyTime[]) || [];
  const dockBookings = useMemo(
    () =>
      allBookings?.filter(
        (b: any) => b.dockId === formData.dockId && b.status !== "CANCELED",
      ) || [],
    [allBookings, formData?.dockId],
  );

  const filteredDockBookings = useMemo(
    () => dockBookings.filter((b: any) => b.id !== currentBookingId),
    [dockBookings, currentBookingId],
  );

  const weekDays = useMemo(() => {
    if (!selectedWeek) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(selectedWeek);
      day.setDate(selectedWeek.getDate() + i);
      return day;
    });
  }, [selectedWeek]);

  const availableSchedulesByDay = useMemo(() => {
    if (!dockDetail?.vacants || !selectedWeek) return {};

    const schedulesByDay: Record<string, any[]> = {};
    weekDays.forEach((date) => {
      const dayEnum = mapDayIndexToEnum(date.getDay());
      const dateString = formatDateToString(date);
      const dayVacants = dockDetail.vacants.filter(
        (v: Vacant) => v.day === dayEnum,
      );

      schedulesByDay[dateString] = dayVacants
        .filter((v: Vacant) => v.availableFrom && v.availableUntil)
        .map((v) => ({
          id: v.id || `vacant-${dayEnum}-${dateString}`,
          day: getDayNameFromDate(date),
          startTime: v.availableFrom!,
          endTime: v.availableUntil!,
          date: dateString,
        }));
    });

    return schedulesByDay;
  }, [dockDetail?.vacants, selectedWeek, weekDays, dockDetail]);

  // Event handlers
  const handleWeekSelect = (weekStart: Date) => {
    setSelectedWeek(weekStart);
    setSelectedDate(null);
    setVisualStartTime(null);
    setVisualEndTime(null);
    onUpdateFormData({ arrivalTime: null, estimatedFinishTime: null });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setVisualStartTime(null);
    setVisualEndTime(null);
    onUpdateFormData({ arrivalTime: null, estimatedFinishTime: null });
  };

  const handleDockChange = (dockId: string) => {
    onUpdateFormData({ dockId });
    setVisualStartTime(null);
    setVisualEndTime(null);
    setSelectedDate(null);
    setSelectedWeek(null);
  };

  const checkTimeCollisions = (
    startTime: number,
    durationHours: number,
    events: any[],
  ): boolean => {
    const endTime = startTime + durationHours;
    for (const event of events) {
      if (startTime < event.end && endTime > event.start) {
        return true;
      }
    }
    return false;
  };

  const handleClickOnTrack = (date: Date, clickedTimeDecimal: number) => {
    if (!formData.Vehicle?.durasiBongkar) return;

    // ===============================
    // 1. VALIDASI TANGGAL
    // ===============================
    const today = normalizeDate(new Date());
    const selected = normalizeDate(date);

    if (selected < today) {
      toast.error("Tanggal sudah lewat");
      return;
    }

    // 1.2 cek hari libur nasional
    const isHoliday = holidays.isHoliday(date);
    if (isHoliday) {
      toast.error(
        `Tanggal ${date.toLocaleDateString("id-ID")} adalah hari libur nasional: ${isHoliday[0]?.name || "Libur"}`,
      );
      return;
    }

    handleDateSelect(date);

    // ===============================
    // 2. AMBIL SCHEDULE AKTIF
    // ===============================
    const dateString = formatDateToString(date);
    const schedules = availableSchedulesByDay[dateString] || [];

    const activeSchedule =
      schedules.find((schedule) => {
        const start =
          parseTimeToHours(schedule.startTime) ?? parseTimeToHours("06:00:00")!;
        const end =
          parseTimeToHours(schedule.endTime) ?? parseTimeToHours("18:00:00")!;
        return clickedTimeDecimal >= start && clickedTimeDecimal < end;
      }) || schedules[0];

    if (!activeSchedule) return;

    const scheduleStartHour =
      parseTimeToHours(activeSchedule.startTime) ??
      parseTimeToHours("06:00:00")!;
    const scheduleEndHour =
      parseTimeToHours(activeSchedule.endTime) ?? parseTimeToHours("18:00:00")!;

    const scheduleEndMinutes = Math.round(scheduleEndHour * 60);

    // ===============================
    // 3. DURASI
    // ===============================
    const durationMinutes = formData.Vehicle.durasiBongkar;
    const durationHours = durationMinutes / 60;

    // Anchor awal
    let selectedStartHour = clickedTimeDecimal;

    // ===============================
    // 4. AUTO EFFICIENT (ANCHOR SEARCH)
    // ===============================
    if (formData.Warehouse.isAutoEfficientActive && !isAdminMode) {
      const applicableBusyTimes = getApplicableBusyTimesForDate(date);
      const dateBookings = getDateBookingsForDate(date);
      type EventBoundary = { start: number; end: number };

      const eventBoundaries: EventBoundary[] = [
        ...applicableBusyTimes.map((bt) => ({
          start: parseTimeToHours(bt.from) || 0,
          end: parseTimeToHours(bt.to) || 0,
        })),
        ...dateBookings.map((b) => {
          const s = new Date(b.arrivalTime);
          const e = new Date(b.estimatedFinishTime);
          return {
            start: s.getHours() + s.getMinutes() / 60,
            end: e.getHours() + e.getMinutes() / 60,
          };
        }),
      ].filter(
        (ev) => ev.end > scheduleStartHour && ev.start < scheduleEndHour,
      );

      const now = new Date();
      const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

      let minimumAllowedHour = scheduleStartHour;

      if (isToday) {
        minimumAllowedHour = Math.max(
          scheduleStartHour,
          now.getHours() + now.getMinutes() / 60 + 0.01,
        ); //0.01 = 1 menit majuin dikit biar ga kebingungan adminnya karena booking langsung jatuh ke delayed
      }

      const candidateStarts: number[] = [minimumAllowedHour];

      eventBoundaries
        .sort((a, b) => a.start - b.start)
        .forEach((ev) => {
          if (ev.end <= clickedTimeDecimal && ev.end > minimumAllowedHour) {
            candidateStarts.push(ev.end);
          }
        });

      const validStarts = candidateStarts.filter((start) => {
        const end = start + durationHours;
        const collide = eventBoundaries.some(
          (ev) => start < ev.end && end > ev.start,
        );
        return !collide && end <= scheduleEndHour;
      });

      if (validStarts.length === 0) {
        toast.error("Tidak ada slot waktu yang tersedia");
        return;
      }

      selectedStartHour = validStarts.reduce((best, curr) => {
        return Math.abs(curr - clickedTimeDecimal) <
          Math.abs(best - clickedTimeDecimal)
          ? curr
          : best;
      });
    }

    // ===============================
    // 5. INTERVAL DECISION (FIX POSISI)
    // ===============================
    const applicableBusyTimes = getApplicableBusyTimesForDate(date);
    const dateBookings = getDateBookingsForDate(date);
    const EPSILON = 0.01;

    const isStartOfDay =
      Math.abs(selectedStartHour - scheduleStartHour) < EPSILON;

    const isAfterBusyTime = applicableBusyTimes.some((bt) => {
      const end = parseTimeToHours(bt.to);
      return end != null && Math.abs(selectedStartHour - end) < EPSILON;
    });

    const isAfterBooking = dateBookings.some((b) => {
      const end =
        new Date(b.estimatedFinishTime).getHours() +
        new Date(b.estimatedFinishTime).getMinutes() / 60;
      return Math.abs(selectedStartHour - end) < EPSILON;
    });

    const intervalMinimalQueueu = formData.Warehouse.intervalMinimalQueueu || 0;

    const isIntervalRequired =
      !isStartOfDay && !isAfterBusyTime && isAfterBooking;

    const effectiveStartHour =
      selectedStartHour + (isIntervalRequired ? intervalMinimalQueueu / 60 : 0);

    // ===============================
    // 6. VALIDASI FINAL (PAKAI EFFECTIVE)
    // ===============================
    const endMinutes = Math.round(effectiveStartHour * 60) + durationMinutes;

    if (endMinutes > scheduleEndMinutes) {
      toast.error("Waktu selesai melebihi jam operasional");
      return;
    }

    const hasCollision = checkTimeCollisions(
      effectiveStartHour,
      durationHours,
      [
        ...applicableBusyTimes.map((bt) => ({
          start: parseTimeToHours(bt.from) || 0,
          end: parseTimeToHours(bt.to) || 0,
        })),
        ...dateBookings.map((b) => ({
          start:
            new Date(b.arrivalTime).getHours() +
            new Date(b.arrivalTime).getMinutes() / 60,
          end:
            new Date(b.estimatedFinishTime).getHours() +
            new Date(b.estimatedFinishTime).getMinutes() / 60,
        })),
      ],
    );

    if (hasCollision) {
      toast.error("Slot waktu bertabrakan");
      return;
    }

    // ===============================
    // 7. SET FINAL TIME
    // ===============================
    const startTimeString = formatHoursToTimeString(effectiveStartHour);

    const arrivalDateTime = new Date(date);
    const [h, m] = startTimeString.split(":").map(Number);
    arrivalDateTime.setHours(h, m, 0, 0);

    const finishDateTime = new Date(arrivalDateTime);
    finishDateTime.setMinutes(finishDateTime.getMinutes() + durationMinutes);

    setVisualStartTime(startTimeString);
    setVisualEndTime(
      `${finishDateTime.getHours().toString().padStart(2, "0")}:${finishDateTime
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
    );

    onUpdateFormData({
      arrivalTime: arrivalDateTime,
      estimatedFinishTime: finishDateTime,
    });

    if (formData.Warehouse.isAutoEfficientActive && !isAdminMode) {
      toast.success("auto efficient active");
    }
  };

  // Calendar setup
  const maximumWeekSelection = formData?.Warehouse?.maximumWeekSelection || 9;

  const today = new Date();
  const currentWeekStart = getStartOfWeek(today);
  const availableWeeks = Array.from(
    { length: maximumWeekSelection },
    (_, i) => {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + i * 7);
      return weekStart;
    },
  );

  // UI Components
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  const WeekSelector = () => (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <h3 className="text-base font-medium mb-3">
        Minggu yang dapat dipilih ({maximumWeekSelection} minggu ke depan)
      </h3>
      <div className="flex overflow-x-auto gap-2 pb-2 -mx-2 px-2">
        {availableWeeks.map((weekStart, i) => {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          const isSelected =
            selectedWeek &&
            formatDateToString(selectedWeek) === formatDateToString(weekStart);

          return (
            <button
              key={i}
              onClick={() => handleWeekSelect(weekStart)}
              className={`flex-shrink-0 flex flex-col p-3 rounded-lg border transition-all min-w-[120px] ${
                isSelected
                  ? "border-primary bg-primary text-white"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              <span className="text-xs opacity-80">
                {i === 0 ? "Minggu Ini" : `Minggu ${i + 1}`}
              </span>
              <span className="text-sm font-bold mt-1">
                {weekStart.getDate()}-{weekEnd.getDate()}{" "}
                {weekStart.toLocaleDateString("id-ID", { month: "short" })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const TimeSlotGrid = () => {
    const startHour = 8;
    const endHour = 22; // atau 21, 23 sesuai kebutuhan
    const hours = Array.from(
      { length: endHour - startHour + 1 },
      (_, i) => startHour + i,
    );

    const getBarPosition = (timeHour: number): number => {
      const clamped = Math.max(startHour, Math.min(endHour, timeHour));
      // PERBAIKAN: 15 kolom, jam 8:00 = kolom 1 (0%), jam 9:00 = kolom 2 (100/15 = 6.67%)
      // Rumus: (jam - startHour) * (100 / totalKolom)
      return ((clamped - startHour) / hours.length) * 100;
    };

    const getApplicableBusyTimes = (date: Date): IDockBusyTime[] => {
      if (!busyTimes) return [];
      const dayEnum = mapDayIndexToEnum(date.getDay());
      return busyTimes.filter((bt: IDockBusyTime) => {
        if (bt.recurring === "DAILY") return true;
        if (bt.recurring === "WEEKLY")
          return bt.recurringCustom?.includes(dayEnum);
        if (bt.recurring === "MONTHLY")
          return date.getDate() === bt.recurringStep;
        return false;
      });
    };

    const getDateBookings = (date: Date): any[] => {
      if (!filteredDockBookings) return [];
      const dateString = formatDateToString(date);
      return filteredDockBookings.filter(
        (b: any) =>
          b?.arrivalTime &&
          formatDateToString(new Date(b.arrivalTime)) === dateString,
      );
    };

    // TAMBAHKAN: Fungsi dan state untuk current time
    const getCurrentTimePosition = (): number | null => {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;

      // Hanya tampilkan jika dalam rentang waktu yang ditampilkan
      if (currentHour >= startHour && currentHour <= endHour) {
        return getBarPosition(currentHour);
      }
      return null;
    };

    const [currentTime, setCurrentTime] = useState<number | null>(
      getCurrentTimePosition,
    );

    // TAMBAHKAN: Fungsi untuk cek apakah hari ini
    const isToday = (date: Date): boolean => {
      const today = new Date();
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    };

    // TAMBAHKAN: Format waktu sekarang untuk label
    const getCurrentTimeLabel = (): string => {
      return new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    if (loadingDock) return <LoadingSpinner />;
    if (!formData?.dockId)
      return (
        <div className="text-center p-6 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-sm">
            Silakan pilih dock terlebih dahulu
          </p>
        </div>
      );
    if (weekDays.length === 0)
      return (
        <div className="text-center p-6 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-sm">
            Silakan pilih minggu terlebih dahulu
          </p>
        </div>
      );

    return (
      <div className="space-y-2">
        {/* Time header - TANPA garis waktu di sini */}
        <div className="flex border-b pb-1">
          <div className="w-16 flex-shrink-0"></div>
          <div className="flex-1 relative min-w-0">
            <div className={`grid grid-cols-[repeat(15,minmax(0,1fr))] gap-0`}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-left text-xs text-gray-500 font-medium"
                >
                  {hour}:00
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Days - Compact horizontal layout */}
        <div className="space-y-1 overflow-y-auto pr-1">
          {weekDays.map((date) => {
            const dateString = formatDateToString(date);
            const dayName = getDayNameFromDate(date);
            const dayShort = dayName.slice(0, 3);
            const schedules = availableSchedulesByDay[dateString] || [];
            const isDateSelected =
              selectedDate && formatDateToString(selectedDate) === dateString;
            const applicableBusyTimes = getApplicableBusyTimes(date);
            const dateBookings = getDateBookings(date);
            const today = isToday(date);

            return (
              <div key={dateString} className="group relative">
                {/* Day header with schedule info */}
                <div className="flex items-center mb-1">
                  <div
                    className={`text-xs font-medium px-2 py-1 rounded transition-colors flex items-center gap-1 flex-shrink-0 ${
                      today
                        ? "bg-red-100 text-red-700 border border-red-300"
                        : isDateSelected
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <span className="font-semibold">{dayShort}</span>
                    <span>{date.getDate()}</span>
                    <span className="text-[10px] opacity-75">
                      {date.toLocaleDateString("id-ID", { month: "short" })}
                    </span>
                    {today && (
                      <span className="text-[10px] font-bold text-red-600 ml-1">
                        • HARI INI
                      </span>
                    )}
                  </div>

                  {/* Schedule times inline */}
                  {schedules.length > 0 && (
                    <div className="ml-2 flex flex-wrap gap-1">
                      {schedules.slice(0, 2).map((schedule, idx) => (
                        <span
                          key={idx}
                          className="text-xs text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border"
                        >
                          {schedule.startTime.slice(0, 5)}-
                          {schedule.endTime.slice(0, 5)}
                        </span>
                      ))}
                      {schedules.length > 2 && (
                        <span className="text-xs text-gray-500 px-1">
                          +{schedules.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Time slot track */}
                <div className="flex items-center">
                  <div className="w-16 flex-shrink-0"></div>
                  <div className="flex-1 relative min-w-0 h-10">
                    {/* GARIS WAKTU SAAT INI - hanya untuk hari ini */}
                    {today && currentTime !== null && (
                      <>
                        {/* Garis vertikal merah */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                          style={{
                            left: `${currentTime}%`,
                          }}
                        >
                          {/* Titik atas */}
                          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>
                          </div>
                          {/* Titik bawah */}
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                            <div className="w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>
                          </div>
                        </div>

                        {/* Label waktu di atas track */}
                        <div
                          className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-30 pointer-events-none"
                          style={{
                            left: `${currentTime}%`,
                          }}
                        >
                          <div className="flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span>Sekarang</span>
                            <span className="font-bold">
                              {getCurrentTimeLabel()}
                            </span>
                          </div>
                          {/* Arrow pointing down */}
                          <div className="w-0 h-0 border-l-3 border-r-3 border-t-3 border-transparent border-t-red-500 mx-auto"></div>
                        </div>
                      </>
                    )}
                    {/* TAMBAHKAN: Garis vertikal setiap jam untuk alignment */}
                    {hours.map((h) => (
                      <div
                        key={`line-${h}`}
                        className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
                        style={{
                          left: `${getBarPosition(h)}%`,
                        }}
                      />
                    ))}

                    {/* Render each schedule as a track */}
                    {schedules.length === 0 ? (
                      <div className="absolute inset-0 bg-gray-100 rounded opacity-50"></div>
                    ) : (
                      schedules.map((schedule) => {
                        const startHourNum =
                          parseTimeToHours(schedule.startTime) || startHour;
                        const endHourNum =
                          parseTimeToHours(schedule.endTime) || endHour;
                        const startPercent = getBarPosition(startHourNum);
                        const widthPercent =
                          getBarPosition(endHourNum) - startPercent;

                        // Collect events for this schedule
                        const events: Array<{
                          start: number;
                          end: number;
                          desc: string;
                          type: "busy" | "booking";
                        }> = [
                          ...applicableBusyTimes
                            .filter((bt) => {
                              const btStart = parseTimeToHours(bt.from) || 0;
                              const btEnd = parseTimeToHours(bt.to) || 0;
                              return (
                                btEnd > startHourNum && btStart < endHourNum
                              );
                            })
                            .map((bt) => ({
                              start: parseTimeToHours(bt.from) || 0,
                              end: parseTimeToHours(bt.to) || 0,
                              desc: bt.reason,
                              type: "busy" as const,
                            })),
                          ...dateBookings
                            .filter((b: Booking) => {
                              const bDate = new Date(b.arrivalTime);
                              const fDate = new Date(b.estimatedFinishTime);
                              const bookingStart =
                                bDate.getHours() + bDate.getMinutes() / 60;
                              const bookingEnd =
                                fDate.getHours() + fDate.getMinutes() / 60;
                              return (
                                bookingEnd > startHourNum &&
                                bookingStart < endHourNum
                              );
                            })
                            .map((b: Booking) => ({
                              start:
                                new Date(b.arrivalTime).getHours() +
                                new Date(b.arrivalTime).getMinutes() / 60,
                              end:
                                new Date(b.estimatedFinishTime).getHours() +
                                new Date(b.estimatedFinishTime).getMinutes() /
                                  60,
                              desc: `${b.code}`,
                              type: "booking" as const,
                            })),
                        ];

                        return (
                          <div key={schedule.id} className="absolute inset-0">
                            {/* Available slot - clickable area */}
                            <div
                              onClick={(e) => {
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const clickPercent = clickX / rect.width;
                                const clickedTime =
                                  startHourNum +
                                  (endHourNum - startHourNum) * clickPercent;

                                handleClickOnTrack(date, clickedTime);
                              }}
                              className={`absolute h-full rounded transition-all cursor-pointer ${
                                isDateSelected
                                  ? "bg-green-100 hover:bg-green-200 border border-green-300 cursor-pointer"
                                  : "bg-gray-200 cursor-not-allowed opacity-60"
                              }`}
                              style={{
                                left: `${startPercent}%`,
                                width: `${widthPercent}%`,
                              }}
                              title={`${schedule.startTime.slice(
                                0,
                                5,
                              )}-${schedule.endTime.slice(
                                0,
                                5,
                              )}\nKlik untuk memilih waktu`}
                            >
                              {/* Schedule time label inside bar */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-medium text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {schedule.startTime.slice(0, 5)}-
                                  {schedule.endTime.slice(0, 5)}
                                </span>
                              </div>
                            </div>

                            {/* Events overlay - versi clean */}
                            {events.map((event, idx) => {
                              const eventStart = Math.max(
                                event.start,
                                startHourNum,
                              );
                              const eventEnd = Math.min(event.end, endHourNum);
                              const left = getBarPosition(eventStart);
                              const width = getBarPosition(eventEnd) - left;

                              const formatHour = (hour: number) => {
                                const hours = Math.floor(hour);
                                const minutes = Math.round((hour - hours) * 60);
                                return `${hours}:${minutes
                                  .toString()
                                  .padStart(2, "0")}`;
                              };

                              const isWideEnough = width > 5;
                              const eventTypeColor =
                                event.type === "busy"
                                  ? {
                                      bg: "bg-red-500",
                                      border: "border-red-600",
                                      text: "text-red-50",
                                    }
                                  : {
                                      bg: "bg-amber-500",
                                      border: "border-amber-600",
                                      text: "text-amber-50",
                                    };

                              return (
                                <div
                                  key={idx}
                                  className="absolute h-full group"
                                  style={{
                                    left: `${left}%`,
                                    width: `${Math.max(2, width)}%`,
                                  }}
                                >
                                  {/* Main event bar */}
                                  <div
                                    className={`relative h-full rounded ${eventTypeColor.bg} ${eventTypeColor.border} border shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
                                  >
                                    {/* Pattern overlay */}
                                    {event.type === "booking" && (
                                      <div className="absolute inset-0 opacity-20 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                                    )}

                                    {/* Content */}
                                    <div className="relative h-full flex items-center px-1">
                                      {/* Icon indicator */}
                                      <div className="absolute left-1 flex items-center">
                                        {event.type === "busy" ? (
                                          <Clock className="w-2.5 h-2.5 text-white/80" />
                                        ) : (
                                          <Calendar className="w-2.5 h-2.5 text-white/80" />
                                        )}
                                      </div>

                                      {/* Time label */}
                                      {isWideEnough && (
                                        <div
                                          className={`flex-1 text-center ${eventTypeColor.text} text-[9px] font-medium truncate px-4`}
                                        >
                                          {formatHour(eventStart)} -{" "}
                                          {formatHour(eventEnd)}
                                        </div>
                                      )}

                                      {/* Type badge */}
                                      <div className="absolute right-1">
                                        <span
                                          className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                                            event.type === "busy"
                                              ? "bg-red-600"
                                              : "bg-amber-600"
                                          } text-white`}
                                        >
                                          {event.type === "busy" ? "🔒" : "📅"}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Hover overlay with full info */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <div className="text-center p-2">
                                        <div className="text-[10px] text-white/90 font-medium">
                                          {event.desc}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Compact tooltip for small events */}
                                  {!isWideEnough && (
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                      <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-lg">
                                        <div className="font-bold">
                                          {event.type === "busy"
                                            ? "🔒 Sibuk"
                                            : "📅 Booking"}
                                        </div>
                                        <div>
                                          {formatHour(eventStart)}-
                                          {formatHour(eventEnd)}
                                        </div>
                                      </div>
                                      <div className="w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900 mx-auto"></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Selected time slot */}
                            {isDateSelected &&
                              visualStartTime &&
                              visualEndTime && (
                                <div
                                  className="absolute h-full rounded-lg border-2 border-blue-500 bg-blue-400/30 shadow-sm z-30 pointer-events-none"
                                  style={{
                                    left: `${getBarPosition(
                                      parseTimeToHours(visualStartTime) || 0,
                                    )}%`,
                                    width: `${Math.max(
                                      2,
                                      getBarPosition(
                                        parseTimeToHours(visualEndTime) || 0,
                                      ) -
                                        getBarPosition(
                                          parseTimeToHours(visualStartTime) ||
                                            0,
                                        ),
                                    )}%`,
                                  }}
                                  title={`Waktu terpilih: ${visualStartTime.slice(
                                    0,
                                    5,
                                  )}-${visualEndTime.slice(0, 5)}`}
                                >
                                  {/* Time label */}
                                  <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 whitespace-nowrap pointer-events-auto">
                                    <div className="text-xs font-medium bg-blue-500 text-white px-2 py-0.5 rounded">
                                      {visualStartTime.slice(0, 5)}-
                                      {visualEndTime.slice(0, 5)}
                                    </div>
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Events summary below track */}
                {(applicableBusyTimes.length > 0 ||
                  dateBookings.length > 0) && (
                  <div className="mt-1 ml-16">
                    <div className="flex flex-wrap gap-1">
                      {applicableBusyTimes.slice(0, 2).map((bt, idx) => (
                        <div
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-800 rounded border border-red-200 flex items-center gap-1"
                          title={bt.reason}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                          <span className="max-w-[120px]">
                            {bt.reason} {bt.from} - {bt.to}
                          </span>
                        </div>
                      ))}
                      {dateBookings.map((b: Booking, idx: number) => (
                        <div
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-200 flex items-center gap-1"
                          title={`Booking ${b.id}`}
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                          <span className="max-w-[120px]">
                            {b.code}{" "}
                            {new Date(b.arrivalTime).toLocaleTimeString(
                              "en-GB",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              },
                            )}
                            -
                            {new Date(b.estimatedFinishTime).toLocaleTimeString(
                              "en-GB",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              },
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Click instruction */}
        {selectedDate && !visualStartTime && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                />
              </svg>
              <p className="text-xs text-blue-700">
                <span className="font-medium">Klik pada area hijau</span> untuk
                memilih waktu kunjungan
              </p>
            </div>
          </div>
        )}

        {/* Legend - Compact */}
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-xs text-gray-600">Tersedia (klik)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-600">Sibuk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
            <span className="text-xs text-gray-600">Booking</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-400/30 border-2 border-blue-500 rounded-lg"></div>
            <span className="text-xs text-gray-600">Pilihan Anda</span>
          </div>
          {/* Tambahkan legend untuk garis waktu sekarang */}
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-red-500"></div>
            <span className="text-xs text-gray-600">Waktu Sekarang</span>
          </div>
        </div>

        {/* Selected time summary */}
        {selectedDate && visualStartTime && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Waktu Terpilih:
                </p>
                <p className="text-sm text-blue-700">
                  {getDayNameFromDate(selectedDate)}, {selectedDate.getDate()}{" "}
                  {selectedDate.toLocaleDateString("id-ID", { month: "long" })}{" "}
                  {selectedDate.getFullYear()}
                </p>
                <p className="text-sm font-semibold text-blue-800">
                  {visualStartTime.slice(0, 5)} - {visualEndTime!.slice(0, 5)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-blue-600">Durasi:</p>
                <p className="text-sm font-semibold text-blue-800">
                  {formData.Vehicle?.durasiBongkar || 0} menit
                </p>
              </div>
            </div>
            {
              <p className="text-xs text-blue-600 mt-2">
                Klik area hijau lain untuk mengubah waktu
              </p>
            }
          </div>
        )}
      </div>
    );
  };

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
        queryKey: ["bookings", formData?.warehouseId],
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

  // Effects - pre-fill from formData when ada arrivalTime (justify atau create dari Modify & Confirm)
  useEffect(() => {
    if (!formData?.dockId || selectedWeek) return;

    const hasExistingSlot =
      formData.arrivalTime && formData.estimatedFinishTime;

    if (mode === "justify" || hasExistingSlot) {
      const arrivalDate = new Date(formData.arrivalTime);
      setSelectedWeek(getStartOfWeek(arrivalDate));
      setSelectedDate(arrivalDate);
      setVisualStartTime(
        `${arrivalDate.getHours().toString().padStart(2, "0")}:${arrivalDate
          .getMinutes()
          .toString()
          .padStart(2, "0")}:00`,
      );
      const finishDate = new Date(formData.estimatedFinishTime);
      setVisualEndTime(
        `${finishDate.getHours().toString().padStart(2, "0")}:${finishDate
          .getMinutes()
          .toString()
          .padStart(2, "0")}:00`,
      );
    } else {
      handleWeekSelect(getStartOfWeek(new Date()));
    }
  }, [
    formData?.dockId,
    formData?.arrivalTime,
    formData?.estimatedFinishTime,
    mode,
  ]);

  // Effect: update visual time ketika arrivalTime berubah (justify atau create dengan existing data)
  useEffect(() => {
    if (formData?.arrivalTime && selectedWeek) {
      const arrivalDate = new Date(formData.arrivalTime);
      const dateString = formatDateToString(arrivalDate);

      // Update selected date jika berbeda dan week sudah ter-set
      const currentDateString = selectedDate
        ? formatDateToString(selectedDate)
        : null;
      if (currentDateString !== dateString) {
        handleDateSelect(arrivalDate);
      }

      // Update visual start time
      const newStartTime = `${arrivalDate
        .getHours()
        .toString()
        .padStart(2, "0")}:${arrivalDate
        .getMinutes()
        .toString()
        .padStart(2, "0")}:00`;
      setVisualStartTime(newStartTime);

      // Update visual end time jika ada
      if (formData.estimatedFinishTime) {
        const finishDate = new Date(formData.estimatedFinishTime);
        const newEndTime = `${finishDate
          .getHours()
          .toString()
          .padStart(2, "0")}:${finishDate
          .getMinutes()
          .toString()
          .padStart(2, "0")}:00`;
        setVisualEndTime(newEndTime);
      } else {
        setVisualEndTime(null);
      }
    }
  }, [
    formData?.arrivalTime,
    formData?.estimatedFinishTime,
    mode,
    selectedWeek,
  ]);

  useEffect(() => {
    if (selectedWeek && weekDays.length > 0 && !selectedDate) {
      handleDateSelect(weekDays[0]);
    }
  }, [selectedWeek, weekDays.length, mode]);

  useEffect(() => {
    if (
      mode === "create" &&
      !formData?.arrivalTime &&
      selectedWeek &&
      !selectedDate
    ) {
      handleDateSelect(new Date());
      setNotes(formData?.notes);
    }
  }, [mode, formData?.arrivalTime, selectedWeek]);

  return (
    <div className="flex flex-col  h-[600px] ">
      {/* Dock Selector */}
      {availableDocks?.length && (
        <div className="bg-white rounded-lg shadow-sm p-4 ">
          <label className="block text-sm font-medium mb-2">Pilih Gate</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={formData.dockId || ""}
            onChange={(e) => handleDockChange(e.target.value)}
          >
            <option value="">Pilih dock...</option>
            {availableDocks
              .filter(
                (dock: IDock) =>
                  !formData.Vehicle?.vehicleType ||
                  !dock.allowedTypes ||
                  dock.allowedTypes.includes(formData.Vehicle.vehicleType),
              )
              .map((dock: IDock) => (
                <option key={dock.id} value={dock.id}>
                  {dock.name}
                </option>
              ))}
          </select>
        </div>
      )}
      <WeekSelector />

      {/* Time Slot Section */}
      <div className="bg-white rounded-lg shadow-sm pb-12">
        <div className="flex justify-between">
          <h3 className="text-base font-medium mb-3 flex items-center">
            <div className="mr-3">Pilih Waktu Kunjungan</div>
            <div className="text-xs text-gray-600">
              Klik area hijau untuk memilih waktu.
            </div>
          </h3>
        </div>
        <ol className="list-disc list-inside mb-3 text-xs">
          {myOrganization?.isConfirmBookRequired && (
            <li>
              Booking anda akan kami tinjau terlebih dahulu sebelum di setujui
            </li>
          )}
          <li>
            Admin Gudang Mungkin Akan Menyesuaikan Ulang Sampai Anda Dilokasi
            (Telah Tiba).
          </li>
          <li>
            Terdapat interval Minimal Queue yang menjaga jarak antar kunjungan.
          </li>
          <li>
            booking dengan status CANCELED, FINISHED tidak ditampilkan karena
            memang boleh di ambil alih
          </li>
          <li>
            Di drag and drop atau justify, status yang sudah telat menurut
            toleransi juga akan di ambil alih, tampilan booking seperti tertimpa
            kemungkinan karena alasan ini
          </li>
        </ol>

        <div className="flex gap-x-3 items-center">
          <p className="text-sm">
            Durasi Bongkar:{" "}
            <span className="font-medium text-primary">
              {formData?.Vehicle?.durasiBongkar || 0} menit
            </span>
          </p>
          {isAdmin && (
            <label
              htmlFor="isAdminMode"
              className="border cursor-pointer p-1 text-xs mr-3 rounded-md bg-slate-100"
            >
              <input
                type="checkbox"
                id="isAdminMode"
                checked={isAdminMode}
                className="checkbox border"
                onChange={() => setIsAdminMode(!isAdminMode)}
              />{" "}
              Tanpa Auto Efficient
            </label>
          )}
        </div>

        <TimeSlotGrid />
      </div>

      {/* Notes */}
      {mode == "create" && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-base font-medium mb-2">Plat Nomor/Short Note</h3>
          <input
            required
            type="text"
            value={notes}
            onChange={(e) => {
              const newNotes = e.target.value;
              setNotes(newNotes);
              onUpdateFormData({ notes: newNotes });
            }}
            placeholder="Plat Nomor/Short Note"
            className="w-full border rounded-lg px-3 py-2 text-sm "
          />
          <p className="text-xs text-gray-500 mt-1">
            * Akan dilihat oleh operator gudang
          </p>
        </div>
      )}
    </div>
  );
};

export default PreviewSlotDisplay;

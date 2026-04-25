"use client";

import React, { Suspense, useState, useEffect } from "react";
import {
  Clock,
  Truck,
  CheckCircle,
  AlertTriangle,
  Building,
  Package,
  Wifi,
  WifiOff,
  History,
  Activity,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

// Components
import QueueTableRow from "@/components/admin/dashboard-component/QueueTableRow";
import SparklineChart from "@/components/admin/dashboard-component/SparklineChart";
import SummaryCard from "@/components/admin/dashboard-component/SummaryCard";
import { useQuery } from "@tanstack/react-query";
import { BookingApi } from "@/api/booking.api";
import { useUserInfo } from "@/components/UserContext";
import { ROLE } from "@/types/shared.type";
import DockStatusSection from "@/components/admin/dashboard-component/DockStatusSection";
import QueueDetailModal from "@/components/admin/QueueDetailModal";
import MyWarehouseActionModal from "@/components/admin/my-warehouse-action-modal";
import { toast } from "sonner";
import Loading from "@/components/shared-common/Loading";
import Skeleton from "@/components/shared-common/Skeleton";

// Types
export interface DashboardState {
  summaryMetrics: {
    totalBookingsToday: number;
    pending: number;
    activeQueue: number;
    completedToday: number;
    delayedBookings: number;
    avgProcessingMinutes: number;
    dockUtilizationPercent: number;
    lastUpdated: string;
  };
  dockStatuses: Array<{
    dockId: string;
    dockName: string;
    status:
      | "IDLE"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "BLOCKED"
      | "SEDANG MEMBONGKAR"
      | "SIBUK/ISTIRAHAT"
      | "TIDAK AKTIF"
      | "KOSONG";
    bookingCode?: string;
    vendorName?: string;
    estimatedFinishTime?: string;
    remainingMinutes: number;
    isOverdue: boolean;
    colorStatus: "green" | "yellow" | "red";
  }>;
  queueSnapshot: any[];
  kpiData: {
    queueLengthTimeline: Array<{ time: string; value: number }>;
    avgWaitingTime: Array<{ time: string; minutes: number }>;
    dockThroughput: Array<{ dock: string; completed: number }>;
  };
  busyTimeData: {
    currentBusyWindow?: {
      from: string;
      to: string;
      affectedDocks: string[];
      intensity: "MEDIUM" | "HIGH";
    };
    nextBusyWindow?: {
      from: string;
      to: string;
      predictedIntensity: number;
    };
  };

  alerts: Array<{
    id: string;
    type: "OVERDUE" | "NO_SHOW" | "DOCK_BLOCKED" | "SLA_BREACH";
    severity: "LOW" | "MEDIUM" | "HIGH";
    bookingCode?: string;
    dockId?: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
    actionRequired: boolean;
  }>;
  filters: {
    searchQuery: string;
    selectedStatuses: string[];
    selectedDocks: string[];
    timeRange: {
      start: string;
      end: string;
    };
    priorityFilter: "ALL" | "HIGH" | "NORMAL" | "LOW";
  };

  selectedDock: string | null;
  selectedBooking: string | null;
  quickActionPanel: {
    reassignModalOpen: boolean;
    noteModalOpen: boolean;
    autoEfficiencyEnabled: boolean;
  };

  connection: {
    isConnected: boolean;
    lastMessageTime: string;
    error: string | null;
  };
}

const DashboardAdmin = () => {
  const { userInfo } = useUserInfo();
  const isAdmin =
    userInfo?.role == ROLE.USER_ORGANIZATION ||
    userInfo?.role == ROLE.ADMIN_ORGANIZATION ||
    userInfo?.role == ROLE.ADMIN_GUDANG;

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  //main
  const { data: dashboardState, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => await BookingApi.adminWarehouseDashboard(),
    enabled: isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds for real-time feel
  });

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: id,
      });
    } catch {
      return "Baru saja";
    }
  };

  // Summary cards data
  const mainMetrics = [
    {
      metric: "Total Booking Hari Ini",
      value: dashboardState?.summaryMetrics?.totalBookingsToday,
      icon: <Package className="h-4 w-4" />,
      status: "normal" as const,
    },
    {
      metric: "Menunggu Kedatangan",
      value: dashboardState?.summaryMetrics?.pending,
      icon: <Clock className="h-4 w-4" />,
      status: "normal" as const,
    },
    {
      metric: "Driver Telah Tiba",
      value: dashboardState?.summaryMetrics?.activeQueue,
      icon: <Truck className="h-4 w-4" />,
      status:
        (dashboardState?.summaryMetrics?.activeQueue || 0) > 15
          ? ("warning" as const)
          : ("normal" as const),
    },
    {
      metric: "Terlambat Tiba (No Show)",
      value: dashboardState?.summaryMetrics.delayedBookings,
      icon: <AlertTriangle className="h-4 w-4" />,
      status:
        (dashboardState?.summaryMetrics.delayedBookings || 0) > 5
          ? ("critical" as const)
          : ("warning" as const),
    },
  ];

  const subMetrics = [
    {
      metric: "Selesai",
      value: dashboardState?.summaryMetrics.completedToday,
      icon: <CheckCircle className="h-4 w-4" />,
      status: "normal" as const,
    },
    {
      metric: "Utilisasi Gudang",
      value: `${dashboardState?.summaryMetrics.dockUtilizationPercent}%`,
      icon: <Activity className="h-4 w-4" />,
      status:
        (dashboardState?.summaryMetrics.dockUtilizationPercent || 0) > 85
          ? ("warning" as const)
          : ("normal" as const),
      tooltip:
        "Beban kerja dock rata-rata : Unloading (100%), In Progress (80%).",
    },
    {
      metric: "Rata-rata Bongkar",
      value: `${dashboardState?.summaryMetrics.avgProcessingMinutes}m`,
      icon: <History className="h-4 w-4" />,
      status:
        (dashboardState?.summaryMetrics.avgProcessingMinutes || 0) > 45
          ? ("warning" as const)
          : ("normal" as const),
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
        <div className="flex justify-between items-center mb-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-[500px] w-full rounded-xl" />
          <Skeleton className="h-[500px] lg:col-span-2 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Dynamic Header with Glassmorphism */}
      <header
        className={`sticky top-0 w-full transition-all duration-300 ${scrolled ? "bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-800" : "bg-transparent"}`}
      >
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Operations Control
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <Building className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase letter tracking-wider">
                  {userInfo?.homeWarehouse?.name} Warehouse
                </span>
              </div>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                Monitoring Rangkuman Laporan Singkat Gudang Anda
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800">
              {dashboardState?.connection.isConnected ? (
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </div>
              ) : (
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
              )}
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">
                {dashboardState?.connection.isConnected
                  ? "Live Sync"
                  : "Sync Error"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              <Clock className="h-4 w-4 opacity-70" />
              <span>
                Updated{" "}
                {formatRelativeTime(dashboardState?.summaryMetrics.lastUpdated)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-8 pb-20">
        {/* Metrics Grid */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mainMetrics.map((card, index) => (
              <SummaryCard
                key={index}
                metric={card.metric}
                value={card.value}
                status={card.status}
                icon={card.icon}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subMetrics.map((card, index) => (
              <SummaryCard
                key={index}
                metric={card.metric}
                value={card.value}
                status={card.status}
                icon={card.icon}
                tooltip={card.tooltip}
              />
            ))}
          </div>
        </section>

        {/* Operational View */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Dock Status: Visualizing the warehouse floor */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="text-blue-500" size={20} /> Warehouse Gates
              </h2>
              <a
                href="/antrian/admin/queue"
                className="group text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-all"
              >
                Manage Queue{" "}
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dashboardState?.dockStatuses?.map((statusData) => (
                <DockStatusSection key={statusData.dockId} dock={statusData} />
              ))}
            </div>
          </div>

          {/* Queue Snapshot: Actionable insights */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <History className="text-amber-500" size={20} /> Priority Queue
                Snapshot
              </h2>
              <a
                href="/antrian/admin/my-warehouse"
                className="group text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-all"
              >
                Full History{" "}
                <ChevronRight
                  size={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </a>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Gate
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Booking Code
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Truck Info
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Vendor
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Schedule
                      </th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Real Arrival
                      </th>
                      <th className="px-5 py-4 text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Est. Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {dashboardState?.queueSnapshot &&
                    dashboardState.queueSnapshot.length > 0 ? (
                      dashboardState.queueSnapshot
                        .slice(0, 5)
                        .map((booking, index) => (
                          <QueueTableRow
                            key={booking.id || booking.code || index}
                            booking={booking}
                            onClick={() => {
                              setSelectedBookingId(booking.id);
                              (
                                document.getElementById(
                                  "my-warehouse-action-modal",
                                ) as HTMLDialogElement
                              )?.showModal();
                            }}
                          />
                        ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-5 py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full">
                              <Package className="h-8 w-8 text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-400">
                              Belum ada antrian yang dijadwalkan hari ini.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Analytics Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Activity className="text-emerald-500" size={20} /> Performance
            Analytics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboardState?.kpiData?.queueLengthTimeline && (
              <SparklineChart
                data={dashboardState?.kpiData?.queueLengthTimeline}
                title="Antrian 4 Jam Terakhir"
                color="blue"
              />
            )}

            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6">
                Throughput Per Gate
              </h3>
              <div className="space-y-4">
                {dashboardState?.kpiData?.dockThroughput.map((item, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {item.dock}
                      </span>
                      <span className="font-mono text-gray-500">
                        {item.completed} comp.
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-1000"
                        style={{
                          width: `${Math.min(100, (item.completed / 15) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <QueueDetailModal
        selectedBookingId={selectedBookingId || ""}
        setSelectedBookingId={setSelectedBookingId}
        key={"QueueDetailModalCreate"}
        mode="create"
      />
      <Suspense fallback={<Loading />}>
        <MyWarehouseActionModal
          key={"MyWarehouseActionModal"}
          onModifyAndConfirm={() => toast.info("Fitur sedang dihubungkan")}
          selectedBooking={dashboardState?.queueSnapshot.find(
            (booking) => booking.id === selectedBookingId,
          )}
        />
      </Suspense>
    </div>
  );
};

export default DashboardAdmin;

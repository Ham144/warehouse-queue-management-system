"use client";

import { useQuery } from "@tanstack/react-query";
import { BookingApi } from "@/api/booking.api";
import { useUserInfo } from "@/components/UserContext";
import { ROLE } from "@/types/shared.type";
import {
  BookOpen,
  BarChart3,
  AlertTriangle,
  MessageCircleWarning,
} from "lucide-react";
import { VendorDashboardState } from "@/types/vendor-dashboard.type";

export default function VendorDashboard() {
  const { userInfo } = useUserInfo();
  const isAdminVendor = userInfo?.role == ROLE.ADMIN_VENDOR;

  const { data, isLoading } = useQuery<VendorDashboardState>({
    queryKey: ["vendor-dashboard"],
    queryFn: async () => await BookingApi.getStatsForAdminVendor(),
    refetchInterval: 10000,
    enabled: !!isAdminVendor,
  });

  if (!isAdminVendor) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <MessageCircleWarning className="text-red-500" />
          <span className="text-lg font-semibold">
            Ini adalah menu admin vendor
          </span>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-ring loading-lg" />
      </div>
    );
  }

  const {
    summaryMetrics,
    operationalSnapshotToday,
    warehouseBreakdown,
    kpiData,
  } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className=" mx-auto p-6 space-y-6">
        <div role="alert" className="alert  alert-error w-full bg-red-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Page ini sedang dalam pengembangan, masih dalam tahap awal.
          </span>
        </div>
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Vendor Dashboard
            </h1>

            <p className="text-sm text-gray-500">
              Ringkasan performa booking ke berbagai warehouse.
            </p>
          </div>
          <div className="text-xs text-gray-500">
            Last updated:{" "}
            {new Date(summaryMetrics.lastUpdated).toLocaleString("id-ID")}
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCardSimple
            icon={<BookOpen className="w-4 h-4" />}
            label="Booking (30 hari)"
            value={summaryMetrics.totalBookingsInRange}
          />
          <SummaryCardSimple
            icon={<BarChart3 className="w-4 h-4" />}
            label="Warehouse Aktif"
            value={summaryMetrics.totalWarehouses}
          />
          <SummaryCardSimple
            icon={<BookOpen className="w-4 h-4" />}
            label="Aktif Hari Ini"
            value={summaryMetrics.activeToday}
          />
          <SummaryCardSimple
            icon={<BarChart3 className="w-4 h-4" />}
            label="On-Time Rate"
            value={`${summaryMetrics.onTimeRatePercent}%`}
          />
        </section>

        {/* Main grid */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Operational Snapshot Today */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Operational Snapshot Today
                </h2>
                <p className="text-xs text-gray-500">
                  Booking yang berjalan & akan berjalan hari ini.
                </p>
              </div>
            </div>
            <div className="p-4">
              {operationalSnapshotToday.todayQueue.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Belum ada booking aktif untuk hari ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {operationalSnapshotToday.todayQueue.map((item) => (
                    <div
                      key={item.bookingId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                    >
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {item.code}{" "}
                          <span className="text-xs text-gray-500">
                            • {item.warehouseName}
                            {item.dockName ? ` / ${item.dockName}` : ""}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(item.arrivalTime).toLocaleTimeString(
                            "id-ID",
                            { hour: "2-digit", minute: "2-digit" },
                          )}{" "}
                          -{" "}
                          {new Date(
                            item.estimatedFinishTime,
                          ).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {item.vehicleBrand} • {item.vehicleType} •{" "}
                          {item.driverName}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                          {item.status}
                        </span>
                        {item.isOverdue && (
                          <span className="text-xs text-red-600">
                            Terlambat {item.overdueMinutes} menit
                          </span>
                        )}
                        {!item.isOverdue &&
                          item.waitingMinutes !== undefined && (
                            <span className="text-xs text-gray-500">
                              Menunggu {item.waitingMinutes} menit
                            </span>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Warehouse Performance & Alerts */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Warehouse Performance
                </h2>
                <p className="text-xs text-gray-500">
                  Performa per warehouse (30 hari).
                </p>
              </div>
              <div className="p-4 space-y-3">
                {warehouseBreakdown.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Belum ada data booking di periode ini.
                  </p>
                ) : (
                  warehouseBreakdown.map((w) => (
                    <div
                      key={w.warehouseId}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {w.warehouseName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {w.totalBookings} booking • {w.completedInRange}{" "}
                          selesai • {w.canceledInRange} batal
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {w.onTimeRatePercent}%
                        </p>
                        <p className="text-xs text-gray-500">
                          On-time • Avg unload {w.avgUnloadingMinutes}m
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Alerts Terbaru
                </h2>
              </div>
              <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                no content
              </div>
            </div>
          </div>
        </section>

        {/* Simple KPI section (textual) */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-gray-700" />
            <h2 className="text-sm font-semibold text-gray-900">
              KPI & Trends (ringkas)
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Data lengkap tersedia di endpoint, bisa di-upgrade ke chart kapan
            saja.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
            <div>
              <p className="font-semibold mb-1">Total per hari</p>
              <p>
                {kpiData.bookingsPerDay.length} hari tercatat dalam 30 hari
                terakhir.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">On-time timeline</p>
              <p>
                {kpiData.onTimeRateTimeline.length} titik data on-time rate.
              </p>
            </div>
            <div>
              <p className="font-semibold mb-1">Distribusi warehouse</p>
              <p>
                {kpiData.warehouseDistribution.length} warehouse dengan booking
                aktif di periode ini.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

interface SummaryCardSimpleProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

function SummaryCardSimple({ icon, label, value }: SummaryCardSimpleProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
      </div>
      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
        {icon}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
} from "lucide-react";
DateRangePicker;
import { subDays } from "date-fns";
import DateRangePicker from "@/components/shared-common/DateRangePicker";
import { toast } from "sonner";
import { BookingApi } from "@/api/booking.api";
import Loading from "@/components/shared-common/Loading";
import { useUserInfo } from "@/components/UserContext";
import { ROLE } from "@/types/shared.type";

// Types
interface ReportsData {
  onTimeDeliveryRate: number;
  averageUnloadTime: number;
  noShows: number;
  totalBooking: number;
  dockPerformances: Array<{
    id: string;
    name: string;
    totalBooking: number;
    onTimeDeliveryRate: number;
    averageUnloadTime: number;
    noShows: number;
    canceled: number;
  }>;
  trends: TrendInfo;
  kpi: {
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
  }[];
}

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface TrendInfo {
  value: string;
  direction: "up" | "down" | "stable";
  percentage: number;
  isPositive: boolean;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [currentData, setCurrentData] = useState<ReportsData | null>(null);
  const [previousData, setPreviousData] = useState<ReportsData | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subDays(new Date(), 6), // 7 hari terakhir termasuk hari ini
    endDate: new Date(),
  });
  const { userInfo } = useUserInfo();

  // Fetch data untuk periode tertentu
  const fetchReportsData = async (
    start: Date,
    end: Date,
    isKpiInclude,
  ): Promise<ReportsData> => {
    try {
      const data = await BookingApi.adminWarehouseReports({
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        isKpiInclude: isKpiInclude,
      });
      return data;
    } catch (error) {
      console.error("Failed to fetch reports:", error);
      throw error;
    }
  };

  // Hitung periode sebelumnya berdasarkan periode saat ini
  const getPreviousPeriod = useCallback((start: Date, end: Date): DateRange => {
    const durationMs = end.getTime() - start.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);

    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - durationDays + 1);

    return { startDate: previousStart, endDate: previousEnd };
  }, []);

  // Fetch data untuk periode saat ini dan sebelumnya
  const fetchReports = async () => {
    try {
      setLoading(true);

      const previousPeriod = getPreviousPeriod(
        dateRange.startDate,
        dateRange.endDate,
      );

      // Fetch data secara paralel
      const [currentResult, previousResult] = await Promise.all([
        fetchReportsData(dateRange.startDate, dateRange.endDate, true),
        fetchReportsData(
          previousPeriod.startDate,
          previousPeriod.endDate,
          false,
        ),
      ]);

      setCurrentData(currentResult);
      setPreviousData(previousResult);
    } catch (error) {
      console.error("Failed to load reports:", error);
      toast.error("Failed to load reports data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  // Hitung trend dari data current vs previous
  const calculateTrend = (current: number, previous: number): TrendInfo => {
    if (previous === 0) {
      return {
        value: current > 0 ? "New" : "No change",
        direction: current > 0 ? "up" : "stable",
        percentage: current > 0 ? 100 : 0,
        isPositive: current > 0,
      };
    }

    const percentage = ((current - previous) / previous) * 100;
    const direction = percentage >= 0 ? "up" : "down";

    // Tentukan apakah trend positif berdasarkan metrik
    let isPositive = percentage >= 0;

    // Untuk averageUnloadTime: angka lebih kecil = lebih baik
    // Untuk noShows: angka lebih kecil = lebih baik
    // Logika ini akan dihandle di keyMetrics

    return {
      value: `${Math.abs(percentage).toFixed(1)}%`,
      direction,
      percentage: Math.abs(percentage),
      isPositive,
    };
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
  };

  const handleExport = (format: "csv" | "pdf") => {
    toast.success(`Export ${format.toUpperCase()} feature coming soon`);
  };

  // Prepare key metrics dengan trend
  const keyMetrics = currentData
    ? [
        {
          metric: "Total Bookings",
          value: currentData.totalBooking.toString(),
          trend: previousData
            ? calculateTrend(
                currentData.totalBooking,
                previousData.totalBooking,
              )
            : {
                value: "No data",
                direction: "stable",
                percentage: 0,
                isPositive: true,
              },
          period: "vs last period",
        },
        {
          metric: "On-Time Delivery Rate",
          value: `${currentData.onTimeDeliveryRate.toFixed(1)}%`,
          trend: previousData
            ? calculateTrend(
                currentData.onTimeDeliveryRate,
                previousData.onTimeDeliveryRate,
              )
            : {
                value: "No data",
                direction: "stable",
                percentage: 0,
                isPositive: true,
              },
          period: "vs last period",
        },
        {
          metric: "Avg Unload Time",
          value: `${currentData.averageUnloadTime.toFixed(1)} min`,
          trend: previousData
            ? calculateTrend(
                currentData.averageUnloadTime,
                previousData.averageUnloadTime,
              )
            : {
                value: "No data",
                direction: "stable",
                percentage: 0,
                isPositive: true,
              },
          period: "vs last period",
        },
        {
          metric: "No Shows (Tidak Datang)",
          value: currentData.noShows.toString(),
          trend: previousData
            ? calculateTrend(currentData.noShows, previousData.noShows)
            : {
                value: "No data",
                direction: "stable",
                percentage: 0,
                isPositive: true,
              },
          period: "vs last period",
        },
      ]
    : [];

  // Adjust trend positivity berdasarkan metrik
  const adjustedKeyMetrics = keyMetrics.map((metric) => {
    let isPositiveTrend = metric.trend.isPositive;

    // Untuk Avg Unload Time: trend naik (angka lebih besar) = buruk
    if (metric.metric === "Avg Unload Time") {
      isPositiveTrend = !isPositiveTrend;
    }

    // Untuk No Shows: trend naik (angka lebih besar) = buruk
    if (metric.metric === "No Shows") {
      isPositiveTrend = !isPositiveTrend;
    }

    return {
      ...metric,
      trend: {
        ...metric.trend,
        isPositive: isPositiveTrend,
      },
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className=" bg-gradient-to-br from-gray-50 to-gray-100 ">
        <main className="overflow-y-auto px-3 max-h-screen pb-7">
          <div className="space-y-8">
            {/* Header with enhanced design */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200/50">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                  Reports & Analytics
                </h1>
                <p className="text-gray-500 flex items-center gap-2">
                  <Calendar size={18} className="text-gray-400" />
                  {dateRange.startDate.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}{" "}
                  -{" "}
                  {dateRange.endDate.toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {previousData && (
                    <span className="text-sm bg-blue-50 text-blue-600 px-2 py-1 rounded-full">
                      vs previous{" "}
                      {Math.ceil(
                        (dateRange.endDate.getTime() -
                          dateRange.startDate.getTime()) /
                          (1000 * 60 * 60 * 24),
                      )}{" "}
                      days
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <DateRangePicker
                  value={dateRange}
                  onChange={handleDateRangeChange}
                  className="bg-white border-gray-200 rounded-xl"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport("csv")}
                    className="px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                  >
                    <Download size={18} /> CSV
                  </button>
                  <button
                    onClick={() => handleExport("pdf")}
                    className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled
                  >
                    <Download size={18} /> PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Key Metrics with enhanced cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {adjustedKeyMetrics.map((metric, i) => (
                <div
                  key={i}
                  className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200"
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">
                        {metric.metric}
                      </p>
                      <div
                        className={`p-2 rounded-xl ${
                          metric.trend.direction === "up"
                            ? "bg-green-50"
                            : metric.trend.direction === "down"
                              ? "bg-red-50"
                              : "bg-gray-50"
                        }`}
                      >
                        {metric.trend.direction === "up" ? (
                          <TrendingUp size={20} className="text-green-600" />
                        ) : metric.trend.direction === "down" ? (
                          <TrendingDown size={20} className="text-red-600" />
                        ) : (
                          <span className="w-5 h-5 block" />
                        )}
                      </div>
                    </div>
                    <p className="text-4xl font-bold mt-3 text-gray-900">
                      {metric.value}
                    </p>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                      <span
                        className={`text-sm font-semibold flex items-center gap-1 ${
                          metric.trend.direction === "stable"
                            ? "text-gray-600"
                            : metric.trend.isPositive
                              ? "text-green-600"
                              : "text-red-600"
                        }`}
                      >
                        {metric.trend.value}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                        {metric.period}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dock Performance Table with enhanced design */}
            {currentData?.dockPerformances &&
            currentData.dockPerformances.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-primary to-primary-dark rounded-full"></span>
                    Dock Performance
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                          Dock
                        </th>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                          Bookings
                        </th>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                          Avg Unload Time
                        </th>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                          On-Time Rate
                        </th>
                        <th className="py-4 px-6 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider">
                          Canceled
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentData.dockPerformances.map((dock, index) => (
                        <tr
                          key={dock.id}
                          className="hover:bg-gray-50/50 transition-colors group"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary font-semibold">
                                {index + 1}
                              </span>
                              <span className="font-semibold text-gray-900">
                                {dock.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-gray-700">
                            {dock.totalBooking}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-gray-400" />
                              <span className="text-gray-700">
                                {dock.averageUnloadTime.toFixed(1)} min
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1 ${
                                dock.onTimeDeliveryRate >= 90
                                  ? "bg-green-50 text-green-700"
                                  : dock.onTimeDeliveryRate >= 80
                                    ? "bg-yellow-50 text-yellow-700"
                                    : "bg-red-50 text-red-700"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  dock.onTimeDeliveryRate >= 90
                                    ? "bg-green-500"
                                    : dock.onTimeDeliveryRate >= 80
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                }`}
                              ></span>
                              {dock.onTimeDeliveryRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-gray-700 font-medium">
                              {dock.canceled}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-12">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <span className="text-3xl">📊</span>
                  </div>
                  <p className="text-gray-500 font-medium">
                    No dock performance data available
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    for the selected period
                  </p>
                </div>
              </div>
            )}

            {/* KPI Stats Table - Enhanced and Fixed */}
            {[ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION].includes(
              ROLE[userInfo.role],
            ) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 overflow-hidden ">
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <span className="w-1 h-6 bg-gradient-to-b from-primary to-primary-dark rounded-full"></span>
                      KPI Statistics
                    </h2>
                    <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-sm font-medium">
                      {currentData?.kpi?.length || 0} Users
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="py-4 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          No
                        </th>
                        <th className="py-4 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="py-4 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Vendor
                        </th>
                        <th className="py-4 px-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Last Activity
                        </th>
                        <th className="py-4 px-4  text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                          Finished
                        </th>
                        <th className="py-4 px-4  text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                          Canceled
                        </th>
                        <th className="py-4 px-4  text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                          In Progress
                        </th>
                        <th className="py-4 px-4  text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                          Created
                        </th>
                        <th className="py-4 px-4  text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                          Field Changes
                        </th>
                        <th className="py-4 px-4  text-xs font-semibold text-gray-600 uppercase tracking-wider text-center">
                          Total Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentData?.kpi && currentData.kpi.length > 0 ? (
                        currentData.kpi.map((kpi, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <span className="w-6 h-6 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-medium text-gray-900">
                                {kpi.username}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                                  kpi.vendor === "INTERNAL"
                                    ? "bg-blue-50 text-blue-700"
                                    : "bg-purple-50 text-purple-700"
                                }`}
                              >
                                {kpi.vendor}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-900">
                                  {new Date(
                                    kpi.tanggalAktifitasTerakhir,
                                  ).toLocaleDateString("id-ID", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {kpi.jamAktifitasTerakhir}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                                {kpi.FINISHED}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 text-sm font-medium">
                                {kpi.CANCELED}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-yellow-50 text-yellow-700 text-sm font-medium">
                                {kpi.IN_PROGRESS}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-gray-900 font-medium">
                                {kpi.totalCreated}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-gray-900 font-medium">
                                {kpi.perubahanLapangan}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-gray-900 font-medium">
                                {kpi.qtyAll}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={10} className="py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-4xl">📋</span>
                              <p className="text-gray-500 font-medium">
                                No KPI data available
                              </p>
                              <p className="text-sm text-gray-400">
                                for the selected period
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </Suspense>
  );
}

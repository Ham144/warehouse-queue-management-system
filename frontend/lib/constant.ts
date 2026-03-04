import { IDock } from "@/types/dock.type";

//Backend Polling & socket di port yg sama
export const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.169.12:3000/antrian";

export const DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

export const normalizeDate = (d: Date) => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};

export const FormatTimeIndonesian = (date: Date) => {
  return new Date(date).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export interface DashboardState {
  summaryMetrics: {
    totalBookingsToday: number;
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
    status: "IDLE" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
    bookingCode?: string;
    vendorName?: string;
    estimatedFinishTime?: string;
    remainingMinutes: number;
    isOverdue: boolean;
    colorStatus: "green" | "yellow" | "red";
  }>;

  queueSnapshot: Array<{
    bookingId: string;
    code: string;
    vendorName: string;
    arrivalTime: string;
    estimatedFinishTime: string;
    status: "WAITING" | "ASSIGNED" | "ARRIVED";
    dock: IDock;
    isOverdue: boolean;
    waitingMinutes: number;
  }>;

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

export const RoleExplanation = {
  ADMIN_VENDOR:
    "Role untuk user pihak vendor yang akan melakukan permintaan kunjungan.",

  DRIVER_VENDOR:
    "Driver hanya dapat mengonfirmasi kedatangan dan mengikuti arahan gate yang ditampilkan pada dashboard driver.",

  ADMIN_ORGANIZATION: "Role dengan level akses tertinggi tanpa batasan fitur.",

  USER_ORGANIZATION:
    "Role untuk procurement atau user yang bertugas melakukan konfirmasi booking serta mengelola ADMIN_GUDANG.",

  ADMIN_GUDANG:
    "Role untuk user yang melakukan supervisi operasional di lapangan. Beberapa fungsionalitas aplikasi tidak tersedia untuk role ini.",
};

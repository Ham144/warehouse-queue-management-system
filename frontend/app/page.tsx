"use client";

import { AuthApi } from "@/api/auth";
import { OrganizationApi } from "@/api/organization.api";
import Loading from "@/components/shared-common/Loading";
import { useUserInfo } from "@/components/UserContext";
import { ROLE } from "@/types/shared.type";
import { useQuery } from "@tanstack/react-query";
import {
  Building,
  Truck,
  Calendar,
  Clock,
  BarChart3,
  CheckCircle,
  PlayCircle,
  Package,
  Warehouse,
  CalendarClock,
  Car,
  UserCog,
  DockIcon,
  CheckCheck,
  Brain,
  CarTaxiFront,
  ArchiveRestore,
  PlusCircle,
  Lock,
  Users,
  FileText,
  Activity,
  Move,
  SlidersHorizontal,
  Bell,
  DoorOpen,
  Building2,
  MapPin,
  MessageCircle,
  BookA,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";

export default function HomePage() {
  const { setUserInfo } = useUserInfo();
  const { data: userInfo } = useQuery({
    queryKey: ["user-info"],
    queryFn: async () => {
      {
        const res = await AuthApi.getUserInfo();
        setUserInfo(res);
        return res;
      }
    },
  });

  const [stats, setStats] = useState([
    {
      label: "Total Gudang Terdaftar",
      value: 0,
      icon: Building,
      description: "Gudang aktif",
      key: "totalWarehouse",
    },
    {
      label: "Gate Aktif Terdaftar",
      value: 0,
      icon: DockIcon,
      description: "Kapasitas tersedia",
      key: "activeSlot",
    },
    {
      label: "IN PROGRESS Booking Hari Ini",
      value: 0,
      icon: Calendar,
      description: "Kunjungan terjadwal",
      key: "bookedToday",
    },
    {
      label: "Finish Booking",
      value: 0,
      icon: CheckCheck,
      description: "Keseluruhan",
      key: "succeedBooking",
    },
  ]);

  const { data: statsData, isLoading: isLoadingStats } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const data = await OrganizationApi.getLandingPage();
      return data;
    },
    staleTime: 3 * 60_000 * 24, // 3 days
  });

  function statsMapping() {
    if (statsData) {
      setStats((prev) => {
        return prev?.map((stat) => {
          return {
            ...stat,
            value: statsData[stat.key],
          };
        });
      });
    }
  }

  useEffect(() => {
    statsMapping();
  }, [statsData]);

  const features = [
    // Fitur existing yang dipertahankan
    {
      title: "Booking Management",
      desc: "Atur jadwal kunjungan vendor dengan pemilihan warehouse dan slot",
      icon: CalendarClock,
      color: "bg-blue-500",
    },
    {
      title: "Warehouse Setup",
      desc: "Kelola data gudang, kapasitas, dan informasi operasional",
      icon: Warehouse,
      color: "bg-green-500",
    },
    {
      title: "Slot Management",
      desc: "Atur dock bongkar muat dan status ketersediaan slot",
      icon: Package,
      color: "bg-purple-500",
    },

    {
      title: "Vehicle Setup",
      desc: "Daftar kendaraan vendor dengan estimasi waktu bongkar muat",
      icon: Car,
      color: "bg-orange-500",
    },
    {
      title: "Queue Monitoring",
      desc: "Pantau antrian real-time dan estimasi waktu penyelesaian",
      icon: BarChart3,
      color: "bg-red-500",
    },
    {
      title: "User Management",
      desc: "Kelola akses pengguna dan role berdasarkan kebutuhan",
      icon: UserCog,
      color: "bg-gray-500",
    },

    // Fitur-fitur baru berdasarkan requirements
    {
      title: "Live Queue Drag & Drop",
      desc: "Drag booking antar status: IN_PROGRESS → UNLOADING, DELAYED → UNLOADING, antar dock, dan canceled",
      icon: Move, // atau GripVertical icon
      color: "bg-indigo-500",
    },
    {
      title: "Busy Time Analytics",
      desc: "Analisis waktu sibuk warehouse dengan visualisasi grafik dan prediksi",
      icon: Activity,
      color: "bg-pink-500",
    },
    {
      title: "Complete Reports",
      desc: "Laporan lengkap untuk admin dan vendor dengan export Excel/PDF",
      icon: FileText,
      color: "bg-amber-500",
    },
    // Realtime communication
    {
      title: "Realtime Messenger",
      desc: "Chat realtime antar vendor, warehouse, dan driver dengan notifikasi instan",
      icon: MessageCircle,
      color: "bg-sky-500",
    },
    {
      title: "Driver GPS Tracking",
      desc: "Pantau posisi kendaraan secara realtime untuk estimasi kedatangan yang lebih akurat",
      icon: MapPin,
      color: "bg-emerald-600",
    },

    // Organization level control
    {
      title: "Organization Management",
      desc: "Kelola multi organisasi, warehouse, dan struktur operasional dalam satu platform",
      icon: Building2,
      color: "bg-indigo-600",
    },
    {
      title: "Member Access Control",
      desc: "Role-based access control untuk admin, vendor, dan driver",
      icon: Users,
      color: "bg-cyan-600",
    },

    // Operational control
    {
      title: "Gate Operational Control",
      desc: "Kontrol operasional gate secara realtime termasuk open/close, maintenance, dan overload control",
      icon: DoorOpen,
      color: "bg-rose-500",
    },
    {
      title: "Smart Notification & Alerts",
      desc: "Notifikasi otomatis untuk keterlambatan, perubahan slot, dan kondisi operasional penting",
      icon: Bell,
      color: "bg-yellow-500",
    },

    // System level
    {
      title: "Global Rules Engine",
      desc: "Pengaturan aturan global seperti delay tolerance, booking policy, dan operational rules",
      icon: SlidersHorizontal,
      color: "bg-gray-700",
    },
    {
      title: "Driver Operations Module",
      desc: "Dashboard khusus driver untuk check-in, arrival confirmation, dan instruksi gate",
      icon: Truck,
      color: "bg-orange-600",
    },

    {
      title: "Multi-Tenancy",
      desc: "Dukungan multi-tenant dengan isolasi data per perusahaan",
      icon: Building,
      color: "bg-cyan-500",
    },
    {
      title: "Unlimited Vendor Users",
      desc: "Tidak ada batasan jumlah user vendor dengan role-based access",
      icon: Users,
      color: "bg-teal-500",
    },
    {
      title: "Warehouse Lock Settings",
      desc: "Pengaturan kunci per warehouse untuk maintenance atau downtime",
      icon: Lock,
      color: "bg-rose-500",
    },
    {
      title: "Auto Efficient Time Picker",
      desc: "Sistem rekomendasi waktu booking otomatis berdasarkan efisiensi",
      icon: Clock,
      color: "bg-emerald-500",
    },
    {
      title: "Unlimited Warehouse Creation",
      desc: "Tambah warehouse tanpa batas dengan konfigurasi fleksibel",
      icon: PlusCircle,
      color: "bg-lime-500",
    },
    {
      title: "Vehicle Type Rules",
      desc: "Aturan khusus berdasarkan tipe kendaraan untuk waktu bongkar muat",
      icon: CarTaxiFront,
      color: "bg-violet-500",
    },
    {
      title: "Smart Queue Positioning",
      desc: "Penempatan otomatis dengan smart check before/after di antrian",
      icon: Brain,
      color: "bg-fuchsia-500",
    },
    {
      title: "Canceled Inventory Management",
      desc: "Kelola booking canceled dan kembalikan ke antrian dengan smart positioning",
      icon: ArchiveRestore,
      color: "bg-slate-600",
    },
  ];

  return (
    <Suspense fallback={<Loading />}>
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 max-h-screen overflow-auto ">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-r from-teal-600 via-teal-700 to-green-200 text-white py-16 md:py-24">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-sm mb-6">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Catur Sukses Internasional
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Sistem Antrian Gudang & Manajemen
              <span className="block text-teal-200">Bongkar Muatan</span>
            </h1>

            <p className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto mb-8 leading-relaxed">
              Kelola antrian vendor, jadwal bongkar muat, dan slot gudang dengan
              sistem terintegrasi yang efisien
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href={
                  userInfo?.role === ROLE.ADMIN_ORGANIZATION
                    ? "/admin/member-management"
                    : userInfo?.role === ROLE.USER_ORGANIZATION
                      ? "/admin/my-warehouse"
                      : userInfo?.role === ROLE.ADMIN_VENDOR
                        ? "/vendor/booking"
                        : userInfo?.role === ROLE.DRIVER_VENDOR
                          ? "/vendor/driver-menu"
                          : userInfo?.role === ROLE.ADMIN_GUDANG
                            ? "/admin/dashboard"
                            : "/forbidden"
                }
                onClick={(e) => {
                  if (!userInfo) {
                    e.preventDefault();
                  }
                  if (!userInfo) {
                    (
                      document.getElementById(
                        "login_modal",
                      ) as HTMLDialogElement
                    ).showModal();
                  }
                }}
                className="btn btn-lg bg-white text-blue-700 hover:bg-gray-100 border-0 font-semibold px-8 gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                {userInfo?.role === ROLE.ADMIN_ORGANIZATION ||
                userInfo?.role === ROLE.USER_ORGANIZATION ||
                userInfo?.role === ROLE.ADMIN_GUDANG
                  ? "Lihat Dashboard Admin"
                  : userInfo?.role === ROLE.ADMIN_VENDOR
                    ? "Mulai Order"
                    : userInfo?.role === ROLE.DRIVER_VENDOR
                      ? "Lihat Rencana"
                      : "Mulai Order"}
              </Link>
              <Link
                href={"/documentation"}
                className="btn btn-lg bg-slate-200 text-blue-900 hover:bg-gray-100 border-0 font-semibold px-8 gap-2"
              >
                <BookA className="w-5 h-5" />
                Dokumentasi
              </Link>
            </div>
          </div>
        </section>
        {/* Stats Section */}
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {!isLoadingStats &&
                stats?.map((stat, index) => (
                  <div
                    key={stat.label}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`p-3 rounded-xl ${
                          index === 0
                            ? "bg-blue-100 dark:bg-blue-900/30"
                            : index === 1
                              ? "bg-green-100 dark:bg-green-900/30"
                              : index === 2
                                ? "bg-purple-100 dark:bg-purple-900/30"
                                : "bg-orange-100 dark:bg-orange-900/30"
                        }`}
                      >
                        <stat.icon
                          className={`w-6 h-6 ${
                            index === 0
                              ? "text-blue-600 dark:text-blue-400"
                              : index === 1
                                ? "text-green-600 dark:text-green-400"
                                : index === 2
                                  ? "text-purple-600 dark:text-purple-400"
                                  : "text-orange-600 dark:text-orange-400"
                          }`}
                        />
                      </div>
                    </div>

                    <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                      {stat.value}
                    </h3>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      {stat.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {stat.description}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </section>
        {/* Features Grid */}
        <section className="py-12 md:py-16 bg-green-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Modul Sistem Terintegrasi
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Akses semua fitur manajemen antrian dan operasional gudang dalam
                satu platform
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features?.map((feature) => (
                <Link
                  key={feature.title}
                  href={"/"}
                  className="group bg-gray-50 dark:bg-gray-700 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-600 hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`p-3 rounded-xl ${feature.color} group-hover:scale-110 transition-transform duration-300`}
                    >
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
        {/* Footer */}
        <footer className="bg-gray-900 text-white py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <div className="p-2 bg-teal-600 rounded-lg">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">Warehouse Queue System</p>
                  <p className="text-sm text-gray-400">
                    PT Catur Sukses Internasional
                  </p>
                </div>
              </div>

              <div className="text-center md:text-right">
                <p className="text-gray-400 text-sm">
                  © {new Date().getFullYear()} — Sistem Manajemen Antrian Vendor
                  v2.1
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Terintegrasi & Teroptimasi untuk Operasional Logistik
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </Suspense>
  );
}

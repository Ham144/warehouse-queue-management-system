"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  WarehouseIcon,
  MapPin,
  Calendar,
  Activity,
  CheckCircle,
  User2,
  Car,
  DockIcon,
  Truck,
  ArrowLeft,
  Info,
  MessageCircleWarning,
  Clock,
  Dock,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { WarehouseApi } from "@/api/warehouse.api";
import { VehicleApi } from "@/api/vehicle.api";
import { DockApi } from "@/api/dock.api";
import { Booking } from "@/types/booking.type";
import { Warehouse } from "@/types/warehouse";
import { IFilterVehicle, IVehicle } from "@/types/vehicle";
import { IDock } from "@/types/dock.type";
import { useRouter, useSearchParams } from "next/navigation";
import PreviewSlotDisplay from "@/components/vendor/PreviewSlotDisplay";
import { BookingApi } from "@/api/booking.api";
import { AuthApi } from "@/api/auth";
import { UserApp } from "@/types/auth";
import { BaseProps, BasePropsInit, ROLE } from "@/types/shared.type";
import { useUserInfo } from "@/components/UserContext";

type BookingStep = "warehouse" | "driver" | "vehicle" | "dock" | "confirmation";

export const dynamic = "force-dynamic"; // penting untuk URLsearcparams

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-16">
    <span className="loading loading-spinner loading-lg text-primary"></span>
  </div>
);

export default function BookingPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const [bookingStep, setBookingStep] = useState<BookingStep>("warehouse");
  const [isBookCompleted, setIsBookCompleted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter states
  const [filterWarehouse, setFilterWarehouse] =
    useState<BaseProps>(BasePropsInit);
  const [filterVehicles, setFilterVehicles] = useState<IFilterVehicle>({
    page: 1,
    searchKey: "",
    selectedWarehouseId: "",
  });
  const [filterDriver, setFilterDriver] = useState<BaseProps>(BasePropsInit);

  // Form state
  const [formData, setFormData] = useState<Booking>({
    vehicleId: "",
    warehouseId: "",
    dockId: "",
    arrivalTime: null,
    driverUsername: "",
    notes: "",
    estimatedFinishTime: null,
  });

  const { userInfo } = useUserInfo();
  const isVendor = userInfo?.role == ROLE.ADMIN_VENDOR;

  // URL params
  const driverUsernameParam = searchParams.get("driverUsername");
  const vehicleIdParam = searchParams.get("vehicleId");
  const warehouseIdParam = searchParams.get("warehouseId");
  const dockIdParam = searchParams.get("dockId");

  // Queries
  const { data: warehouses = [], isLoading: loadingWarehouses } = useQuery({
    queryKey: ["warehouses", filterWarehouse],
    queryFn: () => WarehouseApi.getWarehouses(filterWarehouse),
    enabled: bookingStep === "warehouse",
  });

  const { data: vendorVehicles = [], isLoading: isLoadingVendorVehicles } =
    useQuery({
      queryKey: [filterVehicles, formData?.warehouseId],
      queryFn: () => VehicleApi.getVehicles(filterVehicles),
      enabled: !!(bookingStep === "vehicle" && formData?.warehouseId),
    });

  const { data: myDrivers, isLoading: isLoadingMyDrivers } = useQuery({
    queryKey: ["my-drivers", filterDriver],
    queryFn: () => AuthApi.getAllMyDrivers(filterDriver),
    enabled: bookingStep === "driver",
  });

  const { data: activeDocks, isLoading: loadingDocks } = useQuery({
    queryKey: ["docks", formData.warehouseId],
    queryFn: () => DockApi.getDocksByWarehouseId(formData.warehouseId),
    enabled: bookingStep === "dock",
  });

  // Mutations
  const {
    mutateAsync: handleSubmitBooking,
    isPending: isPendingSubmitBooking,
  } = useMutation({
    mutationFn: async () => {
      const requiredFields = [
        { field: formData.warehouseId, message: "Warehouse harus dipilih" },
        { field: formData.vehicleId, message: "Kendaraan harus dipilih" },
        { field: formData.dockId, message: "Dock harus dipilih" },
        {
          field: formData.arrivalTime,
          message: "Waktu kedatangan harus dipilih",
        },
        {
          field: formData.estimatedFinishTime,
          message: "Gagal membuat est. finish time",
        },
        {
          field: formData.driverUsername,
          message: "Driver perlu dipilih",
        },
      ];

      requiredFields.forEach(({ field, message }) => {
        if (!field) throw new Error(message);
      });

      return await BookingApi.createBooking(formData);
    },
    onSuccess: () => {
      setIsBookCompleted(true);
      toast.success("Booking berhasil dibuat");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Gagal membuat booking");
    },
  });

  // Helper to update search params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null) params.delete(key);
        else params.set(key, value);
      });
      router.push(`?${params.toString()}`);
    },
    [router],
  );

  // Handlers
  const handleWarehouseSelect = useCallback(
    (warehouse: Warehouse) => {
      setFormData((prev) => ({
        ...prev,
        warehouseId: warehouse.id,
        Warehouse: warehouse,
      }));
      setFilterVehicles((prev) => ({
        ...prev,
        selectedWarehouseId: warehouse.id,
      }));
      setBookingStep("driver");
      updateParams({ warehouseId: warehouse.id });
    },
    [updateParams],
  );

  const handleDriverSelect = useCallback(
    (driver: UserApp) => {
      if (!driver.username) return;
      setFormData((prev) => ({ ...prev, driverUsername: driver.username }));
      setBookingStep("vehicle");
      updateParams({ driverUsername: driver.username });
    },
    [updateParams],
  );

  const handleVehicleSelect = useCallback(
    (vehicle: IVehicle) => {
      if (!vehicle.id) return;
      setFormData((prev) => ({
        ...prev,
        vehicleId: vehicle.id,
        Vehicle: vehicle,
      }));
      setBookingStep("dock");
      updateParams({ vehicleId: vehicle.id });
    },
    [updateParams],
  );

  const handleDockSelection = useCallback(
    (dock: IDock, arrivalTime: Date | null = null) => {
      if (!dock.id) return;

      const estimatedFinish =
        arrivalTime && formData.Vehicle?.durasiBongkar
          ? new Date(
              arrivalTime.getTime() +
                formData.Vehicle.durasiBongkar * 60 * 1000,
            )
          : null;

      setFormData((prev) => ({
        ...prev,
        dockId: dock.id,
        Dock: dock,
        arrivalTime: null,
        estimatedFinishTime: estimatedFinish,
      }));
      updateParams({ dockId: dock.id });
    },
    [updateParams, formData.Vehicle?.durasiBongkar],
  );

  const handleBack = () => {
    const stepMap: Record<string, BookingStep> = {
      driver: "warehouse",
      vehicle: "driver",
      dock: "vehicle",
      confirmation: "dock",
    };

    const previousStep = stepMap[bookingStep];
    if (!previousStep) return;

    setBookingStep(previousStep);

    if (bookingStep === "driver") {
      setFormData((prev) => ({ ...prev, warehouseId: "" }));
      updateParams({ warehouseId: null });
    } else if (bookingStep === "vehicle") {
      setFormData((prev) => ({ ...prev, driverUsername: "" }));
      updateParams({ driverUsername: null });
    } else if (bookingStep === "dock") {
      setFormData((prev) => ({ ...prev, vehicleId: "" }));
      updateParams({ vehicleId: null });
    } else if (bookingStep === "confirmation") {
      setFormData((prev) => ({ ...prev, dockId: "" }));
      updateParams({ dockId: null });
    }
  };

  const handleFinish = () => {
    if (
      !formData.warehouseId ||
      !formData.vehicleId ||
      !formData.dockId ||
      !formData.arrivalTime
    ) {
      toast.error("Mohon lengkapi semua data sebelum melanjutkan");
      return;
    }
    setBookingStep("confirmation");
  };

  // Sync state from URL params
  useEffect(() => {
    if (warehouseIdParam && warehouses.length > 0 && !formData.warehouseId) {
      const warehouse = warehouses.find((w) => w.id === warehouseIdParam);
      if (warehouse) {
        setFormData((prev) => ({
          ...prev,
          warehouseId: warehouse.id,
          Warehouse: warehouse,
        }));
        setFilterVehicles((prev) => ({
          ...prev,
          selectedWarehouseId: warehouse.id,
        }));
        setBookingStep("driver");
      }
    }
  }, [warehouseIdParam, warehouses, formData.warehouseId]);

  useEffect(() => {
    if (driverUsernameParam && myDrivers && !formData.driverUsername) {
      const driver = myDrivers.find((d) => d.username === driverUsernameParam);
      if (driver) {
        setFormData((prev) => ({ ...prev, driverUsername: driver.username }));
        setBookingStep("vehicle");
      }
    }
  }, [driverUsernameParam, myDrivers, formData.driverUsername]);

  useEffect(() => {
    if (vehicleIdParam && vendorVehicles && !formData.vehicleId) {
      const vehicle = vendorVehicles.find((v) => v.id === vehicleIdParam);
      if (vehicle) {
        setFormData((prev) => ({
          ...prev,
          vehicleId: vehicle.id,
          Vehicle: vehicle,
        }));
        setBookingStep("dock");
      }
    }
  }, [vehicleIdParam, vendorVehicles, formData.vehicleId]);

  useEffect(() => {
    if (dockIdParam && activeDocks && !formData.dockId) {
      const dock = activeDocks.find((d) => d.id === dockIdParam);
      if (dock) {
        setFormData((prev) => ({ ...prev, dockId: dock.id, Dock: dock }));
      }
    }
  }, [dockIdParam, activeDocks, formData.dockId]);

  const steps = [
    {
      id: "warehouse",
      label: "Gudang",
      icon: WarehouseIcon,
      completed: !!formData.warehouseId,
    },
    {
      id: "driver",
      label: "Driver",
      icon: User2,
      completed: !!formData.driverUsername,
    },
    {
      id: "vehicle",
      label: "Kendaraan",
      icon: Car,
      completed: !!formData.vehicleId,
    },
    { id: "dock", label: "Gate", icon: Activity, completed: !!formData.dockId },
    { id: "confirmation", label: "Konfirmasi", icon: CheckCircle },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === bookingStep);

  if (!isVendor) {
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

  const StepProgress = () => (
    <div className="mb-0 relative w-full lg:max-w-xl">
      <div className="flex items-center justify-between relative px-2">
        {/* Connector Line Background */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-100 -z-10 hidden md:block" />

        {steps.map((step, index) => {
          const isActive = step.id === bookingStep;
          const isCompleted = step.completed || index < currentStepIndex;
          const StepIcon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center relative z-10 group flex-1">
                {/* Step Circle */}
                <div className="relative">
                  {isActive && (
                    <div className="absolute inset-0 bg-emerald-500 rounded-full blur-md opacity-20 animate-pulse scale-150" />
                  )}
                  <div
                    className={`w-9 h-9 md:w-11 md:h-11 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-sm
                    ${
                      isActive
                        ? "border-emerald-500 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rotate-6 scale-110 shadow-emerald-200"
                        : isCompleted
                          ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                          : "border-gray-200 bg-white text-gray-400 group-hover:border-emerald-200"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                    ) : (
                      <StepIcon
                        className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? "animate-bounce" : ""}`}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-2 text-center absolute -bottom-12 w-24">
                  <p
                    className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${
                      isActive ? "text-emerald-700" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>

              {/* Connector Line Fill */}
              {index < steps.length - 1 && (
                <div className="flex-1 px-1 hidden md:block -mt-10">
                  <div
                    className={`h-0.5 w-full transition-all duration-1000 ${
                      isCompleted ? "bg-emerald-500" : "bg-transparent"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  const EmptyState = ({ icon: Icon, message }: any) => (
    <div className="card bg-white shadow">
      <div className="card-body text-center py-12">
        <Icon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );

  // Step Renderers
  const renderWarehouseStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-8 bg-emerald-500 rounded-full" />
            Pilih Gudang Tujuan
          </h2>
          <p className="text-gray-500 mt-1">
            Silahkan pilih lokasi gudang yang ingin Anda kunjungi hari ini.
          </p>
        </div>
        <div className="relative group">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500 scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300" />
          <input
            value={filterWarehouse.searchKey}
            onChange={(e: any) =>
              setFilterWarehouse((prev) => ({
                ...prev,
                searchKey: e.target.value,
              }))
            }
            placeholder="Cari nama gudang..."
            className="w-full md:w-64 bg-gray-50/50 border-gray-200 focus:bg-white rounded-xl py-3 px-4 outline-none transition-all"
          />
        </div>
      </div>

      {loadingWarehouses ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-emerald-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
          </div>
          <p className="mt-4 text-gray-500 font-medium font-mono text-xs uppercase tracking-widest">
            Loading Warehouses
          </p>
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-20 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
            <WarehouseIcon className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-gray-900 font-bold text-xl">
            Gudang Tidak Ditemukan
          </p>
          <p className="text-gray-500 mt-2">
            Coba gunakan kata kunci pencarian yang berbeda.
          </p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
            {warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                onClick={() => {
                  if (
                    Array.isArray(warehouse.docks) &&
                    warehouse.docks.length > 0
                  ) {
                    handleWarehouseSelect(warehouse);
                  } else {
                    toast.error("Gudang ini Belum memiliki Gate");
                  }
                }}
                className={`
                  group relative overflow-hidden bg-white rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1
                  ${
                    formData.warehouseId === warehouse.id
                      ? "border-emerald-500 bg-emerald-50/30 ring-4 ring-emerald-500/5 shadow-xl shadow-emerald-500/10"
                      : "border-gray-100/80 hover:border-emerald-200"
                  }
                `}
              >
                {/* Decorative background element on active */}
                {formData.warehouseId === warehouse.id && (
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
                )}

                <div className="p-7">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-gray-50 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300 rounded-2xl">
                      <WarehouseIcon className="w-6 h-6" />
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        warehouse.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {warehouse.isActive ? "Operational" : "Closed"}
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                      {warehouse.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-gray-500">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm truncate">
                        {warehouse.location || "No address provided"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100 mb-6">
                    <div className="bg-gray-50/50 p-3 rounded-xl">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">
                        Gate Available
                      </div>
                      <div className="text-lg font-black text-gray-900">
                        {Array.isArray(warehouse.docks)
                          ? warehouse.docks.length
                          : 0}
                      </div>
                    </div>
                    <div className="bg-gray-50/50 p-3 rounded-xl">
                      <div className="text-[10px] font-bold text-gray-400 uppercase">
                        Organization
                      </div>
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {warehouse.organizationName || "General"}
                      </div>
                    </div>
                  </div>

                  <button
                    className={`
                      w-full py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2
                      ${
                        formData.warehouseId === warehouse.id
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                          : "bg-gray-900 text-white hover:bg-emerald-600"
                      }
                    `}
                  >
                    {formData.warehouseId === warehouse.id ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Gudang Terpilih</span>
                      </>
                    ) : (
                      <span>Lanjutkan</span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderDriverStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-8 bg-amber-500 rounded-full" />
            Tentukan Driver
          </h2>
          <p className="text-gray-500 mt-1">
            Pilih rekan driver yang akan bertanggung jawab untuk pengiriman ini.
          </p>
        </div>
        <div className="relative group">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-500 scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300" />
          <input
            value={filterDriver.searchKey}
            onChange={(e: any) =>
              setFilterDriver((prev) => ({
                ...prev,
                searchKey: e.target.value,
              }))
            }
            placeholder="Cari nama driver..."
            className="w-full md:w-64 bg-gray-50/50 border-gray-200 focus:bg-white rounded-xl py-3 px-4 outline-none transition-all"
          />
        </div>
      </div>

      {isLoadingMyDrivers ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-amber-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-amber-500 rounded-full border-t-transparent animate-spin" />
          </div>
        </div>
      ) : !myDrivers?.length ? (
        <div className="text-center py-20 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
            <User2 className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-gray-900 font-bold text-xl">
            Driver Tidak Ditemukan
          </p>
          <p className="text-gray-500 mt-2">
            Pastikan driver sudah terdaftar di sistem Anda.
          </p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
            {myDrivers.map((driver: UserApp) => (
              <div
                key={driver.username}
                onClick={() => handleDriverSelect(driver)}
                className={`
                  group relative overflow-hidden bg-white rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1
                  ${
                    formData.driverUsername === driver.username
                      ? "border-amber-500 bg-amber-50/30 ring-4 ring-amber-500/5 shadow-xl shadow-amber-500/10"
                      : "border-gray-100/80 hover:border-amber-200"
                  }
                `}
              >
                <div className="p-7">
                  <div className="flex justify-between items-start mb-6">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 group-hover:bg-amber-500 transition-colors duration-300 flex items-center justify-center">
                        <User2 className="w-8 h-8 text-gray-400 group-hover:text-white transition-colors" />
                      </div>
                      <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white ${
                          driver.isActive ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Driver ID
                      </div>
                      <div className="text-xs font-mono font-bold text-gray-900">
                        #{driver.username.slice(-6).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-amber-700 transition-colors">
                      {driver.displayName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 font-mono uppercase tracking-tighter">
                      @{driver.username}
                    </p>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-gray-100 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Vendor Partner</span>
                      <span className="font-bold text-gray-900">
                        {driver.vendorName || "Active"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Security Clearance</span>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Verified
                      </span>
                    </div>
                  </div>

                  <button
                    className={`
                      w-full py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2
                      ${
                        formData.driverUsername === driver.username
                          ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                          : "bg-gray-900 text-white hover:bg-amber-600"
                      }
                    `}
                  >
                    {formData.driverUsername === driver.username ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Driver Terpilih</span>
                      </>
                    ) : (
                      <span>Pilih Driver</span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderVehicleStep = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-8 bg-blue-500 rounded-full" />
            Pilih Kendaraan
          </h2>
          <p className="text-gray-500 mt-1">
            Pilih armada yang akan digunakan untuk pengiriman ini.
          </p>
        </div>
        <div className="relative group">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-500 scale-x-0 group-focus-within:scale-x-100 transition-transform duration-300" />
          <input
            value={filterVehicles.searchKey}
            onChange={(e: any) =>
              setFilterVehicles((prev: any) => ({
                ...prev,
                searchKey: e.target.value,
              }))
            }
            placeholder="Cari plat nomor atau merk..."
            className="w-full md:w-64 bg-gray-50/50 border-gray-200 focus:bg-white rounded-xl py-3 px-4 outline-none transition-all"
          />
        </div>
      </div>

      {isLoadingVendorVehicles ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
          </div>
        </div>
      ) : !vendorVehicles?.length ? (
        <div className="text-center py-20 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mx-auto mb-6">
            <Truck className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-gray-900 font-bold text-xl">
            Kendaraan Tidak Ditemukan
          </p>
          <p className="text-gray-500 mt-2">
            Daftarkan kendaraan Anda terlebih dahulu di menu Fleet.
          </p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
            {vendorVehicles.map((vehicle: IVehicle) => (
              <div
                key={vehicle.id}
                onClick={() => handleVehicleSelect(vehicle)}
                className={`
                  group relative overflow-hidden bg-white rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1
                  ${
                    formData.vehicleId === vehicle.id
                      ? "border-blue-500 bg-blue-50/30 ring-4 ring-blue-500/5 shadow-xl shadow-blue-500/10"
                      : "border-gray-100/80 hover:border-blue-200"
                  }
                `}
              >
                <div className="p-7">
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 bg-gray-50 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300 rounded-2xl shadow-sm">
                      <Truck className="w-6 h-6" />
                    </div>
                    {/* <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                          Plate Number
                        </span>
                        <span className="px-3 py-1 bg-gray-900 text-white rounded-lg text-sm font-black tracking-widest font-mono">
                          {vehicle.plat || "BN 1234 XY"}
                        </span>
                      </div> */}
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                      {vehicle.brand} {vehicle.vehicleType?.replace("_", " ")}
                    </h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        <Activity className="w-3.5 h-3.5 text-blue-500" />
                        <span>{vehicle.productionYear}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{vehicle.durasiBongkar} Min</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-6 border-t border-gray-100 mb-6">
                    <p className="text-sm text-gray-500 line-clamp-2 italic">
                      {vehicle.description ||
                        "Kendaraan prima siap melakukan pengiriman logistik tepat waktu."}
                    </p>
                  </div>

                  <button
                    className={`
                      w-full py-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2
                      ${
                        formData.vehicleId === vehicle.id
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                          : "bg-gray-900 text-white hover:bg-blue-600"
                      }
                    `}
                  >
                    {formData.vehicleId === vehicle.id ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Armada Terpilih</span>
                      </>
                    ) : (
                      <span>Pilih Armada</span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderDockStep = () => (
    <div className="space-y-4">
      <div className="mb-4 flex justify-start gap-x-5">
        <div className="flex flex-col">
          <h2 className="text-xl md:text-2xl font-semibold flex items-center mr-4">
            <Activity className="w-5 h-5 md:w-6 md:h-6 mr-2  text-primary" />
            Pilih Dock
          </h2>
          <p className="text-gray-600 text-sm md:text-base">
            Pilih dock di{" "}
            <span className="font-semibold">
              {formData.Warehouse?.name || "gudang ini"}
            </span>
          </p>
        </div>
      </div>

      {loadingDocks ? (
        <LoadingSpinner />
      ) : activeDocks?.length === 0 ? (
        <EmptyState icon={Activity} message="Tidak ada dock aktif tersedia" />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-300px)] overflow-y-auto  ">
          {/* Dock List - Mobile: full width, Desktop: 1/3 */}
          <div className="md:w-96 flex flex-col">
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto pr-1 space-y-3">
                {activeDocks.map((dock: IDock) => {
                  const isAllowed =
                    dock.isActive &&
                    dock.allowedTypes.includes(formData.Vehicle?.vehicleType);
                  const isSelected = formData.dockId === dock.id;

                  return (
                    <div
                      key={dock.id}
                      onClick={() => isAllowed && handleDockSelection(dock)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : !isAllowed
                            ? "border-gray-200 opacity-50 cursor-not-allowed"
                            : "border-gray-200 hover:border-primary/30 hover:shadow"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              dock.isActive ? "bg-blue-100" : "bg-gray-100"
                            }`}
                          >
                            <Dock
                              className={`w-3.5 h-3.5 ${
                                dock.isActive
                                  ? "text-blue-600"
                                  : "text-gray-400"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {dock.name}
                              </h4>
                              {!dock.isActive && (
                                <span className="text-xs px-1 py-0.5 bg-red-100 text-red-700 rounded flex-shrink-0">
                                  OFF
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {dock.warehouse?.name}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Allowed Types */}
                      {dock.allowedTypes?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">
                            Kendaraan diizinkan:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {dock.allowedTypes.map((type, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs truncate max-w-[80px]"
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status & Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              dock.isActive ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              dock.isActive ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {dock.isActive ? "Tersedia" : "Tidak tersedia"}
                          </span>
                        </div>
                        <button
                          className={`btn btn-xs px-2 py-1 min-h-0 h-6 ${
                            isSelected
                              ? "btn-primary"
                              : !isAllowed
                                ? "btn-disabled opacity-50"
                                : "btn-outline btn-primary"
                          }`}
                          disabled={!isAllowed}
                        >
                          {isSelected ? "✓" : !isAllowed ? "X" : "Pilih"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview Section - Mobile: full width, Desktop: 2/3 */}
          <div className="flex-1 flex flex-col md:max-h-[calc(100vh-16rem] overflow-y-auto">
            {formData.dockId ? (
              <PreviewSlotDisplay
                formData={formData}
                onUpdateFormData={(updates) => {
                  setFormData((prev) => ({ ...prev, ...updates }));
                }}
                mode="create"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white rounded-lg border">
                <DockIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mb-3" />
                <p className="text-gray-600 font-medium text-center">
                  Pilih dock terlebih dahulu untuk melihat jadwal
                </p>
                <p className="text-sm text-gray-500 text-center mt-2">
                  Klik pada salah satu dock di sebelah kiri
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderConfirmationStep = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-4xl mx-auto ">
      {isBookCompleted ? (
        <div className="text-center py-20 px-8 bg-white/60 backdrop-blur-2xl rounded-[3rem] border border-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-emerald-500" />
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-emerald-50">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4">
            Transaksi Berhasil!
          </h2>
          <p className="text-gray-500 text-lg mb-12 max-w-md mx-auto">
            Booking Anda telah kami catat dalam sistem. Silahakan datang tepat
            waktu sesuai jadwal.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push("/antrian/vendor/booking")}
              className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-black transition-all hover:scale-105 active:scale-95 shadow-xl"
            >
              REKAPITULASI BOOKING
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-10 py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl font-black hover:bg-gray-50 transition-all shadow-sm"
            >
              BUAT BARU
            </button>
          </div>
        </div>
      ) : (
        <div className="relative group px-4 sm:px-0">
          {/* Simplified shadow effect - lebih halus & minimal */}
          <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/5 to-blue-500/5 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition duration-700" />

          <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 p-5 sm:p-8 overflow-hidden">
            {/* Decorative icon - lebih subtle */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 opacity-10">
              <Truck className="w-12 h-12 sm:w-16 sm:h-16" />
            </div>

            {/* Header Section - lebih compact */}
            <div className="mb-6 sm:mb-8 border-b border-gray-100 pb-5 sm:pb-6">
              <h3 className="text-[8px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-3 sm:mb-4">
                Review Summary
              </h3>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6">
                <div>
                  <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
                    Konfirmasi Jadwal
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1 sm:mt-2">
                    Pastikan data sudah akurat
                  </p>
                </div>

                {/* Estimated time - lebih compact di mobile */}
                <div className="bg-emerald-50/80 px-4 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-emerald-100">
                  <div className="text-[7px] sm:text-[9px] font-bold text-emerald-700 uppercase tracking-wider text-center mb-0.5">
                    Estimasi Selesai
                  </div>
                  <div className="text-base sm:text-xl md:text-2xl font-black text-emerald-600 font-mono">
                    {formData.estimatedFinishTime
                      ? new Date(
                          formData.estimatedFinishTime,
                        ).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "--:--"}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Grid - lebih rapi di mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
              {/* Warehouse */}
              <div className="space-y-1.5">
                <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-red-400" /> Lokasi Gudang
                </div>
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                  {formData.Warehouse?.name || "-"}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {formData.Warehouse?.location || "-"}
                </p>
              </div>

              {/* Arrival Time */}
              <div className="space-y-1.5">
                <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-blue-400" /> Waktu
                  Kedatangan
                </div>
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                  {formData.arrivalTime
                    ? new Date(formData.arrivalTime).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )
                    : "-"}
                </div>
                <div className="inline-block text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                  Pukul{" "}
                  {formData.arrivalTime
                    ? new Date(formData.arrivalTime).toLocaleTimeString(
                        "id-ID",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "-"}{" "}
                  WIB
                </div>
              </div>

              {/* Vehicle */}
              <div className="space-y-1.5">
                <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-emerald-500" /> Armada & Plat
                </div>
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                  {formData.Vehicle?.brand || "-"}{" "}
                  {formData.Vehicle?.vehicleType || ""}
                </div>
                <div className="inline-block text-xs font-mono bg-gray-900 text-white px-2.5 py-1 rounded-lg tracking-wide">
                  {formData.notes || "BN 1234 XY"}
                </div>
              </div>

              {/* Driver */}
              <div className="space-y-1.5">
                <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User2 className="w-3 h-3 text-amber-500" /> Penanggung Jawab
                </div>
                <div className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                  {formData.driverUsername || "-"}
                </div>
                <div className="text-[9px] sm:text-xs font-semibold text-amber-600 uppercase">
                  Driver Partner
                </div>
              </div>
            </div>

            {/* Buttons - Touch friendly */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-5 sm:pt-6 border-t border-gray-100">
              <button
                onClick={handleBack}
                className="w-full sm:flex-1 py-3.5 sm:py-4 bg-white border border-gray-200 text-gray-800 rounded-xl sm:rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm sm:text-base">Revisi</span>
              </button>

              <button
                onClick={() => handleSubmitBooking()}
                disabled={isPendingSubmitBooking || !formData.arrivalTime}
                className="w-full sm:flex-[2] py-3.5 sm:py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl sm:rounded-2xl font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPendingSubmitBooking ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-sm sm:text-base">Submit Booking</span>
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/20">
      {/* Background Decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-200 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-blue-100 rounded-full blur-[100px]" />
      </div>

      <div className="relative mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Header Section - Premium & Modern */}
        <div className="mb-14">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
            <div className="flex items-start gap-5">
              {/* Back Button */}
              {bookingStep !== "warehouse" ? (
                <button
                  onClick={handleBack}
                  className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg transition-all group shrink-0"
                >
                  <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                </button>
              ) : (
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-xl shadow-emerald-500/20 shrink-0">
                  <Calendar className="w-7 h-7 text-white" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-[0.3em] mb-1.5 font-mono">
                  <span className="w-6 h-[2px] bg-emerald-500" />
                  Booking System
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                  {isBookCompleted ? "Booking Sukses!" : "Book Visit"}
                </h1>
              </div>
            </div>

            {/* Progress Stepper */}
            <div className="w-full lg:w-auto lg:min-w-[500px]">
              <StepProgress />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="relative">
          {/* Transparent backdrop for glass effect */}
          <div className="absolute inset-0 bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 -z-10 shadow-2xl shadow-gray-200/40" />

          <div className="p-6 md:p-10 lg:p-12 min-h-[500px]">
            {bookingStep === "warehouse" && renderWarehouseStep()}
            {bookingStep === "driver" && renderDriverStep()}
            {bookingStep === "vehicle" && renderVehicleStep()}
            {bookingStep === "dock" && renderDockStep()}
            {bookingStep === "confirmation" && renderConfirmationStep()}
          </div>
        </div>

        {/* Action Bar for Dock Step */}
        {formData.arrivalTime && formData.notes && bookingStep === "dock" && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
            <button
              onClick={handleFinish}
              className="w-full relative group p-1"
            >
              <div className="absolute inset-0 bg-emerald-500 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-all duration-500" />
              <div className="relative px-8 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-black flex items-center justify-center gap-4 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all duration-300 tracking-wide text-lg">
                <span>LANJUTKAN KONFIRMASI</span>
                <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

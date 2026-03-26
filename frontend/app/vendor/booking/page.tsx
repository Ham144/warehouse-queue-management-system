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
  Building,
  DockIcon,
  Dock,
  Truck,
  User,
  MessageSquare,
  ArrowLeft,
  Loader2,
  Info,
  WrapTextIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WarehouseApi } from "@/api/warehouse.api";
import { VehicleApi } from "@/api/vehicle.api";
import { DockApi } from "@/api/dock.api";
import { Booking } from "@/types/booking.type";
import { Warehouse } from "@/types/warehouse";
import { IFilterVehicle, IVehicle } from "@/types/vehicle";
import { IDock } from "@/types/dock.type";
import { useRouter } from "next/navigation";
import PreviewSlotDisplay from "@/components/vendor/PreviewSlotDisplay";
import { BookingApi } from "@/api/booking.api";
import { AuthApi } from "@/api/auth";
import { UserApp } from "@/types/auth";
import { BaseProps, BasePropsInit, ROLE } from "@/types/shared.type";
import { useUserInfo } from "@/components/UserContext";

type BookingStep = "warehouse" | "driver" | "vehicle" | "dock" | "confirmation";

export const dynamic = "force-dynamic"; // penting untuk URLsearcparams

export default function BookingPage() {
  const [bookingStep, setBookingStep] = useState<BookingStep>("warehouse");
  const [isBookCompleted, setIsBookCompleted] = useState(false);
  const router = useRouter();
  const params = new URLSearchParams();

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
  const driverUsernameParam = params.get("driverUsername");
  const vehicleIdParam = params.get("vehicleId");
  const warehouseIdParam = params.get("warehouseId");
  const dockIdParam = params.get("dockId");

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
        {
          field: formData.dockId,
          message: "Dock Perlu dipilih",
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
      window.location.href = "/antrian/vendor/booking";
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Gagal membuat booking");
    },
  });

  // Handlers - PERBAIKAN: Pisahkan handler dock
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
      router.push(`/vendor/booking?warehouseId=${warehouse.id}`);
    },
    [router],
  );

  const handleDriverSelect = useCallback(
    (driver: UserApp) => {
      if (!driver.username) return;
      setFormData((prev) => ({ ...prev, driverUsername: driver.username }));
      setBookingStep("vehicle");
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("driverUsername", driver.username);
      router.push(currentUrl.toString());
    },
    [router],
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
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("vehicleId", vehicle.id);
      router.push(currentUrl.toString());
    },
    [router],
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
        estimatedFinishTime: estimatedFinish ? estimatedFinish : null,
      }));
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("dockId", dock.id);
      router.push(currentUrl.toString());
    },
    [router, formData.Vehicle?.durasiBongkar],
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

    // Clear form data for current step
    const clearMap: Record<string, Partial<Booking>> = {
      driver: {
        driverUsername: null,
        vehicleId: null,
        dockId: null,
        arrivalTime: null,
      },
      vehicle: { vehicleId: null, dockId: null, arrivalTime: null },
      dock: { dockId: "", arrivalTime: null, notes: "" },
    };

    if (clearMap[bookingStep]) {
      setFormData((prev) => ({ ...prev, ...clearMap[bookingStep] }));
    }

    // Update URL
    const searchParams = new URLSearchParams(window.location.search);
    if (bookingStep === "driver") searchParams.delete("driverUsername");
    else if (bookingStep === "vehicle") searchParams.delete("vehicleId");
    else if (bookingStep === "dock") {
      searchParams.delete("dockId");
      searchParams.delete("arrivalTime");
      searchParams.delete("notes");
    }

    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${searchParams.toString()}`,
    );
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

  // Steps configuration
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

  // PERBAIKAN: Initialize from URL params tanpa infinite loop
  useEffect(() => {
    const initializeFromParams = () => {
      if (window.location.search.length <= 1) return; // Skip jika tidak ada params

      // Reset jika sudah completed
      if (isBookCompleted) {
        setIsBookCompleted(false);
        setFormData({
          vehicleId: "",
          warehouseId: "",
          dockId: "",
          arrivalTime: null,
          driverUsername: null,
          notes: "",
          estimatedFinishTime: null,
        });
        setBookingStep("warehouse");
        return;
      }

      // Initialize berdasarkan URL params
      if (warehouseIdParam && warehouses.length > 0 && !formData.warehouseId) {
        const warehouse = warehouses.find((w) => w.id === warehouseIdParam);
        if (warehouse) {
          handleWarehouseSelect(warehouse);
        }
      }

      if (driverUsernameParam && myDrivers && !formData.driverUsername) {
        const driver = myDrivers.find(
          (d) => d.username === driverUsernameParam,
        );
        if (driver) {
          handleDriverSelect(driver);
        }
      }

      if (vehicleIdParam && vendorVehicles && !formData.vehicleId) {
        const vehicle = vendorVehicles.find((v) => v.id === vehicleIdParam);
        if (vehicle) {
          handleVehicleSelect(vehicle);
        }
      }

      if (dockIdParam && activeDocks && !formData.dockId) {
        const dock = activeDocks.find((d) => d.id === dockIdParam);
        if (dock) {
          handleDockSelection(dock);
        }
      }
    };

    // Gunakan setTimeout untuk menghindari update berantai
    const timeoutId = setTimeout(initializeFromParams, 100);
    return () => clearTimeout(timeoutId);
  }, [
    warehouseIdParam,
    driverUsernameParam,
    vehicleIdParam,
    dockIdParam,
    warehouses,
    myDrivers,
    vendorVehicles,
    activeDocks,
    isBookCompleted,
  ]);

  // PERBAIKAN: Prevent infinite updates dengan kondisi
  useEffect(() => {
    if (isBookCompleted) {
      // Reset URL jika booking completed
      router.replace("/antrian/vendor/booking");
    }
  }, [isBookCompleted, router]);

  if (!isVendor) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <WrapTextIcon className="animate-spin" />
          <span>Ini adalah menu admin vendor</span>
        </div>
      </div>
    );
  }

  const StepProgress = () => (
    <Suspense>
      <div className="mb-3">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = step.id === bookingStep;
            const isCompleted = step.completed || index < currentStepIndex;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 transition-all 
                  ${
                    isActive
                      ? "border-primary bg-primary text-white"
                      : isCompleted
                        ? "border-primary bg-primary text-white"
                        : "border-gray-300 bg-white text-gray-400"
                  }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <span className="font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <p
                    className={`mt-2 text-sm font-medium ${
                      isActive ? "text-primary" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      isCompleted ? "bg-primary" : "bg-gray-300"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </Suspense>
  );

  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-16">
      <span className="loading loading-spinner loading-lg text-primary"></span>
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
    <Suspense>
      <div className="space-y-4">
        {/* Header dengan search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <WarehouseIcon className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-800">
                Pilih Gudang
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              Pilih gudang tempat Anda ingin melakukan kunjungan
            </p>
          </div>
          <input
            value={filterWarehouse.searchKey}
            onChange={(e: any) =>
              setFilterWarehouse((prev) => ({
                ...prev,
                searchKey: e.target.value,
              }))
            }
            placeholder="Cari gudang..."
            className="sm:w-48"
          />
        </div>

        {loadingWarehouses ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <WarehouseIcon className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500">Tidak ada gudang tersedia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto">
            {warehouses.map((warehouse) => (
              <div
                key={warehouse.id}
                onClick={() => handleWarehouseSelect(warehouse)}
                className={`
                bg-white rounded-lg border cursor-pointer transition-all hover:shadow-sm
                ${
                  formData.warehouseId === warehouse.id
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50"
                    : "border-gray-200 hover:border-emerald-300"
                }
              `}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-800 truncate">
                        {warehouse.name}
                      </h3>
                      {warehouse.location && (
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {warehouse.location}
                        </p>
                      )}
                    </div>
                    <span
                      className={`
                    text-xs px-2 py-1 rounded whitespace-nowrap ml-2
                    ${
                      warehouse.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }
                  `}
                    >
                      {warehouse.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>

                  {/* Description */}
                  {warehouse.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {warehouse.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm">
                      <div className="text-gray-500">Jumlah Dock</div>
                      <div className="font-semibold text-gray-800">
                        {Array.isArray(warehouse.docks)
                          ? warehouse.docks.length
                          : 0}
                      </div>
                    </div>
                    {warehouse.organizationName && (
                      <div className="text-sm text-right">
                        <div className="text-gray-500">Organisasi</div>
                        <div className="font-medium truncate max-w-[120px]">
                          {warehouse.organizationName}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Button */}
                  <button
                    className={`
                    w-full py-2 text-sm font-medium rounded transition-colors
                    ${
                      formData.warehouseId === warehouse.id
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }
                  `}
                  >
                    {formData.warehouseId === warehouse.id
                      ? "✓ Terpilih"
                      : "Pilih"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Suspense>
  );

  const renderDriverStep = () => (
    <Suspense>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Pilih Driver</h2>
            <p className="text-gray-600">Pilih driver untuk booking ini</p>
          </div>
          <input
            value={filterDriver.searchKey}
            onChange={(e: any) =>
              setFilterDriver((prev) => ({
                ...prev,
                searchKey: e.target.value,
              }))
            }
            placeholder="Cari Driver..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingMyDrivers && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {myDrivers?.map((driver: UserApp) => (
            <div
              key={driver.username}
              onClick={() => handleDriverSelect(driver)}
              className={`card bg-white shadow-md hover:shadow-lg cursor-pointer border-2 
              ${
                formData.driverUsername === driver.username
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              <div className="card-body p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {driver.displayName}
                      </h3>
                      <p className="text-sm text-gray-600">{driver.username}</p>
                    </div>
                  </div>
                  <span
                    className={`badge px-3 py-1 ${
                      driver.isActive ? "badge-success" : "badge-error"
                    }`}
                  >
                    {driver.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                {driver.vendorName && (
                  <div className="flex items-center gap-2 text-sm mb-3">
                    <Building className="w-4 h-4" />
                    <span className="font-medium">Vendor:</span>
                    <span>{driver.vendorName}</span>
                  </div>
                )}

                <button
                  className={`btn w-full gap-2 ${
                    formData.driverUsername === driver.username
                      ? "btn-primary"
                      : "btn-outline btn-primary"
                  }`}
                >
                  {formData.driverUsername === driver.username
                    ? "✓ Driver Terpilih"
                    : "Pilih Driver Ini"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Suspense>
  );
  const renderVehicleStep = () => (
    <Suspense>
      <div className="space-y-4 ">
        {/* Header Compact */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <Car className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="font-semibold text-gray-800">Pilih Kendaraan</h2>
              <p className="text-sm text-gray-500">
                Pilih kendaraan yang akan digunakan
              </p>
            </div>
          </div>
          <input
            value={filterVehicles.searchKey}
            onChange={(e: any) =>
              setFilterVehicles((prev) => ({
                ...prev,
                searchKey: e.target.value,
              }))
            }
            placeholder="Cari..."
            className="w-48"
          />
        </div>

        {isLoadingVendorVehicles ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : vendorVehicles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Car className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>Belum ada kendaraan tersedia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto">
            {vendorVehicles.map((vehicle: IVehicle) => (
              <div
                key={vehicle.id}
                onClick={() => handleVehicleSelect(vehicle)}
                className={`
                bg-white rounded-lg border cursor-pointer transition-all hover:shadow-md
                ${
                  formData.vehicleId === vehicle.id
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50"
                    : "border-gray-200 hover:border-emerald-300"
                }
              `}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center
                      ${
                        formData.vehicleId === vehicle.id
                          ? "bg-emerald-100"
                          : "bg-gray-100"
                      }`}
                      >
                        <Car
                          className={`w-5 h-5 ${
                            formData.vehicleId === vehicle.id
                              ? "text-emerald-600"
                              : "text-gray-600"
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          {vehicle.brand}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {vehicle.vehicleType?.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`
                    text-xs px-2 py-1 rounded
                    ${
                      vehicle.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }
                  `}
                    >
                      {vehicle.isActive ? "Aktif" : "Nonaktif"}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {vehicle?.productionYear && (
                      <div className="text-sm">
                        <div className="text-gray-500">Tahun</div>
                        <div className="font-medium">
                          {vehicle.productionYear}
                        </div>
                      </div>
                    )}
                    <div className="text-sm">
                      <div className="text-gray-500">Durasi</div>
                      <div className="font-medium text-emerald-600">
                        {vehicle.durasiBongkar} mnt
                      </div>
                    </div>
                    <div className="text-sm">
                      <div className="text-gray-500">global</div>
                      <div className="font-medium text-emerald-600">
                        {vehicle.isGlobalWarehouse ? "Ya" : "Tidak"}
                      </div>
                    </div>
                  </div>

                  {/* Button */}
                  <button
                    className={`
                    w-full py-2 text-sm font-medium rounded transition-colors
                    ${
                      formData.vehicleId === vehicle.id
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }
                  `}
                  >
                    {formData.vehicleId === vehicle.id ? "✓ Terpilih" : "Pilih"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Suspense>
  );

  const renderDockStep = () => (
    <Suspense>
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
                                dock.isActive
                                  ? "text-green-700"
                                  : "text-red-700"
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
    </Suspense>
  );

  const renderConfirmationStep = () => (
    <div className="space-y-6 container">
      <div className="border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Konfirmasi Booking
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Tinjau detail sebelum konfirmasi
            </p>
          </div>
        </div>
      </div>

      {isBookCompleted ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Booking Berhasil!
          </h3>
          <p className="text-gray-600 mb-6">
            Booking Anda telah berhasil dibuat
          </p>
          <button
            onClick={() => router.push("/antrian/vendor/booking")}
            className="btn btn-primary w-full"
          >
            Buat Booking Baru
          </button>
        </div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ">
            {/* Vehicle */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-5 h-5 text-emerald-600" />
                <span className="font-medium text-gray-700">Kendaraan</span>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-gray-800">
                  {formData.Vehicle?.brand}
                </p>
                <p className="text-sm text-gray-600">
                  {formData.Vehicle?.vehicleType?.replace("_", " ")}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                    {formData.Vehicle?.durasiBongkar} menit
                  </span>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-gray-700">Jadwal</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-gray-500">Kedatangan</div>
                  <div className="font-medium">
                    {formData.arrivalTime
                      ? new Date(formData.arrivalTime).toLocaleDateString(
                          "id-ID",
                          {
                            day: "numeric",
                            month: "short",
                          },
                        ) +
                        " " +
                        new Date(formData.arrivalTime).toLocaleTimeString(
                          "id-ID",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Selesai</div>
                  <div className="font-medium">
                    {formData.estimatedFinishTime
                      ? new Date(
                          formData.estimatedFinishTime,
                        ).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-gray-700">Lokasi</span>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-purple-700">
                  {formData.Dock?.name}
                </p>
                <p className="text-sm text-gray-600 truncate">
                  {formData.Warehouse?.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {formData.Warehouse?.location}
                </p>
              </div>
            </div>

            {/* Driver */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-gray-700">Supir</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">
                    {formData.driverUsername}
                  </p>
                  <p className="text-xs text-gray-500">Driver</p>
                </div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4">
            {/* Vehicle Details */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-700 mb-3">
                Detail Kendaraan
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Brand</div>
                  <div className="font-medium">{formData.Vehicle?.brand}</div>
                </div>
                <div>
                  <div className="text-gray-500">Tipe</div>
                  <div className="font-medium">
                    {formData.Vehicle?.vehicleType?.replace("_", " ")}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Tahun</div>
                  <div className="font-medium">
                    {formData.Vehicle?.productionYear}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Durasi</div>
                  <div className="font-medium text-emerald-600">
                    {formData.Vehicle?.durasiBongkar} menit
                  </div>
                </div>
              </div>
              {formData.Vehicle?.description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-gray-500 text-sm mb-1">Deskripsi</div>
                  <div className="text-gray-700">
                    {formData.Vehicle.description}
                  </div>
                </div>
              )}
            </div>

            {/* Notes Section */}
            {formData.notes && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-5 h-5 text-gray-500" />
                  <h3 className="font-medium text-gray-700">
                    Plat Nomor / short note
                  </h3>
                </div>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  {formData.notes}
                </p>
              </div>
            )}

            {/* Important Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  Pastikan supir telah diinformasikan mengenai jadwal kedatangan
                  dan durasi bongkar.
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-6 -mb-6 p-6 mt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleBack}
                className="btn btn-outline border-gray-300 hover:bg-gray-50 text-gray-700 flex-1 py-3"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali
              </button>
              <button
                onClick={() => handleSubmitBooking()}
                disabled={isPendingSubmitBooking || !formData.arrivalTime}
                className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-0 text-white flex-1 py-3"
              >
                {isPendingSubmitBooking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Konfirmasi Booking
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
    <Suspense
      fallback={<span className="loading loading-ring loading-lg"></span>}
    >
      <div className="min-h-screen flex-wrap bg-gray-50 p-6">
        <div className="w-full pb-28">
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Title & Back in one row */}
              <div className="flex items-center gap-3">
                {/* Icon */}
                {/* Back Button */}
                {bookingStep !== "warehouse" && (
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="max-md:hidden">Kembali</span>
                  </button>
                )}
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>

                {/* Title & Description */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-semibold text-gray-900 truncate">
                    Buat Booking Baru
                  </h1>
                  <p className="text-sm text-gray-500 truncate">
                    Pilih gudang, kendaraan, dock, tanggal, dan waktu
                  </p>
                </div>
              </div>

              {/* Step Progress */}
              <StepProgress />
            </div>
          </div>

          {bookingStep === "warehouse" && renderWarehouseStep()}
          {bookingStep === "driver" && renderDriverStep()}
          {bookingStep === "vehicle" && renderVehicleStep()}
          {bookingStep === "dock" && renderDockStep()}
          {bookingStep === "confirmation" && renderConfirmationStep()}

          {formData.arrivalTime && formData.notes && bookingStep === "dock" && (
            <div className="fixed bottom-0 left-0 right-0 z-10 ">
              <button
                onClick={handleFinish}
                className="btn btn-primary w-full btn-md md:btn-lg z-20 "
              >
                Lanjutkan ke Konfirmasi
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Suspense>
  );
}

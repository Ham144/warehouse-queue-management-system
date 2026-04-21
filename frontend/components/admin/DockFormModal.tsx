import { IDock } from "@/types/dock.type";
import { MutateFunction, useQuery } from "@tanstack/react-query";
import React, { Dispatch, SetStateAction, useState } from "react";
import {
  Warehouse as WarehouseIcon,
  Truck,
  Star,
  XCircle,
  Activity,
  MapPin,
  Calendar,
} from "lucide-react";
import { Toaster } from "sonner";
import { DockApi } from "@/api/dock.api";
import { VehicleType } from "@/types/shared.type";

interface DockFormModalProps {
  formData: IDock;
  setFormData: Dispatch<SetStateAction<IDock>>;
  onCreate: MutateFunction;
  onEdit: MutateFunction;
}

const DockFormModal = ({
  formData,
  setFormData,
  onCreate,
  onEdit,
}: DockFormModalProps) => {
  const [showVehicleTypes, setShowVehicleTypes] = useState(false);

  useQuery({
    queryKey: ["warehouse", formData?.id],
    queryFn: async () => {
      const res = await DockApi.getDockDetail(formData?.id);
      setFormData(res);
    },
    enabled: !!formData?.id,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id) {
      onEdit();
    } else {
      onCreate();
    }
  };

  const handleClose = () => {
    (document.getElementById("DockFormModal") as HTMLDialogElement).close();
  };

  const vehicleTypes = Object.values(VehicleType);

  const toggleVehicleType = (vehicleType: VehicleType) => {
    const currentTypes = formData.allowedTypes || [];
    const updatedTypes = currentTypes.includes(vehicleType)
      ? currentTypes.filter((type) => type !== vehicleType)
      : [...currentTypes, vehicleType];

    setFormData({ ...formData, allowedTypes: updatedTypes });
  };

  const handlePhotoAdd = (url: string) => {
    if (url.trim()) {
      const currentPhotos = formData.photos || [];
      if (!currentPhotos.includes(url.trim())) {
        setFormData({
          ...formData,
          photos: [...currentPhotos, url.trim()],
        });
      }
    }
  };

  const handlePhotoRemove = (index: number) => {
    const currentPhotos = formData.photos || [];
    const updatedPhotos = currentPhotos.filter((_, i) => i !== index);
    setFormData({ ...formData, photos: updatedPhotos });
  };

  return (
    <dialog id="DockFormModal" className="modal">
      <div className="modal-box w-full max-w-4xl p-0 bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* Header - Modern Gradient */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/10 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-xl text-gray-800">
                {formData?.id ? "Edit Gate" : "Tambah Gate Baru"}
              </h3>
            </div>
            <button
              onClick={handleClose}
              type="button"
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 px-6 py-5 max-h-[70vh] overflow-y-auto custom-scrollbar"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Dock Name */}
              <div className="form-control md:col-span-2">
                <label className="label py-2">
                  <span className="label-text font-semibold text-gray-700 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Nama Gate <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full bg-gray-50/50 border-gray-200 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl transition-all duration-200"
                  placeholder="Contoh: Dock A, Gate 1, Ramp B"
                  value={formData?.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              {/* Warehouse - Disabled */}
              <div className="form-control md:col-span-2">
                <label className="label py-2">
                  <span className="label-text font-semibold text-gray-700 flex items-center gap-2">
                    <WarehouseIcon className="w-4 h-4 text-primary" />
                    Warehouse <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  disabled
                  className="input input-bordered w-full bg-gray-100 border-gray-200 rounded-xl cursor-not-allowed text-gray-600"
                  value={formData?.warehouse?.name || ""}
                />
              </div>

              {/* Priority - Modern Number Input (1-9) */}
              <div className="form-control">
                <label className="label py-2">
                  <span className="label-text font-semibold text-gray-700 flex items-center gap-2">
                    <Star className="w-4 h-4 text-primary" />
                    Prioritas
                  </span>
                </label>

                <div className="space-y-3">
                  {/* Number Input with Stepper */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const newPriority = Math.max(
                          1,
                          (formData?.priority || 1) - 1,
                        );
                        setFormData({ ...formData, priority: newPriority });
                      }}
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 flex items-center justify-center transition-all duration-200 disabled:opacity-50"
                      disabled={formData?.priority <= 1}
                    >
                      <span className="text-xl font-bold">−</span>
                    </button>

                    <input
                      type="number"
                      min="1"
                      max="9"
                      value={formData?.priority || 1}
                      onChange={(e) => {
                        let value = parseInt(e.target.value);
                        if (isNaN(value)) value = 1;
                        value = Math.max(1, Math.min(9, value));
                        setFormData({ ...formData, priority: value });
                      }}
                      className="w-24 h-12 text-center text-lg font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const newPriority = Math.min(
                          9,
                          (formData?.priority || 1) + 1,
                        );
                        setFormData({ ...formData, priority: newPriority });
                      }}
                      className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 flex items-center justify-center transition-all duration-200 disabled:opacity-50"
                      disabled={formData?.priority >= 9}
                    >
                      <span className="text-xl font-bold">+</span>
                    </button>

                    {/* Priority Indicator */}
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        {[...Array(formData?.priority || 1)].map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className="text-amber-500 fill-amber-500"
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Priority Description */}
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      Prioritas {formData?.priority || 1} dari 9
                    </span>
                    <span className="text-gray-300">•</span>
                    <span>1 = Tertinggi, 9 = Terendah</span>
                  </div>
                </div>
              </div>

              {/* Allowed Vehicle Types */}
              <div className="form-control md:col-span-2">
                <label className="label py-2">
                  <span className="label-text font-semibold text-gray-700 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-primary" />
                    Jenis Kendaraan yang Didukung
                  </span>
                </label>

                {/* Selected Types Preview */}
                {formData?.allowedTypes && formData.allowedTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData?.allowedTypes.map((type) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl"
                      >
                        <span className="text-sm font-medium text-primary">
                          {type}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleVehicleType(type)}
                          className="p-0.5 hover:bg-primary/20 rounded-full transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5 text-primary" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Vehicle Types Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowVehicleTypes(!showVehicleTypes)}
                    className="btn w-full justify-between bg-gray-50/50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 rounded-xl transition-all duration-200 font-normal"
                  >
                    <span className="text-gray-600">
                      {formData?.allowedTypes?.length > 0
                        ? `${formData.allowedTypes.length} jenis terpilih`
                        : "Pilih Jenis Kendaraan"}
                    </span>
                    <Truck className="w-4 h-4 text-gray-400" />
                  </button>

                  {showVehicleTypes && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto custom-scrollbar">
                      {vehicleTypes
                        .filter((type) => !formData.allowedTypes.includes(type))
                        .map((type) => (
                          <button
                            type="button"
                            onClick={() => toggleVehicleType(type)}
                            className="w-full px-4 py-3 text-left hover:bg-primary/5 border-b border-gray-100 last:border-b-0 transition-colors"
                            key={type}
                          >
                            <div className="font-medium text-gray-700">
                              {type}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status - Modern Toggle */}
              <div className="form-control md:col-span-2">
                <label className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 cursor-pointer hover:border-primary/30 transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">
                        Status Aktif
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Gate yang aktif dapat digunakan untuk penjadwalan
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={formData?.isActive ?? true}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                  />
                </label>
              </div>
            </div>

            {/* Days Schedule - Modern Cards */}
            <div className="space-y-3">
              <label className="label py-2">
                <span className="label-text font-semibold text-gray-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Jadwal Operasional
                </span>
              </label>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                {formData?.vacants?.length &&
                  formData?.vacants?.map((vacant, index) => (
                    <div
                      key={vacant.day}
                      className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 hover:border-primary/20 transition-all"
                    >
                      <div className="font-semibold text-center text-gray-700 mb-3 pb-2 border-b border-gray-200">
                        {vacant.day}
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Dari
                          </label>
                          <input
                            type="time"
                            className="input input-bordered input-sm w-full bg-white border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg transition-all"
                            value={String(vacant.availableFrom) || ""}
                            onChange={(e) => {
                              const time = e.target.value;
                              const updatedVacants = [
                                ...(formData.vacants || []),
                              ];
                              updatedVacants[index] = {
                                ...updatedVacants[index],
                                availableFrom: time || null,
                              };
                              setFormData({
                                ...formData,
                                vacants: updatedVacants,
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            Sampai
                          </label>
                          <input
                            type="time"
                            className="input input-bordered input-sm w-full bg-white border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg transition-all"
                            value={vacant?.availableUntil?.toString() || ""}
                            onChange={(e) => {
                              const time = e.target.value;
                              const updatedVacants = [
                                ...(formData.vacants || []),
                              ];
                              updatedVacants[index] = {
                                ...updatedVacants[index],
                                availableUntil: time || null,
                              };
                              setFormData({
                                ...formData,
                                vacants: updatedVacants,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Actions - Modern Footer */}
          <div className="flex justify-end gap-3 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-all duration-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary/80 rounded-xl text-white font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-200"
            >
              {formData?.id ? "Perbarui Gate" : "Tambah Gate"}
            </button>
          </div>
        </form>
      </div>
      <Toaster />
    </dialog>
  );
};

export default DockFormModal;

"use client";

import { useState, useRef } from "react";
import { Plus, Edit, Trash2, MapPin, Star, Upload, Info } from "lucide-react";
import { toast } from "sonner";
import DockFormModal from "@/components/admin/DockFormModal";
import { IDock } from "@/types/dock.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DockApi } from "@/api/dock.api";
import { useUserInfo } from "@/components/UserContext";
import { Days } from "@/types/shared.type";
import ConfirmationModal from "@/components/shared-common/confirmationModal";
import { Vacant } from "@/types/vacant.type";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i]
      .split(",")
      .map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    header.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function csvRowsToDocks(
  rows: Record<string, string>[],
  warehouseId: string,
): {
  name: string;
  warehouseId: string;
  allowedTypes?: string[];
  isActive?: boolean;
  priority?: number;
}[] {
  return rows
    .filter((r) => r.name ?? r.nama)
    .map((r) => {
      const name = (r.name ?? r.nama ?? "").trim();
      const allowedTypesStr = (
        r.allowed_types ??
        r.allowedtypes ??
        r["allowed types"] ??
        ""
      ).trim();
      const allowedTypes = allowedTypesStr
        ? allowedTypesStr
            .split(/[,;]/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        : undefined;
      const priorityStr = (r.priority ?? r.prioritas ?? "").trim();
      const priority = priorityStr ? parseInt(priorityStr, 10) : undefined;
      const isActiveStr = (
        r.is_active ??
        r.isactive ??
        r["is active"] ??
        r.aktif ??
        "1"
      )
        .trim()
        .toLowerCase();
      const isActive =
        isActiveStr === "1" ||
        isActiveStr === "true" ||
        isActiveStr === "ya" ||
        isActiveStr === "yes" ||
        isActiveStr === "";
      return {
        name,
        warehouseId,
        allowedTypes,
        isActive,
        priority: priority ?? undefined,
      };
    });
}

export default function GatesPage() {
  const queryClient = useQueryClient();
  const [selectedDockId, setSelectedDockId] = useState<string | null>(null);
  const { userInfo } = useUserInfo();
  const initialDock: IDock = {
    name: "",
    warehouseId: userInfo?.homeWarehouse?.id,
    warehouse: userInfo?.homeWarehouse,
    photos: [],
    allowedTypes: [],
    vacants: ((): Vacant[] => {
      const days = Object.values(Days);
      return days.map((day) => {
        if (day == "MINGGU") {
          return {
            day: day,
            availableFrom: null,
            availableUntil: null,
          };
        } else {
          return {
            day,
            availableFrom: "08:00",
            availableUntil: "15:50",
          };
        }
      });
    })(),
    isActive: true,
    priority: undefined,
    busyTimes: [],
  };
  const [formData, setFormData] = useState<IDock>(initialDock);

  const formatDockData = (data: IDock): IDock => {
    return {
      ...data,
      photos: data.photos || [],
      allowedTypes: data.allowedTypes || [],
      priority: data.priority ? Number(data.priority) : undefined,
      isActive: data.isActive ?? true,
    };
  };

  const { mutateAsync: handleCreate } = useMutation({
    mutationKey: ["docks"],
    mutationFn: async () => {
      const { warehouse, ...createData } = formatDockData(formData!);
      return await DockApi.registerDock(createData);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Gagal membuat dock baru");
    },
    onSuccess: () => {
      toast.success("Dock berhasil dibuat");
      setFormData(initialDock);
      queryClient.invalidateQueries({ queryKey: ["docks"] });
      setFormData(undefined);
      (document.getElementById("DockFormModal") as HTMLDialogElement).close();
    },
  });

  const { mutateAsync: handleUpdate } = useMutation({
    mutationKey: ["docks"],
    mutationFn: async () => {
      const { id } = formData;
      return DockApi.updateDock(id!, formData);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Gagal memperbarui dock");
    },
    onSuccess: () => {
      toast.success("Dock berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["docks"] });
      setFormData(undefined);
      (document.getElementById("DockFormModal") as HTMLDialogElement).close();
      setFormData(initialDock);
    },
  });

  const { data: docks } = useQuery({
    queryKey: ["docks", userInfo],
    queryFn: async () =>
      await DockApi.getDocksByWarehouseId(userInfo?.homeWarehouse?.id),
    enabled: !!userInfo?.homeWarehouse?.id,
  });

  const { mutateAsync: handleDelete } = useMutation({
    mutationKey: ["docks"],
    mutationFn: async (dockId: string) => await DockApi.deleteDock(dockId),
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Gagal menghapus dock");
    },
    onSuccess: () => {
      toast.success("Dock berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["docks"] });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: handleBulkUpload, isPending: isBulkUploading } =
    useMutation({
      mutationKey: ["docks"],
      mutationFn: async (
        docks: {
          name: string;
          warehouseId: string;
          allowedTypes?: string[];
          isActive?: boolean;
          priority?: number;
        }[],
      ) => DockApi.bulkUploadDocks(docks),
      onError: (error: any) => {
        toast.error(
          error?.response?.data?.message || "Gagal upload spreadsheet",
        );
      },
      onSuccess: () => {
        toast.success("Spreadsheet berhasil diupload");
        queryClient.invalidateQueries({ queryKey: ["docks"] });
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userInfo?.homeWarehouse?.id) return;
    const warehouseId = userInfo.homeWarehouse.id;
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      toast.error(
        "File kosong atau format tidak valid. Gunakan CSV dengan header: name, allowed_types, priority, is_active",
      );
      return;
    }
    const docks = csvRowsToDocks(rows, warehouseId);
    if (!docks.length) {
      toast.error(
        "Tidak ada baris dengan kolom name/nama. Pastikan header: name, allowed_types, priority, is_active",
      );
      return;
    }
    await handleBulkUpload(docks);
  };

  const handleSelectToEdit = (dock: IDock) => {
    setFormData(dock);
    (document.getElementById("DockFormModal") as HTMLDialogElement).showModal();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30">
      <div className="flex">
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Section - Modern */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
                      Gate Management
                    </h1>
                  </div>
                  <p className="text-sm text-gray-500 ml-1">
                    Kelola dan atur semua gate/dock untuk warehouse Anda
                  </p>
                </div>

                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onFileChange}
                    disabled={isBulkUploading || !userInfo?.homeWarehouse?.id}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBulkUploading || !userInfo?.homeWarehouse?.id}
                    className="group px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:border-primary hover:text-primary hover:shadow-md transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBulkUploading ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <>
                        <Upload
                          size={18}
                          className="group-hover:-translate-y-0.5 transition-transform"
                        />
                        <span>Upload CSV</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setFormData(initialDock);
                      (
                        document.getElementById(
                          "DockFormModal",
                        ) as HTMLDialogElement
                      ).showModal();
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/80 rounded-xl text-white font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-200 flex items-center gap-2"
                  >
                    <Plus size={18} />
                    <span>New Gate</span>
                  </button>
                </div>
              </div>

              {/* CSV Info Banner */}
              <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <Info
                    size={14}
                    className="text-blue-500 mt-0.5 flex-shrink-0"
                  />
                  <p>
                    Format CSV upload: baris pertama header{" "}
                    <code className="px-1.5 py-0.5 bg-white rounded text-blue-600 font-mono">
                      name, allowed_types, priority, is_active
                    </code>
                    . allowed_types dipisah koma (contoh: PICKUP,VAN,CDE), untuk
                    jam default terisi.
                  </p>
                </div>
              </div>
            </div>

            {/* Table Section - Modern Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                        Nama Gate
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                        Allow Types
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                        Status
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {docks?.length > 0 ? (
                      docks?.map((dock: IDock, index: number) => (
                        <tr
                          key={index}
                          className="group hover:bg-gray-50/80 transition-all duration-150"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-primary" />
                              </div>
                              <span className="font-semibold text-gray-800">
                                {dock.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {dock?.allowedTypes &&
                            dock.allowedTypes.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {dock.allowedTypes.map((type, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700"
                                  >
                                    {type}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                dock.isActive
                                  ? "bg-green-50 text-green-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  dock.isActive
                                    ? "bg-green-500 animate-pulse"
                                    : "bg-red-500"
                                }`}
                              />
                              {dock.isActive ? "Aktif" : "Tidak Aktif"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleSelectToEdit(dock)}
                                className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
                                title="Edit gate"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={async () => {
                                  setSelectedDockId(dock.id);
                                  (
                                    document.getElementById(
                                      "confirmation1",
                                    ) as HTMLDialogElement
                                  ).showModal();
                                }}
                                className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                                title="Hapus gate"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                              <MapPin className="w-10 h-10 text-gray-300" />
                            </div>
                            <p className="font-medium text-gray-500">
                              Belum ada data gate
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              Mulai dengan menambahkan Gate pertama Anda
                            </p>
                            <button
                              onClick={() => {
                                setFormData(initialDock);
                                (
                                  document.getElementById(
                                    "DockFormModal",
                                  ) as HTMLDialogElement
                                ).showModal();
                              }}
                              className="mt-4 px-4 py-2 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              + Tambah Gate
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <DockFormModal
        formData={formData}
        setFormData={setFormData}
        onCreate={handleCreate}
        onEdit={handleUpdate}
        key={"DockFormModal"}
      />

      <ConfirmationModal
        message="Apakah Anda yakin ingin menghapus gate ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={() => handleDelete(selectedDockId!)}
        title="Hapus Gate"
        modalId="confirmation1"
        key={"confirmation1"}
      />
    </div>
  );
}

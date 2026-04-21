"use client";
import { AuthApi } from "@/api/auth";
import { VendorApi } from "@/api/vendor.api";
import ConfirmationModal from "@/components/shared-common/confirmationModal";
import PaginationFullTable from "@/components/shared-common/PaginationFullTable";
import UserEditModalForm from "@/components/shared-common/UserEditModalForm";
import { IUploadUser, UserApp, UserInfo } from "@/types/auth";
import { ROLE } from "@/types/shared.type";
import { IVendor } from "@/types/vendor.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Building2,
  Edit,
  IdCardIcon,
  Info,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
  User2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useRef, useState } from "react";
import { toast, Toaster } from "sonner";

interface MemberManagementFilter {
  searchKey?: string;
  page: number;
  vendorName?: string;
  role?: string;
}

const MemberManagementPage = () => {
  const initialUserAPP: UserApp = {
    username: "",
    password: "",
    passwordConfirm: "",
    role: ROLE.USER_ORGANIZATION,
    description: "",
    displayName: "",
    homeWarehouseId: "",
    isActive: true,
    organizationName: "",
    warehouseAccess: [],
    driverLicense: "",
    accountType: "APP",
    driverPhone: "",
  };
  const [formData, setFormData] = useState<UserApp>(initialUserAPP);
  const [editModalKey, setEditModalKey] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<MemberManagementFilter>({
    searchKey: "",
    page: 1,
    vendorName: "all",
    role: "all",
  });
  const fileInputRef = useRef(null);

  const router = useRouter();

  const qc = useQueryClient();
  const { data: accounts, isLoading } = useQuery({
    queryKey: ["users", filter],
    queryFn: () =>
      AuthApi.getAllAccountForMemberManagement({
        page: filter.page,
        searchKey: filter.searchKey,
        vendorName: filter.vendorName,
        role: filter.role,
      }),
  });

  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => VendorApi.getAllVendors(),
  });

  const { mutateAsync: handleCreateAppUser } = useMutation({
    mutationKey: ["users"],
    mutationFn: async (data: UserApp) => {
      const { passwordConfirm, ...res } = data;
      const out = AuthApi.createAppUser(res);
      return out;
    },
    onSuccess: () => {
      (document.getElementById("UserEditModalForm") as any)?.close();
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Gagal menambahkan user");
    },
  });

  const { mutateAsync: handleUpdateUser } = useMutation({
    mutationKey: ["users"],
    mutationFn: async (data: UserApp) => await AuthApi.updateAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      (document.getElementById("UserEditModalForm") as any)?.close();
    },
    onError: (er: any) => {
      toast.error(
        er?.response?.data?.message || "gagal mengupdate data member",
      );
    },
  });

  const [selectedUser, setSelectedUser] = useState<UserApp | undefined>();

  const { mutateAsync: handleDeleteAppUser } = useMutation({
    mutationKey: ["delete-app-user", "users"],
    mutationFn: async () => await AuthApi.deleteAppUser(selectedUser?.username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      (document.getElementById("delete-app-user") as any)?.close();
    },
    onError: async (er: any) => {
      toast.error(er?.response?.data?.message || "gagal menghapus data member");
      (document.getElementById("delete-app-user") as any)?.close();
    },
  });

  const handleOpenEdit = (user?: UserApp) => {
    setIsCreating(false);
    setFormData(user ?? initialUserAPP);
    setEditModalKey((k) => k + 1);
    setTimeout(() => {
      (
        document.getElementById("UserEditModalForm") as HTMLDialogElement
      )?.showModal();
    }, 0);
  };

  // Perbaiki parser CSV
  function parseCSV(text: string): Record<string, string>[] {
    if (!text || typeof text !== "string") return [];

    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length < 2) return [];

    // Deteksi delimiter (koma atau titik koma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";

    // Bersihkan header: trim dan lowercase
    const header = lines[0].split(delimiter).map((h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/^["']|["']$/g, ""),
    );

    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      // Parse dengan mempertimbangkan quotes
      const values = lines[i].split(delimiter).map((v) => {
        let val = v.trim();
        // Hapus quotes di awal dan akhir jika ada
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        return val;
      });

      const row: Record<string, string> = {};
      header.forEach((h, j) => {
        row[h] = values[j] || "";
      });

      // Hanya tambahkan jika memiliki username
      if (row.username || row.user) {
        rows.push(row);
      }
    }

    return rows;
  }

  function csvRowsToUser(rows: Record<string, string>[]): IUploadUser[] {
    return rows
      .filter((r) => {
        const username = r.username || r.user || r.namapengguna || "";
        return username.trim() !== "";
      })
      .map((r) => {
        // Normalisasi field names
        const username = r.username || r.user || r.namapengguna || "";
        const password = r.password || r.sandi || r.pass || "";
        const displayName =
          r.displayname || r.nama || r.name || r.namalengkap || username;
        const role = (r.role || r.jabatan || "ADMIN_VENDOR")
          .toString()
          .trim()
          .toUpperCase();
        const description = r.description || r.deskripsi || r.keterangan || "";
        const homeWarehouse = r.homewarehouse || r.warehouse || r.gudang || "";
        const vendorName = r.vendorname || r.vendor || r.namavendor || "";

        // Parse isActive dengan lebih baik
        let isActive = false;
        const isActiveRaw = r.isactive || r.active || r.aktif || r.status || "";

        if (typeof isActiveRaw === "string") {
          const lowerVal = isActiveRaw.toLowerCase().trim();
          isActive =
            lowerVal === "true" ||
            lowerVal === "1" ||
            lowerVal === "yes" ||
            lowerVal === "ya" ||
            lowerVal === "aktif" ||
            lowerVal === "active";
        } else if (typeof isActiveRaw === "number") {
          isActive = isActiveRaw === 1;
        } else if (typeof isActiveRaw === "boolean") {
          isActive = isActiveRaw;
        }

        return {
          username: username.trim(),
          password: password.trim() || "default123", // Default password jika kosong
          displayName: displayName.trim(),
          role: role,
          description: description.trim(),
          homeWarehouse: homeWarehouse.trim(),
          vendorName: vendorName.trim(),
          isActive: isActive,
        };
      });
  }

  const queryClient = useQueryClient();
  const handleUploadUsers = useMutation({
    mutationKey: ["users"],
    mutationFn: async (data: IUploadUser[]) => {
      console.log("Uploading users:", data); // Debug
      return await AuthApi.upload(data);
    },
    onSuccess: (res) => {
      toast.success(res.message || "Berhasil mengupload data member");
      (document.getElementById("upload-csv") as HTMLDialogElement)?.close();
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (er: any) => {
      toast.error(
        er?.response?.data?.message || "Gagal mengupload data member",
      );
    },
  });

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Cek tipe file
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("File harus berformat CSV");
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();

      if (!text || text.trim().length === 0) {
        toast.error("File CSV kosong");
        return;
      }

      const rows = parseCSV(text);
      console.log("Parsed rows:", rows); // Debug

      if (!rows.length) {
        toast.error(
          "File tidak memiliki data valid. Pastikan format CSV benar.",
        );
        return;
      }

      const users = csvRowsToUser(rows);
      console.log("Mapped users:", users); // Debug

      if (!users.length) {
        toast.error(
          "Tidak ada data user yang valid. Pastikan kolom 'username' terisi.",
        );
        return;
      }

      // Upload users
      await handleUploadUsers.mutateAsync(users);
    } catch (err: any) {
      console.error("File processing error:", err);
      toast.error("Gagal memproses file: " + err.message);

      // Reset input file
      e.target.value = "";
    }
  };

  // Trigger file input dengan event yang lebih reliable
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      // Clone dan replace input untuk memastikan event handler jalan
      const newInput = document.createElement("input");
      newInput.type = "file";
      newInput.accept = ".csv";
      newInput.style.display = "none";
      newInput.onchange = (e: any) =>
        onFileChange(e as React.ChangeEvent<HTMLInputElement>);

      fileInputRef.current.parentNode?.replaceChild(
        newInput,
        fileInputRef.current,
      );
      (fileInputRef as any).current = newInput;

      newInput.click();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <main className="flex-1 pb-12">
        <div className="p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Section - Modern & Clean */}
            <div className="mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">
                      Manajemen Member
                    </h1>
                  </div>
                  <p className="text-gray-500 ml-1">
                    Kelola member, perizinan, dan hak akses warehouse dalam satu
                    dasbor
                  </p>
                </div>

                <div className="flex gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={onFileChange}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      (
                        document.getElementById(
                          "upload-csv",
                        ) as HTMLDialogElement
                      ).showModal()
                    }
                    disabled={handleUploadUsers.isPending}
                    className="group px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:border-blue-300 hover:shadow-md transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {handleUploadUsers.isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <>
                        <Upload
                          size={18}
                          className="text-gray-500 group-hover:text-blue-500 transition-colors"
                        />
                        <span>Upload CSV</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(true);
                      setFormData(initialUserAPP);
                      setEditModalKey((k) => k + 1);
                      setTimeout(() => {
                        (
                          document.getElementById(
                            "UserEditModalForm",
                          ) as HTMLDialogElement
                        )?.showModal();
                      }, 0);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200 flex items-center gap-2"
                  >
                    <Plus size={18} />
                    <span>Buat Member</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filters Section - Card Style */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 p-5 mb-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  onChange={(e) =>
                    setFilter({ ...filter, vendorName: e.target.value })
                  }
                  value={filter.vendorName}
                  defaultValue={"all"}
                  className="select select-bordered w-full sm:w-56 bg-white border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all"
                >
                  <option disabled>Filter Vendor</option>
                  <option selected value={"all"}>
                    Semua vendor
                  </option>
                  {vendors?.length &&
                    vendors?.map((vendor: IVendor) => (
                      <option key={vendor.name}>{vendor.name}</option>
                    ))}
                </select>

                <select
                  onChange={(e) =>
                    setFilter({ ...filter, role: e.target.value })
                  }
                  defaultValue={"all"}
                  className="select select-bordered w-full sm:w-56 bg-white border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl transition-all"
                >
                  <option disabled>Filter Role</option>
                  <option selected value={"all"}>
                    semua role
                  </option>
                  {
                    // @ts-ignore
                    Object.values(ROLE).map((role) => (
                      <option key={role}>{role}</option>
                    ))
                  }
                </select>

                <div className="flex-1">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari username atau nama member..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-gray-700 placeholder-gray-400"
                      value={filter.searchKey}
                      onChange={(e) =>
                        setFilter((f) => ({
                          ...f,
                          searchKey: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Table Section - Modern Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative">
                      <div className="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-gray-500 text-sm">
                      Memuat data member...
                    </p>
                  </div>
                </div>
              ) : accounts?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                    <User className="w-10 h-10 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium">
                    Tidak ada data member
                  </p>
                  <p className="text-gray-400 text-sm mt-1 max-w-md">
                    {filter.searchKey
                      ? "Coba ubah kata kunci pencarian atau filter yang digunakan"
                      : "Mulai dengan menambahkan member pertama Anda"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200">
                      <tr>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                          Username
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                          Deskripsi
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                          Role
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                          Home Warehouse
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                          Akses Gudang
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                          Status
                        </th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider py-4 px-4">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {accounts?.length > 0 ? (
                        accounts?.map((account: UserInfo, index: number) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50/50 transition-colors duration-150 group"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center">
                                  <User2 className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="font-medium text-gray-900 text-sm">
                                  {account.username}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {account.description ? (
                                <span className="text-gray-600 text-sm">
                                  {account.description}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                                {account.role || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {account.homeWarehouse ? (
                                <span className="text-gray-600 text-sm">
                                  {account.homeWarehouse.name}
                                </span>
                              ) : account.vendorName ? (
                                <span className="text-gray-500 text-sm">
                                  Vendor: {account.vendorName}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() =>
                                  router.push("/admin/all-warehouse")
                                }
                                className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition-colors group/warehouse"
                              >
                                <Building2 className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                  {account?.warehouseAccess?.length || 0}
                                </span>
                                <Plus className="w-3.5 h-3.5 opacity-0 group-hover/warehouse:opacity-100 transition-opacity" />
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                  account.isActive
                                    ? "bg-green-50 text-green-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    account.isActive
                                      ? "bg-green-500"
                                      : "bg-red-500"
                                  }`}
                                />
                                {account.isActive ? "Aktif" : "Tidak Aktif"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleOpenEdit(account)}
                                  className="p-2 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
                                  title="Edit user"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedUser(account);
                                    (
                                      document.getElementById(
                                        "delete-app-user",
                                      ) as HTMLDialogElement
                                    )?.showModal();
                                  }}
                                  className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                                  title="Hapus user"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-12">
                            <p className="text-gray-400">Tidak ada data</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="mt-6">
              <PaginationFullTable
                data={accounts}
                filter={filter}
                isLoading={isLoading}
                setFilter={setFilter}
                key={"PaginationFullTable"}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <UserEditModalForm
        formData={formData}
        setFormData={setFormData}
        submitCreate={(data) => handleCreateAppUser(data ?? formData)}
        isCreating={isCreating}
        submitUpdate={(data) => handleUpdateUser(data ?? formData)}
        key={`UserEditModalForm-${editModalKey}`}
      />

      <ConfirmationModal
        message="Yakin ingin menghapus member ini? Tindakan ini tidak dapat dibatalkan."
        modalId="delete-app-user"
        onConfirm={handleDeleteAppUser}
        title="Konfirmasi Hapus Member"
        key={"delete-app-user"}
      />

      {/* Upload CSV Modal - Modern */}
      <dialog id="upload-csv" className="modal">
        <div className="modal-box max-w-2xl p-0 overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h3 className="font-bold text-xl text-white">
              Upload Users via CSV
            </h3>
            <p className="text-blue-100 text-sm mt-1">
              Import multiple users sekaligus
            </p>
          </div>

          <div className="p-6">
            <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <Info className="text-blue-600" size={18} />
                </div>
                <div>
                  <p className="font-semibold text-blue-900 text-sm uppercase tracking-wide">
                    Instruksi Bulk Upload CSV
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Format Header CSV:
                  </p>
                  <div className="bg-gray-900 rounded-xl p-3 overflow-x-auto">
                    <code className="text-xs text-green-400 font-mono">
                      username,password,displayName,role,isActive,homeWarehouse,vendorName,description
                    </code>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-800 mb-2 flex items-center gap-1">
                      <span>📌</span> Ketentuan:
                    </p>
                    <ul className="space-y-1 text-gray-600 list-disc ml-5">
                      <li>
                        <span className="font-medium">username</span>: wajib
                        diisi
                      </li>
                      <li>
                        <span className="font-medium">password</span>: opsional,
                        default 'default123'
                      </li>
                      <li>
                        <span className="font-medium">isActive</span>:
                        true/1/ya/aktif
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 mb-2 flex items-center gap-1">
                      <span>🏢</span> Relasi:
                    </p>
                    <ul className="space-y-1 text-gray-600 list-disc ml-5">
                      <li>
                        <span className="font-medium">homeWarehouse</span>: nama
                        gudang
                      </li>
                      <li>
                        <span className="font-medium">vendorName</span>: nama
                        vendor
                      </li>
                    </ul>
                  </div>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleButtonClick}
                  disabled={handleUploadUsers.isPending}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {handleUploadUsers.isPending ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Pilih File CSV
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              className="px-5 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
                (
                  document.getElementById("upload-csv") as HTMLDialogElement
                )?.close();
              }}
            >
              Tutup
            </button>
          </div>
        </div>
        <Toaster />
      </dialog>
    </div>
  );
};

export default MemberManagementPage;

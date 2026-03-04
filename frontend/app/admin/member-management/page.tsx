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
    <div className="min-h-screen ">
      <main className="flex-1 pb-12">
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between ">
                <div className="rounded-lg border border-gray-100 ">
                  {/* Header Section */}
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                      Manajemen Semua Member
                    </h1>
                    <p className="text-gray-500 mt-1">
                      Kelola member, perizinan, dan hak akses warehouse dalam
                      satu dasbor.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 items-center ">
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
                    className="btn btn-outline btn-primary px-4"
                  >
                    {handleUploadUsers.isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      <>
                        <Upload size={20} /> Upload CSV
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
                    className="btn  btn-primary px-3 "
                  >
                    <Plus /> Buat Member Custom
                  </button>
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-white rounded-lg border border-gray-200  mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  onChange={(e) =>
                    setFilter({ ...filter, vendorName: e.target.value })
                  }
                  value={filter.vendorName}
                  defaultValue={"all"}
                  className="select w-full max-w-xs px-2"
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
                  className="select w-full max-w-xs px-2"
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
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari username user"
                      className="input input-bordered w-full pl-10 bg-white border-gray-300 focus:border-leaf-green-300 focus:ring-2 focus:ring-leaf-green-100"
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
            {/* Table */}
            <div className="bg-white rounded-lg border border-gray-200">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="flex flex-col items-center space-y-3">
                    <span className="loading loading-spinner loading-lg text-leaf-green-500"></span>
                    <p className="text-gray-500 text-sm">
                      Memuat data warehouse...
                    </p>
                  </div>
                </div>
              ) : accounts?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <User className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-sm max-w-md">
                    {filter.searchKey
                      ? "Coba ubah kata kunci pencarian atau filter yang digunakan"
                      : "Mulai dengan menambahkan warehouse pertama Anda"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="table w-full">
                    <thead className="sticky top-0 z-10 backdrop-blur">
                      <tr className="border-b border-leaf-green-100">
                        <th className="font-semibold text-gray-700 py-4 px-4">
                          Username
                        </th>
                        <th className="font-semibold text-gray-700 py-4 px-4">
                          Deskripsi
                        </th>
                        <th className="font-semibold text-gray-700 py-4 px-4">
                          Role
                        </th>
                        <th className="font-semibold text-gray-700 py-4 px-4">
                          Current Login
                        </th>
                        <th className="font-semibold text-gray-700 py-4 px-4">
                          Accessible warehouses
                        </th>
                        <th className="font-semibold text-gray-700 py-4 px-4">
                          Status
                        </th>
                        <th className="font-semibold text-gray-700 py-4 px-4">
                          Aksi
                        </th>
                      </tr>
                    </thead>

                    <tbody className="">
                      {accounts?.length > 0 ? (
                        accounts?.map((account: UserInfo, index: number) => (
                          <tr
                            key={index}
                            className={`hover:bg-gray-50 transition-colors ${
                              index % 2 === 0 ? "bg-gray-25" : "bg-white"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <User2 className="w-4 h-4 text-leaf-green-500 flex-shrink-0" />
                                <span className="font-semibold text-gray-800">
                                  {account.username}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {account.description ? (
                                <div className="flex items-center space-x-1 text-gray-700">
                                  <IdCardIcon className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm">
                                    {account.description}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </td>{" "}
                            <td className="px-4 py-3">
                              {account.role ? (
                                <div className="flex items-center space-x-1 text-gray-700">
                                  <Award className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm">
                                    {account.role}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 max-w-xs">
                              {account.homeWarehouse ? (
                                <span className="text-sm line-clamp-2">
                                  {account.homeWarehouse.name || "-"}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-sm">
                                  vendor {account.vendorName}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-1 text-gray-700">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-sm">
                                  {account?.warehouseAccess?.length}
                                </span>
                                <Plus
                                  className="w-4 h-4 text-gray-400 cursor-pointer"
                                  onClick={() =>
                                    router.push("/admin/all-warehouse")
                                  }
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  account.isActive
                                    ? "bg-leaf-green-100 text-leaf-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                <div
                                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                    account.isActive
                                      ? "bg-leaf-green-500"
                                      : "bg-red-500"
                                  }`}
                                ></div>
                                {account.isActive ? "Aktif" : "Tidak Aktif"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 items-center gap-x-2">
                                <button
                                  onClick={() => {
                                    handleOpenEdit(account);
                                  }}
                                  className="btn btn-sm btn-ghost hover:bg-leaf-green-50 hover:text-leaf-green-600 text-gray-500 transition-colors"
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
                                  className={`btn text-red-400 font-bold  ${
                                    account.homeWarehouse ? "" : ""
                                  } hover:bg-red-50 hover:text-red-600 transition-colors`}
                                >
                                  <Trash2 className="w-4 h-4 " />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-4">
                            Tidak ada data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Pagination */}
            <PaginationFullTable
              data={accounts}
              filter={filter}
              isLoading={isLoading}
              setFilter={setFilter}
              key={"PaginationFullTable"}
            />
          </div>
        </div>
      </main>
      <UserEditModalForm
        formData={formData}
        setFormData={setFormData}
        submitCreate={(data) => handleCreateAppUser(data ?? formData)}
        isCreating={isCreating}
        submitUpdate={(data) => handleUpdateUser(data ?? formData)}
        key={`UserEditModalForm-${editModalKey}`}
      />
      <ConfirmationModal
        message="Yakin menghapus user ini ?"
        modalId="delete-app-user"
        onConfirm={handleDeleteAppUser}
        title="konfirmasi delete-app-user?"
        key={"delete-app-user"}
      />
      <dialog id="upload-csv" className="modal">
        <div className="modal-box max-w-3xl">
          <h3 className="font-bold text-lg">Upload Users via CSV</h3>

          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-md my-4">
            <div className="flex items-center mb-3">
              <Info className="text-blue-500 mr-2" size={20} />
              <span className="font-semibold text-blue-800 text-sm uppercase tracking-wider">
                Instruksi Bulk Upload CSV
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-blue-700 mb-2">
                  Header CSV (baris pertama):
                </p>
                <div className="bg-white p-3 rounded border border-blue-200 font-mono text-sm overflow-x-auto">
                  username,password,displayName,role,isActive,homeWarehouse,vendorName,description
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-sm">
                  <p className="font-medium text-blue-800 mb-2">
                    📌 Ketentuan:
                  </p>
                  <ul className="space-y-1 text-blue-700 list-disc ml-4">
                    <li>
                      <strong>username</strong>: wajib diisi
                    </li>
                    <li>
                      <strong>password</strong>: opsional, default 'default123'
                    </li>
                    <li>
                      <strong>isActive</strong>: true/1/ya/aktif
                    </li>
                  </ul>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-blue-800 mb-2">🏢 Relasi:</p>
                  <ul className="space-y-1 text-blue-700 list-disc ml-4">
                    <li>
                      <strong>homeWarehouse</strong>: nama gudang
                    </li>
                    <li>
                      <strong>vendorName</strong>: nama vendor
                    </li>
                  </ul>
                </div>
              </div>

              {/* Input file hidden */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                className="hidden"
              />

              {/* Tombol upload yang lebih reliable */}
              <button
                type="button"
                onClick={handleButtonClick}
                disabled={
                  handleUploadUsers.isPending || handleUploadUsers.isPending
                }
                className="btn btn-primary w-full"
              >
                {handleUploadUsers.isPending || handleUploadUsers.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload size={20} className="mr-2" />
                    Pilih File CSV
                  </>
                )}
              </button>

              {/* Debug info (opsional, hapus di production) */}
              {process.env.NODE_ENV === "development" && (
                <div className="text-xs text-gray-500 mt-2">
                  * Jika upload gagal, coba gunakan delimiter koma (,) atau
                  titik koma (;)
                </div>
              )}
            </div>
          </div>

          <div className="modal-action">
            <form method="dialog">
              <button
                className="btn"
                onClick={() => {
                  // Reset states when closing
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              >
                Close
              </button>
            </form>
          </div>
        </div>
        <Toaster />
      </dialog>
    </div>
  );
};

export default MemberManagementPage;

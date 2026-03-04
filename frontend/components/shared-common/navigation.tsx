"use client";

import {
  ChevronDown,
  LogIn,
  LogOut,
  Truck,
  User2,
  Building2,
  Check,
  WarehouseIcon,
  Search,
  Handshake,
  ChevronRight,
} from "lucide-react";
import { useUserInfo } from "../UserContext";
import { Suspense, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AuthApi } from "@/api/auth";
import { toast } from "sonner";
import { OrganizationApi } from "@/api/organization.api";
import { WarehouseApi } from "@/api/warehouse.api";
import { Organization } from "@/types/organization";
import { Warehouse } from "@/types/warehouse";
import {
  adminMenuItems,
  ITOnlyMenus,
  vendorMenutItems,
} from "../admin/side-nav";
import ProfileModal from "./ProfileModal";
import LoginModal from "./login-modal";
import { ROLE } from "@/types/shared.type";
import Loading from "./Loading";

export default function Navigation() {
  const { userInfo, setUserInfo } = useUserInfo();

  //search menu
  const searchBar = useRef<HTMLInputElement | null>(null);
  const am_i_vendor = userInfo?.vendorName ? true : false;

  const menus = [...adminMenuItems, ...ITOnlyMenus, ...vendorMenutItems];
  const [searchKeyMenu, setSearchKeyMenu] = useState("");
  const [filteredMenus, setFilterMenus] = useState([]);

  const { data: warehouseAccess } = useQuery({
    queryKey: ["my-access-warehouses"],
    queryFn: WarehouseApi.getMyAccessWarehouses,
    enabled: am_i_vendor === false && !!userInfo,
  });

  const { data: myOrganizations } = useQuery({
    queryKey: ["my-organizations"],
    queryFn: OrganizationApi.getMyOrganizations,
  });

  const { mutateAsync: handleLogout } = useMutation({
    mutationKey: ["userInfo"],
    mutationFn: AuthApi.logout,
    onSuccess: () => {
      setUserInfo(null);
      window.location.href = "/antrian";
    },
    onError: (er: any) => {
      window.location.href = "/antrian";
    },
  });

  const { mutateAsync: handleSwitchWarehouse } = useMutation({
    mutationKey: ["userInfo"],
    mutationFn: async (id: string) =>
      await WarehouseApi.switchHomeWarehouse(id),
    onSuccess: (res) => {
      setUserInfo(res);
      window.location.reload();
    },
    onError: (re: any) => {
      toast.error(re?.response.data.message);
    },
  });

  const { mutateAsync: handleSwitchOrganization } = useMutation({
    mutationKey: ["userInfo"],
    mutationFn: async (id: string) =>
      await OrganizationApi.switchOrganization(id),
    onSuccess: (res) => {
      setUserInfo(res);
      window.location.reload();
    },
    onError: (re: any) => {
      toast.error(re?.response.data.message);
    },
  });

  // 1️⃣ Ctrl+K fokus + click outside untuk clear menu
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        searchBar.current?.focus();
        setFilterMenus(menus);
      }
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        searchBar.current &&
        !searchBar.current.contains(event.target as Node)
      ) {
        setFilterMenus([]);
      }
    }

    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 2️⃣ Filter menu saat searchKeyMenu berubah
  useEffect(() => {
    if (searchKeyMenu.length > 0) {
      const filtered = menus.filter((menu) =>
        menu.label.toLowerCase().includes(searchKeyMenu.toLowerCase()),
      );
      setFilterMenus(filtered);
    } else {
      setFilterMenus([]);
    }
  }, [searchKeyMenu]);

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <Suspense fallback={<Loading />}>
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className={"flex justify-between items-center py-2 "}>
            {/* Logo & Brand */}
            <div
              className="flex items-center space-x-4 hover:cursor-pointer"
              onClick={() => redirect("/")}
            >
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
                  <Truck className="text-white" size={24} />
                </div>
                <div className="flex flex-col max-xl:hidden group">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl  font-bold bg-gradient-to-r text-primary bg-clip-text animate-gradient bg-[length:200%_auto]">
                      Catur Queue
                      <span className="text-cyan-300 ml-1 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                        Realtime
                      </span>
                    </h1>
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
                      <div className="relative badge badge-accent px-3 py-1 font-medium text-white bg-gradient-to-r from-cyan-600 to-teal-600 border-0">
                        beta
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Suspense
              fallback={
                <span className="loading loading-ring loading-lg"></span>
              }
            >
              {userInfo && (
                <div ref={searchBar} className="relative group max-lg:hidden">
                  {/* Search Input Container */}
                  <div className="relative">
                    <input
                      type="text"
                      value={searchKeyMenu}
                      onChange={(e) => setSearchKeyMenu(e.target.value)}
                      placeholder="Cari menu..."
                      className="w-full md:w-[360px] pl-10 pr-28 py-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-300 shadow-sm hover:shadow-lg text-gray-700 placeholder-gray-400"
                    />

                    {/* Search Icon */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Search className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Keyboard Shortcut */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <div className="flex items-center gap-1 bg-gradient-to-r from-gray-50 to-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                        <kbd className="px-1.5 py-0.5 text-xs font-medium bg-white border border-gray-300 rounded-md shadow-sm text-gray-600 min-w-[24px] text-center">
                          Search
                        </kbd>
                      </div>
                    </div>
                  </div>

                  {/* Search Results Dropdown */}
                  {filteredMenus.length > 0 && searchKeyMenu && (
                    <div className="absolute z-50 mt-3 w-full md:w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-blue-100/50 backdrop-blur-sm overflow-hidden animate-fadeIn">
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50/30">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-700">
                            Hasil Pencarian
                            <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              {filteredMenus.length}
                            </span>
                          </p>
                          <span className="text-xs text-gray-400">
                            Tekan Esc untuk tutup
                          </span>
                        </div>
                      </div>

                      {/* Results List */}
                      <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
                        {filteredMenus.map((menu) => {
                          const IconComponent = menu.icon;
                          return (
                            <div
                              key={menu.id}
                              onClick={() => redirect(menu.href || menu.link)}
                              className="group/item px-4 py-3 hover:bg-blue-50/50 cursor-pointer transition-all duration-200 border-b border-gray-50 last:border-b-0 active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-3">
                                {/* Icon Container */}
                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center group-hover/item:shadow-sm transition-shadow">
                                  {IconComponent && (
                                    <IconComponent className="w-5 h-5 text-blue-600 group-hover/item:scale-110 transition-transform" />
                                  )}
                                </div>

                                {/* Menu Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-medium text-gray-800 group-hover/item:text-blue-700 truncate">
                                      {menu.label}
                                    </h3>
                                    {/* Badge untuk role */}
                                    {menu.roles?.includes(
                                      ROLE.ADMIN_ORGANIZATION,
                                    ) && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                        Admin
                                      </span>
                                    )}
                                    {menu.roles?.includes(
                                      ROLE.ADMIN_VENDOR,
                                    ) && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                        Vendor
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {menu.href || menu.link}
                                  </p>
                                </div>

                                {/* Arrow Indicator */}
                                <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                                  <ChevronRight className="w-5 h-5 text-blue-400" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                        <p className="text-xs text-gray-400 text-center">
                          Gunakan ↑↓ untuk navigasi • Enter untuk memilih
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Suspense>

            {/* Right Section - Login/User Menu */}
            <div className="flex items-center space-x-4">
              {/* Login Button (when not logged in) */}
              {!userInfo && (
                <button
                  onClick={() =>
                    (
                      document.getElementById(
                        "login_modal",
                      ) as HTMLDialogElement
                    ).showModal()
                  }
                  className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white px-5 btn "
                >
                  <LogIn />
                  <span className="max-md:hidden">Login</span>
                </button>
              )}

              {/* User Menu (when logged in) */}
              <Suspense>
                {userInfo && (
                  <div className="flex items-center gap-x-4">
                    {/* Organization & Warehouse Switcher */}
                    <div className="flex items-center gap-x-3">
                      {/* Organization Switcher */}
                      <div className="dropdown  dropdown-center">
                        <div
                          tabIndex={0}
                          className="flex items-center gap-x-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-300 cursor-pointer group md:min-w-[160px]"
                        >
                          <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0 max-md:hidden">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                              {userInfo.organizationName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              Organization
                            </p>
                          </div>
                          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors duration-200" />
                        </div>

                        {myOrganizations?.length > 0 && (
                          <ul className="dropdown-content z-[1] menu p-2 shadow-2xl bg-white rounded-xl w-80 mt-2 border border-gray-100 overflow-y-auto max-h-[400px]">
                            {myOrganizations?.map((org: Organization) => (
                              <li key={org.name}>
                                <button
                                  onClick={() =>
                                    handleSwitchOrganization(org.name)
                                  }
                                  className={`flex items-center gap-x-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                                    org.name === userInfo?.organizationName
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : "hover:bg-gray-50 text-gray-700"
                                  }`}
                                >
                                  <Building2
                                    className={`w-4 h-4 flex-shrink-0 ${
                                      (org.name as any) ===
                                      (userInfo?.organizationName as any)
                                        ? "text-blue-500"
                                        : "text-gray-400"
                                    }`}
                                  />
                                  <div className="flex-1 text-left">
                                    <p className="font-medium text-sm">
                                      {org.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Organization
                                    </p>
                                  </div>
                                  {org.name ===
                                    (userInfo?.organizationName as any) && (
                                    <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {am_i_vendor ? (
                        <div className=" dropdown-center ">
                          <div
                            tabIndex={0}
                            className="flex items-center  gap-x-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-lg transition-all duration-300 cursor-pointer group "
                          >
                            <Handshake className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0 max-xs:hidden">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {userInfo?.vendorName || "Terjadi kesalahan"}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                Vendor
                              </p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors duration-200" />
                          </div>
                        </div>
                      ) : (
                        <div className="dropdown  dropdown-center ">
                          {/* Warehouse Switcher */}
                          <div
                            tabIndex={0}
                            className="flex items-center gap-x-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-lg transition-all duration-300 cursor-pointer group md:min-w-[160px] "
                          >
                            <WarehouseIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0 max-xs:hidden ">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {userInfo?.homeWarehouse?.name ||
                                  "Terjadi kesalahan"}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                Warehouse
                              </p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors duration-200" />
                          </div>

                          <ul className="dropdown-content z-[1] menu p-2 shadow-2xl bg-white rounded-xl w-80 mt-2 border border-gray-100 overflow-y-auto max-h-[400px]">
                            {warehouseAccess?.length > 0 &&
                              warehouseAccess?.map((warehouse: Warehouse) => (
                                <li key={warehouse.id}>
                                  <button
                                    onClick={() =>
                                      handleSwitchWarehouse(warehouse.id)
                                    }
                                    className={`flex items-center gap-x-3 px-3 py-3 rounded-lg transition-all duration-200 ${
                                      warehouse?.id ===
                                      userInfo?.homeWarehouse?.id
                                        ? "bg-green-50 text-green-700 border border-green-200"
                                        : "hover:bg-gray-50 text-gray-700"
                                    }`}
                                  >
                                    <WarehouseIcon
                                      className={`w-4 h-4 flex-shrink-0 ${
                                        warehouse?.id ===
                                        userInfo?.homeWarehouse?.id
                                          ? "text-green-500"
                                          : "text-gray-400"
                                      }`}
                                    />
                                    <div className="flex-1 text-left">
                                      <p className="font-medium text-sm">
                                        {warehouse.name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {warehouse.location}
                                      </p>
                                      <p className="text-xs text-gray-700 flex  items-center gap-x-2 mt-2">
                                        <Building2 size={10} />{" "}
                                        {warehouse.organizationName}
                                      </p>
                                    </div>
                                    {warehouse.id ===
                                      userInfo?.homeWarehouse?.id && (
                                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    )}
                                  </button>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* User Profile Dropdown */}
                    <div className="dropdown dropdown-end">
                      <div
                        tabIndex={0}
                        className="flex items-center space-x-3 cursor-pointer group p-2 rounded-xl hover:bg-white/80 backdrop-blur-sm transition-all duration-300"
                      >
                        <div className="text-right hidden sm:block">
                          <p className="font-semibold text-gray-800 text-sm">
                            {userInfo?.username}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {userInfo?.role || "Vendor"}
                          </p>
                        </div>
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                            {userInfo?.displayName?.charAt(0) ||
                              userInfo?.username?.charAt(0) ||
                              "U"}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
                        </div>
                      </div>

                      <ul className="dropdown-content z-[1] menu p-3 shadow-2xl bg-white rounded-2xl w-72 mt-2 border border-gray-100">
                        {/* User Info Header */}
                        <li className="border-b border-gray-100">
                          <div className="px-4 py-3">
                            <div className="flex items-center gap-x-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {userInfo?.displayName?.charAt(0) ||
                                  userInfo?.username?.charAt(0) ||
                                  "U"}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800">
                                  {userInfo?.displayName || userInfo?.username}
                                </p>
                                <p className="text-sm text-gray-500 capitalize">
                                  {userInfo?.role}
                                </p>
                                <p className="text-md font-bold text-gray-400 mt-1">
                                  {userInfo?.organizationName}
                                </p>
                              </div>
                            </div>
                          </div>
                        </li>

                        {/* Profile Button */}
                        <li>
                          <button
                            onClick={() =>
                              (
                                document.getElementById(
                                  "profile_modal",
                                ) as HTMLDialogElement
                              ).showModal()
                            }
                            className="flex items-center gap-x-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-all duration-200 group"
                          >
                            <User2 className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            <span>
                              Profile{" "}
                              {userInfo?.description === "admin"
                                ? "Admin"
                                : "Vendor"}
                            </span>
                          </button>
                        </li>
                        {/* Logout */}
                        <li className="border-t border-gray-100 mt-2">
                          <button
                            onClick={() => handleLogout()}
                            className="flex items-center gap-x-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group w-full text-left"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Keluar</span>
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </Suspense>
            </div>
          </div>
        </div>
      </Suspense>

      {/* Login Modal */}
      <LoginModal key={"login_modal"} />

      <Suspense fallback={<Loading />}>
        <ProfileModal key={"profile_modal"} />
      </Suspense>
    </nav>
  );
}

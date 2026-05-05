"use client";

import {
  ChevronDown,
  LogIn,
  LogOut,
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
        <div className="relative z-10 ">
          {/* Background dengan efek glassmorphism */}
          <div className="fixed top-0 left-0 right-0 z-20">
            <div className="relative backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-lg shadow-black/5">
              {/* Gradient line at top */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

              <div className=" px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16 lg:h-20">
                  {/* Logo & Brand Section - Modern dengan efek hover */}
                  <div
                    className="group flex items-center gap-3 cursor-pointer"
                    onClick={() => redirect("/")}
                  >
                    {/* Logo Container dengan animasi */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-teal-100 to-white-400 rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                      <div className="relative bg-gradient-to-br from-teal-100 via-white-500 to-white-600 p-2.5 rounded-2xl shadow-lg group-hover:shadow-2xl group-hover:scale-105 transition-duration-300">
                        <img
                          src="/antrian/csi-logo.png"
                          alt="CSI Logo"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                    </div>

                    {/* Text Brand */}
                    <div className="hidden lg:block">
                      <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 bg-clip-text text-transparent">
                          Catur antrian
                        </h1>

                        {/* Realtime Badge dengan animasi pulse */}
                        <div className="relative group/badge">
                          <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-md opacity-75 group-hover/badge:opacity-100 transition-opacity animate-pulse" />
                          <div className="relative px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-red-500 to-pink-500 rounded-full shadow-lg">
                            <span className="flex items-center gap-1">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                              </span>
                              REALTIME
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search Section - Modern & Elegant */}
                  <Suspense
                    fallback={
                      <div className="animate-pulse">
                        <div className="w-[360px] h-12 bg-gray-200/50 rounded-2xl backdrop-blur-sm" />
                      </div>
                    }
                  >
                    {userInfo && (
                      <div ref={searchBar} className="relative hidden lg:block">
                        {/* Search Input dengan efek modern */}
                        <div className="relative group/input">
                          {/* Glow effect on focus */}
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-300" />

                          <input
                            type="text"
                            value={searchKeyMenu}
                            onChange={(e) => setSearchKeyMenu(e.target.value)}
                            placeholder="Cari menu atau fitur..."
                            className="relative w-[400px] pl-12 pr-32 py-2.5 bg-white/80 backdrop-blur-sm border border-gray-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-300 text-gray-700 placeholder-gray-400 shadow-sm hover:shadow-md"
                          />

                          {/* Search Icon dengan animasi */}
                          <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            <Search className="w-5 h-5 text-gray-400 group-hover/input:text-blue-500 transition-colors duration-200" />
                          </div>

                          {/* Keyboard Shortcut Indicator */}
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl border border-gray-200 shadow-sm">
                              <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-600 bg-white rounded-md shadow-sm">
                                ⌘
                              </kbd>
                              <span className="text-xs text-gray-500">K</span>
                            </div>
                          </div>
                        </div>

                        {/* Search Results Dropdown - Modern dengan animasi */}
                        {filteredMenus.length > 0 && searchKeyMenu && (
                          <div className="absolute z-50 mt-3 w-[480px] bg-white/95 backdrop-blur-xl border border-gray-200/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Header dengan gradient */}
                            <div className="px-5 py-4 bg-gradient-to-r from-gray-50 via-blue-50/30 to-gray-50 border-b border-gray-200/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Search className="w-4 h-4 text-blue-500" />
                                  <p className="text-sm font-semibold text-gray-700">
                                    Hasil Pencarian
                                  </p>
                                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                                    {filteredMenus.length}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 rounded">
                                    ESC
                                  </kbd>
                                  tutup
                                </span>
                              </div>
                            </div>

                            {/* Results dengan scroll custom */}
                            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
                              {filteredMenus.map((menu, index) => {
                                const IconComponent = menu.icon;
                                return (
                                  <div
                                    key={menu.id}
                                    onClick={() =>
                                      redirect(menu.href || menu.link)
                                    }
                                    className="group/item relative px-5 py-3 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent cursor-pointer transition-all duration-200 border-b border-gray-100/50 last:border-b-0"
                                    style={{
                                      animationDelay: `${index * 50}ms`,
                                    }}
                                  >
                                    <div className="flex items-center gap-4">
                                      {/* Icon dengan efek modern */}
                                      <div className="relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-xl blur opacity-0 group-hover/item:opacity-50 transition-opacity duration-300" />
                                        <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center group-hover/item:shadow-md transition-all group-hover/item:scale-105">
                                          {IconComponent && (
                                            <IconComponent className="w-5 h-5 text-blue-600 group-hover/item:text-blue-700 transition-transform" />
                                          )}
                                        </div>
                                      </div>

                                      {/* Menu Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <h3 className="font-semibold text-gray-800 group-hover/item:text-blue-700 transition-colors">
                                            {menu.label}
                                          </h3>
                                          {menu.roles?.includes(
                                            ROLE.ADMIN_ORGANIZATION,
                                          ) && (
                                            <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                              Admin
                                            </span>
                                          )}
                                          {menu.roles?.includes(
                                            ROLE.ADMIN_VENDOR,
                                          ) && (
                                            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                              Vendor
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-500 truncate mt-0.5">
                                          {menu.href || menu.link}
                                        </p>
                                      </div>

                                      {/* Arrow dengan animasi */}
                                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover/item:text-blue-500 group-hover/item:translate-x-1 transition-all duration-200" />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Footer dengan keyboard navigation info */}
                            <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-200/50">
                              <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-3">
                                <span className="flex items-center gap-1">
                                  <kbd className="px-1.5 py-0.5 text-xs bg-white rounded shadow-sm">
                                    ↑
                                  </kbd>
                                  <kbd className="px-1.5 py-0.5 text-xs bg-white rounded shadow-sm">
                                    ↓
                                  </kbd>
                                  <span className="ml-1">navigasi</span>
                                </span>
                                <span className="flex items-center gap-1">
                                  <kbd className="px-1.5 py-0.5 text-xs bg-white rounded shadow-sm">
                                    Enter
                                  </kbd>
                                  <span>pilih</span>
                                </span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Suspense>

                  {/* Right Section - User Controls Modern */}
                  <div className="flex items-center gap-3">
                    {/* Login Button */}
                    {!userInfo && (
                      <button
                        onClick={() =>
                          (
                            document.getElementById(
                              "login_modal",
                            ) as HTMLDialogElement
                          ).showModal()
                        }
                        className="group relative px-6 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-xl text-white font-medium shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-300 hover:scale-105"
                      >
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="relative flex items-center gap-2">
                          <LogIn className="w-4 h-4" />
                          <span className="hidden sm:inline">Login</span>
                        </div>
                      </button>
                    )}

                    {/* User Controls when logged in */}
                    <Suspense>
                      {userInfo && (
                        <div className="flex items-center gap-3">
                          {/* Organization & Warehouse Section */}
                          <div className="hidden md:flex items-center gap-3">
                            {/* Organization Switcher - Modern Card Style */}
                            <div className="dropdown dropdown-center">
                              <div
                                tabIndex={0}
                                className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl hover:border-blue-300 hover:shadow-lg hover:bg-white/80 transition-all duration-300 cursor-pointer group"
                              >
                                <Building2 className="w-4 h-4 text-blue-500" />
                                <div className="hidden lg:block text-left">
                                  <p className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">
                                    {userInfo.organizationName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Organization
                                  </p>
                                </div>
                                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                              </div>

                              {myOrganizations?.length > 0 && (
                                <ul className="dropdown-content z-[1] p-2 mt-3 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50">
                                  {myOrganizations?.map((org: Organization) => (
                                    <li key={org.name}>
                                      <button
                                        onClick={() =>
                                          handleSwitchOrganization(org.name)
                                        }
                                        className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all duration-200 ${
                                          org.name ===
                                          userInfo?.organizationName
                                            ? "bg-blue-50 text-blue-700"
                                            : "hover:bg-gray-50 text-gray-700"
                                        }`}
                                      >
                                        <Building2
                                          className={`w-4 h-4 flex-shrink-0 ${
                                            org.name ===
                                            userInfo?.organizationName
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
                                          userInfo?.organizationName && (
                                          <Check className="w-4 h-4 text-blue-500" />
                                        )}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* Warehouse/Vendor Switcher */}
                            {am_i_vendor ? (
                              <div className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl">
                                <Handshake className="w-4 h-4 text-red-500" />
                                <div className="hidden lg:block">
                                  <p className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">
                                    {userInfo?.vendorName || "Vendor"}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Vendor
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="dropdown dropdown-center">
                                <div
                                  tabIndex={0}
                                  className="flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm border border-gray-200/80 rounded-xl hover:border-green-300 hover:shadow-lg hover:bg-white/80 transition-all duration-300 cursor-pointer group"
                                >
                                  <WarehouseIcon className="w-4 h-4 text-green-500" />
                                  <div className="hidden lg:block text-left">
                                    <p className="text-sm font-semibold text-gray-800 max-w-[120px] truncate">
                                      {userInfo?.homeWarehouse?.name ||
                                        "Warehouse"}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      Warehouse
                                    </p>
                                  </div>
                                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                                </div>

                                <ul className="dropdown-content z-[1] p-2 mt-3 w-96 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 max-h-[80vh] overflow-y-auto">
                                  {warehouseAccess?.length > 0 &&
                                    warehouseAccess?.map(
                                      (warehouse: Warehouse) => (
                                        <li key={warehouse.id}>
                                          <button
                                            onClick={() =>
                                              handleSwitchWarehouse(
                                                warehouse.id,
                                              )
                                            }
                                            className={`flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all duration-200 ${
                                              warehouse?.id ===
                                              userInfo?.homeWarehouse?.id
                                                ? "bg-green-50 text-green-700"
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
                                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                                <Building2 size={10} />{" "}
                                                {warehouse.organizationName}
                                              </p>
                                            </div>
                                            {warehouse.id ===
                                              userInfo?.homeWarehouse?.id && (
                                              <Check className="w-4 h-4 text-green-500" />
                                            )}
                                          </button>
                                        </li>
                                      ),
                                    )}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* User Profile - Modern Avatar with Dropdown */}
                          <div className="dropdown dropdown-end">
                            <div
                              tabIndex={0}
                              className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-xl hover:bg-white/60 backdrop-blur-sm transition-all duration-300"
                            >
                              {/* User Info Text */}
                              <div className="hidden md:block text-right">
                                <p className="font-semibold text-gray-800 text-sm">
                                  {userInfo?.username}
                                </p>
                                <p className="text-xs text-gray-500 capitalize flex items-center gap-1 justify-end">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      userInfo?.role === "admin"
                                        ? "bg-purple-500"
                                        : "bg-green-500"
                                    }`}
                                  />
                                  {userInfo?.role || "Vendor"}
                                </p>
                              </div>

                              {/* Avatar dengan efek modern */}
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-md opacity-0 group-hover:opacity-75 transition-opacity duration-300" />
                                <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-105 transition-all duration-300">
                                  {userInfo?.displayName?.charAt(0) ||
                                    userInfo?.username?.charAt(0) ||
                                    "U"}
                                </div>
                                {/* Online indicator */}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                              </div>
                            </div>

                            {/* Dropdown Menu - Modern Card */}
                            <ul className="dropdown-content z-[1] p-2 mt-3 w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50">
                              {/* User Info Header */}
                              <li className="border-b border-gray-200/50">
                                <div className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                                      {userInfo?.displayName?.charAt(0) ||
                                        userInfo?.username?.charAt(0) ||
                                        "U"}
                                    </div>
                                    <div className="flex-1">
                                      <p className="font-semibold text-gray-800">
                                        {userInfo?.displayName ||
                                          userInfo?.username}
                                      </p>
                                      <p className="text-sm text-gray-500 capitalize">
                                        {userInfo?.role}
                                      </p>
                                      <p className="text-xs font-medium text-gray-400 mt-1">
                                        {userInfo?.organizationName}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </li>

                              {/* Profile Menu Item */}
                              <li>
                                <button
                                  onClick={() =>
                                    (
                                      document.getElementById(
                                        "profile_modal",
                                      ) as HTMLDialogElement
                                    ).showModal()
                                  }
                                  className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-transparent rounded-xl transition-all duration-200 group"
                                >
                                  <User2 className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                  <span className="flex-1 text-left">
                                    Profile{" "}
                                    {userInfo?.description === "admin"
                                      ? "Admin"
                                      : "Vendor"}
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </button>
                              </li>

                              {/* Logout */}
                              <li className="border-t border-gray-200/50 mt-2 pt-2">
                                <button
                                  onClick={() => handleLogout()}
                                  className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group"
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

              {/* Bottom gradient line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            </div>
          </div>

          {/* Spacer to prevent content from hiding behind fixed navbar */}
          <div className="h-16 lg:h-20" />
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

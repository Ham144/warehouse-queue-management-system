"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  Users,
  BarChart3,
  Truck,
  DoorOpen,
  Settings,
  WarehouseIcon,
  Settings2Icon,
  Users2Icon,
  Tv2,
  Rocket,
  Building2,
  PenTool,
  Crown,
  MessageCircle,
  MapPin,
} from "lucide-react";
import { useRef, useState } from "react";
import { useUserInfo } from "../UserContext";
import { ROLE } from "@/types/shared.type";

export const adminMenuItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
  {
    id: "queue",
    label: "Live Queue",
    icon: Tv2,
    href: "/admin/queue",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
  {
    id: "slots",
    label: "Gate Management",
    icon: DoorOpen,
    href: "/admin/gate",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
  {
    id: "busy-times",
    label: "Busy Times",
    icon: Clock,
    href: "/admin/busy-times",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    href: "/admin/reports",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
  {
    id: "vehicles",
    label: "Vehicles",
    icon: Truck,
    href: "/admin/vehicles",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
  {
    id: "my warehouse",
    label: "My Warehouse",
    icon: WarehouseIcon,
    href: "/admin/my-warehouse",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
  {
    id: "warehouse setting",
    label: "Warehouse Setting",
    icon: Settings,
    href: "/admin/settings",
    roles: [ROLE.ADMIN_ORGANIZATION, ROLE.USER_ORGANIZATION, ROLE.ADMIN_GUDANG],
  },
];

export const ITOnlyMenus = [
  //IT Only---------
  {
    id: "All Warehouses",
    label: "All Warehouses",
    icon: Building2,
    href: "/admin/all-warehouse",
    roles: [ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "Organization Management",
    label: "Organization Management",
    icon: Crown,
    href: "/admin/organization-management",
    roles: [ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "members management",
    label: "members Management",
    icon: Users2Icon,
    href: "/admin/member-management",
    roles: [ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "Organization Setting",
    label: "Organization Setting",
    icon: Settings2Icon,
    href: "/admin/organization-settings",
    roles: [ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "Global Setting",
    label: "Global Setting",
    icon: PenTool,
    href: "/admin/global-settings",
    roles: [ROLE.ADMIN_ORGANIZATION],
  },
];

export const vendorMenutItems = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/vendor/dashboard",
    roles: [ROLE.ADMIN_VENDOR, ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "booking",
    label: "Plan Visit",
    icon: Rocket,
    href: "/vendor/booking",
    roles: [ROLE.ADMIN_VENDOR, ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "history",
    label: "History Booking",
    icon: Clock,
    href: "/vendor/history",
    roles: [ROLE.ADMIN_VENDOR, ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "Members",
    label: "Member Management",
    icon: Users,
    href: "/vendor/member-management",
    roles: [ROLE.ADMIN_VENDOR, ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    href: "/vendor/reports",
    roles: [ROLE.ADMIN_VENDOR, ROLE.ADMIN_ORGANIZATION],
  },
  {
    id: "driver menu",
    label: "Driver Menu",
    icon: Truck,
    href: "/vendor/driver-menu",
    roles: [ROLE.DRIVER_VENDOR, ROLE.ADMIN_ORGANIZATION],
  },
];

export const nonSidebarFeatures = [
  {
    id: "chat",
    label: "Chat/Messenger",
    icon: MessageCircle,
  },
  {
    id: "gps",
    label: "GPS tracking supir",
    icon: MapPin,
  },
];

export const allMenuAndFeatures = [
  ...nonSidebarFeatures,
  ...adminMenuItems,
  ...ITOnlyMenus,
  ...vendorMenutItems,
];

const SideNav = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { userInfo } = useUserInfo();

  // Helper function untuk render menu items
  const renderMenuItem = (
    item: any,
    colorScheme: {
      active: string;
      hover: string;
      text: string;
      indicator: string;
      icon: string;
    },
  ) => {
    const Icon = item.icon;
    const active = pathname === item.href;

    return (
      <Link
        key={item.id}
        href={item.href}
        className={`
          group relative flex items-center gap-3 px-3 py-3 rounded-xl mx-1 my-1
          transition-all duration-300 ease-out
          overflow-hidden
          ${
            active
              ? colorScheme.active
              : `${colorScheme.text} ${colorScheme.hover}`
          }
        `}
      >
        {/* Active indicator */}
        {active && (
          <div
            className={`
              absolute left-0 top-1/2 -translate-y-1/2 
              w-1 h-8 rounded-r-full
              ${colorScheme.indicator}
            `}
          />
        )}

        {/* Icon */}
        <div
          className={`
            relative flex items-center justify-center
            transition-all duration-300
            ${
              active
                ? "text-white"
                : `${colorScheme.icon} group-hover:scale-110 group-hover:rotate-3`
            }
          `}
        >
          <Icon size={20} className="flex-shrink-0" />
        </div>

        {/* Label - LANGSUNG MUNCUL saat sidebar di-hover */}
        <span
          className={`
            text-sm font-medium whitespace-nowrap
            transition-all duration-300
            ${active ? "text-white" : colorScheme.text}
            group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0
            opacity-0 -translate-x-4
          `}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <div className="max-h-screen flex flex-col w-full">
      <div className="flex flex-1">
        {/* SIDEBAR - Modern dengan efek glassmorphism */}
        {userInfo?.role != ROLE.DRIVER_VENDOR && (
          <aside
            ref={sidebarRef}
            className={`
              fixed left-0 top-13 h-screen z-20
              bg-gradient-to-b from-white/80 via-white/70 to-white/80
              backdrop-blur-xl
              border-r border-white/20
              shadow-2xl shadow-black/5
              transition-all duration-500 ease-out
              no-scrollbar w-16
              hover:w-48
              group/sidebar
            `}
          >
            {/* Gradient border atas yang halus */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent"></div>

            {/* Navigation */}
            <nav className="flex-1 no-scrollbar overflow-auto max-h-screen pb-32 pt-4">
              {/* Admin Menu Items */}
              {adminMenuItems
                .filter((item) =>
                  item.roles.some((role) => userInfo?.role === role),
                )
                .map((item) =>
                  renderMenuItem(item, {
                    active:
                      "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-lg shadow-emerald-500/20",
                    hover:
                      "hover:bg-emerald-50/60 hover:shadow-md hover:shadow-emerald-500/10",
                    text: "text-emerald-700",
                    indicator:
                      "bg-gradient-to-b from-emerald-400 to-emerald-500",
                    icon: "text-emerald-500 group-hover:text-emerald-600",
                  }),
                )}

              {/* Separator dengan efek modern */}
              {ITOnlyMenus.length > 0 && adminMenuItems.length > 0 && (
                <div className="relative my-3 mx-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200/50"></div>
                  </div>
                </div>
              )}

              {/* IT Menu Items */}
              {ITOnlyMenus.filter((item) =>
                item.roles.some((role) => userInfo?.role === role),
              ).map((item) =>
                renderMenuItem(item, {
                  active:
                    "bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-500/20",
                  hover:
                    "hover:bg-blue-50/60 hover:shadow-md hover:shadow-blue-500/10",
                  text: "text-blue-700",
                  indicator: "bg-gradient-to-b from-blue-400 to-blue-500",
                  icon: "text-blue-500 group-hover:text-blue-600",
                }),
              )}

              {/* Separator */}
              {vendorMenutItems.length > 0 && (
                <div className="relative my-3 mx-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200/50"></div>
                  </div>
                </div>
              )}

              {/* Vendor Menu Items */}
              {vendorMenutItems
                .filter((item) =>
                  item.roles.some((role) => userInfo?.role === role),
                )
                .map((item) =>
                  renderMenuItem(item, {
                    active:
                      "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-lg shadow-amber-500/20",
                    hover:
                      "hover:bg-amber-50/60 hover:shadow-md hover:shadow-amber-500/10",
                    text: "text-amber-700",
                    indicator: "bg-gradient-to-b from-amber-400 to-amber-500",
                    icon: "text-amber-500 group-hover:text-amber-600",
                  }),
                )}
            </nav>

            {/* Efek glassmorphism di bagian bawah */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 via-white/40 to-transparent pointer-events-none"></div>

            {/* Efek blur di sisi kanan sidebar */}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent"></div>
          </aside>
        )}

        {/* MAIN CONTENT dengan transisi yang smooth */}
        <div
          className={`
            w-full overflow-hidden max-h-screen
            transition-all duration-500 ease-out
            ${userInfo?.role != ROLE.DRIVER_VENDOR ? "pl-16" : "pl-0"}
            group-hover/sidebar:pl-48
          `}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
export default SideNav;

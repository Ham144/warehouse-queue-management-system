import { useGoToUnloadingBar } from "@/hooks/useGoToUnloadingBar";
import { useCalculateIsPast } from "@/hooks/useCalculateIsPast";
import { Booking } from "@/types/booking.type";
import { BookingStatus, ROLE } from "@/types/shared.type";
import {
  LucideSettings2,
  PanelLeftDashedIcon,
  WarehouseIcon,
} from "lucide-react";
import React from "react";
import {
  getStatusBadgeColor,
  getStatusIcon,
  getStatusLabel,
} from "../admin/QueueDetailModal";
import { useUserInfo } from "../UserContext";

interface BookingRowProps {
  booking: Booking;
  setSelectedBookingId: React.Dispatch<React.SetStateAction<string | null>>;
}

const BookingRow = ({ booking, setSelectedBookingId }: BookingRowProps) => {
  const { remainingTime: remainingTimeGotoUnloading } =
    booking.status == BookingStatus.IN_PROGRESS &&
    useGoToUnloadingBar(booking, 1000);
  const { isPast } = useCalculateIsPast({ booking });
  const { userInfo } = useUserInfo();

  return (
    <tr
      key={booking.id}
      className={`hover:bg-gray-50 transition-colors duration-150 relative ${
        isPast && "bg-yellow-100 hover:bg-yellow-50"
      }`}
    >
      {/* Booking Code */}
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div>
          <div className="text-sm font-bold text-gray-900 lg:w-24 text-wrap">
            {booking.code}
            {booking.notes && (
              <div
                className="text-xs text-gray-500 mt-1 truncate max-w-[150px]"
                title={booking.notes}
              >
                <div className="flex items-center gap-x-1">
                  <PanelLeftDashedIcon size={12} /> {booking.notes}
                </div>
              </div>
            )}
            {booking.canceledReason && (
              <div className="text-xs text-rose-600 bg-rose-50 px-2 py-1 rounded mt-1 absolute">
                ❗ {booking.canceledReason}
              </div>
            )}
          </div>
        </div>
      </td>

      {userInfo.role != ROLE.ADMIN_VENDOR && (
        <td className="px-4 py-2.5 whitespace-nowrap">
          <div>
            <div className="text-sm font-bold text-gray-900 lg:w-40">
              {booking?.driver?.vendorName}
            </div>
          </div>
        </td>
      )}

      {/* Vehicle & Driver */}
      <td className="px-4 py-2.5">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-blue-600 text-xs font-bold">
              {booking.Vehicle?.brand?.charAt(0) || "V"}
            </span>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">
              {booking.Vehicle?.brand || "N/A"}
              <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                {booking.Vehicle?.vehicleType || "N/A"}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              <span className="flex items-center mt-1">
                <span className="mr-1">👤</span>
                {booking.driver?.displayName || booking.driverUsername || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </td>

      {userInfo.role == ROLE.ADMIN_VENDOR && (
        <td className="px-2  py-4 whitespace-nowrap">
          <div>
            <div className="text-sm font-bold py-3 text-gray-900 lg:w-40 flex items-center gap-x-2">
              {booking.Warehouse?.name || "N/A"} <WarehouseIcon size={16} />
            </div>
          </div>
        </td>
      )}

      {/* Schedule */}
      <td className="px-4 py-2.5">
        <div className="text-[13px]">
          <div className="font-medium text-gray-900">
            Target Bongkar:{" "}
            {new Date(booking.arrivalTime).toLocaleDateString("id-ID", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div className="text-gray-500 text-xs mt-1">
            {new Date(booking.arrivalTime).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            <span>
              {booking.estimatedFinishTime && (
                <>
                  <span className="mx-1">→</span>
                  {new Date(booking.estimatedFinishTime).toLocaleTimeString(
                    "id-ID",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </>
              )}
            </span>
          </div>
          {booking.actualArrivalTime && (
            <div className="text-green-600 text-xs mt-1 font-medium">
              ✅ Actual:{" "}
              {new Date(booking.actualArrivalTime).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              -{" "}
              {new Date(booking.actualFinishTime).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
      </td>

      {/* Duration */}
      <td className="px-4 py-2.5">
        <div className="text-sm">
          {booking.Vehicle?.durasiBongkar ? (
            <div className="space-y-1.5">
              {/* Durasi Badge */}
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                {booking.Vehicle.durasiBongkar} min
              </div>

              {/* Status Waktu */}
              {booking.status === BookingStatus.IN_PROGRESS && (
                <div className="text-xs">
                  <div
                    className={`font-medium whitespace-nowrap ${
                      remainingTimeGotoUnloading &&
                      remainingTimeGotoUnloading.includes("+")
                        ? "text-red-500"
                        : "text-gray-600"
                    }`}
                  >
                    {remainingTimeGotoUnloading &&
                    remainingTimeGotoUnloading.includes("+")
                      ? "Telah Berlalu "
                      : "Menuju "}
                    {remainingTimeGotoUnloading}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </div>
      </td>

      {/* Dock */}
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="text-sm">
          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 text-gray-800 text-sm font-medium">
            {booking.Dock?.name || "N/A"}
          </span>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="flex w-24 flex-col gap-1">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusBadgeColor(
              booking.status,
            )}`}
          >
            <span>{getStatusIcon(booking.status)}</span>
            <span>{getStatusLabel(booking.status)}</span>
          </div>
        </div>
      </td>

      {/* Organization */}
      <td className="px-4 py-2.5">
        <div className="text-sm w-20">
          <button
            onClick={() => {
              setSelectedBookingId(booking.id);
              (
                document.getElementById(
                  "my-warehouse-action-modal",
                ) as HTMLDialogElement
              )?.showModal();
            }}
            className="btn btn-sm btn-ghost hover:bg-blue-50 hover:text-blue-600"
          >
            <LucideSettings2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default BookingRow;

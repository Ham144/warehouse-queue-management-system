import { FormatTimeIndonesian } from "@/lib/constant";
import { Booking } from "@/types/booking.type";
import { Eye, Truck, User } from "lucide-react";

const QueueTableRow = ({
  booking,
  onClick,
}: {
  booking: Booking;
  onClick: () => void;
}) => {
  const now = new Date();

  // Normalisasi tipe tanggal
  const arrivalTime = booking.arrivalTime
    ? new Date(booking.arrivalTime)
    : null;

  const estimatedFinishTime = booking.estimatedFinishTime
    ? new Date(booking.estimatedFinishTime)
    : null;

  const isOverdue = estimatedFinishTime
    ? now.getTime() > estimatedFinishTime.getTime()
    : false;

  return (
    <tr
      onClick={onClick}
      className={`
        group border-b cursor-pointer transition-colors duration-200
        hover:bg-blue-50/50 dark:hover:bg-blue-900/10
        ${isOverdue ? "bg-red-50/20 dark:bg-red-900/5" : ""}
      `}
    >
      <td className="py-4 px-5">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
          {booking.Dock?.name || "N/A"}
        </span>
      </td>
      <td className="py-4 px-5">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {booking.code}
          </span>
          <span className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">
            ID: {booking.id?.substring(0, 8)}...
          </span>
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200 font-semibold">
            <Truck size={12} className="text-gray-400" />
            {booking.Vehicle?.brand || "No Brand"}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            {booking.Vehicle?.vehicleType || "Vehicle"}
          </div>
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <User size={14} />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
            {booking.driver?.vendorName || "Internal"}
          </span>
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex flex-col">
          <span className={`text-xs font-bold ${isOverdue ? "text-red-500" : "text-gray-700 dark:text-gray-200"}`}>
            {arrivalTime ? FormatTimeIndonesian(arrivalTime) : "-"}
          </span>
          <span className="text-[10px] text-gray-400">Scheduled</span>
        </div>
      </td>
      <td className="py-4 px-5">
        <div className="flex flex-col">
          <span className={`text-xs font-bold ${booking?.actualArrivalTime ? "text-emerald-500" : "text-amber-500"}`}>
            {booking?.actualArrivalTime
              ? FormatTimeIndonesian(booking?.actualArrivalTime)
              : "Belum Tiba"}
          </span>
          <span className="text-[10px] text-gray-400">At Warehouse</span>
        </div>
      </td>
      <td className="py-4 px-5 text-right relative">
        <div className="flex items-center justify-end gap-3 group-hover:pr-10 transition-all duration-300">
           <span className="text-xs font-bold text-gray-600 dark:text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded">
            {booking.Vehicle?.durasiBongkar ?? 0}m
          </span>
        </div>
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
          <button className="p-2 bg-blue-600 text-white rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700">
            <Eye size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default QueueTableRow;

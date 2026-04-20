import { Booking } from "@/types/booking.type";
import { BookingStatus } from "@/types/shared.type";
import {
  Timer,
  Check,
  Truck,
  BanIcon,
  MessageCircleWarning,
  CheckCircle,
  Clock,
  User,
  X,
  Notebook,
  TimerReset,
  Repeat,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { DAYS, FormatTimeIndonesian } from "@/lib/constant";
import { useProgressBarUnloading } from "@/hooks/useProgressBarUnloading";
import { useGoToUnloadingBar } from "@/hooks/useGoToUnloadingBar";

interface DraggableBookingCardProps {
  booking: Booking;
  draggable?: boolean;
  droppable?: boolean; // 🔥 NEW PROP: apakah bisa di-drop di atasnya
  className?: string;

  onDetail?: () => void;
  onJustify?: () => void;
  onMarkFinished?: () => void;
  onCancel?: () => void;
  onActualArrived?: () => void;
}

const DraggableBookingCard = ({
  booking,
  draggable = true,
  droppable = true, // 🔥 Default true, false untuk inventory
  className = "",
  onDetail,
  onMarkFinished,
  onCancel,
  onActualArrived,
}: DraggableBookingCardProps) => {
  // Tambahkan useSortable dengan data yang lengkap
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: booking.id!,
    disabled: !draggable,
    data: {
      type: "booking-card",
      booking,
      bookingId: booking.id,
      dockId: booking.dockId,
      bookingStatus: booking.status,
      sourceType: "booking-card",
      sourceStatus: booking.status,
      sourceDockId: booking.dockId,
      allowReorder: booking.status === BookingStatus.IN_PROGRESS,
    },
  });

  //hooks
  const { progress } =
    booking.status == BookingStatus.UNLOADING &&
    useProgressBarUnloading(booking, 1000);
  const { remainingTime: remainingTimeGotoUnloading } =
    booking.status == BookingStatus.IN_PROGRESS &&
    useGoToUnloadingBar(booking, 1000);

  // Tambahkan juga sebagai drop target
  const { setNodeRef: setDropRef } = useDroppable({
    id: `booking-${booking.id}`,
    data: {
      type: "booking-card",
      booking,
      bookingStatus: booking.status,
      bookingId: booking.id,
      dockId: booking.dockId,
      acceptFrom: [BookingStatus.IN_PROGRESS], // Untuk reorder
    },
  });

  // Gabungkan refs
  const combinedRef = (node: HTMLDivElement) => {
    setNodeRef(node);
    setDropRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const StatusIcon = () => {
    switch (booking.status) {
      case BookingStatus.IN_PROGRESS:
        return <Timer className="w-4 h-4 text-primary" />;
      case BookingStatus.UNLOADING:
        return <Truck className="w-4 h-4 text-warning" />;
      case BookingStatus.FINISHED:
        return <Check className="w-4 h-4 text-success" />;
      case BookingStatus.DELAYED:
        return <MessageCircleWarning className="w-4 h-4 text-amber-500" />;
      case BookingStatus.CANCELED:
        return <BanIcon className="w-4 h-4 text-error" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={combinedRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={`
        ${
          booking.actualArrivalTime && !isOver
            ? "border-4 border-white border-dashed bg-teal-100"
            : "bg-white"
        }
         rounded-md border p-2 min-w-[180px]
        transition-all duration-150 cursor-grab w-full relative text-xs
        ${isDragging ? "opacity-30 shadow-lg scale-95" : ""}
        ${isOver ? "border-4  bg-blue-200 border-dashed border-teal-500" : ""}
        hover:shadow-sm hover:border-gray-300
      `}
    >
      {/* HEADER - SUPER COMPACT */}
      <div
        onClick={onDetail}
        className="flex justify-between items-start gap-1"
      >
        {/* Left Content */}
        <div className="flex-1 min-w-0">
          {/* Status & Code in one line */}
          <div className="flex items-center justify-between gap-1 mb-1 relative">
            {/* overlay */}
            {isOver &&
              booking.status === BookingStatus.IN_PROGRESS &&
              !isDragging && (
                <div className="badge badge-sm bg-primary text-white absolute inset-2 ">
                  <Repeat />
                  Swap
                </div>
              )}
            <div className="flex items-center gap-1 truncate justify-between w-full">
              <span className="font-medium text-gray-700 truncate flex gap-x-1">
                {StatusIcon()}
                {booking.code && booking.code.slice(0, 15)}
              </span>
              <span className="font-medium text-gray-700 truncate">
                {booking.driver.vendorName &&
                  booking.driver.vendorName.slice(0, 9)}
              </span>
            </div>
            {booking.status === BookingStatus.IN_PROGRESS && (
              <div className="flex items-center gap-1">
                <span
                  className={`font-medium whitespace-nowrap ${
                    remainingTimeGotoUnloading &&
                    remainingTimeGotoUnloading.includes("+")
                      ? "animate-bounce text-red-500"
                      : "text-gray-600"
                  }`}
                >
                  {remainingTimeGotoUnloading &&
                  remainingTimeGotoUnloading.includes("+")
                    ? "Telah Berlalu "
                    : "Menuju "}
                  {remainingTimeGotoUnloading}
                </span>
              </div>
            )}
          </div>

          {/* Driver & Vehicle in one line */}
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <User className="w-4 h-4" />
            {booking.driverUsername?.slice(0, 10) || "N/A"}
            <Truck className="w-4 h-4" /> {booking.Vehicle?.vehicleType || "-"}
          </div>

          {/* Time Info - Minimal */}
          {(booking.status === BookingStatus.IN_PROGRESS ||
            booking.status == BookingStatus.DELAYED ||
            booking.status == BookingStatus.CANCELED) && (
            <div className="space-y-0.5 mt-1.5 border-t pt-1.5">
              {/* Actual Arrival Time */}
              {booking.actualArrivalTime && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Clock size={10} className="text-gray-400" />
                    <span className="text-gray-600">
                      Waktu Datang Sebenarnya:
                    </span>
                  </div>
                  <span className="font-medium text-gray-800">
                    {DAYS[new Date(booking.actualArrivalTime).getDay() - 1]}
                    {booking.actualArrivalTime
                      ? ", " + FormatTimeIndonesian(booking.actualArrivalTime)
                      : "-"}
                  </span>
                </div>
              )}

              {/* Arrival Time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-gray-400" />
                  <span className="text-gray-600">Waktu Datang Rencana:</span>
                </div>
                <span className="font-medium text-gray-800">
                  {DAYS[new Date(booking.arrivalTime).getDay() - 1]}
                  {booking.arrivalTime
                    ? ", " + FormatTimeIndonesian(booking.arrivalTime)
                    : "-"}
                </span>
              </div>

              {/* actualStartTime */}
              {booking.actualStartTime && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Timer size={10} className="text-gray-400" />
                    <span className="text-gray-600">Waktu Mulai Bongkar:</span>
                  </div>
                  <span className="font-medium text-gray-800">
                    {DAYS[new Date(booking.actualStartTime).getDay() - 1]}
                    {booking.actualStartTime
                      ? ", " + FormatTimeIndonesian(booking.actualStartTime)
                      : "-"}
                  </span>
                </div>
              )}
              {/* actualStartTime */}
              {booking.status == BookingStatus.CANCELED &&
                booking.canceledReason && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Timer size={10} className="text-gray-400" />
                      <span className="text-gray-600">Cancel Reason:</span>
                    </div>
                    <span className="font-medium text-gray-800 truncate w-2/3 text-wrap">
                      {booking.canceledReason || "-"}
                    </span>
                  </div>
                )}

              {/* Duration dengan native title attribute */}
              <div className="flex flex-1 ">
                {booking.status !== BookingStatus.DELAYED &&
                  booking.status != BookingStatus.CANCELED && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancel();
                        }}
                        title="Batalkan booking ini"
                        className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors group"
                        type="button"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          Batalkan
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onActualArrived();
                        }}
                        className="p-1.5 rounded-md hover:bg-teal-50 hover:text-teal-600 transition-colors group"
                        type="button"
                      >
                        {booking.actualArrivalTime ? (
                          <TimerReset className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle className="w-3.5 h-3.5" />
                        )}
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                          {booking.actualArrivalTime
                            ? "Kembalikan status Belum Datang"
                            : "Konfirmasi Telah Tiba"}
                        </span>
                      </button>
                    </>
                  )}
                {/* Duration dengan info */}
                <div className="relative group">
                  <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{booking.Vehicle.durasiBongkar}m</span>
                  </div>
                </div>

                {/* note untuk plat */}
                {booking.notes && (
                  <div className="relative group">
                    <div className="px-2 py-1 bg-blue-50 text-green-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <Notebook className="w-3 h-3" />
                      <span className="w-20 truncate">{booking.notes}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar - Super Slim */}
      {booking.status === BookingStatus.UNLOADING && (
        <div className="mt-1.5 ">
          <div
            className={`flex justify-between text-[10px] text-gray-400 mb-0.5 ${
              progress > 99 && "text-red-400"
            }`}
          >
            <span>
              Start Time {FormatTimeIndonesian(booking.actualStartTime)}
            </span>
            <span>durasi {booking.Vehicle.durasiBongkar}m</span>
            <span>
              Est. Finish{" "}
              {booking.actualStartTime
                ? FormatTimeIndonesian(
                    new Date(
                      // Bungkus string ini ke dalam new Date() dulu
                      new Date(booking.actualStartTime).getTime() +
                        booking.Vehicle.durasiBongkar * 60000,
                    ),
                  )
                : "-"}
            </span>
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Actions - Minimal */}
      {onMarkFinished && booking.status === BookingStatus.UNLOADING && (
        <div className="mt-2 pt-1.5 border-t border-gray-100">
          <button
            className="w-full py-1 px-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-medium rounded flex items-center justify-center gap-1 transition-colors"
            onClick={onMarkFinished}
          >
            <CheckCircle size={10} />
            <span>Mark Selesai</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DraggableBookingCard;

import { BookingApi } from "@/api/booking.api";
import { Booking, UpdateBookingStatus } from "@/types/booking.type";
import { BookingStatus, ROLE } from "@/types/shared.type";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "sonner";
import ConfirmationWithInput from "../shared-common/ConfirmationWithInput";
import {
  ArrowRight,
  Check,
  Crosshair,
  Edit2,
  MessageCircleCode,
  PlaneLandingIcon,
  SearchCheckIcon,
  X,
} from "lucide-react";
import ConfirmationModal from "../shared-common/confirmationModal";
import { useUserInfo } from "../UserContext";
import MoveTraceList from "../shared-common/move-trace-list";
import { useCalculateIsPast } from "@/hooks/useCalculateIsPast";
import { useRouter, useSearchParams } from "next/navigation";

interface MyWarehouseActionModalProps {
  selectedBooking?: Booking;
  onModifyAndConfirm?: (bookingId: string) => void;
}

const MyWarehouseActionModal = ({
  selectedBooking,
  onModifyAndConfirm,
}: MyWarehouseActionModalProps) => {
  const [canceledReason, setCanceledReason] = useState<string>("");
  const queryClient = useQueryClient();
  const { isPast } = useCalculateIsPast({ booking: selectedBooking });

  const router = useRouter();
  const searchParams = useSearchParams();

  const { userInfo } = useUserInfo();
  const isAdmin = [
    ROLE.ADMIN_ORGANIZATION,
    ROLE.USER_ORGANIZATION,
    ROLE.ADMIN_GUDANG,
  ].includes(ROLE[userInfo?.role]);

  const [bookingToShowMoveTrace, setBookingToShowMoveTrace] = useState<
    Booking | undefined
  >();

  const { mutateAsync: handleUpdateStatus, isPending } = useMutation({
    mutationKey: ["booking", selectedBooking?.id],
    mutationFn: async (payload: UpdateBookingStatus) =>
      BookingApi.updateBookingStatus(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["bookings"],
      });
      toast.success("Booking berhasil dikonfirmasi");
      (
        document.getElementById(
          "my-warehouse-action-modal",
        ) as HTMLDialogElement
      )?.close();
    },
    onError: (er: any) => {
      toast.error(er?.response?.data?.message || "Gagal mengupdate booking");
    },
  });

  const { mutateAsync: handleCancel } = useMutation({
    mutationKey: ["bookings"],
    mutationFn: async () => {
      if (!selectedBooking?.id || !canceledReason) {
        toast.error("Mohon isi alasan pembatalan");
        throw new Error("Mohon isi alasan pembatalan");
      }
      await BookingApi.cancelBooking(selectedBooking.id, canceledReason);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["bookings"],
      });
      setCanceledReason("");
      toast.success("Booking berhasil dibatalkan");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message);
    },
  });
  const onChatDriver = (booking: Booking) => {
    if (booking.driverUsername) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("recipient", booking.driverUsername);
      params.set(
        "message",
        "kode booking " +
          '"' +
          booking.code +
          '"' +
          " yang book ke warehouse " +
          booking.Warehouse.name +
          ":  ",
      );

      router.push(`?${params.toString()}`);
    }
  };

  return (
    <>
      <dialog id="my-warehouse-action-modal" className="modal">
        <div className="modal-box w-full max-w-md p-6 bg-white rounded-2xl shadow-xl  ">
          <div className="flex items-center justify-between mb-6 ">
            <div className="flex items-center gap-3 ">
              <div className="p-2 bg-blue-100 rounded-lg">
                <PlaneLandingIcon />
              </div>
              <div>
                <h3 className="font-bold text-xl text-gray-900">
                  Booking Actions
                </h3>
              </div>
            </div>

            {selectedBooking?.status && (
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  selectedBooking.status === BookingStatus.PENDING
                    ? "bg-yellow-100 text-yellow-800"
                    : selectedBooking.status === BookingStatus.IN_PROGRESS
                      ? "bg-blue-100 text-blue-800"
                      : selectedBooking.status === BookingStatus.FINISHED
                        ? "bg-green-100 text-green-800"
                        : selectedBooking.status === BookingStatus.CANCELED
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                }`}
              >
                {selectedBooking.status.replace("_", " ")}
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mb-6"></div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 mb-6">
            {selectedBooking?.status == BookingStatus.IN_PROGRESS &&
              isAdmin && (
                <button
                  className="group  flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                  onClick={() => {
                    (
                      document.getElementById(
                        "arrival-confirmation",
                      ) as HTMLDialogElement
                    )?.showModal();
                    (
                      document.getElementById(
                        "my-warehouse-action-modal",
                      ) as HTMLDialogElement
                    )?.close();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <Crosshair />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-gray-900">
                        Mobil Telah Datang
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        Catat Kedatangan: waktu datang sebenarnya akan tercatat
                        sebagai actualArrivalTime
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="absolute right-10" />
                </button>
              )}

            {selectedBooking?.status == BookingStatus.PENDING ||
              (selectedBooking?.status == BookingStatus.IN_PROGRESS &&
                isAdmin && (
                  <button
                    className={`group flex items-center justify-between p-4 border rounded-xl transition-all duration-200 ${
                      !selectedBooking?.id || !onModifyAndConfirm
                        ? "bg-gray-100 border-gray-200 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 hover:shadow-md"
                    }`}
                    disabled={!selectedBooking?.id || !onModifyAndConfirm}
                    onClick={() => {
                      if (!selectedBooking?.id || !onModifyAndConfirm) return;
                      onModifyAndConfirm(selectedBooking.id);
                      (
                        document.getElementById(
                          "my-warehouse-action-modal",
                        ) as HTMLDialogElement
                      )?.close();
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg shadow-sm ${
                          !selectedBooking?.id || !onModifyAndConfirm
                            ? "bg-gray-200"
                            : "bg-white"
                        }`}
                      >
                        <Edit2 className={"w-5 h-5 text-purple-600 "} />
                      </div>
                      <div className="text-left">
                        <span
                          className={`font-semibold ${
                            !selectedBooking?.id || !onModifyAndConfirm
                              ? "text-gray-500"
                              : "text-gray-900"
                          }`}
                        >
                          Justify & Confirm Booking
                        </span>
                        <p
                          className={`text-xs mt-1 ${
                            !selectedBooking?.id || !onModifyAndConfirm
                              ? "text-gray-400"
                              : "text-gray-600"
                          }`}
                        >
                          Justify / Sesuaikan ulang booking dan klik confirm
                          untuk menjadikannya IN_PROGRESS
                        </p>
                      </div>
                    </div>
                    {!selectedBooking?.id || !onModifyAndConfirm ? (
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
            {selectedBooking?.status !== BookingStatus.FINISHED &&
              selectedBooking?.status !== BookingStatus.CANCELED && (
                <button
                  className="group  flex items-center justify-between p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl hover:from-red-100 hover:to-red-200 hover:border-red-300 hover:shadow-md transition-all duration-200"
                  onClick={() => {
                    (
                      document.getElementById(
                        "cancel-confirmation",
                      ) as HTMLDialogElement
                    )?.showModal();
                    (
                      document.getElementById(
                        "my-warehouse-action-modal",
                      ) as HTMLDialogElement
                    )?.close();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      <X />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-gray-900">
                        Cancel Booking
                      </span>
                      <p className="text-xs text-gray-600 mt-1">
                        Batalkan/Tolak Konfirmasi ini
                      </p>
                    </div>
                  </div>
                  <ArrowRight />
                </button>
              )}

            {selectedBooking?.status === BookingStatus.PENDING && isAdmin && (
              <button
                className="group flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                disabled={isPending}
                onClick={() => {
                  if (!selectedBooking?.id) return;

                  if (isPast) {
                    (
                      document.getElementById(
                        "my-warehouse-action-modal",
                      ) as HTMLDialogElement
                    )?.close();

                    return toast.error(
                      "Tidak dapat mengonfirmasi: Arrival Time masa lalu",
                    );
                  }
                  handleUpdateStatus({
                    id: selectedBooking.id,
                    status: BookingStatus.IN_PROGRESS,
                  });
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Check />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-900">
                      Confirm Booking
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          Arrival Time:
                          {new Date(
                            selectedBooking.arrivalTime,
                          ).toLocaleDateString("id-ID", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {new Date(
                            selectedBooking.arrivalTime,
                          ).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          <span>
                            {selectedBooking.estimatedFinishTime && (
                              <>
                                <span className="mx-1">→</span>
                                {new Date(
                                  selectedBooking.estimatedFinishTime,
                                ).toLocaleTimeString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </>
                            )}
                          </span>
                        </div>
                        {selectedBooking.actualArrivalTime && (
                          <div className="text-green-600 text-xs mt-1 font-medium">
                            ✅ Actual:{" "}
                            {new Date(
                              selectedBooking.actualArrivalTime,
                            ).toLocaleTimeString("id-ID")}
                          </div>
                        )}
                      </div>
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      Ubah Status Menjadi IN_PROGRESS dan booking akan muncul di
                      live queue
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      note: saat ini pending, artinya booking tidak akan muncul
                      di live queue sampai anda klik confirm ini
                    </p>
                  </div>
                </div>
                <svg
                  className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}

            <button
              onClick={() => {
                (
                  document.getElementById(
                    "my-warehouse-action-modal",
                  ) as HTMLElement as HTMLDialogElement
                )?.close();
                onChatDriver(selectedBooking);
              }}
              className="group flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 hover:border-green-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <MessageCircleCode />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-gray-900">
                    Chat Driver
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    note: Driver dan admin vendor sudah dapat notifikasi
                    Realtime sistem untuk tiap perubahan yang anda organisasi
                    anda perbuat.
                  </p>
                </div>
              </div>
              <svg
                className="w-5 h-5 text-green-400 group-hover:text-green-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            <button
              onClick={() => {
                (
                  document.getElementById(
                    "my-warehouse-action-modal",
                  ) as HTMLDialogElement
                )?.close();
                (
                  document.getElementById(
                    "move-trace-modal",
                  ) as HTMLDialogElement
                )?.showModal();
                setBookingToShowMoveTrace(selectedBooking);
              }}
              className="group flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-violet-100 border border-violet-200 rounded-xl hover:from-violet-100 hover:to-violet-200 hover:border-violet-300 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <SearchCheckIcon />
                </div>
                <div className="text-left">
                  <span className="font-semibold text-violet-900">
                    Jejak Perubahan
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Baca jejak perubahan
                  </p>
                </div>
              </div>
              <ArrowRight color="violet" />
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 mb-6"></div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                (
                  document.getElementById(
                    "my-warehouse-action-modal",
                  ) as HTMLDialogElement
                )?.close();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 font-medium rounded-xl border border-gray-300 hover:border-gray-400 hover:shadow-sm transition-all duration-200"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Close
            </button>
          </div>

          {/* Info Footer */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center text-xs text-gray-500">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Select an action to proceed with this booking</span>
            </div>
          </div>
        </div>

        <ConfirmationWithInput
          modalId="cancel-confirmation"
          message="Konfirmasi Pembatalan. tuliskan suatu alasan"
          onConfirm={handleCancel}
          title={"Apakaha kamu yakin akan membatalkan Booking ini? "}
          input={canceledReason}
          setInput={setCanceledReason}
          key={"cancel-confirmation"}
        />
        <ConfirmationModal
          message="Konfirmasi Kendaraan Telah Datang"
          modalId="arrival-confirmation"
          onConfirm={() => {
            handleUpdateStatus({
              id: selectedBooking.id,
              actualArrivalTime: new Date(),
              status: BookingStatus.IN_PROGRESS,
            });
          }}
          title="Unload Confirmation"
        />
      </dialog>
      <MoveTraceList booking={bookingToShowMoveTrace} />
    </>
  );
};

export default MyWarehouseActionModal;

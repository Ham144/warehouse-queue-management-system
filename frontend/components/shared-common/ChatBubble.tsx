"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import {
  MessageCircle,
  X,
  Search,
  Truck,
  MoreVertical,
  Clock,
  Inbox,
  ChevronRight,
  Bell,
  User,
  Calendar,
  Copy,
  Ban,
  Trash2,
  Camera,
  Trash,
  Check,
  CheckCheck,
  Redo,
  ChevronLeft,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useUserInfo } from "../UserContext";
import { IRoom, IChat } from "@/types/chat.type";
import { toast } from "sonner";
import { ChatApi } from "@/api/chat.api";
import ConfirmationModal from "./confirmationModal";
import { useRouter, useSearchParams } from "next/navigation";

export function stripHtmlPreview(html: string | null | undefined): string {
  if (!html) return "";
  const raw = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return raw.length > 80 ? raw.slice(0, 80) + "â€¦" : raw;
}

export function playMessengerStyleSound() {
  try {
    const ctx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();

    const now = ctx.currentTime;

    function createTone(
      startFreq: number,
      endFreq: number,
      startTime: number,
      duration: number,
    ) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle"; // lebih tajam dari sine
      osc.frequency.setValueAtTime(startFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    }

    // Layer bass tipis supaya lebih "berisi"
    createTone(400, 300, now, 0.5);
    createTone(443, 340, now, 0.8);
    // Nada 2 (sedikit lebih rendah)
    createTone(1000, 700, now + 0.25, 0.3);
    // Nada 1 (tinggi & cepat)
    createTone(1200, 900, now, 0.25);

    createTone(400, 300, now, 0.5);
  } catch {
    // ignore autoplay block
  }
}

function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const [newMessage, setNewMessage] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(
    null,
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  //selected messages to delete
  const [chatIds, setSelectedChatIds] = useState<string[]>([]);

  //listener untuk cari user dari params
  const searchParams = useSearchParams();

  const { userInfo, socket } = useUserInfo();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", selectedRoomId],
    queryFn: () => ChatApi.getHistory(selectedRoomId, 120),
    enabled: !!selectedRoomId,
  });

  useQuery({
    queryKey: ["get-room-id", selectedRecipient],
    queryFn: async () => {
      if (selectedRoomId) return;
      const roomId = await ChatApi.getRoomId(selectedRecipient!);
      setSelectedRoomId(roomId);
    },
    enabled: !!selectedRecipient,
  });

  // Query untuk mendapatkan daftar room
  const { data: { chatRooms: rooms = [], totalUnreadMessages = 0 } = {} } =
    useQuery<{
      chatRooms: IRoom[];
      totalUnreadMessages: number;
    }>({
      queryKey: ["rooms", searchQuery],
      queryFn: async () => await ChatApi.lastMessageList(searchQuery),
      enabled: !!userInfo,
    });

  // Mutation untuk mengirim pesan
  const { mutateAsync: handleSendMessage, isPending: sendingMessage } =
    useMutation({
      mutationFn: async ({
        message,
        recipientId,
      }: {
        message: string;
        recipientId: string;
      }) =>
        await ChatApi.sendMessage(
          message,
          recipientId,
          userInfo,
          selectedRoomId,
        ),
      onSuccess: (data) => {
        if (data && selectedRoomId && selectedRecipient) {
          setNewMessage("");
          scrollToBottom();
        }
      },
    });

  const handleSend = () => {
    if (!newMessage.trim() || sendingMessage) return;

    handleSendMessage({
      message: newMessage,
      recipientId: selectedRecipient,
    });

    setNewMessage("");

    // penting: kasih delay sedikit supaya setelah re-render tetap focus
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 0);
    router.push("?");
  };

  // connect + join user (sekali)
  useEffect(() => {
    if (!socket || !userInfo?.username) return;

    socket.connect();

    const handleConnect = () => {
      socket.emit("join_list", { recipientId: userInfo.username });
    };

    socket.on("connect", handleConnect);
    // kalau sudah connect duluan, tetap join
    if (socket.connected) {
      handleConnect();
    }
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, userInfo?.username]);

  // listener offline online == presence
  useEffect(() => {
    if (!socket) return;

    const handleOnline = () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    const handleOffline = () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    };

    socket.on("user_online", handleOnline);
    socket.on("user_offline", handleOffline);

    return () => {
      socket.off("user_online", handleOnline);
      socket.off("user_offline", handleOffline);
    };
  }, [socket]);

  // join room ketika berubah
  useEffect(() => {
    if (!socket || !selectedRoomId) return;

    socket.emit("join_room", { roomId: selectedRoomId });

    return () => {
      socket.emit("leave_room", { roomId: selectedRoomId });
    };
  }, [socket, selectedRoomId]);

  // listen event (sekali saja)
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message: IChat) => {
      queryClient.setQueryData<IChat[]>(
        ["messages", message.roomId],
        (old = []) => {
          if (old.some((m) => m.id === message.id)) return old;
          return [...old, message];
        },
      );

      if (message.roomId === selectedRoomId) {
        scrollToBottom();
      }
    };

    const handleChatListUpdate = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      if (
        data.senderId !== userInfo?.username && // bukan pesan kita sendiri
        data.roomId !== selectedRoomId // bukan room yang sedang dibuka
      ) {
        playMessengerStyleSound();

        // Tampilkan floating notification
        toast.custom(
          (t) => (
            <div
              onClick={() => {
                setSelectedRecipient(data.senderId);
                setSelectedRoomId(data.roomId || null);
                setIsOpen(true);
                toast.dismiss(t);
              }}
              className="flex items-center gap-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-teal-50/50 cursor-pointer hover:bg-white transition-all transform hover:scale-[1.02] active:scale-[0.98] group animate-in fade-in slide-in-from-right-8 duration-300 pointer-events-auto"
            >
              <div className="relative flex-shrink-0">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-teal-200/50 ${
                    data.senderId === "system"
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-200/50"
                      : "bg-gradient-to-br from-teal-500 to-emerald-600"
                  }`}
                >
                  {data.senderId === "system" ? (
                    <Bell className="w-6 h-6 text-white" />
                  ) : (
                    <User className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-bold text-gray-900 truncate text-sm">
                    {data.senderId === "system"
                      ? "Notifikasi Sistem"
                      : data.senderId}
                  </p>
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">
                    Baru saja
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {stripHtmlPreview(data.message)}
                </p>
              </div>
            </div>
          ),
          {
            duration: 5000,
            position: "bottom-right",
          },
        );
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("chat_list_update", handleChatListUpdate);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("chat_list_update", handleChatListUpdate);
    };
  }, [socket, queryClient, selectedRoomId, userInfo?.username]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }, 100);
  };

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isOpen, selectedRecipient]);

  const activeRoom = rooms.find((r) => r.roomId === selectedRoomId);

  const formatTime = (date: Date | string) => {
    return format(new Date(date), "HH:mm", { locale: id });
  };

  const formatMessageTime = (date: Date | string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInDays = Math.floor(
      (now.getTime() - messageDate.getTime()) / (1000 * 3600 * 24),
    );

    if (diffInDays === 0) {
      return formatTime(date);
    } else if (diffInDays === 1) {
      return "Kemarin";
    } else if (diffInDays < 7) {
      return format(new Date(date), "EEEE", { locale: id });
    } else {
      return format(new Date(date), "dd/MM/yy", { locale: id });
    }
  };

  const handleRoomSelect = (room: IRoom) => {
    setSelectedRecipient(room.recipientId);
    setSelectedRoomId(room.roomId);
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  //listener chat driver dari search params
  useEffect(() => {
    if (searchParams) {
      const recipient = searchParams?.get("recipient");
      const message = searchParams?.get("message");

      if (recipient) {
        setSelectedRecipient(recipient);
        setNewMessage(message);
        setIsOpen(true);
      }
    }
  }, [searchParams]);

  if (!userInfo) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 group"
      >
        <MessageCircle className="w-7 h-7 text-white" />
        {totalUnreadMessages > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-6 h-6 px-1 bg-red-500 text-white text-xs font-bold rounded-full border-2 border-white">
            {totalUnreadMessages > 9 ? "9+" : totalUnreadMessages}
          </span>
        )}
        <div className="absolute bottom-full right-0 mb-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
          Buka Messenger
          <div className="absolute top-full right-5 -mt-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-900"></div>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-teal-500 to-teal-600">
        <div className="flex items-center space-x-3">
          {selectedRecipient ? (
            <>
              <div className="flex items-center gap-3">
                {/* Avatar/Initial Container */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedRecipient?.charAt(0).toUpperCase() || "U"}
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">
                    {selectedRecipient || "Unknown User"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activeRoom?.isOnline
                          ? "bg-green-500 animate-pulse"
                          : "bg-gray-400"
                      }`}
                    ></div>
                    <p className="text-teal-100/80 text-sm font-medium">
                      {activeRoom?.isOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>

                {/* Additional Actions (optional) */}
                <div className="flex-shrink-0">
                  <div className="flex text-white items-center gap-x-2">
                    <button
                      onClick={() =>
                        (
                          document.getElementById(
                            "recipient-profile-menu",
                          ) as HTMLDialogElement
                        ).showModal()
                      }
                      className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {chatIds.length > 0 && (
                      <>
                        <Trash
                          className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                          onClick={() =>
                            (
                              document.getElementById(
                                "message-delete-confirmation",
                              ) as HTMLDialogElement
                            ).showModal()
                          }
                        />
                        <Redo
                          className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                          onClick={() => {
                            setSelectedChatIds([]);
                          }}
                        />
                      </>
                    )}
                  </div>
                  <dialog id="recipient-profile-menu" className="modal">
                    <div className="modal-box p-0 overflow-hidden rounded-3xl bg-white shadow-2xl w-full max-w-sm">
                      {/* Header dengan Gradient */}
                      <div className="bg-gradient-to-r from-teal-500 to-emerald-600 px-6 py-8 relative">
                        <button
                          onClick={() =>
                            (
                              document.getElementById(
                                "recipient-profile-menu",
                              ) as HTMLDialogElement
                            ).close()
                          }
                          className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                          <X className="w-5 h-5 text-white" />
                        </button>

                        <div className="flex flex-col items-center text-white">
                          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-3">
                            <User className="w-12 h-12 text-white" />
                          </div>
                          <h3 className="font-bold text-xl mb-1">
                            {selectedRecipient}
                          </h3>
                          <p className="text-sm text-white/80">
                            {activeRoom?.isOnline ? "Online" : "Offline"} â€¢
                          </p>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="p-4">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
                          Pengaturan Chat
                        </div>

                        <div className="space-y-1">
                          <button className="flex items-center gap-3 w-full p-3 hover:bg-red-50 rounded-xl transition-colors group">
                            {chatIds.length > 0 && (
                              <div
                                onClick={() => {
                                  (
                                    document.getElementById(
                                      "message-delete-confirmation",
                                    ) as HTMLDialogElement
                                  )?.showModal();
                                }}
                                className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </div>
                            )}
                            <div className="flex-1 text-left">
                              <span className="text-sm font-medium text-gray-700 group-hover:text-red-600">
                                Bersihkan Chat
                              </span>
                              <p className="text-xs text-gray-400">
                                Hapus semua pesan dalam percakapan
                              </p>
                            </div>
                          </button>

                          <button className="flex items-center gap-3 w-full p-3 hover:bg-orange-50 rounded-xl transition-colors group">
                            <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                              <Ban className="w-4 h-4 text-orange-600" />
                            </div>
                            <div className="flex-1 text-left">
                              <span className="text-sm font-medium text-gray-700 group-hover:text-orange-600">
                                Blokir Pengguna
                              </span>
                              <p className="text-xs text-gray-400">
                                Tidak dapat menerima pesan dari pengguna ini
                              </p>
                            </div>
                          </button>

                          <button className="flex items-center gap-3 w-full p-3 hover:bg-purple-50 rounded-xl transition-colors group">
                            <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                              <Bell className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="flex-1 text-left">
                              <span className="text-sm font-medium text-gray-700 group-hover:text-purple-600">
                                Atur Notifikasi
                              </span>
                              <p className="text-xs text-gray-400">
                                Sesuaikan notifikasi untuk chat ini
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>

                        <div className="border-t border-gray-100 my-4"></div>

                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
                          Info Lainnya
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-3 p-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <Clock className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-gray-400">
                                ID Pengguna
                              </p>
                              <p className="text-sm font-medium text-gray-800">
                                {selectedRecipient}
                              </p>
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                              <Copy className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3 p-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <Calendar className="w-4 h-4 text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">
                                Bergabung sejak
                              </p>
                              <p className="text-sm font-medium italic text-gray-800">
                                loading...
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer Action */}
                      <div className="bg-gray-50 px-6 py-4 flex justify-end gap-2">
                        <button
                          onClick={() =>
                            (
                              document.getElementById(
                                "recipient-profile-menu",
                              ) as HTMLDialogElement
                            ).close()
                          }
                          className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          Tutup
                        </button>
                        <button className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow">
                          Kirim Pesan
                        </button>
                      </div>
                    </div>

                    {/* Backdrop dengan blur */}
                    <form
                      method="dialog"
                      className="modal-backdrop backdrop-blur-sm bg-black/30"
                    >
                      <button>close</button>
                    </form>
                  </dialog>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Messenger</h3>
                <p className="text-teal-100 text-sm">
                  {rooms.length} percakapan
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              if (selectedRecipient) {
                setSelectedRecipient(null);
                setSelectedRoomId(null);
                setSelectedChatIds([]);
                router.push("?");
              } else {
                setIsOpen(false);
              }
            }}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
            title="Minimize"
          >
            {selectedRecipient || selectedRoomId ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}{" "}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Daftar Percakapan */}
        {!selectedRecipient ? (
          <div className="w-full flex flex-col">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama admin / supir..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto min-h-full bg-white">
              <div className="p-4 min-h-full">
                {!rooms.length ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="bg-teal-50 rounded-3xl p-8 max-w-sm mx-auto text-center border border-teal-100">
                      <div className="bg-gradient-to-br from-teal-400 to-emerald-500 rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-teal-200">
                        <Inbox className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">
                        Belum Ada Percakapan
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        Cari nama akun yang ingin Anda ajak chat
                        <br />
                        untuk memulai percakapan baru
                      </p>
                      <button
                        onClick={() =>
                          toast.info(
                            "Coba cari akun seseorang di pencarian Messenger",
                          )
                        }
                        className="mt-6 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm hover:shadow-md"
                      >
                        Mulai Chat
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rooms.map((room: IRoom) => (
                      <button
                        key={room.roomId}
                        onClick={() => handleRoomSelect(room)}
                        className="flex items-center gap-4 w-full p-4 hover:bg-gray-50 rounded-2xl transition-all duration-200 group border border-transparent hover:border-gray-200"
                      >
                        {/* Avatar dengan Icon */}
                        <div className="relative flex-shrink-0">
                          <div
                            className={`
                w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm
                ${
                  room.recipientId === "system"
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                    : "bg-gradient-to-br from-teal-500 to-emerald-600"
                }
              `}
                          >
                            {room.recipientId === "system" ? (
                              <Bell className="w-7 h-7 text-white" />
                            ) : (
                              <User className="w-7 h-7 text-white" />
                            )}
                          </div>

                          {/* Status Online */}
                          {room.recipientId !== "system" && (
                            <div
                              className={`absolute -bottom-1 -right-1 w-4 h-4 border-4 border-white rounded-full ${
                                room.isOnline ? "bg-green-500" : "bg-gray-300"
                              }`}
                            ></div>
                          )}

                          {/* Badge Notifikasi */}
                          {room.unreadMessages > 0 && (
                            <div className="absolute -top-2 -right-2 min-w-[24px] h-6 bg-red-500 border-2 border-white rounded-full flex items-center justify-center px-1.5 shadow-lg">
                              <span className="text-xs font-bold text-white">
                                {room.unreadMessages > 99
                                  ? "99+"
                                  : room.unreadMessages}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Konten Utama */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <h5 className="font-semibold text-gray-900 truncate text-base">
                                {room.recipientId === "system"
                                  ? "Notifikasi Sistem"
                                  : room.recipientId}
                              </h5>
                              {room.recipientId === "system" && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full">
                                  Official
                                </span>
                              )}
                            </div>

                            {room.lastMessageAt && (
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {formatMessageTime(room.lastMessageAt)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
                              <MessageCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <p className="text-sm text-gray-600 truncate group-hover:text-gray-900">
                                {room.lastMessage ? (
                                  stripHtmlPreview(room.lastMessage)
                                ) : (
                                  <span className="text-gray-400 italic">
                                    Ketik pesan pertama...
                                  </span>
                                )}
                              </p>
                            </div>

                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-400 transition-all group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-[#efeae2] relative">
              {/* Messages Container - Background WhatsApp Pattern */}
              <div
                className="flex-1 overflow-y-auto py-4 relative"
                style={{
                  backgroundImage:
                    'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABmJLR0QA/wD/AP+gvaeTAAAAPUlEQVRIie3VMQ4AIAgDQPD/n2wHjW0NpSwG3W1vOgQBwBO5W3PPN6kUjFJKafMbhBBCCCGEEEIIIYQQ4n8GBAAhPgNmfUoHLAAAAABJRU5ErkJggg==")',
                  backgroundColor: "#efeae2",
                  backgroundRepeat: "repeat",
                  backgroundSize: "54px 54px",
                  backgroundBlendMode: "overlay",
                }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-sm">
                      <div className="w-8 h-8 border-3 border-[#00a884] border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-[#54656f] font-medium">
                        Memuat pesan...
                      </span>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 max-w-xs text-center shadow-sm border border-[#e9edef]">
                      <div className="bg-gradient-to-br from-[#00a884] to-[#008f72] rounded-2xl w-20 h-20 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#00a884]/20">
                        <MessageCircle className="w-10 h-10 text-white" />
                      </div>
                      <h3 className="text-[#111b21] text-lg font-semibold mb-2">
                        Belum ada pesan
                      </h3>
                      <p className="text-[#667781] text-sm leading-relaxed">
                        {selectedRecipient === "system"
                          ? "📢 Notifikasi sistem akan muncul di sini"
                          : `👋 Mulai percakapan dengan ${selectedRecipient}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Date Divider - Hari ini */}
                    <div className="flex justify-center mb-6 sticky top-2 z-10">
                      <span className="text-[0.7rem] bg-[#e1f5fe] text-[#1f7a8c] px-3 py-1.5 rounded-full font-medium shadow-sm backdrop-blur-sm bg-opacity-90">
                        Hari Ini
                      </span>
                    </div>

                    {/* Messages */}
                    <div className="space-y-1">
                      {messages.map((message, index) => {
                        const isUserMessage =
                          message.senderId === userInfo?.username;
                        const isSystemMessage = message.senderId === "system";
                        const showTime =
                          index === messages.length - 1 ||
                          new Date(message.createdAt).getTime() -
                            new Date(messages[index + 1].createdAt).getTime() <
                            -300000;

                        const showAvatar =
                          !isUserMessage &&
                          !isSystemMessage &&
                          (index === 0 ||
                            messages[index - 1]?.senderId !== message.senderId);

                        return (
                          <div
                            key={message?.id || index}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isUserMessage) {
                                return;
                              }
                              if (chatIds.includes(message.id)) {
                                setSelectedChatIds(
                                  chatIds.filter((id) => id !== message.id),
                                );
                              } else {
                                if (!chatIds.length) return;
                                setSelectedChatIds([...chatIds, message.id]);
                              }
                            }}
                            className={`flex items-end gap-1.5 py-1 ${
                              isUserMessage ? "justify-end" : "justify-start"
                            } mb-1 ${
                              chatIds.includes(message.id) && "bg-green-200"
                            }`}
                          >
                            {/* Avatar untuk pesan non-user */}
                            {!isUserMessage && !isSystemMessage && (
                              <div className="w-8 h-8 flex-shrink-0 self-end mb-1">
                                {showAvatar ? (
                                  <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs font-medium shadow-sm">
                                    {selectedRecipient?.charAt(0).toUpperCase()}
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 opacity-0" />
                                )}
                              </div>
                            )}

                            {/* Message Container */}
                            <div
                              className={`flex flex-col max-w-[75%] ${
                                isUserMessage ? "items-end" : "items-start"
                              }`}
                            >
                              {/* Sender Name */}
                              {!isUserMessage &&
                                !isSystemMessage &&
                                showAvatar && (
                                  <span className="text-[0.65rem] font-medium text-[#00a884] ml-1 mb-0.5">
                                    {selectedRecipient}
                                  </span>
                                )}

                              {/* Message Bubble */}
                              <div className="relative group">
                                <div
                                  className={`
                          relative px-3.5 py-2 text-[0.9375rem] leading-5 break-words
                          ${
                            isUserMessage
                              ? "bg-[#e7ffdb] text-[#111b21] rounded-[7.5px] rounded-br-[2px]"
                              : isSystemMessage
                                ? "bg-white text-[#111b21] border border-[#e9edef] rounded-[7.5px] rounded-bl-[2px]"
                                : "bg-white text-[#111b21] border border-[#e9edef] rounded-[7.5px] rounded-bl-[2px]"
                          }
                          shadow-[0_1px_0.5px_rgba(0,0,0,0.08)]
                          hover:shadow-md transition-shadow
                          pr-[70px] ${
                            isUserMessage
                              ? "rounded-br-none"
                              : "rounded-bl-none"
                          }
                        `}
                                >
                                  {/* Message Content */}
                                  {isSystemMessage ? (
                                    <div
                                      className="text-sm text-[#3b4a54] [&>a]:text-[#00a884] [&>a]:font-medium"
                                      dangerouslySetInnerHTML={{
                                        __html: message.message,
                                      }}
                                    />
                                  ) : (
                                    <p className="whitespace-pre-wrap">
                                      {message.message}
                                    </p>
                                  )}

                                  {/* Time & Status */}
                                  <div
                                    className={`
                          absolute bottom-1 right-2 flex items-center gap-0.5
                          ${isUserMessage ? "text-[#667781]" : "text-[#8696a0]"}
                        `}
                                  >
                                    <span className="text-[0.65rem] whitespace-nowrap">
                                      {formatTime(message.createdAt)}
                                    </span>
                                    {isUserMessage && message.status && (
                                      <span className="flex items-center">
                                        {message.status === "READ" ? (
                                          <CheckCheck
                                            className="text-[#53bdeb]"
                                            size={12}
                                          />
                                        ) : (
                                          <Check
                                            className="text-[#8696a0]"
                                            size={12}
                                          />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Message Actions - Hover menu */}
                                {isUserMessage && !chatIds.length && (
                                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => {
                                        (
                                          document.getElementById(
                                            "message-menu",
                                          ) as HTMLDialogElement
                                        ).showModal();
                                        setSelectedChatIds([message.id]);
                                      }}
                                      className="bg-white rounded-full p-1.5 shadow-md hover:shadow-lg transition-shadow border border-[#e9edef]"
                                    >
                                      <MoreVertical className="w-4 h-4 text-[#54656f]" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Time Divider */}
                              {showTime && index !== messages.length - 1 && (
                                <div className="flex justify-center w-full my-3">
                                  <span className="text-[0.65rem] bg-[#e9edef] text-[#667781] px-2 py-1 rounded-full">
                                    {formatTime(message.createdAt)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Spacer untuk user message (biar sejajar dengan avatar) */}
                            {isUserMessage && (
                              <div className="w-8 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>

              {/* Input Area */}
              {selectedRecipient !== "system" && (
                <div className="bg-[#f0f2f5] px-3 py-2.5 border-t border-[#e9edef]">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSend();
                    }}
                    className="flex items-end gap-2"
                  >
                    {/* Attachment Button */}
                    <button
                      type="button"
                      onClick={() =>
                        toast.info("Fitur lampiran belum tersedia")
                      }
                      className="p-2.5 text-[#54656f] hover:bg-[#e9edef] rounded-full transition-colors shrink-0"
                    >
                      <Camera />
                    </button>

                    {/* Input Field - Container yang fleksibel */}
                    <div className="flex-1 bg-white rounded-2xl px-4 shadow-sm border border-transparent focus-within:border-[#00a884] transition-colors flex items-end">
                      <textarea
                        value={newMessage}
                        ref={chatInputRef}
                        onChange={(e) => {
                          setNewMessage(e.target.value);
                          // Auto-resize
                          e.target.style.height = "auto";
                          e.target.style.height =
                            Math.min(e.target.scrollHeight, 128) + "px"; // 128px = max-h-32
                        }}
                        placeholder="Ketik pesan"
                        className="w-full bg-transparent outline-none text-[0.9375rem] text-[#111b21] placeholder-[#667781] py-2 resize-none overflow-y-auto"
                        style={{
                          minHeight: "40px",
                          maxHeight: "128px", // max-h-32 = 8rem = 128px
                        }}
                        rows={1}
                      />
                    </div>

                    {/* Send Button */}
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sendingMessage}
                      className={`
          p-2.5 rounded-full transition-all flex items-center justify-center shrink-0
          ${
            newMessage.trim() && !sendingMessage
              ? "bg-[#00a884] text-white hover:bg-[#008f72] shadow-sm hover:shadow-md"
              : "bg-[#e9edef] text-[#8696a0] cursor-not-allowed"
          }
        `}
                    >
                      {sendingMessage ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <dialog id="message-menu" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">message-menu</h3>
          <div className="flex flex-col">
            <button
              onClick={() =>
                (
                  document.getElementById("message-menu") as HTMLDialogElement
                )?.close()
              }
              className="btn"
            >
              Select
            </button>
            <button className="btn">Delete for everyone</button>
          </div>
          <div className="modal-action">
            <button
              onClick={() => {
                (
                  document.getElementById("message-menu") as HTMLDialogElement
                )?.close();
                setSelectedChatIds([]);
              }}
              className="btn"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
      <ConfirmationModal
        message="Anda yakin ingin menghapus pesan terpilih?"
        modalId="message-delete-confirmation"
        onConfirm={async () => {
          const res = await ChatApi.deleteMessages(
            chatIds,
            selectedRoomId,
            selectedRecipient,
          );
          if (res.success) {
            toast.success(res.message);
            setSelectedChatIds([]);
          } else {
            toast.error(res.message);
          }
        }}
        title=""
        key={"message-delete-confirmation"}
      />
    </div>
  );
}

export default ChatBubble;

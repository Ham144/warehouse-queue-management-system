"use client";
import { AuthApi } from "@/api/auth";
import { BASE_URL } from "@/lib/constant";
import { UserApp, UserInfo } from "@/types/auth";
import { createContext, useContext, useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

interface UserContextType {
  userInfo: UserInfo | null;
  setUserInfo: (userInfo: UserInfo | null) => void;
  loadingUser: boolean;
  socket: Socket | null;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingUser, setloadingUser] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await AuthApi.getUserInfo();
        setUserInfo(res as UserInfo);
      } catch {
        setUserInfo(null);
      } finally {
        setloadingUser(false);
      }
    }
    fetchUser();
  }, []);

  // SOCKET LIFECYCLE
  useEffect(() => {
    if (!userInfo) {
      setSocket(null);
      return;
    }

    // Parse the BASE_URL so we can handle proxy subpaths correctly
    const url = new URL(BASE_URL, window.location.origin);
    const origin = url.origin;
    const basePath = url.pathname === "/" ? "" : url.pathname;

    const socketInstance = io(origin, {
      path: `${basePath}/api/socket.io/`,
      auth: {
        username: userInfo.username,
      },
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [userInfo]);

  return (
    <UserContext.Provider
      value={{
        userInfo,
        setUserInfo,
        loadingUser,
        socket,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserInfo(): {
  userInfo: UserInfo | UserApp | null;
  loadingUser: boolean;
  setUserInfo: (userInfo: UserInfo | UserApp | null) => void;
  socket: Socket | null;
} {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserInfo must be used within UserProvider");
  }
  return context as {
    userInfo: UserInfo | UserApp | null;
    loadingUser: boolean;
    setUserInfo: (userInfo: UserInfo | UserApp | null) => void;
    socket: Socket | null;
  };
}

import axios from "axios";
import { BASE_URL } from "./constant";
import { toast } from "sonner";

const axiosInstance = axios.create({
  withCredentials: true,
  baseURL: `${BASE_URL}`,
});

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed() {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
}

// Request interceptor untuk menyimpan URL di config
axiosInstance.interceptors.request.use(
  (config) => {
    // Simpan URL menggunakan properti headers atau cara lain yang aman
    // Kita bisa menyimpannya di config.headers atau menggunakan pendekatan berbeda
    if (config.url && config.headers) {
      // Simpan di custom header (tidak akan dikirim ke server karena kita akan hapus nanti)
      config.headers["X-Request-Url"] = config.url;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor untuk menangani error 401 dan 403
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isAuthError = error.response?.status === 401;
    const isForbiddenError = error.response?.status === 403;

    // Ambil URL dari headers yang kita simpan atau dari originalRequest.url
    const requestUrl =
      originalRequest.headers?.["X-Request-Url"] || originalRequest.url || "";
    const isRefreshEndpoint = requestUrl.includes("/api/user/refresh-token");
    const isLoginEndpoint = requestUrl.includes("/api/user/login/ldap");
    const isPublicRoute = isLoginEndpoint || isRefreshEndpoint;

    // Handle 401 Unauthorized
    if (isAuthError && !originalRequest._retry && !isPublicRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push(() => {
            axiosInstance(originalRequest).then(resolve).catch(reject);
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${BASE_URL}/api/user/refresh-token`,
          {},
          {
            withCredentials: true,
          },
        );

        if (res.status === 200) {
          isRefreshing = false;
          onRefreshed();
          await new Promise((resolve) => setTimeout(resolve, 200));
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        isRefreshing = false;
        onRefreshed();

        // Cek apakah di browser environment
        if (typeof window !== "undefined") {
          const currentPath = window.location.pathname;
          
          // JANGAN REDIRECT JIKA DI HALAMAN DOKUMENTASI
          const isAtDocumentation = currentPath.includes("/documentation");

          const isOnLogin =
            currentPath === "/antrian" || currentPath === "/antrian/";

          if (!isOnLogin && !isAtDocumentation) {
            try {
              const cookieNames = ["access_token", "refresh_token"];
              const paths = ["/antrian", "/"];

              cookieNames.forEach((name) => {
                paths.forEach((path) => {
                  document.cookie = `${name}=; path=${path}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
                });
              });

              window.location.href = window.location.origin + "/antrian";
            } catch (e) {
              console.error("Redirect error:", e);
            }
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 Forbidden
    if (isForbiddenError) {
      toast.error("Anda tidak memiliki hak akses.");
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;

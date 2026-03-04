import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { TokenPayload } from "./types/tokenPayload"; // Pastikan path ini benar
import { ROLE } from "./types/shared.type"; // Pastikan path ini benar

export function middleware(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;
  const { pathname } = req.nextUrl;

  // --- PINDAHKAN ARRAY KE SINI AGAR TERBACA ---
  const DRIVER_VENDOR = ["/vendor/driver-menu"];
  const ADMIN_VENDOR = [
    "/vendor/dashboard",
    "/vendor/booking",
    "/vendor/history",
    "/vendor/member-management",
    "/vendor/reports",
    "/admin/all-warehouse",
  ];

  const USER_ORGANIZATION = [
    "/admin/dashboard",
    "/admin/gate",
    "/admin/booking",
    "/admin/busy-times",
    "/admin/queue",
    "/admin/reports",
    "/admin/vehicles",
    "/admin/my-warehouse",
    "/admin/settings",
  ];

  // 1. Jalur Bebas Hambatan (Public)
  if (pathname === "/antrian" || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // 2. Helper Redirect
  const redirectToLogin = () => {
    // Karena pakai basePath: '/antrian', "/" ini akan mengarah ke domain.com/antrian/
    return NextResponse.redirect(new URL("/antrian", req.url));
  };

  const redirectToForbidden = () => {
    return NextResponse.redirect(new URL("/antrian/forbidden", req.url));
  };

  // 3. Cek Keberadaan Token
  if (!token) {
    if (refreshToken) return NextResponse.next();
    return redirectToLogin();
  }

  try {
    const payload = token.split(".")[1];
    const decoded: TokenPayload = JSON.parse(
      Buffer.from(payload, "base64").toString(),
    );

    const exp = decoded?.exp;
    if (exp && exp * 1000 < Date.now()) {
      if (refreshToken) return NextResponse.next();
      return redirectToLogin();
    }

    const role: ROLE = decoded?.role;
    const am_i_vendor = !!decoded?.vendorName;

    if (!role) return redirectToLogin();

    // 4. Role-Based Access Control (RBAC)
    if (!am_i_vendor) {
      if (role === ROLE.ADMIN_ORGANIZATION) return NextResponse.next();

      // Cek apakah path yang diakses ada di daftar USER_ORGANIZATION
      const isUserOrgPath = USER_ORGANIZATION.some((path) =>
        pathname.startsWith(path),
      );
      if (isUserOrgPath) return NextResponse.next();

      return redirectToForbidden();
    } else {
      // Logic untuk Vendor
      const targetPaths =
        role === ROLE.DRIVER_VENDOR ? DRIVER_VENDOR : ADMIN_VENDOR;
      const isAllowed = targetPaths.some((path) => pathname.startsWith(path));

      if (isAllowed) return NextResponse.next();
      return redirectToForbidden();
    }
  } catch (err) {
    if (refreshToken) return NextResponse.next();
    return redirectToLogin();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|csi-logo.png|login|forgot-password|forbidden|unauthorized|docs).*)",
  ],
};

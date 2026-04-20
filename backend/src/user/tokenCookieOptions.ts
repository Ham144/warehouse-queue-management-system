export const refreshTokenOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV == 'production' ? true : false,
  sameSite: 'lax' as const,
  path:
    process.env.NODE_ENV === 'production'
      ? '/antrian/api/user/refresh-token'
      : '/api/user/refresh-token', //ini fix, jangan diganti!!!!!
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

//ini udah pasti benar
export const accessTokenOption = {
  httpOnly: true,
  secure: process.env.NODE_ENV == 'production' ? true : false,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 10 * 60 * 1000,
};

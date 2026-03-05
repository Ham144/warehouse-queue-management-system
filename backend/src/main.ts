import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/http-exception-filter';
import { ValidationPipe } from '@nestjs/common';
import { PrismaExceptionFilter } from './common/PrismaException';
import { RedisIoAdapter } from './RedisIoAdapter/redis-io-adapter.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();

  // jangan create server sendiri, cukup set adapter
  app.useWebSocketAdapter(redisIoAdapter);

  app.setGlobalPrefix('api');

  // Global Pipes (cukup 1 kali)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // hapus field yg tidak ada di DTO
      forbidNonWhitelisted: false, // tidak lempar error
      transform: true, // otomatis transform payload → DTO
    }),
  );

  // Cookie parser
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL_PROD]
        : ['http://localhost:3000', process.env.FRONTEND_URL_DEV],
    credentials: true,
  });

  // Global error filter (opsional)
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  await app.listen(3001, '0.0.0.0');
  console.log('✓ Server listening on port 3001');
}

bootstrap().catch((error) => {
  console.error('Unhandled error in bootstrap:', error);
  process.exit(1);
});

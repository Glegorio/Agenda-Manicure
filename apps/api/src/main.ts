import 'reflect-metadata';
import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { configureContractsLocale } from '@agende/contracts';
import { AppModule } from './app.module.js';

configureContractsLocale();
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.enableShutdownHooks();
const port = Number(process.env['API_PORT'] ?? 3333);
await app.listen(port);
Logger.log(`API ouvindo na porta ${String(port)}`, 'Bootstrap');

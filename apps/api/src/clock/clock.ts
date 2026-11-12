/**
 * Relógio injetável: casos de uso pedem `now` aqui, nunca `new Date()` direto, para que regras
 * de tempo (RN-33, RN-40, RN-46) sejam testáveis com instante fixo.
 */
export abstract class Clock {
  abstract now(): Date;
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

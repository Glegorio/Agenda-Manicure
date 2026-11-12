-- Q-27: a página pública só mostra o endereço completo se a profissional optar (LGPD, minimização).
ALTER TABLE "professionals" ADD COLUMN "show_full_address" BOOLEAN NOT NULL DEFAULT false;

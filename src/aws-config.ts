import { Amplify } from 'aws-amplify';

// ===========================================
// CONFIGURACIÓN DE AWS AMPLIFY (STORAGE)
// ===========================================
// CONFIGURACIÓN PARA AWS ACADEMY (Learner Lab)
// Al ser un entorno de laboratorio, usamos credenciales directas.
// NOTA: Estas credenciales caducan cada cierto tiempo (ej: 4 horas). Tendrás que actualizarlas.

export const AWS_LAB_CREDENTIALS = {
    region: 'us-east-1',
    credentials: {
        accessKeyId: 'ASIAS2T7TKRZ27MRQKFS',
        secretAccessKey: 'IN2elK1E25qPDPCl+JN9kh/9dsc1YsRFLJKWTIp3',
        sessionToken: 'IQoJb3JpZ2luX2VjEID//////////wEaCXVzLXdlc3QtMiJHMEUCIFiIiV1L4VsCXMhtHxXFp+8ENoST/U3rYR/gLbUJP5QYAiEA4S/1Vd4z2cxo0JqhhPX2pwtXey++0yhZlh1buQfwLQQqtAIISRAAGgwxOTQ2MTQ4NzUyNTEiDHL2zXUMyWjvJuU0WCqRAg2CBVKZkPL/o74uBO0wGT91z+8Kd0KPoIROu6mkp66oh4Pp9GBmCZUej0Cs724EBfGsX+Sq8ZkanseUACTyYoUpECZqWBBZmMW2rHyiGc+sr74GLr5b9Y+k6ok2mEnrSzp0fOdPmYjhFfkVe3VZCyUKAgDmMM7BM0plYOdmAs3uemXdN7zhCtf+bXQUGnMC51sUKMDshyZezV7L9kfWv0iG7ZDG4VcRSH6+YZMI/ZQKOgAy75a17Jrl4xYJcVCto0AlqadV4CepicEBRqcScBG7WX2Zpsjea7DnVHZisZs+KqYM9Rr2i3HssgMs5ppGDbGy41u0n+BdJoy5JCdv53FZkl8LJTJp/UPltaqISbm37TC5lJjMBjqdAb11yZggyz86UHhAYkbHHB0JpxntrdUNRCaG+IO+fX+1JGxgspCdepqZm9I83t0OrlbeEyDsKuMKpdGApoKHlf3L/ztPqaCl5cpCQyYVhtDO+3XFMvfW3MSf7kMrEsAaPhPMph6hSMkIzxSxqKLLtHJkWM9KhUF9BSZg1t28k2rMMl8WdJ1LFpg3Ezp/Iyzxxh5vzvDwowFDUtWB+2U='
    },
    bucketName: 'reportes-pdf-facturacion'
};

// Función dummy para mantener compatibilidad si algo llama a initAmplify
export function initAmplify() {
    console.log("Using AWS SDK with Lab Credentials");
}

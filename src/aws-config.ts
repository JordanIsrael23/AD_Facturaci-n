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
        accessKeyId: 'ASIAS2T7TKRZR4CTOJT3',
        secretAccessKey: 'Yek6CqrlixQnq7//2j81WnnP+AWc0msm7VX3o0rm',
        sessionToken: 'IQoJb3JpZ2luX2VjEKX//////////wEaCXVzLXdlc3QtMiJGMEQCIH2tuSESBigz2QqBZYy0hYEE1QXPwxw2Ec+4GgEhv3zmAiA9ur3LnIiyDDO1FGCCx0ibbM2KE351BXsX6Ni+wn6v9iq0AghuEAAaDDE5NDYxNDg3NTI1MSIMEi8S3fZw7MhjAX90KpECyipzNvtAnFFGGMP+BwM7AAic1JyIUF3neIARUYmTqStp4JQfcUXh6X6bTawr4CWZ39qnAvBTXj7t6THc2APHvNSUUyEMpNn4AA5gssyyAOQay7bqTpHZIj2CWbw9RebYpc1Gf0GcZyWwb91cX5bVcJis6W+kC3YKqPOQB86JUJZc07vbmi0PBHc1ryt0V2bgbsuiG0gRqp5f2JauKInWnVfdal7aa+wr/bZLAIjrN4aa0Ck71xZTRvXqx4bt3tuD9Ttxnt7PoPfMblT8T2HMg1ZvqLJJsuLoy/lzyH2aZ7B5IsQsHCBMA7Ft6uYRyoOL1pFRwN60e4WQaoy9f6H6XQaE+hQkbOfMJ0M1uSriLV1iMKmjoMwGOp4B4XYhbv9hMv5QgB5zqaH4x4EbNp3Xy11gPl1zo2OdFeM5pQxQ3PTSLgLXdCLICotKd6Cbd2+ix1q3tHmH1m8oy1OyfHV85KKfx5hJ1ImwJyUK8eZ2jqg5/8msNZOUbwIE2dShjFspopWHpRwZJw+/PYRpdEKeGddLMDG7MVHcn+Bp7EqHje4spSh5IjGP8+6DGAwBvTxX6MrhsTeA2eI='
    },
    bucketName: 'reportes-pdf-facturacion'
};

// Función dummy para mantener compatibilidad si algo llama a initAmplify
export function initAmplify() {
    console.log("Using AWS SDK with Lab Credentials");
}

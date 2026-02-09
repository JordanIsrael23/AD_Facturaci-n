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
        accessKeyId: 'ASIAS2T7TKRZSLAXKI5C',
        secretAccessKey: 'A9b0F3t8lKx8rPbzAlFhx18/qHFMK3jqJNRHlVos',
        sessionToken: 'IQoJb3JpZ2luX2VjEMn//////////wEaCXVzLXdlc3QtMiJIMEYCIQDjSuPEW9/Xx38eKGzmQO6ayD75E4Ralr9sV7MWdTDCcAIhAO7jUFd5FEbZa6i6PevAxmXwrMq14ru4x/I8vqOlCAEdKr0CCJL//////////wEQABoMMTk0NjE0ODc1MjUxIgz/qxczRbkmUukS/EoqkQImNH0O3eKNsxjUkkcvPF/fH3VlD/4JdwsMTbIgkrei0L0yniGCgyRCz4R3fEHqvGq6XZE/sjWUcR0Tv2Z2BzW9XTf1SyF0tpINC/4SBXRhq/eSVpFVbnBSdDLKZvCx1/QyTKULuado8izGj01OdWR6td3qCo/iwjF16o5lcFOxuhc8Q4lalp2QR2Zy8PTcIwDyYw7qOY6qANswP9G4r2t4c28Q//vxGaC1j7KSRhEHev1v6mxCk9ZA4Oj22S5H0gkwCvM2iBSQ7/W5oITUlJexDdFUXfz1feiK4PzM/JWRPPfIRR/omy2At5kR0ukgVpqCHMMKjVHDPNfFIUSjPGcsyQ3KgyeMM4xME17QbwCkEmYwiKmozAY6nAG+DKjkxDI3CligcODdG8fsiX35fU8WFVPui3QcOWXYOkXJetJJfa7nrFxK/RzDTRVZnFUEWhF3mg1Ic6KsC54Bb9Kb+3c4QOGhyoyMSFXYo3EMwXTof0N96ep/Aqz4MyG3udl31xmU60ObP1wKjpeCBYcKJDDioNiDx+rnrQC5J2OI5JikHLW1NvYeFW/PtxzM7fmM/QWHew+sM8k='
    },
    bucketName: 'reportes-pdf-facturacion'
};

// Función dummy para mantener compatibilidad si algo llama a initAmplify
export function initAmplify() {
    console.log("Using AWS SDK with Lab Credentials");
}

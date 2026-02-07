import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { AWS_LAB_CREDENTIALS } from "../aws-config";

const s3Client = new S3Client({
    region: AWS_LAB_CREDENTIALS.region,
    credentials: AWS_LAB_CREDENTIALS.credentials
});

export async function uploadPDFToS3(blob: Blob, folder: 'facturas' | 'reportes' | 'clientes', fileName: string) {
    if (!blob) {
        console.error("Upload error: Blob is null");
        return;
    }

    // Convert Blob to Uint8Array because AWS SDK expects buffer/array for browser
    const arrayBuffer = await blob.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Path structure: public/folder/year/month/filename
    const key = `public/${folder}/${year}/${month}/${fileName}`;

    try {
        console.log(`Subiendo archivo a S3: ${key}...`);

        const command = new PutObjectCommand({
            Bucket: AWS_LAB_CREDENTIALS.bucketName,
            Key: key,
            Body: body,
            ContentType: 'application/pdf'
            // ACL: 'public-read' // Omitido, buckets de lab suelen bloquear ACLs públicas, pero es accesible si el bucket es público
        });

        const response = await s3Client.send(command);
        console.log("S3 Upload Success", response);
        return response;

    } catch (error) {
        console.error("Error subiendo a S3:", error);
        throw error;
    }
}

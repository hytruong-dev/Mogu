import { Platform } from 'react-native';
import { File, UploadType } from 'expo-file-system';
import type { UploadImage } from '../../components/organisms/ImageUploadField';

export type SignedImageUpload = {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  expiresAt?: string;
};

/** Upload the original bytes to a short-lived signed URL, without app Authorization headers. */
export async function uploadSignedImage(
  image: UploadImage,
  signed: SignedImageUpload,
  onProgress: (percent: number) => void,
) {
  if (
    !signed.url ||
    signed.url.includes('token=stub') ||
    signed.url.includes('placeholder.supabase.co')
  ) {
    throw new Error('Máy chủ chưa cấu hình URL upload ảnh thật. Hãy liên hệ bộ phận BE.');
  }
  if (signed.expiresAt && Date.now() >= new Date(signed.expiresAt).getTime()) {
    throw new Error('Phiên upload đã hết hạn. Hãy thử lại.');
  }

  if (Platform.OS === 'web') {
    if (!image.webFile) throw new Error('Không đọc được tệp ảnh trên trình duyệt.');
    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers,
      body: image.webFile,
    });
    if (!response.ok) throw new Error(`Upload ảnh thất bại (${response.status}).`);
    onProgress(100);
    return;
  }

  const result = await new File(image.uri).upload(signed.url, {
    httpMethod: signed.method,
    uploadType: UploadType.BINARY_CONTENT,
    headers: signed.headers,
    mimeType: image.mimeType,
    onProgress: ({ bytesSent, totalBytes }) => {
      if (totalBytes > 0) onProgress((bytesSent / totalBytes) * 100);
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload ảnh thất bại (${result.status}).`);
  }
  onProgress(100);
}

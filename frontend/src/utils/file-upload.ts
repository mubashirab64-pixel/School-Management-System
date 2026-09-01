/**
 * Utility functions for handling file uploads and conversions
 */

/**
 * Converts a base64 data URL to a File object
 * @param dataUrl - Base64 data URL (e.g., "data:image/jpeg;base64,/9j/4AAQ...")
 * @param filename - Name for the file
 * @param mimeType - MIME type (optional, will be extracted from data URL if not provided)
 */
export function base64ToFile(dataUrl: string, filename: string, mimeType?: string): File {
  try {
    // Extract base64 data and mime type
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const extractedMimeType = mimeType || (dataUrl.split(';')[0].split(':')[1] || 'application/octet-stream');

    // Convert base64 to binary
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);

    // Create File object
    return new File([byteArray], filename, { type: extractedMimeType });
  } catch (error) {
    console.error('Error converting base64 to file:', error);
    throw new Error('Failed to convert base64 data to file');
  }
}

/**
 * Converts multiple base64 data URLs to File objects
 */
export function base64ToFiles(
  dataUrls: Record<string, string>,
  filenameMap: Record<string, string>
): Record<string, File> {
  const files: Record<string, File> = {};

  for (const [key, dataUrl] of Object.entries(dataUrls)) {
    if (dataUrl) {
      const filename = filenameMap[key] || `${key}.jpg`;
      files[key] = base64ToFile(dataUrl, filename);
    }
  }

  return files;
}

/**
 * Creates FormData from an object, including file fields
 * @param data - Object with data fields
 * @param files - Optional files to append
 */
export function createFormData(
  data: Record<string, unknown>,
  files?: Record<string, File>
): FormData {
  const formData = new FormData();

  // Append regular fields
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        // Handle arrays
        value.forEach((item) => {
          formData.append(key, String(item));
        });
      } else if (typeof value === 'object' && !(value instanceof File)) {
        // Handle nested objects by stringifying
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  // Append files
  if (files) {
    Object.entries(files).forEach(([key, file]) => {
      formData.append(key, file);
    });
  }

  return formData;
}

/**
 * Validates file size
 */
export function validateFileSize(file: File, maxSizeMB: number = 5): boolean {
  const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
  return file.size <= maxSize;
}

/**
 * Validates file type
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

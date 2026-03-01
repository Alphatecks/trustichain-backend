/**
 * Storage Service
 * Handles file uploads to Supabase Storage
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { v4 as uuidv4 } from 'uuid';

// Image-only for company logo upload
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Business KYC documents: PDF or image (Identity, Address, Enhanced Due Diligence)
const KYC_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

// Allowed file types for dispute evidence
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export interface UploadFileResult {
  success: boolean;
  message: string;
  data?: {
    fileUrl: string;
    filePath?: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    signedUrl?: string;
  };
  error?: string;
}

export class StorageService {
  private readonly BUCKET_NAME = 'dispute-evidence';

  /**
   * Validate file before upload
   */
  private validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      };
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Generate unique file path for storage
   */
  private generateFilePath(userId: string, originalFileName: string): string {
    const timestamp = Date.now();
    const uniqueId = uuidv4().substring(0, 8);
    const sanitizedFileName = originalFileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50); // Limit filename length

    return `${userId}/${timestamp}-${uniqueId}-${sanitizedFileName}`;
  }

  /**
   * Ensure storage bucket exists
   */
  async ensureBucketExists(): Promise<void> {
    const adminClient = supabaseAdmin || supabase;
    if (!adminClient) {
      throw new Error('Supabase admin client not available');
    }

    // Check if bucket exists
    const { data: buckets, error: listError } = await adminClient.storage.listBuckets();

    if (listError) {
      console.error('Error listing buckets:', listError);
      throw new Error('Failed to check storage buckets');
    }

    const bucketExists = buckets?.some((bucket: { name: string }) => bucket.name === this.BUCKET_NAME);

    if (!bucketExists) {
      // Create bucket if it doesn't exist
      const { error: createError } = await adminClient.storage.createBucket(this.BUCKET_NAME, {
        public: false, // Private bucket - files accessible via signed URLs
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });

      if (createError) {
        console.error('Error creating bucket:', createError);
        throw new Error('Failed to create storage bucket');
      }
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  async uploadFile(
    userId: string,
    file: Express.Multer.File
  ): Promise<UploadFileResult> {
    try {
      // Validate file
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.error || 'File validation failed',
          error: validation.error || 'File validation failed',
        };
      }

      // Ensure bucket exists
      await this.ensureBucketExists();

      const adminClient = supabaseAdmin || supabase;
      if (!adminClient) {
        return {
          success: false,
          message: 'Storage service not available',
          error: 'Storage service not available',
        };
      }

      // Generate unique file path
      const filePath = this.generateFilePath(userId, file.originalname);

      // Upload file to Supabase Storage
      const { data, error: uploadError } = await adminClient.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Don't overwrite existing files
        });

      if (uploadError || !data) {
        console.error('Error uploading file:', uploadError);
        return {
          success: false,
          message: 'Failed to upload file to storage',
          error: uploadError?.message || 'Upload failed',
        };
      }

      // Get public URL (or signed URL for private buckets)
      // For private buckets, we'll use the path and generate signed URLs when needed
      const { data: urlData } = adminClient.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(data.path);

      // For private buckets, we return the path and can generate signed URLs later
      // For now, we'll use the path as the identifier
      const fileUrl = urlData.publicUrl || `${this.BUCKET_NAME}/${data.path}`;

      return {
        success: true,
        message: 'File uploaded successfully',
        data: {
          fileUrl,
          filePath: data.path,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
        },
      };
    } catch (error) {
      console.error('Error in uploadFile:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload file',
        error: error instanceof Error ? error.message : 'Failed to upload file',
      };
    }
  }

  /**
   * Upload company logo (image only). Used by business suite KYC.
   * Path: business-suite-logos/{userId}/...
   */
  async uploadCompanyLogo(
    userId: string,
    file: Express.Multer.File
  ): Promise<UploadFileResult> {
    try {
      if (!file) {
        return { success: false, message: 'No file provided', error: 'No file provided' };
      }
      if (file.size > MAX_FILE_SIZE) {
        return {
          success: false,
          message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          error: 'File too large',
        };
      }
      if (!IMAGE_MIME_TYPES.includes(file.mimetype)) {
        return {
          success: false,
          message: 'Only images are allowed (JPEG, PNG, GIF, WebP)',
          error: 'Invalid file type',
        };
      }
      const adminClient = supabaseAdmin || supabase;
      if (!adminClient) {
        return { success: false, message: 'Storage service not available', error: 'Storage service not available' };
      }
      await this.ensureBucketExists();
      const filePath = `business-suite-logos/${this.generateFilePath(userId, file.originalname)}`;
      const { data, error: uploadError } = await adminClient.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
      if (uploadError || !data) {
        return {
          success: false,
          message: uploadError?.message || 'Failed to upload logo',
          error: uploadError?.message || 'Upload failed',
        };
      }
      const { data: urlData } = adminClient.storage.from(this.BUCKET_NAME).getPublicUrl(data.path);
      const fileUrl = urlData.publicUrl || `${this.BUCKET_NAME}/${data.path}`;
      return {
        success: true,
        message: 'Logo uploaded successfully',
        data: {
          fileUrl,
          filePath: data.path,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload logo',
        error: error instanceof Error ? error.message : 'Failed to upload logo',
      };
    }
  }

  /**
   * Upload file and return a signed URL (e.g. for KYC providers that need to fetch the image by URL).
   * Default expiry 7 days.
   */
  async uploadFileAndGetSignedUrl(
    userId: string,
    file: Express.Multer.File,
    expiresInSeconds: number = 7 * 24 * 3600
  ): Promise<UploadFileResult> {
    const result = await this.uploadFile(userId, file);
    if (!result.success || !result.data?.filePath) {
      return result;
    }
    const signedUrl = await this.getSignedUrl(result.data.filePath, expiresInSeconds);
    if (!signedUrl) {
      return {
        success: false,
        message: 'Failed to generate signed URL',
        error: 'Failed to generate signed URL',
      };
    }
    return {
      ...result,
      data: {
        ...result.data,
        signedUrl,
      },
    };
  }

  /**
   * Upload business KYC document (Identity, Address, or Enhanced Due Diligence). PDF or image.
   * Path: business-kyc-docs/{userId}/{type}/...
   */
  async uploadBusinessKycDocument(
    userId: string,
    file: Express.Multer.File,
    type: 'identity' | 'address' | 'enhanced_due_diligence'
  ): Promise<UploadFileResult> {
    try {
      if (!file) {
        return { success: false, message: 'No file provided', error: 'No file provided' };
      }
      if (file.size > MAX_FILE_SIZE) {
        return {
          success: false,
          message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          error: 'File too large',
        };
      }
      if (!KYC_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
        return {
          success: false,
          message: 'Only PDF or images are allowed (JPEG, PNG, GIF, WebP, PDF)',
          error: 'Invalid file type',
        };
      }
      const adminClient = supabaseAdmin || supabase;
      if (!adminClient) {
        return { success: false, message: 'Storage service not available', error: 'Storage service not available' };
      }
      await this.ensureBucketExists();
      const filePath = `business-kyc-docs/${userId}/${type}/${this.generateFilePath(userId, file.originalname)}`;
      const { data, error: uploadError } = await adminClient.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });
      if (uploadError || !data) {
        return {
          success: false,
          message: uploadError?.message || 'Failed to upload document',
          error: uploadError?.message || 'Upload failed',
        };
      }
      const { data: urlData } = adminClient.storage.from(this.BUCKET_NAME).getPublicUrl(data.path);
      const fileUrl = urlData.publicUrl || `${this.BUCKET_NAME}/${data.path}`;
      return {
        success: true,
        message: 'Document uploaded successfully',
        data: {
          fileUrl,
          filePath: data.path,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload document',
        error: error instanceof Error ? error.message : 'Failed to upload document',
      };
    }
  }

  /**
   * Resolve stored company logo URL (or path) to a signed URL for viewing.
   * Use when returning logo to admin or anywhere the bucket is private.
   */
  async getSignedUrlForCompanyLogo(storedUrlOrPath: string | null | undefined, expiresIn: number = 3600): Promise<string | null> {
    if (!storedUrlOrPath || typeof storedUrlOrPath !== 'string') return null;
    const trimmed = storedUrlOrPath.trim();
    if (!trimmed) return null;
    const path = trimmed.includes(this.BUCKET_NAME)
      ? (trimmed.split(`${this.BUCKET_NAME}/`)[1] || trimmed)
      : trimmed;
    return this.getSignedUrl(path, expiresIn);
  }

  /**
   * Resolve stored business KYC document URL (or path) to a signed URL for viewing (e.g. admin).
   */
  async getSignedUrlForBusinessKycDocument(storedUrlOrPath: string | null | undefined, expiresIn: number = 3600): Promise<string | null> {
    if (!storedUrlOrPath || typeof storedUrlOrPath !== 'string') return null;
    const trimmed = storedUrlOrPath.trim();
    if (!trimmed) return null;
    const path = trimmed.includes(this.BUCKET_NAME)
      ? (trimmed.split(`${this.BUCKET_NAME}/`)[1] || trimmed)
      : trimmed;
    return this.getSignedUrl(path, expiresIn);
  }

  /**
   * Generate signed URL for private file access
   */
  async getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const adminClient = supabaseAdmin || supabase;
      if (!adminClient) {
        return null;
      }

      const { data, error } = await adminClient.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(filePath, expiresIn);

      if (error || !data) {
        console.error('Error generating signed URL:', error);
        return null;
      }

      return data.signedUrl;
    } catch (error) {
      console.error('Error in getSignedUrl:', error);
      return null;
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const adminClient = supabaseAdmin || supabase;
      if (!adminClient) {
        return false;
      }

      // Extract path from full URL if needed
      const path = filePath.includes('/') ? filePath.split(`${this.BUCKET_NAME}/`)[1] || filePath : filePath;

      const { error } = await adminClient.storage.from(this.BUCKET_NAME).remove([path]);

      if (error) {
        console.error('Error deleting file:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteFile:', error);
      return false;
    }
  }
}

export const storageService = new StorageService();


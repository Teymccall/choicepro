// Remove unused import
// import cloudinary from '../config/cloudinary';

import axios from 'axios';

const CLOUDINARY_UPLOAD_PRESET = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_CLOUD_NAME = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;

// Function to upload media to Cloudinary
export const uploadMedia = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'choice_app_preset'); // Using the unsigned upload preset
    formData.append('timestamp', Math.round((new Date()).getTime() / 1000));

    const response = await fetch(
      'https://api.cloudinary.com/v1_1/dmfoxrq1v/auto/upload',
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed response:', errorText);
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.secure_url) {
      throw new Error('Invalid response from Cloudinary');
    }

    return {
      url: data.secure_url,
      publicId: data.public_id,
      resourceType: data.resource_type,
      format: data.format
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image. Please try again.');
  }
};

// Function to validate file before upload
export const validateFile = async (file) => {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    // Validate file type first
    if (!isImage && !isVideo) {
      reject(new Error('File type not supported. Please use images (JPEG, PNG, GIF, WEBP) or videos (MP4, MOV, WEBM)'));
      return;
    }
    
    // Validate file size (max 10MB for images, 50MB for videos)
    const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      reject(new Error(`File size must be less than ${isImage ? '10' : '50'}MB`));
      return;
    }

    // For images, validate specific types and dimensions
    if (isImage) {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedImageTypes.includes(file.type)) {
        reject(new Error('Image type not supported. Please use JPEG, PNG, GIF or WEBP'));
        return;
      }

      // Create image object to check dimensions
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        // Check if image dimensions are reasonable
        if (img.width > 4096 || img.height > 4096) {
          reject(new Error('Image dimensions too large. Maximum size is 4096x4096 pixels.'));
          return;
        }

        resolve(true);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Invalid image file'));
      };

      img.src = objectUrl;
    }
    
    // For videos, validate specific types
    else if (isVideo) {
      const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
      if (!allowedVideoTypes.includes(file.type)) {
        reject(new Error('Video type not supported. Please use MP4, MOV, or WEBM'));
        return;
      }

      // Videos don't need dimension checks, just resolve
      resolve(true);
    }
  });
}; 


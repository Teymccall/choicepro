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
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      reject(new Error('File size must be less than 5MB'));
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      reject(new Error('File type not supported. Please use JPEG, PNG, GIF or WEBP'));
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
  });
}; 


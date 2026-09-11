const supabase = require('../config/supabase');

const BUCKET = process.env.SUPABASE_BUCKET || 'glowbulk-files';

/**
 * Upload a file buffer to Supabase Storage
 */
const uploadToSupabase = async function(fileBuffer, originalName, folder, mimetype) {
  // Generate a unique filename
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const ext = originalName.split('.').pop();
  const filename = folder + '/' + timestamp + '-' + random + '.' + ext;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, fileBuffer, {
      contentType: mimetype,
      upsert: false
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error('Failed to upload file: ' + error.message);
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filename);

  return {
    url: urlData.publicUrl,
    path: filename,
    filename: filename
  };
};

module.exports = { uploadToSupabase };
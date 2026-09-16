const supabase = require('../config/supabase');

const BUCKET = process.env.SUPABASE_BUCKET || 'glowbulk-files';

/**
 * Upload a file buffer to Supabase Storage
 */
const uploadToSupabase = async function(fileBuffer, originalName, folder, mimetype) {
  // Validate inputs
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('No file data provided');
  }

  if (!originalName) {
    throw new Error('No filename provided');
  }

  // Safe folder — default to 'uploads' if missing, strip leading/trailing slashes
  const safeFolder = (folder || 'uploads').replace(/^\/+|\/+$/g, '');

  // Sanitize extension — remove dots and special chars
  const rawExt = originalName.split('.').pop();
  const ext = rawExt ? rawExt.replace(/[^a-zA-Z0-9]/g, '') : 'bin';

  // Generate unique filename WITHOUT leading slash
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const filename = safeFolder + '/' + timestamp + '-' + random + '.' + ext;

  console.log('Supabase upload debug:', {
    bucket: BUCKET,
    folder: safeFolder,
    originalName: originalName,
    finalFilename: filename,
    mimetype: mimetype,
    bufferSize: fileBuffer.length,
    url: process.env.SUPABASE_URL
  });

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
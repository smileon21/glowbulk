const pool = require('../config/database');

// Create content
const createContent = async (contentData) => {
  const {
    title,
    contentType,
    content,
    slug,
    metaDescription,
    status = 'draft',
    createdBy
  } = contentData;

  const query = `
    INSERT INTO content (
      title, content_type, content, slug, meta_description, status, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [title, contentType, content, slug, metaDescription, status, createdBy];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'content_slug_key') {
      const friendlyError = new Error('That slug is already in use. Please choose a different one.');
      friendlyError.status = 400;
      throw friendlyError;
    }
    throw error;
  }
};

// Publish content
const publishContent = async (id, publishedBy) => {
  const query = `
    UPDATE content 
    SET status = 'published',
        published_at = CURRENT_TIMESTAMP,
        published_by = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [publishedBy, id]);
  return result.rows[0];
};

// Get all content
const getAllContent = async () => {
  const query = 'SELECT * FROM content ORDER BY created_at DESC';
  const result = await pool.query(query);
  return result.rows;
};

// Get published content (for website)
const getPublishedContent = async () => {
  const query = 'SELECT * FROM content WHERE status = \'published\' ORDER BY created_at DESC';
  const result = await pool.query(query);
  return result.rows;
};

// Get content by ID
const getContentById = async (id) => {
  const query = 'SELECT * FROM content WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Get content by slug
const getContentBySlug = async (slug) => {
  const query = 'SELECT * FROM content WHERE slug = $1 AND status = \'published\'';
  const result = await pool.query(query, [slug]);
  return result.rows[0];
};

// Update content
const updateContent = async (id, contentData) => {
  const {
    title,
    contentType,
    content,
    slug,
    metaDescription,
    status
  } = contentData;

  const query = `
    UPDATE content 
    SET 
      title = $1,
      content_type = $2,
      content = $3,
      slug = $4,
      meta_description = $5,
      status = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
  `;

  const values = [title, contentType, content, slug, metaDescription, status, id];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'content_slug_key') {
      const friendlyError = new Error('That slug is already in use. Please choose a different one.');
      friendlyError.status = 400;
      throw friendlyError;
    }
    throw error;
  }
};

// Delete content
const deleteContent = async (id) => {
  const query = 'DELETE FROM content WHERE id = $1 RETURNING id';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

module.exports = {
  createContent,
  publishContent,
  getAllContent,
  getPublishedContent,
  getContentById,
  getContentBySlug,
  updateContent,
  deleteContent
};
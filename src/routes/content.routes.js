const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  createContent,
  publishContent,
  getAllContent,
  getPublishedContent,
  getContentById,
  getContentBySlug,
  updateContent,
  deleteContent
} = require('../models/content.model');

// Create content
router.post('/', authenticate, authorize('admin', 'marketing'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('contentType').notEmpty().withMessage('Content type is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('slug').notEmpty().withMessage('Slug is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const content = await createContent({
      ...req.body,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Content created successfully',
      data: content
    });
  } catch (error) {
    console.error('Error creating content:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error creating content',
      error: error.message
    });
  }
});

// Publish content
router.put('/:id/publish', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const content = await publishContent(req.params.id, req.user.id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: 'Content published successfully',
      data: content
    });
  } catch (error) {
    console.error('Error publishing content:', error);
    res.status(500).json({
      success: false,
      message: 'Error publishing content',
      error: error.message
    });
  }
});

// Get published content (public)
router.get('/published', async (req, res) => {
  try {
    const content = await getPublishedContent();
    res.json({
      success: true,
      count: content.length,
      data: content
    });
  } catch (error) {
    console.error('Error fetching published content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching published content',
      error: error.message
    });
  }
});

// Get content by slug (public)
router.get('/slug/:slug', async (req, res) => {
  try {
    const content = await getContentBySlug(req.params.slug);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content',
      error: error.message
    });
  }
});

// Get all content (admin/marketing)
router.get('/all', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const content = await getAllContent();
    res.json({
      success: true,
      count: content.length,
      data: content
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content',
      error: error.message
    });
  }
});

// Get content by ID
router.get('/:id', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const content = await getContentById(req.params.id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching content',
      error: error.message
    });
  }
});

// Update content
router.put('/:id', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const content = await updateContent(req.params.id, req.body);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: 'Content updated successfully',
      data: content
    });
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : 'Error updating content',
      error: error.message
    });
  }
});

// Delete content
router.delete('/:id', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const content = await deleteContent(req.params.id);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      message: 'Content deleted successfully',
      data: content
    });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting content',
      error: error.message
    });
  }
});

module.exports = router;
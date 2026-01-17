const express = require('express');
const router = express.Router();

// Simple in-memory store for saved endpoints (per app run)
const endpoints = new Map(); // slug => endpointObj

function validateSlug(slug) {
  return /^[a-z0-9-]{1,80}$/.test(slug);
}

router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'Missing name' });
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    if (!validateSlug(slug)) return res.status(400).json({ error: 'Invalid slug' });
    if (endpoints.has(slug)) return res.status(409).json({ error: 'Slug already exists' });

    const now = new Date().toISOString();
    const ep = { ...body, slug, createdAt: now, updatedAt: now };
    endpoints.set(slug, ep);

    res.status(201).json(ep);
  } catch (err) {
    console.error('Error saving endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  res.json(Array.from(endpoints.values()));
});

router.get('/:slug', (req, res) => {
  const slug = req.params.slug;
  if (!endpoints.has(slug)) return res.status(404).json({ error: 'Not found' });
  res.json(endpoints.get(slug));
});

router.put('/:slug', (req, res) => {
  try {
    const slug = req.params.slug;
    if (!endpoints.has(slug)) return res.status(404).json({ error: 'Not found' });
    
    const existing = endpoints.get(slug);
    const body = req.body || {};
    const now = new Date().toISOString();
    
    // Merge existing with updates, preserving slug and createdAt
    const updated = { 
      ...existing, 
      ...body, 
      slug, 
      createdAt: existing.createdAt, 
      updatedAt: now 
    };
    
    endpoints.set(slug, updated);
    res.json(updated);
  } catch (err) {
    console.error('Error updating endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:slug', (req, res) => {
  try {
    const slug = req.params.slug;
    if (!endpoints.has(slug)) return res.status(404).json({ error: 'Not found' });
    
    endpoints.delete(slug);
    res.json({ success: true, message: 'Endpoint deleted' });
  } catch (err) {
    console.error('Error deleting endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

function upsertEndpoint(ep) {
  // Ensure slug
  const slug = ep.slug || (ep.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const finalSlug = (() => {
    if (!endpoints.has(slug)) return slug;
    // find unique suffix
    let i = 1;
    while (endpoints.has(`${slug}-${i}`)) i++;
    return `${slug}-${i}`;
  })();
  const now = new Date().toISOString();
  const copy = { ...ep, slug: finalSlug, createdAt: now, updatedAt: now };
  endpoints.set(finalSlug, copy);
  return copy;
}

module.exports = { router, upsertEndpoint };
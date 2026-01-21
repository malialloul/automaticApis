import express, { Request, Response, Router } from 'express';
import { Graph, JSONValue } from '../types';

export const router: Router = express.Router();

export interface EndpointObj {
  name: string;
  slug: string;
  path?: string;
  method?: string;
  graph?: Graph | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EndpointCreateBody {
  name: string;
  slug?: string;
  path?: string;
  method?: string;
  graph?: Graph | null;
}

const endpoints: Map<string, EndpointObj> = new Map();

function validateSlug(slug: string) {
  return /^[a-z0-9-]{1,80}$/.test(slug);
}

router.post('/', (req: Request, res: Response): void => {
  try {
    const body = req.body as EndpointCreateBody | undefined;
    if (!body || typeof body.name !== 'string') { res.status(400).json({ error: 'Missing name' }); return; }
    const slug = (body.slug && String(body.slug)) || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    if (!validateSlug(slug)) { res.status(400).json({ error: 'Invalid slug' }); return; }
    if (endpoints.has(slug)) { res.status(409).json({ error: 'Slug already exists' }); return; }

    const now = new Date().toISOString();
    const ep: EndpointObj = { ...body, slug, createdAt: now, updatedAt: now };
    endpoints.set(slug, ep);

    res.status(201).json(ep);
    return;
  } catch (err) {
    console.error('Error saving endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
    return;
  }
});

router.get('/', (req: Request, res: Response): void => {
  res.json(Array.from(endpoints.values()));
  return;
});

router.get('/:slug', (req: Request, res: Response): void => {
  const raw = req.params.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (!endpoints.has(slug)) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(endpoints.get(slug));
  return;
});

router.put('/:slug', (req: Request, res: Response): void => {
  try {
    const raw = req.params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!endpoints.has(slug)) { res.status(404).json({ error: 'Not found' }); return; }

    const existing = endpoints.get(slug) as EndpointObj;
    const body = req.body as Partial<EndpointCreateBody> | undefined;
    const now = new Date().toISOString();

    const updated: EndpointObj = { ...existing, ...(body || {}), slug, createdAt: existing.createdAt, updatedAt: now };
    endpoints.set(slug, updated);
    res.json(updated);
    return;
  } catch (err) {
    console.error('Error updating endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
    return;
  }
});

router.delete('/:slug', (req: Request, res: Response): void => {
  try {
    const raw = req.params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!endpoints.has(slug)) { res.status(404).json({ error: 'Not found' }); return; }

    endpoints.delete(slug);
    res.json({ success: true, message: 'Endpoint deleted' });
    return;
  } catch (err) {
    console.error('Error deleting endpoint:', err);
    res.status(500).json({ error: (err as Error).message });
    return;
  }
});

export function upsertEndpoint(ep: Partial<EndpointObj>): EndpointObj {
  const slugBase = (ep.slug || (ep.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)) as string;
  let finalSlug = slugBase;
  if (!endpoints.has(finalSlug)) {
    // use slugBase
  } else {
    let i = 1;
    while (endpoints.has(`${slugBase}-${i}`)) i++;
    finalSlug = `${slugBase}-${i}`;
  }
  const now = new Date().toISOString();
  const copy: EndpointObj = { ...ep, slug: finalSlug, createdAt: now, updatedAt: now } as EndpointObj;
  endpoints.set(finalSlug, copy);
  return copy;
}

export default { router, upsertEndpoint };

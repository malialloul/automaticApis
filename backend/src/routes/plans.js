const express = require('express');
const router = express.Router();

const plans = [
  {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    features: [
      'Single connection',
      'Schema introspection',
      'Generate client code snippets',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 19,
    features: [
      'Multiple connections',
      'CRUD generation + relations',
      'Backend implementation templates',
      'ER diagram export (PNG/SVG)',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    priceMonthly: 49,
    features: [
      'Shared workspaces',
      'Swagger publishing',
      'Priority support',
    ],
  },
];

router.get('/', (req, res) => {
  res.json({ plans });
});

module.exports = router;

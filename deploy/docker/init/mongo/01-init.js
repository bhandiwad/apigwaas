// ============================================================================
// CloudInfinit API Gateway - MongoDB Initialization
// Creates Gravitee database and user
// ============================================================================

db = db.getSiblingDB('gravitee');

db.createUser({
  user: 'gravitee',
  pwd: 'gravitee_secret',
  roles: [
    { role: 'readWrite', db: 'gravitee' }
  ]
});

// Create initial indexes for Gravitee collections
db.createCollection('apis');
db.createCollection('applications');
db.createCollection('events');
db.createCollection('plans');
db.createCollection('subscriptions');

db.apis.createIndex({ "crossId": 1 });
db.applications.createIndex({ "name": 1 });
db.events.createIndex({ "createdAt": -1 });

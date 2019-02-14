'use strict';

const { ServiceBroker } = require('moleculer');
const StoreService = require('moleculer-db');
const ModuleChecker = require('moleculer-db/test/checker');
const KnexAdapter = require('../../index');
const Promise = require('bluebird');

const DB_HOST = 'localhost';
const DB_NAME = 'test';
const DB_USER = 'test';
const DB_PASS = '123789';

// Create broker
let broker = new ServiceBroker({
  logger: console,
  logLevel: 'debug'
});
const adapter = new KnexAdapter({
  client: 'postgresql',
  connection: {
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASS
  },
  pool: {
    min: 2,
    max: 10
  }
});

// Load my service
const s = broker.createService(StoreService, {
  name: 'posts',
  adapter,
  table: {
    schema: 'adm',
    name: 'posts',
    builder(table) {
      console.log('Create table...');
      table.increments('id');
      table.string('title');
      table.string('content');
      table.integer('votes');
      table.boolean('status');
      table.timestamp('createdAt');
      table.timestamp('updatedAt');
    }
  },
  settings: {
    idField: 'id'
  },

  afterConnected() {
    this.logger.info('Connected successfully');
    return this.adapter.clear().then(() => start());
  }
});

const checker = new ModuleChecker(21);

// Start checks
function start() {
  return Promise.resolve()
    .delay(500)
    .then(() => checker.execute())
    .catch(console.error)
    .then(() => broker.stop())
    .then(() => checker.printTotal());
}

// --- TEST CASES ---

let ids = [];
let date = new Date();

// Count of posts
checker.add(
  'COUNT',
  () => s.adapter.count(),
  res => {
    console.log(res);
    return res == 0;
  }
);

// Insert a new Post
checker.add(
  'INSERT',
  () =>
    s.adapter.insert({
      title: 'Hello',
      content: 'Post content',
      votes: 3,
      status: true,
      createdAt: date
    }),
  doc => {
    ids[0] = doc.id;
    console.log('[INSERT] >> Saved: ', doc);
    return (
      doc.id &&
      doc.title === 'Hello' &&
      doc.content === 'Post content' &&
      doc.votes === 3 &&
      doc.status === true &&
      `${doc.createdAt}` === `${date}`
    );
  }
);

// Find
checker.add(
  'FIND',
  () => s.adapter.find(),
  res => {
    console.log('[FIND] >> res: ', res);
    return res.length == 1 && res[0].id == ids[0];
  }
);

// Find by ID
checker.add(
  'GET',
  () => s.adapter.findById(ids[0]),
  res => {
    console.log('[GET] >> res: ', res);
    return res.id == ids[0];
  }
);

// Count of posts
checker.add(
  'COUNT',
  () => s.adapter.count(),
  res => {
    console.log('[COUNT] >> res: ', res);
    return res == 1;
  }
);

// Insert many new Posts
checker.add(
  'INSERT MANY',
  () =>
    s.adapter.insertMany([
      {
        title: 'Second',
        content: 'Second post content',
        votes: 8,
        status: true,
        createdAt: new Date()
      },
      {
        title: 'Last',
        content: 'Last document',
        votes: 1,
        status: false,
        createdAt: new Date()
      }
    ]),
  docs => {
    console.log('[INSERT MANY] >> Saved: ', docs);
    ids[1] = docs[0].id;
    ids[2] = docs[1].id;

    return [
      docs.length == 2,
      ids[1] && docs[0].title === 'Second' && docs[0].votes === 8,
      ids[1] &&
        docs[1].title === 'Last' &&
        docs[1].votes === 1 &&
        docs[1].status === false
    ];
  }
);

// Count of posts
checker.add(
  'COUNT',
  () => s.adapter.count(),
  res => {
    console.log('[COUNT 3] >> res: ', res);
    return res == 3;
  }
);

// Find
checker.add(
  'FIND by query',
  () => s.adapter.find({ query: { title: 'Last' } }),
  res => {
    console.log('[FIND by query] >> res: ', res);
    return res.length == 1 && res[0].id == ids[2];
  }
);

// Find
checker.add(
  'FIND by limit, sort, query',
  () => s.adapter.find({ limit: 1, sort: ['votes', '-title'], offset: 1 }),
  res => {
    console.log('[FIND by limit, sort, query] >> res: ', res);
    return res.length == 1 && res[0].id == ids[0];
  }
);

// Find
checker.add(
  'FIND by query ($gt)',
  () => s.adapter.find({ query: ['votes', '>', 2] }),
  res => {
    console.log('FIND by query ($gt): ', res);
    return res.length == 2;
  }
);

// Find
checker.add(
  'COUNT by query ($gt)',
  () => s.adapter.count({ query: ['votes', '>', 2] }),
  res => {
    console.log('COUNT by query ($gt): ', res);
    return res == 2;
  }
);

// Find by IDs
checker.add(
  'GET BY IDS',
  () => s.adapter.findByIds([ids[2], ids[0]]),
  res => {
    console.log('[GET BY IDS] > res: ', res);
    return res.length == 2;
  }
);

// Update a posts
checker.add(
  'UPDATE',
  () =>
    s.adapter.updateById(ids[2], {
      title: 'Last 2',
      updatedAt: new Date(),
      status: true
    }),
  doc => {
    console.log('[UPDATE] >> Updated: ', doc);
    return (
      doc.id &&
      doc.title === 'Last 2' &&
      doc.content === 'Last document' &&
      doc.votes === 1 &&
      doc.status === true &&
      doc.updatedAt
    );
  }
);

// Update by query
checker.add(
  'UPDATE BY QUERY',
  () => s.adapter.updateMany(['votes', '>', 2], [{ status: false }]),
  docs => {
    console.log('[UPDATE BY QUERY] >> Updated: ', docs);
    return docs.length == 2;
  }
);

// Remove by query
checker.add(
  'REMOVE BY QUERY',
  () => s.adapter.removeMany(['votes', '<', '5']),
  count => {
    console.log('[REMOVE BY QUERY] >> Removed: ', count);
    return count == 2;
  }
);

// Count of posts
checker.add(
  'COUNT',
  () => s.adapter.count(),
  res => {
    console.log(res);
    return res == 1;
  }
);

// Remove by ID
checker.add(
  'REMOVE BY ID',
  () => s.adapter.removeById(ids[1]),
  count => {
    console.log('[REMOVE BY ID] >> Removed: ', count);
    return count === 1;
  }
);

// Count of posts
checker.add(
  'COUNT',
  () => s.adapter.count(),
  res => {
    console.log(res);
    return res == 0;
  }
);

// Clear
checker.add(
  'CLEAR',
  () => s.adapter.clear(),
  res => {
    console.log(res);
    return res == 0;
  }
);

broker.start();

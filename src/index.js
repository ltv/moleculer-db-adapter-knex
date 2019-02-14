'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const Knex = require('knex');

class KnexDbAdapter {
  /**
   * Creates an instance of KnexDbAdapter.
   * @param {any} opts
   * @param {any} opts2
   *
   * @memberof KnexDbAdapter
   */
  constructor(opts, opts2) {
    this.opts = opts;
    this.opts2 = opts2;
    this.schema = 'public';
  }

  instance(withSchema = true) {
    const mTable = this.db(this.table);
    return withSchema ? mTable.withSchema(this.schema) : mTable;
  }

  /**
   * Initialize adapter
   *
   * @param {ServiceBroker} broker
   * @param {Service} service
   *
   * @memberof KnexDbAdapter
   */
  init(broker, service) {
    this.broker = broker;
    this.service = service;

    if (!this.service.schema.table) {
      /* istanbul ignore next */
      throw new Error('Missing `table` definition in schema of service!');
    }
    this.idField = this.service.settings.idField || 'id';
  }

  /**
   * Connect to database
   *
   * @returns {Promise}
   *
   * @memberof KnexDbAdapter
   */
  connect() {
    this.db = Knex(this.opts || {}, this.opts2);

    const tableDef = this.service.schema.table;
    if (_.isString(tableDef)) {
      this.table = tableDef;
    } else if (_.isObject(tableDef)) {
      this.table = tableDef.name;
      this.schema = tableDef.schema;
      if (_.isFunction(tableDef.builder)) {
        return this.db.schema
          .withSchema(this.schema)
          .hasTable(this.table)
          .then(hasTable =>
            hasTable
              ? false
              : this.db.schema
                  .withSchema(this.schema)
                  .createTable(this.table, tableDef.builder)
          );
      }
    }

    return Promise.resolve();
  }

  /**
   * Disconnect from database
   *
   * @returns {Promise}
   *
   * @memberof KnexDbAdapter
   */
  disconnect() {
    if (this.db) {
      //this.db.close();
    }
    return Promise.resolve();
  }

  /**
   * Find all entities by filters.
   *
   * Available filter props:
   *   - limit
   *  - offset
   *  - sort
   *  - search
   *  - searchFields
   *  - query
   *
   * @param {Object} filters
   * @returns {Promise<Array>}
   *
   * @memberof KnexDbAdapter
   */
  find(filters) {
    return this.createCursor(filters);
  }

  /**
   * Find entity by query.
   *
   *
   * @param {Object} query
   * @returns {Promise<Object>}
   *
   * @memberof KnexDbAdapter
   */
  findOne(query) {
    return this.db(this.table)
      .withSchema(this.schema)
      .where(query)
      .then(res => res && res[0]);
  }

  /**
   * Find an entities by ID.
   *
   * @param {String} _id
   * @returns {Promise<Object>} Return with the found document.
   *
   * @memberof KnexDbAdapter
   */
  findById(_id) {
    return this.db(this.table)
      .withSchema(this.schema)
      .where(this.idField, _id)
      .then(res => res && res[0]);
  }

  /**
   * Find any entities by IDs.
   *
   * @param {Array} idList
   * @returns {Promise<Array>} Return with the found documents in an Array.
   *
   * @memberof KnexDbAdapter
   */
  findByIds(idList) {
    return this.db(this.table)
      .withSchema(this.schema)
      .whereIn(this.idField, idList);
  }

  /**
   * Get count of filtered entites.
   *
   * Available query props:
   *  - search
   *  - searchFields
   *  - query
   *
   * @param {Object} [filters={}]
   * @returns {Promise<Number>} Return with the count of documents.
   *
   * @memberof KnexDbAdapter
   */
  count(filters) {
    const q = filters
      ? this.createCursor(filters).count(this.idField)
      : this.createCursor(filters, true);
    return q.then(total => total[0] && total[0].count);
  }

  /**
   * Insert an entity.
   *
   * @param {Object} entity
   * @returns {Promise<Object>} Return with the inserted document.
   *
   * @memberof KnexDbAdapter
   */
  insert(entity) {
    return this.db(this.table)
      .withSchema(this.schema)
      .insert(entity, '*')
      .then(res => res[0] && res[0]);
  }

  /**
   * Insert many entities
   *
   * @param {Array} entities
   * @returns {Promise<Array<Object>>} Return with the inserted documents in an Array.
   *
   * @memberof KnexDbAdapter
   */
  insertMany(entities, useTransaction = false) {
    if (!useTransaction)
      return this.db(this.table)
        .withSchema(this.schema)
        .insert(entities, '*');
    return this.db.transaction(tx =>
      Promise.all(
        entities.map(e =>
          this.db(this.table)
            .withSchema(this.schema)
            .insert(entities, '*')
        )
      )
        .then(tx.commit)
        .catch(tx.rollback)
    );
  }

  /**
   * Update many entities by `query` and `update`
   *
   * @param {Object} query
   * @param {Object} update
   * @returns {Promise<Number>} Return with the modified documents.
   *
   * @memberof KnexDbAdapter
   */
  updateMany(query, entities) {
    let cursor = this.db(this.table).withSchema(this.schema);
    if (query) {
      cursor = _.isArray(query) ? cursor.where(...query) : query;
    }
    return this.db
      .transaction(tx =>
        Promise.all(
          entities.map(e =>
            query
              ? cursor.update(e, '*')
              : cursor.where(this.idField, e.id).update(e, '*')
          )
        )
          .then(tx.commit)
          .catch(tx.rollback)
      )
      .then(res => res && res[0]);
  }

  /**
   * Update an entity by ID and `update`
   *
   * @param {String} _id - ObjectID as hexadecimal string.
   * @param {Object} update
   * @returns {Promise<Object>} Return with the updated document.
   *
   * @memberof KnexDbAdapter
   */
  updateById(_id, update) {
    return this.db(this.table)
      .withSchema(this.schema)
      .where({ [this.idField]: _id })
      .update(update, '*')
      .then(res => res[0] && res[0]);
  }

  /**
   * Remove entities which are matched by `query`
   *
   * @param {Object} query
   * @returns {Promise<Number>} Return with the count of deleted documents.
   *
   * @memberof KnexDbAdapter
   */
  removeMany(query) {
    query = !_.isArray(query) ? [query] : query;
    return this.db(this.table)
      .withSchema(this.schema)
      .where(...query)
      .del();
  }

  /**
   * Remove an entity by ID
   *
   * @param {String} _id - ObjectID as hexadecimal string.
   * @returns {Promise<Object>} Return with the removed document.
   *
   * @memberof KnexDbAdapter
   */
  removeById(_id) {
    return this.db(this.table)
      .withSchema(this.schema)
      .where(this.idField, _id)
      .del();
  }

  /**
   * Clear all entities from table
   *
   * @returns {Promise}
   *
   * @memberof KnexDbAdapter
   */
  clear() {
    return this.db(this.table)
      .withSchema(this.schema)
      .del();
  }

  /**
   * Convert DB entity to JSON object. It converts the `_id` to hexadecimal `String`.
   *
   * @param {Object} entity
   * @returns {Object}
   * @memberof KnexDbAdapter
   */
  entityToObject(entity) {
    let json = Object.assign({}, entity);
    return json;
  }

  /**
   * Create a filtered cursor.
   *
   * Available filters in `params`:
   *  - search
   *   - sort
   *   - limit
   *   - offset
   *   - query
   *
   * @param {Object} params
   * @param {Boolean} isCounting
   * @returns {MongoCursor}
   */
  createCursor(params, isCounting = false) {
    if (params) {
      let q = this.db(this.table).withSchema(this.schema); //.where(params.query);
      if (params.query) {
        if (_.isArray(params.query)) {
          q = q.where(...params.query);
        } else {
          q = q.where(params.query);
        }
      }

      // Sort
      if (params.sort) {
        q = this.transformSort(q, params.sort);
      }
      //}

      // Offset
      if (_.isNumber(params.offset) && params.offset > 0)
        q.offset(params.offset);

      // Limit
      if (_.isNumber(params.limit) && params.limit > 0) q.limit(params.limit);

      return q;
    }

    // If not params
    if (isCounting)
      return this.db(this.table)
        .withSchema(this.schema)
        .count(this.idField);
    else
      return this.db(this.table)
        .withSchema(this.schema)
        .where({});
  }

  /**
   * Convert the `sort` param to a `sort` object to Mongo queries.
   *
   * @param {Cursor} q
   * @param {String|Array<String>|Object} paramSort
   * @returns {Object} Return with a sort object like `{ "votes": 1, "title": -1 }`
   * @memberof KnexDbAdapter
   */
  transformSort(q, paramSort) {
    let sorts = [];

    if (_.isString(paramSort)) {
      sorts = paramSort
        .replace(/,/, ' ')
        .split(' ')
        .map(column => ({ column, order: 'asc' }));
    } else if (Array.isArray(paramSort)) {
      sorts = paramSort.map(s => {
        if (_.isObject(s)) return s;
        if (_.isString(s)) {
          const order = s.startsWith('-') ? 'desc' : 'asc';
          const column = s.replace('-', '');
          return { column, order };
        }
        return { column: this.idField, order: 'asc' };
      });
    } else if (_.isObject(paramSort)) {
      sorts = [paramSort];
    }

    return q.orderBy(sorts);
  }
}

module.exports = KnexDbAdapter;

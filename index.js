'use strict';

var EventEmitter = require('eventemitter3')
  , slice = Array.prototype.slice
  , propget = require('propget')
  , Ultron = require('ultron');

/**
 * Internal unique id for generating row properties.
 *
 * @type {Number}
 * @private
 */
var id = 0;

/**
 * A single source of truth.
 *
 * @param {String} name Name of your truth instance.
 * @constructor
 * @api private
 */
function Truth(name) {
  if (!(this instanceof Truth)) return new Truth(name);

  this.original = '_truth' + (id++);
  this.name = name || this.original;
  this.events = new Ultron(this);
  this.transforms = [];
  this.following = [];
  this.length = 0;
  this.data = [];
  this.rows = [];
}

//
// Inherit from the EventEmitter so we can listen to change events.
//
Truth.prototype = new EventEmitter();
Truth.prototype.constructor = Truth;

/**
 * Merge in the data from another given truth data source.
 *
 * @param {Truth} truth A truth store we need to merge data with.
 * @param {String} key We should match against.
 * @returns {Truth}
 * @api public
 */
Truth.prototype.merge = function merge(truth, key) {
  var ultron = new Ultron(truth)
    , self = this;

  ultron.on('change', self.change.bind(self));
  ultron.once('destroy', function destroy() {
    var i = self.following.length;

    while (i--) {
      if (self.following[i].ultron === ultron) break;
    }

    if (!i) return false;

    self.following.splice(i, 1);
    ultron.destroy();

    self.change();
  });

  self.following.push({
    name: truth.name,
    ulton: ultron,
    truth: truth,
    key: key
  });

  return self.change();
};

/**
 * Find a row for a given key/value pair.
 *
 * @param {String} key The key or property of the object we should check for
 * @param {Mixed} value Value of the key.
 * @returns {Object} the found row.
 * @api public
 */
Truth.prototype.find = function find(key, value, data) {
  data = data || this.data;

  for (var i = 0, match; i < data.length; i++) {
    match = propget(data[i], key);

    if (match && match === value) {
      return data[i];
    }
  }
};

/**
 * Data has changed. Process changes.
 *
 * @returns {Truth}
 * @api public
 */
Truth.prototype.change = function change(removed, added) {
  var rows = this.rows.slice(0)
    , transform
    , data
    , j
    , i;

  //
  // Make sure we have our unique row id assigned
  //
  for (i = 0; i < rows.length; i++) {
    Object.defineProperty(rows[i], this.original, {
      configurable: true,
      writable: true,
      value: rows[i]
    });
  }

  //
  // Merge all additional data structures so we can generate once big source of
  // truth for this given instance.
  //
  for (i = 0; i < this.following.length; i++) {
    transform = this.following[i];
    data = this.apply('before', transform.truth.get());

    for (j = 0; j < data.length; j++) {
      if (this.find(transform.key, data[j][transform.key], this.rows)) {
        continue;
      } else rows.push(data[j]);
    }
  }

  this.data = this.apply('transform', rows);
  this.emit('change', removed, added, this.data);

  return this;
};

/**
 * Add new data to the store.
 *
 * @param {Arguments} arguments
 * @returns {Boolean}
 * @api public
 */
Truth.prototype.add = function add() {
  var self = this
    , changes;

  changes = this.apply('before', slice.call(arguments)).filter(function each(row) {
    return row && 'object' === typeof row && !~self.rows.indexOf(row);
  });

  if (changes.length) {
    Array.prototype.push.apply(self.rows, changes);

    self.length += changes.length;
    self.change(changes);

    return true;
  }

  return false;
};

/**
 * Remove rows from the store.
 *
 * @param {Arguments} arguments
 * @returns {Boolean}
 * @api public
 */
Truth.prototype.remove = function remove() {
  var changes = []
    , self = this;

  slice.call(arguments).forEach(function each(row) {
    var what = row[self.original] || row
      , index = self.rows.indexOf(what);

    if (!~index) return;

    delete row[self.original];

    self.rows.splice(index, 1);
    changes.push(row);
  });

  if (changes.length) {
    self.length -= changes.length;
    self.change(undefined, changes);

    return true;
  }

  return false;
};

/**
 * Additional data transformation methods.
 *
 * @param {String} method API method we should use
 * @param {Function} fn Method that does the modification.
 * @param {String} name Name of the transform.
 * @returns {Truth}
 * @api public
 */
['transform', 'before', 'after'].forEach(function generate(when) {
  Truth.prototype[when] = function transform(method, fn, name) {
    this.transforms.push({
      name: name || fn.name || fn.displayName,
      method: method,
      when: when,
      fn: fn,
    });

    return this.change();
  };
});

/**
 * Apply the data transformations to a given array.
 *
 * @param {String} when What transformation cycle are we executing.
 * @param {Array} rows Rows that need to be transformed
 * @returns {Array}
 * @api private
 */
Truth.prototype.apply = function apply(when, rows) {
  var transforms = this.transforms.filter(function filter(transform) {
    return transform.when === when;
  }), i, j, transform, data;

  //
  // Bail out early, nothing to apply.
  //
  if (!transforms.length) return rows;

  for (i = 0; i < transforms.length; i++) {
    transform = transforms[i];

    //
    // Make sure we copy back our hidden row to the mapped result so we need to
    // implement a custom mapper in order to maintain the correct data
    // references.
    //
    if (transform.method === 'map' && when === 'transform') {
      for (j = 0; j < rows.length; j++) {
        data = rows[j];

        rows[j] = transform.fn(rows[j], j, rows);
        Object.defineProperty(rows[j], this.original, {
          value: data[this.original],
          configurable: true,
          writable: true,
        });
      }
    } else {
      rows = rows[transform.method](transform.fn);
    }
  }

  return rows;
};

/**
 * Undo a transformation on the data source.
 *
 * @param {String} method What kind of alteration are we talking about here.
 * @param {String} name Name of the transformation that should be nuked.
 * @returns {Truth}
 * @api public
 */
Truth.prototype.undo = function undo(method, name) {
  this.transforms = this.transforms.filter(function remove(transform) {
    return !(transform.method === method && transform.name === name);
  });

  return this.change();
};

/**
 * Get a new set of things!
 *
 * @returns {Array}
 * @api public
 */
Truth.prototype.get = function get() {
  return this.apply('after', this.data.slice(0));
};

/**
 * Create a clone of the store so we can easily inherit the transformations.
 *
 * @param {String} name Name of the truth store.
 * @api public
 */
Truth.prototype.clone = function clone(name) {
  var truth = new Truth(name);

  truth.transforms = this.transforms.slice();
  return truth;
};

/**
 * Empty the whole store, but optionally add new rows as complete replacement.
 *
 * @param {Arguments} args arguments.
 * @api public
 */
Truth.prototype.empty = function empty() {
  this.length = this.rows.length = 0;
  this.data = [];

  if (!this.add.apply(this, arguments)) this.change();
  this.emit('empty');

  return this;
};

/**
 * Destroy the data source.
 *
 * @returns {Boolean} Successful destruction.
 * @api public
 */
Truth.prototype.destroy = function destroy() {
  if (!this.events) return false;

  this.following.forEach(function each(follow) {
    follow.ultron.destroy();
  });

  this.emit('destroy');
  this.events.destroy();
  this.length = 0;
  this.events = this.following = this.transform = this.data = this.rows = null;

  return true;
};

//
// Expose the things.
//
module.exports = Truth;

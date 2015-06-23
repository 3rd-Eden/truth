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
 * @constructor
 * @api private
 */
function Truth() {
  if (!(this instanceof Truth)) return new Truth();

  this.original = '_truth' + (id++);
  this.events = new Ultron(this);
  this.transforms = [];
  this.following = [];
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
  }, self);

  self.following.push({ key: key, ulton: ultron, truth: truth });
  self.change();

  return self;
};

/**
 * Check if a certain key/value exists in our data set.
 *
 * @param {String} key The key or property of the object we should check for
 * @param {Mixed} value Value of the key.
 * @returns {Boolean}
 * @api public
 */
Truth.prototype.has = function has(key, value) {
  return !!this.find.apply(this, arguments);
};

/**
 * Find a row for a given key/value pair.
 *
 * @param {String} key The key or property of the object we should check for
 * @param {Mixed} value Value of the key.
 * @returns {Object} the found row.
 * @api public
 */
Truth.prototype.find = function find(key, value) {
  for (var i = 0, match; i < this.data.length; i++) {
    match = propget(this.data[i], key);

    if (match) {
      if (arguments.length === 2 && match !== value) continue;
      return this.data[i];
    }
  }
};

/**
 * Data has changed. Process changes.
 *
 * @returns {Truth}
 * @api public
 */
Truth.prototype.change = function change() {
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
    data = transform.truth.get();

    for (j = 0; j < data.length; j++) {
      if (this.has(transform.key, data[j][transform.key])) continue;
      else rows.push(data[j]);
    }
  }

  //
  // Apply all the data transformations.
  //
  for (i = 0; i < this.transforms.length; i++) {
    transform = this.transforms[i];

    //
    // Make sure we copy back our hidden row to the mapped result so we need to
    // implement a custom mapper in order to maintain the correct data
    // references.
    //
    if (transform.method === 'map') {
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

  this.data = rows;
  this.emit('change', this.data);

  return this;
};

/**
 * Add new data to the store.
 *
 * @param {Arguments} arguments
 * @returns {Truth}
 * @api public
 */
Truth.prototype.add = function add() {
  var changes = []
    , self = this;

  slice.call(arguments).forEach(function each(row) {
    if (
         !row
      || 'object' !== typeof row
      || ~self.rows.indexOf(row)
    ) return;

    self.rows.push(row);
    changes.push(row);
  });

  if (changes.length) self.change(changes);

  return self;
};

/**
 * Remove rows from the store.
 *
 * @param {Arguments} arguments
 * @returns {Truth}
 * @api public
 */
Truth.prototype.remove = function remove() {
  var changes = []
    , self = this;

  slice.call(arguments).forEach(function each(row) {
    var index = self.rows.indexOf(row[self.original] || row);

    if (!~index) return;

    delete self.data[index][self.original];
    delete row[self.original];

    self.rows.splice(index, 1);
    changes.push(row);
  });

  if (changes.length) self.change(undefined, changes);

  return self;
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
Truth.prototype.transform = function transform(method, fn, name) {
  this.transforms.push({
    name: name || fn.name || fn.displayName,
    method: method,
    fn: fn
  });

  return this.change();
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
  return this.data.slice(0);
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
  this.events = this.following = this.transform = this.data = this.rows = null;

  return true;
};

//
// Expose the things.
//
module.exports = Truth;

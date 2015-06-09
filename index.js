'use strict';

var EventEmitter = require('eventemitter3')
  , Ultron = require('ultron');

/**
 * A single source of truth.
 *
 * @constructor
 * @api private
 */
function Truth() {
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
Truth.prototype.emits = require('emits');

/**
 * Merge in the data from another given truth data source.
 *
 * @param {Truth} truth A truth store we need to merge data with.
 * @param {String} key We should match against.
 * @returns {Truth}
 * @api public
 */
Truth.prototype.merge = function merge(truth, key) {
  var ultron = new Ultron(truth);

  ultron.on('change', this.change.bind(this));
  ultron.once('destroy', function destroy() {
    var i = this.following.length;

    while (i--) {
      if (this.following[i].ultron === ultron) break;
    }

    if (!i) return false;

    this.following.splice(i, 1);
    ultron.destroy();
    this.change();
  }, this);

  this.following.push({ key: key, ulton: ultron, truth: truth });
  this.change();

  return this;
};

/**
 * Check if a certain key/value.
 *
 * @param {String} key The key or property of the object we should check for
 * @param {Mixed} value Value of the key.
 * @returns {Boolean}
 * @api public
 */
Truth.prototype.has = function has(key, value) {
  for (var i = 0; i < this.rows.length; i++) {
    if (key in this.rows[i]) {
      if (arguments.length === 2 && this.rows[i][key] !== value) continue;
      return true;
    }
  }

  return false;
};

/**
 * Data has changed. Process changes.
 *
 * @returns {Truth}
 * @api private
 */
Truth.prototype.change = function change() {
  var rows = this.rows.slice(0)
    , transform
    , data
    , j
    , i;

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
    rows = rows[transform.method](transform.fn);
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
  var changes = 0;

  Array.prototype.slice.call(arguments).forEach(function each(row) {
    if (~this.rows.indexOf(row)) return;

    this.rows.push(row);
    changes++;
  }, this);

  if (changes) this.change();
  return this;
};

/**
 * Remove rows from the store.
 *
 * @param {Arguments} arguments
 * @returns {Truth}
 * @api public
 */
Truth.prototype.remove = function remove() {
  var changes = 0;

  Array.prototype.slice.call(arguments).forEach(function each(row) {
    var index = this.rows.indexOf(row);

    if (~index) {
      this.rows.splice(index, 1);
      changes++;
    }
  }, this);

  if (changes) this.change();
  return this;
};

/**
 * Additional data transformation methods.
 *
 * @param {Function} fn Method that does the modification.
 * @param {Boolean} override Override all exiting
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

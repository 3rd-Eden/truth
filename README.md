# truth

[![Version npm][version]](http://browsenpm.org/package/truth)[![Build Status][build]](https://travis-ci.org/3rd-Eden/truth)[![Dependencies][david]](https://david-dm.org/3rd-Eden/truth)[![Coverage Status][cover]](https://coveralls.io/r/3rd-Eden/truth?branch=master)

[version]: https://img.shields.io/npm/v/truth.svg?style=flat-square
[build]: https://img.shields.io/travis/3rd-Eden/truth/master.svg?style=flat-square
[david]: https://img.shields.io/david/3rd-Eden/truth.svg?style=flat-square
[cover]: https://img.shields.io/coveralls/3rd-Eden/truth/master.svg?style=flat-square

Truth allows you to merge different sets of data in to one single source of
truth. The data can be manipulated from one central point in your application
leading to a better separation of concerns and maintainability of the project.

Changes propagate through all the merged data sets so you know when your data
set has changed.

## Installation

The module is released in the public npm registry and can be installed by
running:

```
npm install --save truth
```

## Usage

First of all we need to require the module and create a new Truth instance as
shown in the example code blow. This is the bare minimum required bootstrapping
code.

```js
'use strict';

var Truth = require('truth')
  , truth = new Truth();
```

While it's certainly possible to create `truth` instances without any arguments,
there are a couple of arguments that can be set:

1. The first argument can be a string with the name of the store. This will be
   used when merging stores and can be useful for debugging purposes.
2. Configuration object where you can set:
  - `key` The name of the key that should be used to determine duplicates when
    merging truth instances.

Now that we've constructed our first `truth` instance we can look at the various of
API methods that are available:

#### truth.add

Add a new row(s) in to the data set. You can supply as many arguments as you
wish as they will all been seen as new rows that should be inserted. Once the
insertion has occurred a change event will be triggered. So if you have multiple
rows, it makes more sense to supply all at once as arguments instead of doing
multiple invocations to `truth.add()`.

```js
truth.add({ another: 'row' }, { more: 'rows'i });
```

There is some small level of duplication detection where it tries to find
exactly the same item in the current data set. So the method only trigger's
changes when something is actually inserted.

#### truth.remove

Remove one or more rows from the data set. Please note that this only removes
rows who equals those that got added before any modifications.

```js
var row = { foo: 'bar' };

truth.add(row);
truth.remove(row);
```

#### truth.has

Test if a certain `key->value` combination is present in the data store. The
first argument is the key of the row you're searching for and the second
argument is an optional value to test against.

```js
truth.add({ foo: 'bar' });

truth.has('foo', 'bar'); // true
truth.has('foo', 'baz'); // false
```

#### truth.find

Find a row in the dataset. Searches are done based on key/value matching.

```js
var row = { foo: 'bar' }
  , found;

truth.add(row);
found = truth.find('foo', 'bar');

console.log(row === found); // true
```

#### truth.change

The internal dataset has changed, fetch data from merged data stores, re-apply
all data transformations and trigger the `change` event.

```js
truth.change();
```

#### truth.transform

Add additional data transformation methods, these should be existing methods on
an Array, so you can use things like `map`, `reduce`, `sort` and what not. There
are 3 requirement arguments:

- The method name as string.
- The actual function that does the transformation. If you supply a reduce
  method please assume that no default reduce value is given so you should
  return that on the first call.
- Name of the transform method. This allows easy removal of transformations
  using the `undo` method.

```js
truth.transform('map', function (row) {
  return {
    foo: row.value
  };
});

truth.add({ value: 'awesome' });
truth.get(); // [ { foo: 'awesome' }]
```

#### truth.undo

Undo a transformation on the dataset. This method requires 2 arguments:

- The method name as string.
- The name that you supplied as third argument in the `transform` method.

#### truth.merge

Merge the data from another truth store, the merging can be done based on a key
to prevent duplicate rows. The primary data store will always be preferred over
the merged data store.

When a merged truth store changes it data, it will also trigger a change event
for your data store so they are always in sync.

```js
var another = new Truth();

truth.add({ foo: 'bar', hello: 'world' });
another.add({ foo: 'bar', hello: 'hi' }, { foo: 'baz', hello: 'hi' });

truth.merge(another, 'foo');
```

In the example above we're merging our primary `truth` store `another` truth
store. We supply the de-duplication key as second argument. So when we
`truth.get()` data from the primary store it will have:

```js
[
  { foo: 'bar', hello: 'world' },
  { foo: 'baz', hello: 'hi' }
]
```

As rows.

### truth.destroy

Completely destroy the truth instance. No more methods should be called after
this method is called so it can be safely collected by garbage collectors. When
it's destroyed, it will emit an `destroy` method.

```js
truth.destroy();
```

## License

MIT

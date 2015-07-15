describe('truth', function () {
  'use strict';

  var truth
    , truth2
    , Truth = require('./')
    , assume = require('assume');

  beforeEach(function () {
    truth2 = new Truth('truth2', { key: 'foo' });
    truth = new Truth('truth', { key: 'foo' });
  });

  it('is exported as function', function () {
    assume(Truth).is.a('function');
  });

  it('can be initialized without using the `new` keyword', function () {
    assume(Truth()).is.instanceOf(Truth);
  });

  describe('#add', function () {
    it('adds a new row', function () {
      assume(truth.get()).is.a('array');
      assume(truth.get().length).equals(0);

      assume(truth.add({ foo: 'bar' })).equals(true);
      assume(truth.add()).equals(false);

      assume(truth.get()).is.a('array');
      assume(truth.get().length).equals(1);
      assume(truth.get()[0]).deep.equals({ foo: 'bar' });
    });

    it('increments the length', function () {
      assume(truth.length).equals(0);

      truth.add({ foo: 'bar'});
      assume(truth.length).equals(1);

      truth.add({ foo: 'barmaid'}, { foo: 'banana'});
      assume(truth.length).equals(3);

      truth.add();
      assume(truth.length).equals(3);
    });

    it('is not affected by modifications of the returned array', function () {
      truth.add({ foo: 'bar' });

      truth.get().length = 0;
      assume(truth.get()[0]).deep.equals({ foo: 'bar' });
    });

    it('adds multiple rows', function () {
      truth.add({ foo: 'bar' }, { bar: 'foo' });

      assume(truth.get().length).equals(2);
      assume(truth.get()).deep.equals([{ foo: 'bar' }, { bar: 'foo' }]);
    });

    it('emits a change event once data has changed', function (next) {
      truth.on('change', function () {
        assume(truth.get().length).equals(2);
        assume(truth.get()).deep.equals([{ foo: 'bar' }, { bar: 'foo' }]);

        next();
      });

      truth.add({ foo: 'bar' }, { bar: 'foo' });
    });

    it('does not add duplicates', function () {
      truth.add({ foo: 'bar' });
      truth.add({ foo: 'bar' });

      assume(truth.length).equals(1);

      truth.once('change', function () {
        throw new Error('I should not trigger, there is no change');
      });

      truth.add({ foo: 'bar' });
      assume(truth.length).equals(1);

      truth.add({ foo: 'bar' });
      assume(truth.length).equals(1);
    });

    it('de-dupes mapped values', function () {
      truth.before('map', function (what) {
        return {
          foo: what.bar
        };
      });

      truth.add({ bar: 'bar' });
      truth.add({ bar: 'bar' });

      assume(truth.length).equals(1);

      truth.once('change', function () {
        throw new Error('I should not trigger, there is no change');
      });

      truth.add({ bar: 'bar' });
      assume(truth.length).equals(1);

      truth.add({ bar: 'bar' });
      assume(truth.length).equals(1);
    });

    it('adds a row even when a merged dataset contains this exact row', function () {
      truth.merge(truth2, 'foo');
      truth2.add({ foo: 'bar' });

      assume(truth.get()[0]).deep.equals({foo: 'bar' });
      assume(truth.get()).has.length(1);

      truth.add({ foo: 'bar', bar: 'banana' });

      assume(truth.get()[0]).deep.equals({foo: 'bar', bar: 'banana' });
      assume(truth.get()).has.length(1);

      assume(truth2.get()[0]).deep.equals({foo: 'bar' });
      assume(truth2.get()).has.length(1);
    });
  });

  describe('#remove', function () {
    it('removes an added row', function () {
      var value = { foo: 'bar' };

      truth.add(value);
      assume(truth.get()[0]).equals(value);

      truth.remove(value);
      assume(truth.get().length).equals(0);
    });

    it('decrements the length', function () {
      assume(truth.length).equals(0);

      truth.add({ foo: 'barmaid'}, { foo: 'banana'}, { hello: 'world'});
      assume(truth.length).equals(3);

      truth.remove(truth.find('foo', 'barmaid'));
      assume(truth.length).equals(2);

      truth.remove.apply(truth, truth.get());
      assume(truth.length).equals(0);

      truth.remove();
      assume(truth.length).equals(0);
    });

    it('removes multiple rows', function () {
      var values = [{ foo: 'bar' }, { foo: 'foo'}];

      truth.add.apply(truth, values);
      assume(truth.get()).deep.equals(values);

      truth.remove.apply(truth, values);
      assume(truth.get().length).equals(0);
    });

    it('only removes the supplied row', function () {
      var values = [{ foo: 'bar' }, { foo: 'foo'}];

      truth.add.apply(truth, values);
      assume(truth.get()).deep.equals(values);

      truth.remove(values[0]);
      assume(truth.get().length).equals(1);
      assume(truth.get()).deep.equals([values[1]]);
    });

    it('can remove completely transformed data structures', function () {
      var values = [{ foo: 'bar' }, { foo: 'foo'}];

      truth.transform('map', function (row) {
        return {
          value: row
        };
      });

      truth.add.apply(truth, values);
      assume(truth.get()).deep.equals([
        { value: { foo: 'bar' } },
        { value: { foo: 'foo' } }
      ]);

      var row = truth.find('value.foo', 'bar');

      assume(row).is.a('object');
      assume(truth.get()).has.length(2);

      truth.remove(row);
      assume(truth.get()).has.length(1);
      assume(truth.get()).deep.equals([{ value: { foo: 'foo' }}]);
    });
  });

  describe('#find', function () {
    it('finds transformed rows', function () {
      var values = [{ foo: 'bar' }, { foo: 'foo'}];

      truth.add.apply(truth, values);

      var row = truth.find('foo', 'bar');

      assume(row).is.a('object');
      assume(row.foo).equals('bar');
      assume(row[truth.original]).equals(values[0]);
    });

    it('finds transformed rows', function () {
      var values = [{ foo: 'bar' }, { foo: 'foo'}];

      truth.transform('map', function (row) {
        return {
          value: row
        };
      });

      truth.add.apply(truth, values);
      assume(truth.get()).deep.equals([
        { value: { foo: 'bar' } },
        { value: { foo: 'foo' } }
      ]);

      var row = truth.find('value.foo', 'bar');

      assume(row).is.a('object');
      assume(row.value.foo).equals('bar');
    });

    it('can search the supplied array of data', function () {
      truth.add({ foo: 'bar', baz: 'baz' });

      var match = truth.find('foo', 'bar', [
        { foo: 'bar', baz: 'baz', lol: 'cackes'},
        { foo: 'babi', baz: 'baz', lol: 'cackes'},
        { foo: 'bambi', baz: 'baz', lol: 'cackes'},
      ]);

      assume(match).deep.equals({ foo: 'bar', baz: 'baz', lol: 'cackes'});
    });
  });

  describe('#merge', function () {
    it('triggers a change event once the added dataset changes', function (next) {
      truth.once('change', function () {
        truth.once('change', function () {
          assume(truth2.get()).deep.equals([{ foo: 'bar' }]);
          assume(truth.get()).deep.equals([{ foo: 'bar' }]);

          next();
        });

        truth2.add({ foo: 'bar' });
      });

      truth.merge(truth2, 'foo');
    });

    it('does not override existing rows', function (next) {
      truth.add({ foo: 'bar', bar: 'bar' });

      truth.once('change', function () {
        truth.once('change', function () {
          assume(truth2.get()).deep.equals([{ foo: 'bar' }]);
          assume(truth.get()).deep.equals([{ foo: 'bar', bar: 'bar' }]);

          next();
        });

        truth2.add({ foo: 'bar' });
      });

      truth.merge(truth2, 'foo');
    });

    it('merges rows', function (next) {
      truth.add({ foo: 'foo' });

      truth.once('change', function () {
        truth.once('change', function () {
          assume(truth2.get()).deep.equals([{ foo: 'bar' }]);
          assume(truth.get()).deep.equals([{ foo: 'foo' }, { foo: 'bar' }]);

          next();
        });

        truth2.add({ foo: 'bar' });
      });

      truth.merge(truth2, 'foo');
    });

    it('can default to the key option for row merges', function (next) {
      truth.add({ foo: 'foo' });

      truth.once('change', function () {
        truth.once('change', function () {
          assume(truth2.get()).deep.equals([{ foo: 'bar' }]);
          assume(truth.get()).deep.equals([{ foo: 'foo' }, { foo: 'bar' }]);

          next();
        });

        truth2.add({ foo: 'bar' });
      });

      truth.merge(truth2);
    });

    it('accepts a custom filter function', function () {
      truth.add({ foo: 'foo' });

      truth.merge(truth2, function (row, rows) {
        assume(rows).is.a('array');
        assume(rows[0]).deep.equals({ foo: 'foo' });

        assume(row).is.a('object');
        assume(row.banana).is.true();

        return false;
      });

      truth2.add({ foo: 'bar', banana: true });

      assume(truth.get().length).equals(2);
    });
  });

  describe('#transform', function () {
    it('applies the filter', function () {
      truth.add({ foo: 'bar' }, { foo: 'foo' });

      truth.transform('filter', function (row) {
        if (row.foo === 'bar') return true;
        return false;
      });

      assume(truth.get().length).equals(1);
      assume(truth.get()).deep.equals([{ foo: 'bar'}]);
    });

    it('transforms the data structure', function () {
      truth.transform('map', function (row) {
        return { lol: 'cakes' };
      });

      truth.add({ foo: 'bar' }, { foo: 'foo' });
      assume(truth.get().length).equals(2);
      assume(truth.get()).deep.equals([{ lol: 'cakes'}, { lol: 'cakes' }]);
    });

    it('triggers a `change` after adding a new undo', function (next) {
      truth.add({ foo: 'bar' }, { foo: 'foo' });

      truth.once('change', function () {
        next();
      });

      truth.transform('map', function () {
        return {};
      });
    });
  });

  describe('#before', function () {
    it('can apply filters to data that is about to get added', function () {
      truth.before('map', function (row) {
        assume(row).deep.equals({ hello: 'world' });

        return { value: 'row' };
      });

      truth.add({ hello: 'world' });
      var row = truth.find('value', 'row');

      assume(row).deep.equals({ value: 'row' });
      assume(row[truth.original]).equals(row);
    });
  });

  describe('#undo', function () {
    it('undos an applied filter', function () {
      truth.transform('map', function (row) {
        return { lol: 'cakes' };
      }, 'mapsel');

      truth.add({ foo: 'bar' }, { foo: 'foo' });
      assume(truth.get().length).equals(2);
      assume(truth.get()).deep.equals([{ lol: 'cakes'}, { lol: 'cakes' }]);

      truth.undo('map', 'mapsel');
      assume(truth.get().length).equals(2);
      assume(truth.get()).deep.equals([{ foo: 'bar' }, { foo: 'foo' }]);
    });
  });

  describe('#empty', function () {
    it('is removing all of its own rows', function () {
      truth.add({ foo: 'bar' });

      assume(truth.length).equals(1);

      truth.empty();
      assume(truth.length).equals(0);
    });

    it('adds supplied arguments a new rows', function () {

      truth.add({ foo: 'bar' });

      assume(truth.length).equals(1);
      assume(truth.get()).deep.equals([{ foo: 'bar' }]);

      truth.empty({ bar: 'baz' }, { bar: 'bi' });
      assume(truth.length).equals(2);
      assume(truth.get()).deep.equals([{ bar: 'baz' }, { bar: 'bi' }]);
    });
  });

  describe('#clone', function () {
    it('inherits the transformations', function () {
      truth.transform('map', function () {
        return { foo: 'foo' };
      });

      var clone = truth.clone();

      assume(clone).does.not.equal(truth);
      assume(clone.length).equals(0);
      assume(truth.length).equals(0);

      clone.add({ lol: 1 });

      assume(truth.length).equals(0);
      assume(clone.length).equals(1);

      assume(clone.get()).deep.equals([{ foo: 'foo' }]);
    });

    it('inherits options like unique key', function () {
      var optional = new Truth('test', { key: 'test' })
        , clone = optional.clone('cloned');

      assume(clone.unique).to.be.a('string');
      assume(clone.unique).to.equal(optional.unique);
    });

    it('does not inherit cloned key if passed through options', function () {
      var optional = new Truth('test', { key: 'test' })
        , clone = optional.clone('cloned', { key: 'bar' });

      assume(clone.unique).to.not.equal(optional.unique);
      assume(clone.unique).to.be.a('string');
      assume(clone.unique).to.equal('bar');
    });
  });

  describe('#destroy', function () {
    it('removes the store once its destroyed', function () {
      truth.merge(truth2, 'foo');

      truth2.add({ foo: 'bar' });

      assume(truth.get()[0]).deep.equals({ foo: 'bar' });
      assume(truth.following).is.length(1);

      truth2.destroy();

      assume(truth.following).is.length(0);
      assume(truth.get()).deep.equals([]);
    });

    it('triggers a change event if a mounted truth is destoryed', function (next) {
      truth.merge(truth2, 'foo');
      truth2.add({ foo: 'bar' });

      truth.once('change', function () {
        next();
      });

      truth2.destroy();
    });

    it('only destroys it self when calling destroy', function (next) {
      truth.merge(truth2, 'foo');
      truth2.add({ foo: 'bar' });

      /* istanbul ignore next */
      truth.once('destroy', function () {
        throw new Error('Fuck, this shouldnt die');
      });

      truth.once('change', function () {
        setTimeout(next, 100);
      });

      truth2.destroy();
    });

    it('removes the listeners from all following datasets so no more evets are emitted', function (next) {
      truth.merge(truth2, 'foo');

      truth.once('change', function () {
        truth.destroy();

        /* istanbul ignore next */
        truth.once('change', function () {
          throw new Error('I should NOT be emitted');
        });

        truth2.add({ foo: 'bar' });
        next();
      });

      truth2.add({ foo: 'bar' });
    });

    it('emits a destroy event', function (next) {
      truth.once('destroy', function () {
        next();
      });

      truth.destroy();
    });

    it('only triggers the destroy event once', function (next) {
      truth.once('destroy', next);

      assume(truth.destroy()).is.true();
      assume(truth.destroy()).is.false();
      assume(truth.destroy()).is.false();
      assume(truth.destroy()).is.false();
      assume(truth.destroy()).is.false();
    });
  });
});

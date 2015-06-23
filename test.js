describe('truth', function () {
  'use strict';

  var truth
    , truth2
    , Truth = require('./')
    , assume = require('assume');

  beforeEach(function () {
    truth2 = new Truth();
    truth = new Truth();
  });

  it('is exported as function', function () {
    assume(Truth).is.a('function');
  });

  describe('#add', function () {
    it('adds a new row', function () {
      assume(truth.get()).is.a('array');
      assume(truth.get().length).equals(0);

      assume(truth.add({ foo: 'bar' })).equals(truth);

      assume(truth.get()).is.a('array');
      assume(truth.get().length).equals(1);
      assume(truth.get()[0]).deep.equals({ foo: 'bar' });
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
  });

  describe('#remove', function () {
    it('removes an added row', function () {
      var value = { foo: 'bar' };

      truth.add(value);
      assume(truth.get()[0]).equals(value);

      truth.remove(value);
      assume(truth.get().length).equals(0);
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

  describe("#destroy", function () {
    it('triggers a change event if a mounted truth is destoryed');
    it('correctly removes old mounted truths when destoryed');
    it('only destroys it self when calling destroy');
    it('emits a destroy event');
  });
});

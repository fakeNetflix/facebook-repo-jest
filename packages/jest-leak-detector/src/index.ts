/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {setFlagsFromString} from 'v8';
import {runInNewContext} from 'vm';
import prettyFormat from 'pretty-format';
import {isPrimitive} from 'jest-get-type';

export default class {
  private _isReferenceBeingHeld: boolean;

  constructor(value: unknown) {
    if (isPrimitive(value)) {
      throw new TypeError(
        [
          'Primitives cannot leak memory.',
          'You passed a ' + typeof value + ': <' + prettyFormat(value) + '>',
        ].join(' '),
      );
    }

    let weak;

    try {
      // eslint-disable-next-line import/no-extraneous-dependencies
      weak = require('weak');
    } catch (err) {
      if (!err || err.code !== 'MODULE_NOT_FOUND') {
        throw err;
      }

      throw new Error(
        'The leaking detection mechanism requires the "weak" package to be installed and work. ' +
          'Please install it as a dependency on your main project',
      );
    }

    weak(value, () => (this._isReferenceBeingHeld = false));
    this._isReferenceBeingHeld = true;

    // Ensure value is not leaked by the closure created by the "weak" callback.
    value = null;
  }

  isLeaking(): boolean {
    this._runGarbageCollector();

    return this._isReferenceBeingHeld;
  }

  private _runGarbageCollector() {
    const isGarbageCollectorHidden = !global.gc;

    // GC is usually hidden, so we have to expose it before running.
    setFlagsFromString('--expose-gc');
    runInNewContext('gc')();

    // The GC was not initially exposed, so let's hide it again.
    if (isGarbageCollectorHidden) {
      setFlagsFromString('--no-expose-gc');
    }
  }
}

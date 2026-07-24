'use strict';

/** Fixture bundle — works in Node and Wrangler (no runtime fs). */
module.exports = {
  session: require('./session.json'),
  suppliers: require('./suppliers.json'),
  pcfPayloads: require('./pcf_payloads.json'),
};

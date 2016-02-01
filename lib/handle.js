const co = require('co');
const is = require('is_js');
const mime = require('mime-types');
const prince = require('prince-promise');
const parse = require('co-body');

const validateHeaders = headers => {
  const supportedMimeType = mime.lookup('json');
  if (headers['content-type'] !== supportedMimeType) {
    throw new TypeError (`Invalid request: headers: content-type must be ${supportedMimeType}.`);
  }
};
const validateBody = body => {
  const prefix = 'Invalid request: body:';
  if (!is.json(body)) throw new TypeError(`${prefix} must be an object.`);
  if (!body.input) throw new TypeError(`${prefix} input: must be defined.`);
  if (!is.string(body.input)) throw new TypeError(`${prefix} input: must be a string.`);
};
const handle = co.wrap(function * (request, response, log) {
  validateHeaders(request.headers);
  const body = yield parse(request);
  validateBody(body);
  log('info', { body }, 'Rendering.');
  const output = yield prince(body.input, body.options);
  log('info', { body }, 'Rendered.');
  response.writeHead(200, { 'Content-Type': mime.lookup('pdf') });
  response.end(output);
});
module.exports = handle;

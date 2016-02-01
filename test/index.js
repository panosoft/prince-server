const bunyan = require('bunyan');
const co = require('co');
const concat = require('concat-stream');
const cp = require('child_process');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const mime = require('mime-types');
const parseJson = require('parse-json');
const PdfParser = require('pdf2json/pdfparser');
const pdfText = require('pdf-text');
const path = require('path');
const R = require('ramda');
const url = require('url');

const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/ca.crt'));
const key = `${__dirname}/credentials/server.key`;
const cert = `${__dirname}/credentials/server.crt`;
const bin = path.resolve(__dirname, '../bin/index.js');

const startServer = () => new Promise((resolve, reject) => {
  const split = R.compose(R.reject(R.isEmpty), R.split('\n'));
  const parseRecords = stdout => R.map(parseJson, split(stdout.toString('utf8')));
  const isInfo = R.compose(R.equals(bunyan.INFO), R.prop('level'));
  const isStarted = R.compose(R.equals(`Server started.`), R.prop('msg'));
  const server = cp.spawn(bin, ['--key', key, '--cert', cert]);
  server.stderr.pipe(concat(data => data ? reject(data.toString('utf8')) : null));
  server.stdout.once('data', function check (data) {
    var records;
    try { records = parseRecords(data); }
    catch (error) { return reject(error); }
    if (!R.all(isInfo, records)) { reject(records); }
    else if (R.any(isStarted, records)) { resolve(server); }
    else { server.stdout.once('data', check); }
  });
});
const parse = url.parse;
const request = co.wrap(function * (url, method, headers, data) {
  const response = yield new Promise((resolve, reject) => https
    .request(R.merge(parse(url), { ca, headers, method }), resolve)
    .on('error', reject)
    .end(data));
  const buffer = yield new Promise(resolve => response.pipe(concat(resolve)));
  if (buffer.length > 0) response.body = buffer;
  return response;
});
const pdfToText = buffer => new Promise((resolve, reject) =>
  pdfText(buffer, (error, chunks) => error ? reject(error) : resolve(chunks))
);
const pdfToJson = buffer => new Promise((resolve, reject) => {
  const parser = new PdfParser();
  parser.on('pdfParser_dataError', reject);
  parser.on('pdfParser_dataReady', resolve);
  parser.parseBuffer(buffer);
});

const expectError = (response, message) => {
  const body = JSON.parse(response.body.toString('utf8'));
  expect(response.statusCode).to.equal(500);
  expect(body).to.be.an('object')
    .and.to.have.property('error')
    .that.equals(message);
};

describe('prince-server', () => {
  var server;
  const port = 8443;
  const host = `https://localhost:${port}`;
  before(co.wrap(function * () {
    server = yield startServer();
  }));
  after(() => server.kill());
  describe('prince', () => {
    const path = '/';
    const url = `${host}${path}`;
    const method = 'POST';
    const headers = { 'content-type': mime.lookup('json') };
    const input = 'Test';
    it('reject request with invalid content-type header', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('txt') };
      const response = yield request(url, method, headers);
      expectError(response, 'Invalid request: headers: content-type must be application/json.');
    }));
    it('reject request without input field', co.wrap(function * () {
      const data = JSON.stringify({});
      const response = yield request(url, method, headers, data);
      expectError(response, 'Invalid request: body: input: must be defined.');
    }));
    it('reject request with invalid input field', co.wrap(function * () {
      const data = JSON.stringify({ input: {} });
      const response = yield request(url, method, headers, data);
      expectError(response, 'Invalid request: body: input: must be a string.');
    }));
    it('render input', co.wrap(function * () {
      const data = JSON.stringify({ input });
      const response = yield request(url, method, headers, data);
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.length.greaterThan(0);
      const pdf = yield pdfToText(response.body);
      expect(pdf.join('')).to.contain(input);
    }));
    it('support options', co.wrap(function * () {
      const pdfTitle = 'Custom Title';
      const options = { pdfTitle };
      const data = JSON.stringify({ input, options });
      const response = yield request(url, method, headers, data);
      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('pdf'));
      expect(response.body).to.have.length.greaterThan(0);
      const pdf = yield pdfToJson(response.body);
      expect(pdf.PDFJS.documentInfo.Title).to.contain(pdfTitle);
    }));
  });
});

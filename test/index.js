const co = require('co');
const expect = require('chai').expect;
const HttpsServer = require('@panosoft/https-server');
const mime = require('mime-types');
const PdfParser = require('pdf2json/pdfparser');
const pdfText = require('pdf-text');
const path = require('path');

const bin = path.resolve(__dirname, '../bin/index.js');
const startServer = HttpsServer.test.startServer;
const request = HttpsServer.test.request;

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
  before(co.wrap(function * () {
    server = yield startServer(bin);
  }));
  after(() => server.kill());
  describe('prince', () => {
    const path = '/';
    const method = 'POST';
    const headers = { 'content-type': mime.lookup('json') };
    const input = 'Test';
    it('reject request with invalid content-type header', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('txt') };
      const response = yield request(path, method, headers);
      expectError(response, 'Invalid request: headers: content-type must be application/json.');
    }));
    it('reject request without input field', co.wrap(function * () {
      const data = JSON.stringify({});
      const response = yield request(path, method, headers, data);
      expectError(response, 'Invalid request: body: input: must be defined.');
    }));
    it('reject request with invalid input field', co.wrap(function * () {
      const data = JSON.stringify({ input: {} });
      const response = yield request(path, method, headers, data);
      expectError(response, 'Invalid request: body: input: must be a string.');
    }));
    it('render input', co.wrap(function * () {
      const data = JSON.stringify({ input });
      const response = yield request(path, method, headers, data);
      expect(response.statusCode).to.equal(200);
      expect(response.body).to.have.length.greaterThan(0);
      const pdf = yield pdfToText(response.body);
      expect(pdf.join('')).to.contain(input);
    }));
    it('support options', co.wrap(function * () {
      const pdfTitle = 'Custom Title';
      const options = { pdfTitle };
      const data = JSON.stringify({ input, options });
      const response = yield request(path, method, headers, data);
      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('pdf'));
      expect(response.body).to.have.length.greaterThan(0);
      const pdf = yield pdfToJson(response.body);
      expect(pdf.PDFJS.documentInfo.Title).to.contain(pdfTitle);
    }));
  });
});

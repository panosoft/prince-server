# Prince server

> A PrinceXml rendering server.

[![npm version](https://img.shields.io/npm/v/@panosoft/prince-server.svg)](https://www.npmjs.com/package/@panosoft/prince-server)
[![Travis](https://img.shields.io/travis/panosoft/prince-server.svg)](https://travis-ci.org/panosoft/prince-server)


# Installation

```sh
npm install -g @panosoft/prince-server
```

# Usage

```sh
Usage: prince-server --key <path> --cert <path> [options]

A PrinceXml rendering server.

Options:

  -h, --help                    output usage information
  -V, --version                 output the version number
  -k, --key   <path>            Path to the private key of the server in PEM format.
  -c, --cert  <path>            Path to the certificate key of the server in PEM format.
  -p, --port  <port>            The port to accept connections on. Default: 8443.
  -i, --interface  <interface>  The interface to accept connections on. Default: 0.0.0.0.
```

# HTTPS API

## Request

- Path: `/`
- Method: `POST`
- Headers:
	- `Content-Type` - `'application/json'`
- Body:
	- `input` - {String} The html string to render.
	- `[options]` - {\*} The options to pass to the prince command at runtime.

## Responses

__Success__
- Status Code: `200`
- Headers:
	- `Request-Id` - {String} The unique request identifier.
	- `Content-Type` - `'application/pdf'`
- Body: {Buffer} The pdf binary.

__Error__
- Status Code: `500`
- Headers:
	- `Request-Id` - {String} The unique request identifier.
	- `Content-Type` - `'application/json'`
- Body:
	- `error` - {String} The error message.

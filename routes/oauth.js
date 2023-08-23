/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Autodesk Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

'use strict'; // http://www.w3schools.com/js/js_strict.asp

// web framework
var express = require('express');
var router = express.Router();

var apsSDK = require('forge-apis');

// APS config information, such as client ID and secret
var config = require('../config');

var cryptiles = require('cryptiles');

// this end point will logoff the user by destroying the session
// as of now there is no APS endpoint to invalidate tokens
router.get('/user/logoff', function (req, res) {
  console.log('/user/logoff')

  req.session = null;

  res.end('/');
});

router.get('/api/aps/clientID', function (req, res) {
  res.json({
    'ClientId': config.credentials.client_id
  });
});

// return the public token of the current user
// the public token should have a limited scope (read-only)
router.get('/user/token', function (req, res) {
  console.log('Getting user token'); // debug

  // json returns empty object if the entry values are undefined
  // so let's avoid that
  var tp = req.session.public?.access_token ? req.session.public.access_token : "";
  var te = req.session.public?.expires_in ? req.session.public.expires_in : "";
  console.log('Public token:' + tp);
  res.json({token: tp, expires_in: te});
});

// return the APS authenticate url
router.get('/user/authenticate', function (req, res) {
  req.session.csrf = cryptiles.randomString(24);

  console.log('using csrf: ' + req.session.csrf);

  console.log('/user/authenticate');

  // redirect the user to this page
  var url =
    "https://developer.api.autodesk.com" +
    '/authentication/v2/authorize?response_type=code' +
    '&client_id=' + config.credentials.client_id +
    '&redirect_uri=' + config.callbackURL +
    '&state=' + req.session.csrf +
    '&scope=' + config.scopeInternal.join(" ");
  res.end(url);
});

// wait for Autodesk callback (oAuth callback)
router.get('/callback/oauth', function (req, res) {
  var csrf = req.query.state;

  console.log('stored csrf: ' + req.session.csrf);
  console.log('got back csrf: ' + csrf);

  if (!csrf || csrf !== req.session.csrf) {
    res.status(401).end();
    return;
  }

  var code = req.query.code;
  if (!code) {
    res.redirect('/');
  }

  // first get a full scope token for internal use (server-side)
  var req1 = new apsSDK.AuthClientThreeLeggedV2(config.credentials.client_id, config.credentials.client_secret, config.callbackURL, config.scopeInternal);
  console.log(code);
  req1.getToken(code)
    .then(function (internalCredentials) {

      req.session.internal = {
        access_token: internalCredentials.access_token,
        expires_in: internalCredentials.expires_in
      }

      console.log('Internal token (full scope): ' + internalCredentials.access_token); // debug

      // then refresh and get a limited scope token that we can send to the client
      var req2 = new apsSDK.AuthClientThreeLeggedV2(config.credentials.client_id, config.credentials.client_secret, config.callbackURL, config.scopePublic);
      req2.refreshToken(internalCredentials, config.scopePublic)
        .then(function (publicCredentials) {
          req.session.public = {
            access_token: publicCredentials.access_token,
            expires_in: publicCredentials.expires_in
          }

          console.log('Public token (limited scope): ' + publicCredentials.access_token); // debug
          res.redirect('/');
        })
        .catch(function (error) {
          res.end(JSON.stringify(error));
        });
    })
    .catch(function (error) {
      res.end(JSON.stringify(error));
    });
});

module.exports = router;
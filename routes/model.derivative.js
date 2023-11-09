'use strict'; // http://www.w3schools.com/js/js_strict.asp

// web framework
var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

var zlib = require("zlib");

var apsSDK = require('forge-apis');

/////////////////////////////////////////////////////////////////
// Get the list of export file formats supported by the
// Model Derivative API
/////////////////////////////////////////////////////////////////
router.get('/formats', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getFormats({}, null, req.session.internal)
        .then(function (formats) {
            res.json(formats.body);
        })
        .catch(function (error) {
            res.status(error.response.status).end(error.message);
        });
});

/////////////////////////////////////////////////////////////////
// Get the manifest of the given file. This will contain
// information about the various formats which are currently
// available for this file
/////////////////////////////////////////////////////////////////
router.get('/manifests/:urn', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getManifest(req.params.urn, {}, null, req.session.internal)
        .then(function (data) {
            res.json(data.body);
        })
        .catch(function (error) {
            res.status(error.response.status).end(error.message);
        });
});

router.delete('/manifests/:urn', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();
    try {
        derivatives.deleteManifest(req.params.urn, null, req.session.internal)
            .then(function (data) {
                res.json(data.body);
            })
            .catch(function (error) {
                res.status(error.response.status).end(error.message);
            });

    } catch (err) {
        res.status(500).end(err.message);
    }
});

/////////////////////////////////////////////////////////////////
// Get the metadata of the given file. This will provide us with
// the guid of the avilable models in the file
/////////////////////////////////////////////////////////////////
router.get('/metadatas/:urn', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getMetadata(req.params.urn, {}, null, req.session.internal)
        .then(function (data) {
            res.json(data.body);
        })
        .catch(function (error) {
            res.status(error.response.status).end(error.message);
        });
});

/////////////////////////////////////////////////////////////////
// Get the hierarchy information for the model with the given
// guid inside the file with the provided urn
/////////////////////////////////////////////////////////////////
router.get('/hierarchy', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getModelviewMetadata(req.query.urn, req.query.guid, {}, null, req.session.internal)
        .then(function (metaData) {
            if (metaData.body.data) {
                res.json(metaData.body);
            } else {
                res.json({result: 'accepted'});
            }
        })
        .catch(function (error) {
            res.status(error.response.status).end(error.message);
        });
});

/////////////////////////////////////////////////////////////////
// Get the properties for all the components inside the model
// with the given guid and file urn
/////////////////////////////////////////////////////////////////
router.get('/properties', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getModelviewProperties(req.query.urn, req.query.guid, {}, null, req.session.internal)
        .then(function (data) {
            res.json(data.body);
        })
        .catch(function (error) {
            res.status(error.response.status).end(error.message);
        });
});

/////////////////////////////////////////////////////////////////
// Download the given derivative file, e.g. a STEP or other
// file format which are associated with the model file
/////////////////////////////////////////////////////////////////
router.get('/download', function (req, res) {
    var derivatives = new apsSDK.DerivativesApi();

    derivatives.getDerivativeManifest(req.query.urn, req.query.derUrn, {}, null, req.session.internal)
        .then(function (data) {
            var fileExt = req.query.fileName.split('.')[1];
            res.set('content-type', 'application/octet-stream');
            res.set('Content-Disposition', 'attachment; filename="' + req.query.fileName + '"');
            res.end(data.body);
        })
        .catch(function (error) {
            res.status(error.response.status).end(error.message);
        });
});

/////////////////////////////////////////////////////////////////
// Send a translation request in order to get an SVF or other
// file format for our file
/////////////////////////////////////////////////////////////////
router.post('/export', jsonParser, function (req, res) {
    //env, token, urn, format, rootFileName, fileExtType, advanced
    var item = {
        "type": req.body.format
    };

    if (req.body.format === 'svf') {
        item.views = ['2d', '3d'];
    }

    if (req.body.advanced) {
        item.advanced = req.body.advanced;
    }

    let isComposite = (req.body.fileExtType && req.body.fileExtType === 'versions:autodesk.a360:CompositeDesign');

    var rootFilename = req.body.rootFileName
    if (rootFilename.endsWith(".zip")) {
        rootFilename = rootFilename.slice(0, -4)
        isComposite = true
    }
    
    var input = (isComposite) ? {
        "urn": req.body.urn,
        //"checkReferences": true,
        "rootFilename": rootFilename,
        "compressedUrn": true
    } : {
        "urn": req.body.urn
    };
    

    //var input = {"urn": req.body.urn};
    var output = {
        "destination": {
            "region": "us"
        },
        "formats": [item]
    };

    var derivatives = new apsSDK.DerivativesApi();

    console.log("input", input);    

    derivatives.translate({"input": input, "output": output}, {}, null, req.session.internal)
        .then(function (data) {
            res.json(data.body);
        })
        .catch(function (error) {
            res.status(error.response.status).end(error.message);
        });
});

/////////////////////////////////////////////////////////////////
// Return the router object that contains the endpoints
/////////////////////////////////////////////////////////////////
module.exports = router;
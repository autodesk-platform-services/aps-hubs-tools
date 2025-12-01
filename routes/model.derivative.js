'use strict'; // http://www.w3schools.com/js/js_strict.asp

// web framework
var express = require('express');
var router = express.Router();

var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

var zlib = require("zlib");

var apsSDK = require('forge-apis');

var sdk = require('@aps_sdk/autodesk-sdkmanager');
var derivativeSdk = require('@aps_sdk/model-derivative');
const sdkManager = sdk.SdkManagerBuilder.create().build();
const modelDerivativeClient = new derivativeSdk.ModelDerivativeClient(sdkManager);

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
            res.status(error?.statusCode || 500).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Get the manifest of the given file. This will contain
// information about the various formats which are currently
// available for this file
/////////////////////////////////////////////////////////////////
router.get('/manifests/:urn', function (req, res) {
    const region = req.query.region || 'US';

    modelDerivativeClient.getManifest(req.params.urn, { region: region, accessToken: req.session.internal.access_token })
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error?.axiosError?.status || 500).end(error.statusMessage);
        });
});

router.delete('/manifests/:urn', function (req, res) {
    const region = req.query.region || 'US';

    try {
        modelDerivativeClient.deleteManifest(req.params.urn, { region: region, accessToken: req.session.internal.access_token })
            .then(function (data) {
                res.json(data);
            })
            .catch(function (error) {
                res.status(error?.axiosError?.status || 500).end(error.statusMessage);
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
    const region = req.query.region || 'US';
    
    modelDerivativeClient.getModelViews(req.params.urn, { region: region, accessToken: req.session.internal.access_token })
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error?.axiosError?.status || 500).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Get the hierarchy information for the model with the given
// guid inside the file with the provided urn
/////////////////////////////////////////////////////////////////
function sanitize(obj) {
  return s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&#34;');
}

router.get('/hierarchy', function (req, res) {
    const region = req.query.region || 'US';

    modelDerivativeClient.getObjectTree(req.query.urn, req.query.guid, { region: region, accessToken: req.session.internal.access_token })
        .then(function (metaData) {
            if (metaData.data) {
                res.json(sanitizeAllValues(metaData));
            } else {
                res.json({result: 'accepted'});
            }
        })
        .catch(function (error) {
            res.status(error?.axiosError?.status || 500).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Get the properties for all the components inside the model
// with the given guid and file urn
/////////////////////////////////////////////////////////////////
router.get('/properties', function (req, res) {
    const region = req.query.region || 'US';

    modelDerivativeClient.getAllProperties(req.query.urn, req.query.guid, { region: region, accessToken: req.session.internal.access_token })
        .then(function (data) {
            res.json(sanitizeAllValues(data));
        })
        .catch(function (error) {
            res.status(error?.axiosError?.status || 500).end(error.statusMessage);
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
            res.status(error?.statusCode || 500).end(error.statusMessage);
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

    if (req.body.format.startsWith('svf')) {
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
        //"checkReferences": true
        "rootFilename": rootFilename,
        "compressedUrn": true
    } : {
        "urn": req.body.urn
    };
    

    //var input = {"urn": req.body.urn};
    var output = {
        "formats": [item]
    };

    const region = req.body.region || 'US';

    //var derivatives = new apsSDK.DerivativesApi();

    //if (!derivatives)
    //    return;

    console.log("input", input);    

    //derivatives.translate({"input": input, "output": output}, {}, null, req.session.internal)
    modelDerivativeClient.startJob({ "input": input, "output": output }, { region, accessToken: req.session.internal.access_token })
        .then(function (data) {
            res.json(data);
        })
        .catch(function (error) {
            res.status(error?.axiosError?.status || 500).end(error.statusMessage);
        });
});

/////////////////////////////////////////////////////////////////
// Utility function to recursively modify all values in an object
// at all levels (deep traversal)
// 
// @param {Object|Array} obj - The object or array to modify
// @param {Function} modifierFn - Function that takes a value and returns the modified value
// @returns {Object|Array} - New object/array with all values modified
/////////////////////////////////////////////////////////////////
function sanitize(s) {
    if (typeof s !== 'string') 
        return s;

    return s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&#39;')
        .replace(/"/g, '&#34;');
}

function sanitizeAllValues(obj) {
    return modifyAllValues(obj, sanitize);
}

function modifyAllValues(obj, modifierFn) {
    // Handle null or undefined
    if (obj === null || obj === undefined) {
        return modifierFn(obj);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => modifyAllValues(item, modifierFn));
    }

    // Handle objects
    if (typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = modifyAllValues(obj[key], modifierFn);
            }
        }
        return result;
    }

    // Handle primitive values (string, number, boolean, etc.)
    return modifierFn(obj);
}

/////////////////////////////////////////////////////////////////
// Return the router object that contains the endpoints
/////////////////////////////////////////////////////////////////
module.exports = router;
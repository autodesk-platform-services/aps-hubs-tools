# Hubs Tools

[![Node.js](https://img.shields.io/badge/Node.js-6.2-blue.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-5.5.1-blue.svg)](https://www.npmjs.com/)
![Platforms](https://img.shields.io/badge/platform-windows%20%7C%20osx%20%7C%20linux-lightgray.svg)
[![License](https://img.shields.io/:license-mit-blue.svg)](http://opensource.org/licenses/MIT)
[![OAuth2](https://img.shields.io/badge/OAuth2-v1-green.svg)](http://developer.autodesk.com/)
[![OSS](https://img.shields.io/badge/Data_Management-v1-green.svg)](http://developer.autodesk.com/)
[![Model-Derivative](https://img.shields.io/badge/Model%20Derivative-v2-green.svg)](http://developer.autodesk.com/)
[![Viewer](https://img.shields.io/badge/Viewer-v7-green.svg)](http://developer.autodesk.com/)
[![Level](https://img.shields.io/badge/Level-Intermediate-blue.svg)](http://developer.autodesk.com/)

# Description

This sample shows how you can use the **Model Derivative API** and what you can do with it and also uses [Autodesk Viewer](https://developer.autodesk.com/en/docs/viewer/v2/overview/) for showing models. The front-end will look like:

## Thumbnail
![thumbnail](/thumbnail.png)

## Live version

See it live at [https://derivatives.autodesk.io](https://derivatives.autodesk.io) 

# Setup

## Prerequisites

1. **BIM 360 or other Autodesk storage account**: if you want to use it with files from BIM 360 Docs then you must be an Account Admin to add the app integration. [Learn about provisioning](https://aps.autodesk.com/blog/bim-360-docs-provisioning-forge-apps).
2. **APS Account**: Learn how to create a APS Account, activate subscription and create an app at [this tutorial](https://tutorials.autodesk.io/). 
3. **Visual Studio Code**: other text editors could be used too, but Visual Studio Code is a widely used editor, see [https://code.visualstudio.com/](https://code.visualstudio.com/) 
4. **Node.js**: basic knowledge of Node.js, see [https://nodejs.org/en/](https://nodejs.org/en/) 
5. **JavaScript**: basic knowledge

## Running locally

Install [NodeJS](https://nodejs.org).

Clone this project or download it. It's recommended to install [GitHub desktop](https://desktop.github.com/). To clone it via command line, use the following (<b>Terminal</b> on MacOSX/Linux, <b>Git Shell</b> on Windows):

    git clone https://github.com/autodesk-platform-services/aps-hubs-tools

To run it, install the required packages, set the enviroment variables with your client ID & secret and finally start it. Via command line, navigate to the folder where this repository was cloned and use the following:

Mac OSX/Linux (Terminal)

    npm install
    export APS_CLIENT_ID=<<YOUR CLIENT ID FROM DEVELOPER PORTAL>>
    export APS_CLIENT_SECRET=<<YOUR CLIENT SECRET>>
    npm run dev

Windows (use <b>Node.js command line</b> from Start menu)

    npm install
    set APS_CLIENT_ID=<<YOUR CLIENT ID FROM DEVELOPER PORTAL>>
    set APS_CLIENT_SECRET=<<YOUR CLIENT SECRET>>
    npm run dev

Open the browser: [http://localhost:3000](http://localhost:3000).

<b>Important:</b> do not use <b>npm start</b> locally, this is intended for PRODUCTION only with HTTPS (SSL) secure cookies.

## Deployment

To deploy this application to Heroku, the **Callback URL** must use your `.herokuapp.com` address. After clicking on the button below, at the Heroku Create New App page, set your Client ID, Secret and Callback URL.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/autodesk-platform-services/aps-hubs-tools)

Watch [this video](https://www.youtube.com/watch?v=Oqa9O20Gj0c) on how deploy samples to Heroku.

# Further reading

Documentation:

- [BIM 360 API](https://developer.autodesk.com/en/docs/bim360/v1/overview/) and [App Provisioning](https://aps.autodesk.com/blog/bim-360-docs-provisioning-forge-apps)
- [Data Management API](https://developer.autodesk.com/en/docs/data/v2/overview/)
- [Viewer](https://developer.autodesk.com/en/docs/viewer/v6)

Tutorials:

- [View BIM 360/ACC Models](https://tutorials.autodesk.io/tutorials/hubs-browser/)
- [Retrieve Issues](https://developer.autodesk.com/en/docs/bim360/v1/tutorials/retrieve-issues)

Blogs:

- [APS Blog](https://aps.autodesk.com/categories/bim-360-api)
- [Field of View](https://fieldofviewblog.wordpress.com/), a BIM focused blog

### Tips & tricks

For local development/testing, consider use [nodemon](https://www.npmjs.com/package/nodemon) package, which auto restart your node application after any modification on your code. To install it, use:

    sudo npm install -g nodemon

Then, instead of <b>npm run dev</b>, use the following:

    npm run nodemon

Which executes <b>nodemon server.js --ignore www/</b>, where the <b>--ignore</b> parameter indicates that the app should not restart if files under <b>www</b> folder are modified.

### Troubleshooting

After installing Github desktop for Windows, on the Git Shell, if you see a <b>*error setting certificate verify locations*</b> error, use the following:

    git config --global http.sslverify "false"

## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT).
Please see the [LICENSE](LICENSE) file for full details.

## Written by

Adam Nagy (Autodesk Partner Development)<br />
http://aps.autodesk.com<br />

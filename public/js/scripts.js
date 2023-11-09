const MyVars = {
    keepTrying: true,
};

$(document).ready(function () {
    //debugger;
    $("#hiddenFrame").attr("src", "");

    // Make sure that "change" event is fired
    // even if same file is selected for upload
    $("#apsUploadHidden").click(evt => {
        evt.target.value = "";
    });

    $("#refreshTree").click(evt => {
        $("#apsFiles").jstree(true).refresh();
    });

    $("#apsUploadHidden").change(evt => {
        onUploadFile(evt.target.value, evt.target.files[0]);
    });

    $("#uploadFile").click(evt => {
        evt.preventDefault();
        MyVars.isAttachment = true;
        $("#apsUploadHidden").trigger("click");
    });

    $("#uploadFile2").click(evt => {
        evt.preventDefault();
        MyVars.isAttachment = false;
        $("#apsUploadHidden").trigger("click");
    });

	$("#downloadExport").click(onDownloadExport);

	$("#deleteManifest").click(() => {
		cleanupViewer();

		deleteManifest(MyVars.selectedUrn);
	});

	$("#progressInfo").click(() => {
        MyVars.keepTrying = false;
    });

    // Get the tokens
    getToken(token => {
        const auth = $("#authenticate");

        if (!token) {
            auth.click(signIn);
        } else {
            MyVars.token = token;

            auth.html("You're logged in");
            auth.click(() => {
                if (MyVars.token) {
                    if (confirm("You're sure you want to sign out?")) {
                        signOut();
                    }
                } else {
                    signIn();
                }
            });

            // Fill the tree with A360 items
            prepareFilesTree();

            // Download list of available file formats
            fillFormats();
        }
    });
});

async function onDownloadExport() {
	try {
		const elem = $("#apsHierarchy");
		const tree = elem.jstree();
		const rootNodeId = tree.get_node("#").children[0];
		const rootNode = tree.get_node(rootNodeId);

		const format = $("#apsFormats").val();
		const urn = MyVars.selectedUrn;
		const guid = MyVars.selectedGuid;
		const fileName = rootNode.text + "." + format;
		const rootFileName = MyVars.rootFileName;
		const nodeIds = elem.jstree("get_checked", null, true);

		// Only OBJ supports subcomponent selection
		// using objectId's
		let objectIds = null;
		if (format === "obj") {
			objectIds = [-1];
			if (nodeIds.length) {
				objectIds = [];

				$.each(nodeIds, function (index, value) {
					objectIds.push(parseInt(value, 10));
				});
			}
		}

		// The rest can be exported with a single function
		const res = await askForFileType(
			format,
			urn,
			guid,
			objectIds,
			rootFileName,
			MyVars.fileExtType,
		);

		// If it's a thumbnail then just download it
		if (format === "thumbnail") {
			downloadThumbnail(urn);

			return;
		}

		// Find the appropriate obj part
		const der = res.derivatives.find(
			item => item.outputType === format
		);

		if (!der) {
			showProgress("Could not find exported file", "failed");
			console.log(
				"askForFileType, Did not find " +
					format +
					" in the manifest"
			);
			return;
		}
		
		// found it, now get derivative urn
		// leaf objectIds parameter undefined
		const derUrns = getDerivativeUrns(
			der,
			format,
			false,
			objectIds
		);

		if (!derUrns) {
			showProgress(
				"Could not find specific OBJ file",
				"failed"
			);
			console.log(
				"askForFileType, Did not find the OBJ translation with the correct list of objectIds"
			);
			return;
		}

		// url encode it
		derUrns[0] = encodeURIComponent(derUrns[0]);

		downloadDerivative(urn, derUrns[0], fileName);

		// in case of obj format, also try to download the material
		if (format === "obj") {
			// The MTL file needs to have the exact name that it has on OSS
			// because that's how it's referenced from the OBJ file
			let ossName = decodeURIComponent(
				derUrns[0]
			);
			const ossNameParts = ossName.split("/");

			// Get the last element
			ossName =
				ossNameParts[ossNameParts.length - 1];

			downloadDerivative(
				urn,
				derUrns[0].replace(".obj", ".mtl"),
				ossName.replace(".obj", ".mtl")
			);
		}
	} catch (err) {
		console.log(err);
	}
}

function onUploadFile(fileName, file) {
    showProgress("Uploading file... ", "inprogress");
    let data = new FormData();
    data.append(0, file);
    $.ajax({
        url: "/dm/files",
        type: "POST",
        headers: {
            "x-file-name": fileName,
            "wip-href": MyVars.selectedNode.original.href,
            "wip-id": MyVars.selectedNode.original.wipid,
            "is-attachment": MyVars.isAttachment,
        },
        data: data,
        cache: false,
        processData: false, // Don't process the files
        contentType: false, // Set content type to false as jQuery will tell the server its a query string request
        complete: null,
    })
        .done(function (data) {
            console.log(
                'Uploaded file "' +
                    data.fileName +
                    '" with urn = ' +
                    data.objectId
            );

            // Refresh file tree
            $("#apsFiles").jstree("refresh");

            showProgress("Upload successful", "success");
        })
        .fail(function (xhr, ajaxOptions, thrownError) {
            alert(fileName + " upload failed!");
            showProgress("Upload failed", "failed");
        });
}

function base64encode(str) {
    let ret = "";
    if (window.btoa) {
        ret = window.btoa(str);
    } else {
        // IE9 support
        ret = window.Base64.encode(str);
    }

    // Remove ending '=' signs
    // Use _ instead of /
    // Use - insteaqd of +
    // Have a look at this page for info on "Unpadded 'base64url' for "named information" URI's (RFC 6920)"
    // which is the format being used by the Model Derivative API
    // https://en.wikipedia.org/wiki/Base64#Variants_summary_table
    const ret2 = ret.replace(/=/g, "").replace(/[/]/g, "_").replace(/[+]/g, "-");

    console.log("base64encode result = " + ret2);

    return ret2;
}

async function signIn() {
    const response = await fetch("/user/authenticate");

    if (response.ok) {
        const rootUrl = await response.text();
        location.href = rootUrl;
    }
}

async function signOut() {
    // Delete session data both locally and on the server
    MyVars.token = null;
    await fetch("/user/signOut");

    let loadCount = 0;
    $("#hiddenFrame").on("load", function (data) {
        loadCount++;
        if (loadCount > 1) {
            // Once the logout finished the iframe will be redirected
            // and the load event will be fired again
            window.location.reload();
        }
    });

    // Load the LogOut page
    $("#hiddenFrame").attr(
        "src",
        "https://developer.api.autodesk.com/authentication/v2/logout"
    );
}

async function getToken(callback) {
    if (callback) {
        const response = await fetch("/user/token");

        if (response.ok) {
            const data = await response.json();
            MyVars.token = data.token;
            console.log(
                "Returning new 3 legged token (User Authorization): " +
                    MyVars.token
            );
            callback(data.token, data.expires_in);
        }
    } else {
        console.log(
            "Returning saved 3 legged token (User Authorization): " +
                MyVars.token
        );

        return MyVars.token;
    }
}

function downloadDerivative(urn, derUrn, fileName) {
    console.log("downloadDerivative for urn=" + urn + " and derUrn=" + derUrn);
    // fileName = file name you want to use for download
    const url =
        window.location.protocol +
        "//" +
        window.location.host +
        "/md/download?urn=" +
        urn +
        "&derUrn=" +
        derUrn +
        "&fileName=" +
        encodeURIComponent(fileName);

    window.open(url, "_blank");
}

function downloadThumbnail(urn) {
    console.log("downloadDerivative for urn=" + urn);
    // fileName = file name you want to use for download
    const url =
        window.location.protocol +
        "//" +
        window.location.host +
        "/dm/thumbnail?urn=" +
        urn;

    window.open(url, "_blank");
}

function isArraySame(arr1, arr2) {
    // If both are undefined or has no value
    if (!arr1 && !arr2) return true;

    // If just one of them has no value
    if (!arr1 || !arr2) return false;

    return arr1.sort().join(",") === arr2.sort().join(",");
}

function getDerivativeUrns(
    derivative,
    format,
    isThumbnailRequested,
    objectIds
) {
    console.log(
        "getDerivativeUrns for derivative=" +
            derivative.outputType +
            " and objectIds=" +
            (objectIds ? objectIds.toString() : "none")
    );
    const res = [];
    for (const childId in derivative.children) {
        const child = derivative.children[childId];
        // using toLowerCase to handle inconsistency
        if (child.role === "3d" || child.role.toLowerCase() === format) {
            if (isArraySame(child.objectIds, objectIds)) {
                // Some formats like svf might have children
                if (child.children) {
                    for (const subChildId in child.children) {
                        const subChild = child.children[subChildId];

                        if (subChild.role === "graphics") {
                            res.push(subChild.urn);
                            if (!isThumbnailRequested) return res;
                        } else if (
                            isThumbnailRequested &&
                            subChild.role === "thumbnail"
                        ) {
                            res.push(subChild.urn);
                            return res;
                        }
                    }
                } else {
                    res.push(child.urn);
                    return res;
                }
            }
        }
    }

    return null;
}

// OBJ: guid & objectIds are also needed
// SVF, STEP, STL, IGES:
// Posts the job then waits for the manifest and then download the file
// if it's created
async function askForFileType(
    format,
    urn,
    guid,
    objectIds,
    rootFileName,
    fileExtType
) {
    console.log("askForFileType " + format + " for urn=" + urn);

    const advancedOptions = {
        stl: {
            format: "binary",
            exportColor: true,
            exportFileStructure: "single", // "multiple" does not work
        },
        obj: {
            modelGuid: guid,
            objectIds: objectIds,
        },
    };

    const response = await fetch("/md/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            urn: urn,
            format: format,
            advanced: advancedOptions[format],
            rootFileName: rootFileName,
            fileExtType: fileExtType,
        }),
    });

    if (!response.ok) {
        showProgress("Could not start translation", "failed");
        throw new Error(response.statusText);
    }

    const data = await response.json();

    if (
        data.result === "success" || // newly submitted data
        data.result === "created" // already submitted data
    ) {
        return await getManifest(urn);
    }

	throw new Error(data.result);
}

// We need this in order to get an OBJ file for the model
async function getMetadata(urn) {
    console.log("getMetadata for urn=" + urn);

	const response = await fetch("/md/metadatas/" + urn);

	if (!response.ok) {
		console.log("GET /md/metadata call failed\n" + response.statusText);
		throw new Error(response.statusText);
	}

	const data = await response.json();
	console.log(data);

	// Get first model guid
	// If it does not exists then something is wrong
	// let's check the manifest
	// If get manifest sees a failed attempt then it will
	// delete the manifest
	const md0 = data?.data?.metadata[0];
	if (!md0) {
		return await getManifest(urn);
	} else {
		return md0.guid;
	}
       
}

async function getHierarchy(urn, guid) {
    console.log("getHierarchy for urn=" + urn + " and guid=" + guid);

	MyVars.keepTrying = true;
	while (true) {
		const response = await fetch("/md/hierarchy?urn=" + urn + "&guid=" + guid);

		if (!response.ok) {
			console.log("GET /md/hierarchy call failed\n" + response.statusText);
			throw new Error(response.statusText);
		}

		const data = await response.json();
		console.log(data);

		// If it's 'accepted' then it's not ready yet
		if (data.result === "accepted") {
			// Let's try again
			if (MyVars.keepTrying) 
				continue;
		}	
		
		return data;
	}
}

async function getProperties(urn, guid) {
    console.log("getProperties for urn=" + urn + " and guid=" + guid);

	const response = await fetch("/md/properties?urn=" + urn + "&guid=" + guid);

	if (!response.ok) {
		console.log("GET /api/properties call failed\n" + err.statusText);
		throw new Error(response.statusText);
	}

	const data = await response.json();
	console.log(data);

    return data;
}

async function getManifest(urn) {
    console.log("getManifest for urn=" + urn);

	MyVars.keepTrying = true;
    while (true) {
        const response = await fetch("/md/manifests/" + urn, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        const data = await response.json();
        console.log(data);

        if (data.status === "failed") {
            showProgress("Translation failed", data.status);
            throw new Error(response.statusText);
        }

        if (data.progress === "complete") {
            showProgress("Translation completed", data.status);
            return data;
        }

        showProgress("Translation progress: " + data.progress, data.status);

        if (MyVars.keepTrying) 
			continue;

		showProgress("Monitoring stopped", "failed");
        throw new Error("Stopped by user");
    }
}

async function deleteManifest(urn) {
    console.log("deleteManifest for urn=" + urn);

	const response = await fetch("/md/manifests/" + urn, {
		method: "DELETE",
	});

	if (!response.ok) {
		console.log("DELETE /api/manifest call failed\n" + err.statusText);
		showProgress("Failed to delete manifest", "failed");
		throw new Error(response.statusText);
	}

	const data = await response.json();
	console.log(data);
	if (data.result === "success") {
		showProgress("Manifest deleted", "success");
		return data;
	}
}

/////////////////////////////////////////////////////////////////
// Formats / #apsFormats
// Shows the export file formats available for the selected model
/////////////////////////////////////////////////////////////////

async function getFormats() {
    console.log("getFormats");

	const response = await fetch("/md/formats");

	if (!response.ok) {
		console.log("GET /md/formats call failed\n" + err.statusText);
		throw new Error(response.statusText);
	}

	const data = await response.json();
	console.log(data);

	return data;
}

async function fillFormats() {
    const data = await getFormats();

	const apsFormats = $("#apsFormats");
	apsFormats.data("apsFormats", data);
}

function updateFormats(format) {
    const apsFormats = $("#apsFormats");
    const formats = apsFormats.data("apsFormats");
    apsFormats.empty();

    // obj is not listed for all possible files
    // using this workaround for the time being
    //apsFormats.append($("<option />").val('obj').text('obj'));

    $.each(formats.formats, function (key, value) {
        if (key === "obj" || value.indexOf(format) > -1) {
            apsFormats.append($("<option />").val(key).text(key));
        }
    });
}

/////////////////////////////////////////////////////////////////
// Files Tree / #apsFiles
// Shows the A360 hubs, projects, folders and files of
// the logged in user
/////////////////////////////////////////////////////////////////

function prepareFilesTree() {
    console.log("prepareFilesTree");
    $.getJSON("/api/aps/clientID", res => {
        $("#ClientID").val(res.ClientId);
    });

	let haveBIM360Hub = false;
    $("#apsFiles")
        .jstree({
            core: {
                themes: { icons: true },
                check_callback: true, // make it modifiable
                data: {
                    cache: false,
                    url: "/dm/treeNode",
                    dataType: "json",
                    data: node => {
                        return {
                            href: node.id === "#" ? "#" : node.original.href,
                        };
                    },
                    success: nodes => {
                        nodes.forEach(function (n) {
                            if (n.type === "hubs" && n.href.indexOf("b.") > 0)
                                haveBIM360Hub = true;
                        });

                        if (!haveBIM360Hub) {
                            $("#provisionAccountModal").modal();
                            $("#provisionAccountSave").click(() => {
                                $("#provisionAccountModal").modal("toggle");
                                $("#apsFiles").jstree(true).refresh();
                            });
                            haveBIM360Hub = true;
                        }
                    },
                },
            },
            types: {
                default: {
                    icon: "glyphicon glyphicon-cloud",
                },
                "#": {
                    icon: "glyphicon glyphicon-user",
                },
                hubs: {
                    icon: "glyphicon glyphicon-inbox",
                },
                projects: {
                    icon: "glyphicon glyphicon-list-alt",
                },
                items: {
                    icon: "glyphicon glyphicon-briefcase",
                },
                folders: {
                    icon: "glyphicon glyphicon-folder-open",
                },
                versions: {
                    icon: "glyphicon glyphicon-time",
                },
            },
            plugins: ["types", "contextmenu"], // let's not use sort or state: , "state" and "sort"],
            contextmenu: {
                select_node: false,
                items: filesTreeContextMenu,
            },
        })
        .bind("select_node.jstree", (evt, data) => {
            // Clean up previous instance
            cleanupViewer();

            console.log("Selected item's ID/URN: " + data.node.original.wipid);

            // Disable the hierarchy related controls for the time being
            $("#apsFormats").attr("disabled", "disabled");
            $("#downloadExport").attr("disabled", "disabled");

            if (data.node.type === "folders") {
                $("#uploadFile2").removeAttr("disabled");
            } else {
                $("#uploadFile2").attr("disabled", "disabled");
            }

            MyVars.selectedNode = data.node;

            if (data.node.type === "versions") {
                $("#deleteManifest").removeAttr("disabled");
                $("#uploadFile").removeAttr("disabled");

                // Clear hierarchy tree
                $("#apsHierarchy").empty().jstree("destroy");

                // Clear properties tree
                $("#apsProperties").empty().jstree("destroy");

                // Delete cached data
                $("#apsProperties").data("apsProperties", null);

                updateFormats(data.node.original.fileType);

                // Store info on selected file
                MyVars.rootFileName = data.node.original.rootFileName;
                MyVars.fileName = data.node.original.fileName;
                MyVars.fileExtType = data.node.original.fileExtType;

                if ($("#wipVsStorage").hasClass("active")) {
                    console.log("Using WIP id");
                    MyVars.selectedUrn = base64encode(data.node.original.wipid);
                } else {
                    console.log("Using Storage id");
                    MyVars.selectedUrn = base64encode(
                        data.node.original.storage
                    );
                }

                // Fill hierarchy tree
                // format, urn, guid, objectIds, rootFileName, fileExtType
                showHierarchy(
                    MyVars.selectedUrn,
                    null,
                    null,
                    MyVars.rootFileName,
                    MyVars.fileExtType
                );
                console.log(
                    "data.node.original.storage = " +
                        data.node.original.storage,
                    "data.node.original.wipid = " + data.node.original.wipid,
                    ", data.node.original.fileName = " +
                        data.node.original.fileName,
                    ", data.node.original.fileExtType = " +
                        data.node.original.fileExtType
                );

                // Show in viewer
                //initializeViewer(data.node.data);
            } else {
                $("#deleteManifest").attr("disabled", "disabled");
                $("#uploadFile").attr("disabled", "disabled");

                // Just open the children of the node, so that it's easier
                // to find the actual versions
                $("#apsFiles").jstree("open_node", data.node);

                // And clear trees to avoid confusion thinking that the
                // data belongs to the clicked model
                $("#apsHierarchy").empty().jstree("destroy");
                $("#apsProperties").empty().jstree("destroy");
            }
        });
}

function downloadAttachment(href, attachmentVersionId) {
    console.log("downloadAttachment for href=" + href);
    // fileName = file name you want to use for download
    const url =
        window.location.protocol +
        "//" +
        window.location.host +
        "/dm/attachments/" +
        encodeURIComponent(attachmentVersionId) +
        "?href=" +
        encodeURIComponent(href);

    window.open(url, "_blank");
}

function downloadFile(href) {
    console.log("downloadFile for href=" + href);
    // fileName = file name you want to use for download
    const url =
        window.location.protocol +
        "//" +
        window.location.host +
        "/dm/files/" +
        encodeURIComponent(href);

    window.open(url, "_blank");
}

function deleteAttachment(href, attachmentVersionId) {
    alert("Functionality not available yet");
    return;

    console.log("deleteAttachment for href=" + href);
    $.ajax({
        url: "/dm/attachments/" + encodeURIComponent(attachmentVersionId),
        headers: { "wip-href": href },
        type: "DELETE",
    })
        .done(function (data) {
            console.log(data);
            if (data.status === "success") {
                if (onsuccess !== undefined) {
                    onsuccess(data);
                }
            }
        })
        .fail(function (err) {
            console.log("DELETE /api/manifest call failed\n" + err.statusText);
        });
}

function filesTreeContextMenu(node, callback) {
    if (node.type === "versions") {
        $.ajax({
            url: "/dm/attachments",
            data: { href: node.original.href },
            type: "GET",
            success: function (data) {
                const menuItems = {};
                menuItems["download"] = {
                    label: "Download",
                    action: function (obj) {
                        downloadFile(obj.item.href);
                    },
                    href: node.original.href,
                };
                data.data.forEach(function (item) {
                    if (
                        item.meta.extension.type ===
                        "auxiliary:autodesk.core:Attachment"
                    ) {
                        const menuItem = {
                            label: item.displayName,
                            action: function (obj) {
                                alert(
                                    obj.item.label +
                                        " with versionId = " +
                                        obj.item.versionId
                                );
                            },
                            versionId: item.id,
                            submenu: {
                                open: {
                                    label: "Open",
                                    action: function (obj) {
                                        downloadAttachment(
                                            obj.item.href,
                                            obj.item.versionId
                                        );
                                    },
                                    versionId: item.id,
                                    href: node.original.href,
                                },
                                delete: {
                                    label: "Delete",
                                    action: function (obj) {
                                        deleteAttachment(
                                            obj.item.href,
                                            obj.item.versionId
                                        );
                                    },
                                    versionId: item.id,
                                    href: node.original.href,
                                },
                            },
                        };

                        menuItems = menuItems || {};
                        menuItems[item.id] = menuItem;
                    }
                });

                if (Object.keys(menuItems).length < 2) {
                    menuItems["noItem"] = {
                        label: "No attachments",
                        action: function () {},
                    };
                }

                callback(menuItems);
            },
        });
    }

    return;
}

/////////////////////////////////////////////////////////////////
// Hierarchy Tree / #apsHierarchy
// Shows the hierarchy of components in selected model
/////////////////////////////////////////////////////////////////

async function showHierarchy(urn, guid, objectIds, rootFileName, fileExtType) {
    // You need to
    // 1) Post a job
    // 2) Get matadata (find the model guid you need)
    // 3) Get the hierarchy based on the urn and model guid

    // Get svf export in order to get hierarchy and properties
    // for the model

	try {
		const format = "svf";
		const manifest = await askForFileType(
			format,
			urn,
			guid,
			objectIds,
			rootFileName,
			fileExtType
		);
	
		const viewGuid = await getMetadata(urn);

		showProgress("Retrieving hierarchy...", "inprogress");
		const data = await getHierarchy(urn, viewGuid);
		showProgress("Retrieved hierarchy", "success");

		const der = manifest.derivatives.find(
			item => item.outputType.includes("svf")
		);

		if (!der) 
			return;

		initializeViewer(urn);
						
		prepareHierarchyTree(urn, viewGuid, data.data);
	} catch (err) {
		console.log(err);
	}
}

function addHierarchy(nodes) {
    for (let nodeId in nodes) {
        const node = nodes[nodeId];

        // We are also adding properties below that
        // this function might iterate over and we should skip
        // those nodes
        if (
            (node.type && node.type === "property") ||
            node.type === "properties"
        ) 
			continue;

		node.text = node.name;
		node.children = node.objects;
		if (node.objectid === undefined) {
			node.type = "dunno";
		} else {
			node.id = node.objectid;
			node.type = "object";
		}
		addHierarchy(node.objects);
    }
}

function prepareHierarchyTree(urn, guid, json) {
    // Convert data to expected format
    addHierarchy(json.objects);

    // Enable the hierarchy related controls
    $("#apsFormats").removeAttr("disabled");
    $("#downloadExport").removeAttr("disabled");

    // Store info of selected item
    MyVars.selectedUrn = urn;
    MyVars.selectedGuid = guid;

    // init the tree
    $("#apsHierarchy")
        .jstree({
            core: {
                check_callback: true,
                themes: { icons: true },
                data: json.objects,
            },
            checkbox: {
                tie_selection: false,
                three_state: true,
                whole_node: false,
            },
            types: {
                default: {
                    icon: "glyphicon glyphicon-cloud",
                },
                object: {
                    icon: "glyphicon glyphicon-save-file",
                },
            },
            plugins: [
                "types",
                "sort",
                "checkbox",
                "ui",
                "themes",
                "contextmenu",
            ],
            contextmenu: {
                select_node: false,
                items: hierarchyTreeContextMenu,
            },
        })
        .bind("select_node.jstree", async (evt, data) => {
            if (data.node.type === "object") {
                const urn = MyVars.selectedUrn;
                const guid = MyVars.selectedGuid;
                const objectId = data.node.original.objectid;

                // Empty the property tree
                $("#apsProperties").empty().jstree("destroy");

                const props = await fetchProperties(urn, guid);
				preparePropertyTree(urn, guid, objectId, props);
				selectInViewer([objectId]);
            }
        })
        .bind("check_node.jstree uncheck_node.jstree", function (evt, data) {
            // To avoid recursion we are checking if the changes are
            // caused by a viewer selection which is calling
            // selectInHierarchyTree()
            if (!MyVars.selectingInHierarchyTree) {
                const elem = $("#apsHierarchy");
                const nodeIds = elem.jstree("get_checked", null, true);

                // Convert from strings to numbers
                const objectIds = [];
                $.each(nodeIds, function (index, value) {
                    objectIds.push(parseInt(value, 10));
                });

                selectInViewer(objectIds);
            }
        });
}

function selectInHierarchyTree(objectIds) {
    MyVars.selectingInHierarchyTree = true;

    const tree = $("#apsHierarchy").jstree();

    // First remove all the selection
    tree.uncheck_all();

    // Now select the newly selected items
    for (let id of objectIds) {
        // Select the node
        tree.check_node(id);

        // Make sure that it is visible for the user
        tree._open_to(id);
    }

    MyVars.selectingInHierarchyTree = false;
}

function hierarchyTreeContextMenu(node) {
    const menuItems = {};

    const menuItem = {
        label: "Select in Fusion",
        action: function (obj) {
            const path = $("#apsHierarchy").jstree().get_path(node, "/");
            alert(path);

            // Open this in the browser:
            // fusion360://command=open&file=something&properties=MyCustomPropertyValues
            const url =
                "fusion360://command=open&file=something&properties=" +
                encodeURIComponent(path);
            $("#fusionLoader").attr("src", url);
        },
    };
    menuItems[0] = menuItem;

    return null; 
}

/////////////////////////////////////////////////////////////////
// Property Tree / #apsProperties
// Shows the properties of the selected sub-component
/////////////////////////////////////////////////////////////////

// Storing the collected properties since you get them for the whole
// model. So when clicking on the various sub-components in the
// hierarchy tree we can reuse it instead of sending out another
// http request
async function fetchProperties(urn, guid, onsuccess) {
    const props = $("#apsProperties").data("apsProperties");
    if (!props) {
        const data = await getProperties(urn, guid);
        $("#apsProperties").data("apsProperties", data.data);
        return data.data;
    } else {
        return props;
    }
}

// Recursively add all the additional properties under each
// property node
function addSubProperties(node, props) {
    node.children = node.children || [];
    for (const subPropId in props) {
        const subProp = props[subPropId];
        if (subProp instanceof Object) {
            const length = node.children.push({
                text: subPropId,
                type: "properties",
            });
            const newNode = node.children[length - 1];
            addSubProperties(newNode, subProp);
        } else {
            node.children.push({
                text: subPropId + " = " + subProp.toString(),
                type: "property",
            });
        }
    }
}

// Add all the properties of the selected sub-component
function addProperties(node, props) {
    // Find the relevant property section
    for (const propId in props) {
        const prop = props[propId];
        if (prop.objectid === node.objectid) {
            addSubProperties(node, prop.properties);
        }
    }
}

function preparePropertyTree(urn, guid, objectId, props) {
    // Convert data to expected format
    const data = { objectid: objectId };
    addProperties(data, props.collection);

    // init the tree
    $("#apsProperties")
        .jstree({
            core: {
                check_callback: true,
                themes: { icons: true },
                data: data.children,
            },
            types: {
                default: {
                    icon: "glyphicon glyphicon-cloud",
                },
                property: {
                    icon: "glyphicon glyphicon-tag",
                },
                properties: {
                    icon: "glyphicon glyphicon-folder-open",
                },
            },
            plugins: ["types", "sort"],
        })
        .bind("activate_node.jstree", function (evt, data) {
            //
        });
}

/////////////////////////////////////////////////////////////////
// Viewer
// Based on Autodesk Viewer basic sample
// https://developer.autodesk.com/api/viewerapi/
/////////////////////////////////////////////////////////////////

function cleanupViewer() {
    // Clean up previous instance
    if (MyVars.viewer && MyVars.viewer.model) {
        console.log("Unloading current model from Autodesk Viewer");

        //MyVars.viewer.impl.unloadModel(MyVars.viewer.model);
        //MyVars.viewer.impl.sceneUpdated(true);
        MyVars.viewer.tearDown();
        MyVars.viewer.setUp(MyVars.viewer.config);

        document.getElementById("apsViewer").style.display = "none";
    }
}

function initializeViewer(urn) {
    cleanupViewer();

    document.getElementById("apsViewer").style.display = "block";

    console.log("Launching Autodesk Viewer for: " + urn);

    const options = {
        document: "urn:" + urn,
        env: "AutodeskProduction2",
        api: "streamingV2",
        getAccessToken: getToken, // this works fine, but if I pass getToken it only works the first time
    };

    if (MyVars.viewer) {
        loadDocument(MyVars.viewer, options.document);
    } else {
        const viewerElement = document.getElementById("apsViewer");
        const config = {
            extensions: ["Autodesk.DocumentBrowser"], // 'Autodesk.Viewing.WebVR', 'Autodesk.Viewing.MarkupsGui', 'Autodesk.AEC.LevelsExtension'],
            //experimental: ['webVR_orbitModel']
        };
        MyVars.viewer = new Autodesk.Viewing.Private.GuiViewer3D(
            viewerElement,
            config
        );
        Autodesk.Viewing.Initializer(options, function () {
            MyVars.viewer.start(); // this would be needed if we also want to load extensions
            loadDocument(MyVars.viewer, options.document);
            //addSelectionListener(MyVars.viewer);
        });
    }
}

function addSelectionListener(viewer) {
    viewer.addEventListener(
        Autodesk.Viewing.SELECTION_CHANGED_EVENT,
        function (event) {
            selectInHierarchyTree(event.dbIdArray);

            const dbId = event.dbIdArray[0];
            if (dbId) {
                viewer.getProperties(dbId, function (props) {
                    console.log(props.externalId);
                });
            }
        }
    );
}

// Get the full path of the selected body
function getFullPath(tree, dbId) {
    const path = [];
    while (dbId) {
        const name = tree.getNodeName(dbId);
        path.unshift(name);
        dbId = tree.getNodeParentId(dbId);
    }

    // We do not care about the top 2 items because it's just the file name
    // and root component name
    path = path.splice(2, path.length - 1);

    return path.join("+");
}

function showAllProperties(viewer) {
    const instanceTree = viewer.model.getData().instanceTree;

    const allDbIds = Object.keys(instanceTree.nodeAccess.dbIdToIndex);

    for (const key in allDbIds) {
        const id = allDbIds[key];
        viewer.model.getProperties(id, function (data) {
            const str = "";
        });
    }
}

// Adds a button to the toolbar that can be used
// to check for body sepcific data in our mongo db
// Call this once the Viewer has been set up
function addFusionButton(viewer) {
    const button = new Autodesk.Viewing.UI.Button("toolbarFusion");
    button.onClick = function (e) {
        const ids = viewer.getSelection();
        if (ids.length === 1) {
            const tree = viewer.model.getInstanceTree();
            const fullPath = getFullPath(tree, ids[0]);
            console.log(fullPath);

            $.ajax({
                url:
                    "/dm/fusionData/" +
                    viewer.model.loader.svfUrn +
                    "/" +
                    encodeURIComponent(fullPath),
                type: "GET",
            })
                .done(function (data) {
                    console.log("Retrieved data");
                    console.log(data);

                    alert(JSON.stringify(data, null, 2));
                })
                .fail(function (xhr, ajaxOptions, thrownError) {
                    alert("Failed to retrieve data");
                });
        }
    };
    button.addClass("toolbarFusionButton");
    button.setToolTip("Show Fusion properties");

    // SubToolbar
    const subToolbar = new Autodesk.Viewing.UI.ControlGroup("myFusionAppGroup");
    subToolbar.addControl(button);

    if (viewer.toolbar) {
        viewer.toolbar.addControl(subToolbar);
    } else {
        viewer.addEventListener(
            Autodesk.Viewing.TOOLBAR_CREATED_EVENT,
            function () {
                viewer.toolbar.addControl(subToolbar);
            }
        );
    }
}

function loadDocument(viewer, documentId) {
    // Set the Environment to "Riverbank"
    viewer.setLightPreset(8);

    // Make sure that the loaded document's setting won't
    // override it and change it to something else
    viewer.prefs.tag("ignore-producer");

    Autodesk.Viewing.Document.load(
        documentId,
        // onLoad
        function (doc) {
            const node = doc.getRoot().getDefaultGeometry();
            if (node) {
                viewer.loadDocumentNode(doc, node);
                addFusionButton(viewer);
            }
        },
        // onError
        function (errorMsg) {
            //showThumbnail(documentId.substr(4, documentId.length - 1));
        }
    );
}

function selectInViewer(objectIds) {
    if (MyVars.viewer) {
        MyVars.viewer.select(objectIds);
    }
}

/////////////////////////////////////////////////////////////////
// Other functions
/////////////////////////////////////////////////////////////////

function showProgress(text, status) {
    const progressInfo = $("#progressInfo");
    const progressInfoText = $("#progressInfoText");
    const progressInfoIcon = $("#progressInfoIcon");

    const oldClasses = progressInfo.attr("class");
    let newClasses = "";
    let newText = text;

    if (status === "failed") {
        newClasses = "btn btn-danger";
    } else if (status === "inprogress" || status === "pending") {
        newClasses = "btn btn-warning";
        newText += " (Click to stop)";
    } else if (status === "success") {
        newClasses = "btn btn-success";
    } else {
        newClasses = "btn btn-info";
    }

    // Only update if changed
    if (progressInfoText.text() !== newText) {
        progressInfoText.text(newText);
    }

    if (oldClasses !== newClasses) {
        progressInfo.attr("class", newClasses);

        if (newClasses === "btn btn-warning") {
            progressInfoIcon.attr(
                "class",
                "glyphicon glyphicon-refresh glyphicon-spin"
            );
        } else {
            progressInfoIcon.attr("class", "");
        }
    }
}

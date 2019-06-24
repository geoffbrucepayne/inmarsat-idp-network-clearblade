// TRIGGER on IdpMobiles item created

/**
 * Sends a notification when a new Mobile is detected/added to the Mobiles collection
 */
function idpMobileCollectionMonitor(req, resp) {
    var fName = entryLog(arguments.callee.name, 'called with:' + JSON.stringify(req.params));
    const mobileCollName = COL_IDP_MOBILES;
    ClearBlade.init({ request: req });

    var query = ClearBlade.Query({ collectionName: mobileCollName });
    // TODO: get only the new addition
    if (req.params.items) {
        query.equalTo('item_id', req.params.items[0].item_id);
        query.setPage(1, 1);
        query.fetch(function (err, qProvisioned) {
            if (err) {
                vlog(logLevels.ERROR, fName + ' qProvisioned query error:' + JSON.stringify(qProvisioned));
            } else if (qProvisioned.DATA.length > 0) {
                var provisioned = qProvisioned.DATA[0];
                vlog(logLevels.INFO, fName + ' ' + provisioned.mobile_id + ' added to ' + mobileCollName);
                notifyIdpNewMobileProvisioned(provisioned);
                
                var mobilesProvisioned = [];

                var getMobilesPagedCallback = function(err, data) {
                    if (err) {
                        vlog(logLevels.ERROR, fName + JSON.stringify(data));
                    } else {
                        vlog(logLevels.DEBUG, fName + ' get_mobiles_paged returned ' + JSON.stringify(data));
                        if (data.ErrorID > 0) {
                            vlog(logLevels.ERROR, fName + getErrorMessage(data.ErrorID));
                        } else {
                            mobilesProvisioned = mobilesProvisioned.concat(data.Mobiles);
                            if (data.More) {
                                // Note: this API should have a better filtering mechanism than having to query all mobiles, should allow a list
                                filters.since_mobile = data.Mobiles[data.Mobiles.length - 1].ID;
                                getMobilesPaged(auth, filters);
                            } else {
                                for (var m=0; m < mobilesProvisioned.length; m++) {
                                    if (mobilesProvisioned[m].ID === provisioned.mobile_id) {
                                        var mobileMeta = {
                                            mobile_id: mobilesProvisioned[m].ID,
                                            description: mobilesProvisioned[m].Description,
                                            last_registration: timestampRfc3339(mobilesProvisioned[m].LastRegistrationUTC),
                                            satellite_beam: mobilesProvisioned[m].RegionName,
                                        };
                                        vlog(logLevels.DEBUG, fName + ' mobileMeta:' + JSON.stringify(mobileMeta));
                                        updateMobileMeta(mobileMeta);
                                    }
                                }
                            }
                        }
                    }
                }

                var getMobilesPaged = function() {
                    get_mobiles_paged(auth, filters, getMobilesPagedCallback);
                }
                
                var mailbox = getMailboxes(provisioned.access_id)[0];
                var auth = { access_id: mailbox.accessId, password: mailbox.password };
                var filters = {
                    page_size: 100,
                };
                
                getMobilesPaged(auth, filters);
            }
        });
    }
    resp.success('Success');
}

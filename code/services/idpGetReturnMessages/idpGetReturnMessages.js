// RECOMMENDED TIMER 30 SECONDS 'pollReturnMessages'

/**
 * Polls the IDP message gateway for new Mobile-Originated messages.  Uses a Collection of mailbox credentials if none is provided.
 * @param {Object} [req.params]
 * @param {string} [req.params.access_id] - the IDP Mailbox credential username
 * @param {string} [req.params.password] - the IDP Mailbox credential password
 * @param {number} [req.params.from_id] - high watermark for message retrieval by unique ID
 * @param {string} [req.params.start_utc] - high watermark for message retrieval by UTC datestamp
 * @param {string} [req.params.end_utc] - filter datestamp of messages in range between start and end UTC
 */
function idpGetReturnMessages(req, resp) {
    var fName = entryLog(arguments.callee.name);
    ClearBlade.init({request:req});

    var callTime = new Date();
    var successMsgs = [];
    var retrievedCount = 0;
    var storedCount = 0;
    var newMsg = false;
    var parsable = false;

    var mailboxes = [];
    var activeMailbox = {};
    
    var getReturnMessagesCallback = function(err, data){
        var cbName = entryLog(fName.replace('[', '').replace(']', '') + '.' + 'getReturnMessagesCallback');
        var resTime = new Date();
        if(err) {
            vlog(logLevels.ERROR, cbName + ' IDP API server error ' + err);
            resp.error(cbName + ' IDP API server error ' + err);
        } else {
            var successMsg = '';
            if (data.ErrorID > 0) {
                successMsg = 'IDP API error for ' + activeMailbox.accessId + ': ' + getErrorMessage(data.ErrorID);
                vlog(logLevels.ERROR, cbName + ' ' + successMsg);
            } else if (data.Messages !== null) {
                for (var i=0; i < data.Messages.length; i++) {
                    var activeMessage = data.Messages[i];
                    var mobileId = activeMessage.MobileID;
                    retrievedCount += 1;
                    newMsg = false;
                    parsable = false;
                    if (activeMessage.Payload) {
                        vlog(logLevels.DEBUG, cbName + ' JSON parsing possible on message ' + activeMessage.ID + 
                                ' from modem ' + mobileId + '(' + activeMessage.Payload.Name + ')');
                        // vlog(logLevels.DEBUG, cbName + ' Message: ' + JSON.stringify(activeMessage, null, 2));
                        parsable = true;
                    } else {
                        vlog(logLevels.DEBUG, cbName + ' only RawPayload available for message ' + activeMessage.ID + ' from modem ' + mobileId);
                    }
                    // TODO: else cases to check for supported RawPayload decoding
                    updateReturnMessages(activeMailbox.accessId, activeMessage, function (err, updateData) {
                        if (err) {
                            vlog(logLevels.ERROR, cbName + ' updateReturnMessages: ' + JSON.stringify(updateData));
                        } else {
                            vlog(logLevels.DEBUG, cbName + ' updateReturnMessages called back with updateData:' + JSON.stringify(updateData));
                            if (updateData.stored > 0) {
                                vlog(logLevels.INFO, cbName + ' updateReturnMessages stored new message ' + updateData.messageId + ' from modem ' + mobileId);
                                storedCount += updateData.stored;
                                newMsg = true;
                            }
                        }
                    });
                    if (newMsg) {
                        var mobileMeta = {
                            mobile_id: mobileId,
                            last_message: timestampRfc3339(activeMessage.MessageUTC),
                            access_id: activeMailbox.accessId,
                        };
                        updateMobileMeta(mobileMeta);
                    }
                }
                successMsg = 'Return Messages for ' + activeMailbox.accessId + ' Retrieved: ' + retrievedCount + ' | Stored: ' + storedCount;
            } else {
                successMsg = 'No messages to retrieve from ' + activeMailbox.accessId + '.';
            }
            vlog(logLevels.INFO, cbName + ' ' + successMsg);
            successMsgs.push(successMsg);
            var apiMeta = {
                accessId: activeMailbox.accessId,
                stored: storedCount,
                callTime: callTime,
                resTime: resTime,
                errorDesc: getErrorMessage(data.ErrorID),
            };
            delete data.Messages;
            updateIdpRestApiCalls('get_return_messages', apiMeta, data, function (err, result) {
                if (err) {
                    vlog(logLevels.ERROR, cbName + ' updateIdpRestApiCalls: ' + JSON.stringify(result));
                } else {
                    vlog(logLevels.TRACE, cbName + ' updateIdpRestApiCalls completed.');
                }
            });
            if (data.More) {
                vlog(logLevels.INFO, cbName + ' more messages pending retrieval.');
                getReturnMessages(activeMailbox);
                // TODO: TEST
            } else {
                vlog(logLevels.DEBUG, cbName + ' no more messages pending retrieval.');
            }
        }
    };

    var getReturnMessages = function(mailbox) {
        var auth = {access_id: mailbox.accessId, password: mailbox.password};
        var filters = {
            include_raw_payload: true,
            include_type: true
        };
        var highWaterMark = '';
        var from_id = getNextStartId(mailbox.accessId);
        if (from_id !== -1) {
            filters.from_id = from_id;
            highWaterMark = 'messageId=' + filters.from_id.toString();
            vlog(logLevels.DEBUG, fName + ' using watermark from_id=' + filters.from_id);
        } else {
            filters.start_utc = getNextStartUtc(mailbox.accessId);
            highWaterMark = filters.start_utc;
            vlog(logLevels.DEBUG, fName + ' using watermark start_utc=' + filters.start_utc);
        }
        vlog(logLevels.INFO, fName + ' getting Return messages from ' + mailbox.accessId + ' using highWaterMark ' +
                highWaterMark);
        get_return_messages(auth, filters, getReturnMessagesCallback);   // idpMessagingApi.get_return_messages
    };

    if (typeof req.params.access_id === 'undefined' || req.params.access_id === '') {
        vlog(logLevels.DEBUG, fName + ' parameter access_id not provided. Looping through Mailboxes collection.');
        mailboxes = getMailboxes();  // idpCollections.getMailboxes
        if (mailboxes.length === 0) {
            successMsg = fName + ' No mailboxes defined in System';
            vlog(logLevels.WARNING, successMsg);
            successMsgs.push(successMsg);
        }
    } else {
        vlog(logLevels.DEBUG, fName + ' using parameter access_id: ' + req.params.access_id);
        //TODO: probably a more effective/robust way to manage a user-input single mailbox retreival
        var mb = new Mailbox(req.params.access_id, req.params.password || 'password');
        mailboxes.push(mb);
    }

    for (var mb_idx=0; mb_idx < mailboxes.length; mb_idx++) {
        activeMailbox = mailboxes[mb_idx];
        getReturnMessages(activeMailbox);
    }

    resp.success(JSON.stringify(successMsgs));
}

/**
 * Sends a message to a specified terminal
 * @param {string} req.params.access_id
 */
function idpSendMessage(req, resp) {
    var fName = entryLog(arguments.callee.name, 'called with ' + JSON.stringify(req.params));
    ClearBlade.init({request:req});
    
    if (!req.params.MobileID || req.params.MobileID === '') {
        resp.error('Missing parameter MobileID');
    } else if (!(req.params.Payload || req.params.RawPayload)) {
        resp.error('Missing parameter Payload or RawPayload');
    }

    var callTime = new Date();
    var accessId = req.params.access_id || '';
    var password = req.params.password || '';
    var mobileId = req.params.MobileID;
    var metaMsg = {
        mt_submit_time: callTime,
        mt_status_id: 0,
        mt_status_timestamp: getIdpTimestamp(),
        mt_is_closed: false,
        //msg_size_ota: 0,
        //user_msg_id: 0,
        //msg_id: -1,
        mobile_id: mobileId,
        //mt_wakeup_period: 0,
        //mt_scheduled_send: ''
    };
  
    var message = {
        DestinationID: mobileId,
    };
    if (req.params.UserMessageID) {
        message.UserMessageID = req.params.UserMessageID;
    }
    var msg_sin, msg_min;
    if (req.params.Payload) {
        msg_sin = req.params.Payload.SIN;
        msg_min = req.params.Payload.MIN;
        /* Optional requestSent time calculation for Ping modem message 
        if (msg_sin === 0 && msg_min === 112) {
            var requestTime = pingTime();
            vlog(logLevels.INFO, 'Detected SIN=0 MIN=112 'ping' message, calculating requestSent time as: ' + requestTime);
            req.params.Payload.Fields[0].Value = requestTime;
        }
        */
        message.Payload = req.params.Payload;
    } else {
        msg_sin = req.params.RawPayload[0];
        msg_min = req.params.RawPayload[1];
        message.RawPayload = req.params.RawPayload;
    }
    vlog(logLevels.DEBUG, fName + ' submitting SIN='+ msg_sin + ' MIN=' + msg_min);
    
    var messages = [message];
    var storedCount = 0;
    var byteCount = 0;
          
    var submitMessagesCallback = function(err, dataJresult){
        var cbName = entryLog(fName.replace('[', '').replace(']', '') + '.' + 'submitMessagesCallback');
        // vlog(logLevels.DEBUG, '[GetModemLocation.submitMessagesCallback]: ' + JSON.stringify(dataJresult));
        var successMsg = '';
        if(err) {
            vlog(logLevels.ERROR, cbName + ' ' + JSON.stringify(dataJresult));
            resp.error(JSON.stringify(dataJresult));
        } else {
            var data = dataJresult.SubmitForwardMessages_JResult;
            if (data.ErrorID > 0) {
                errMsg = 'SubmitForwardMessages_JResult:' + getErrorMessage(data.ErrorID);
                vlog(logLevels.ERROR, cbName + ' ' + errMsg);
                resp.error(errMsg);
            } else if (data.Submissions !== null) {
                for (var i=0; i < data.Submissions.length; i++) {
                    if (data.Submissions[i].ErrorID !== 0) {
                        vlog(logLevels.ERROR, cbName + ' Forward Message Submission: ' + getErrorMessage(data.Submissions[i].ErrorID));
                    } else {
                        vlog(logLevels.DEBUG, cbName + ' processing Forward Message Submission: ' + JSON.stringify(data.Submissions[i]));
                        metaMsg.mobile_id = data.Submissions[i].DestinationID;
                        metaMsg.msg_id = data.Submissions[i].ForwardMessageID;
                        metaMsg.mt_status_timestamp = data.Submissions[i].StateUTC;
                        metaMsg.msg_size_ota = data.Submissions[i].OTAMessageSize;
                        metaMsg.mt_wakeup_seconds = data.Submissions[i].TerminalWakeupPeriod;
                        metaMsg.mt_wakeup_period = getModemWakeupPeriod(data.Submissions[i].TerminalWakeupPeriod);
                        metaMsg.mt_scheduled_send = data.Submissions[i].ScheduledSendUTC;
                        updateForwardMessages(accessId, metaMsg, messages[i], function(err, res) {
                            if (err) {
                                vlog(logLevels.ERROR, fName + ' ' + JSON.stringify(res));
                            } else {
                                storedCount += res.stored;
                                byteCount += res.bytes;
                            }
                        });
                        if (data.Submissions[i].ScheduledSendUTC !== '') {
                            notifyIdpMtScheduledMessage(metaMsg);
                        }
                        var metaMobile = {
                            mobile_id: metaMsg.mobile_id,
                            mt_wakeup_period: metaMsg.mt_wakeup_period,
                            mt_wakeup_seconds: metaMsg.mt_wakeup_seconds,
                            //wakeup_offset: getWakeupOffsetSeconds(getModemWakeupSeconds(data.Submissions[i].TerminalWakeupPeriod), data.Submissions[i].ScheduledSendUTC),
                        } 
                        updateMobileMeta(metaMobile);
                        // TODO: notify on delivery
                    }
                }
                //TODO: scale this for generic message submissions
                successMsg = 'Message '+ metaMsg.msg_id + ' (SIN=' + msg_sin + ' MIN=' + msg_min + ') sent to ' + mobileId;
            }
            
            var metaApi = {
                accessId: accessId,
                stored: storedCount,
                //bytes: byteCount,
                errorDesc: getErrorMessage(data.ErrorID),
                callTime: callTime
            };
            updateIdpRestApiCalls('submit_messages', metaApi, data, function(err, result) {
                if (err) { 
                    vlog(logLevels.ERROR, cbName + ' updateRestApiCallsCallback: ' + JSON.stringify(result));
                    resp.error(JSON.stringify(result));
                }
            });
        }
        // TODO: start timer to check forward message status until complete
        if (successMsg !== '') {
            vlog(logLevels.DEBUG, cbName + ' ' + successMsg);
            resp.success(successMsg);
        }
    };
  
    if (accessId === '') {
        vlog(logLevels.DEBUG, fName + ' Mailbox access_id not provided - attempting to retrieve from Mobiles collection.');
        var qMobiles = ClearBlade.Query({collectionName:COL_IDP_MOBILES});
        qMobiles.equalTo('mobile_id', mobileId);
        qMobiles.fetch(function(err, qResult) {
            var errMsg = '';
            if (err) {
                vlog(logLevels.ERROR, fName + ' qMobiles.fetch: ' + JSON.stringify(qResult));
                resp.error(JSON.stringify(qResult));
            } else if (qResult.DATA.length > 0) {
                accessId = qResult.DATA[0].access_id;
                vlog(logLevels.DEBUG, fName + ' found mailbox ' + accessId + ' in Mobiles collection');
                var qMailboxes = ClearBlade.Query({collectionName:COL_IDP_MAILBOXES});
                qMailboxes.equalTo('access_id', accessId);
                qMailboxes.fetch(function(err, qResult2) {
                    if (err) {
                        vlog(logLevels.ERROR, fName + ' qMailboxes.fetch: ' + JSON.stringify(qResult2));
                        resp.error(JSON.stringify(qResult2));
                    } else if (qResult2.DATA.length > 0) {
                        password = qResult2.DATA[0].password;
                    } else {
                        errMsg = 'Mailbox ' + accessId + ' not found in Mailboxes collection';
                    }
                });
            } else {
                errMsg = 'Mobile ID ' + mobileId + ' not found in Mobiles collection.';
            }
            if (errMsg !== '') {
                vlog(logLevels.ERROR, fName + ' ' + errMsg);
                resp.error(errMsg);
            }
        });
    }
    var auth = {access_id: accessId, password: password};
    submit_messages(auth, messages, submitMessagesCallback);
}

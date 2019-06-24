const COLLECTIONS_LIBRARY_NAME = 'idpCollections';

/**
 * @typedef Mailbox
 * @property {string} accessId
 * @property {string} password
 */
/**
 * Returns a list of Mailbox objects
 * @param {string} accessId Optional single mailbox ID
 * @returns {Mailbox[]} mailboxes A list of Mailbox objects
 */
function getMailboxes(accessId) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name);
    const collName = COL_IDP_MAILBOXES;
    var mailboxes = [];
    var qMailboxes = ClearBlade.Query({collectionName:collName});
    if (accessId) {
        qMailboxes.equalTo('access_id', accessId);
    }
    qMailboxes.fetch(function(err, qResult) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' Mailboxes Query error: ' + JSON.stringify(qResult));
        } else if (qResult.DATA.length > 0) {
            for (var i=0; i < qResult.DATA.length; i++) {
                var mb = new Mailbox(qResult.DATA[i].access_id, qResult.DATA[i].password);
                vlog(logLevels.DEBUG, fName + ' ' + mb.accessId + ' added to mailboxes list');
                mailboxes.push(mb);
            }
            vlog(logLevels.DEBUG, fName + ' returning ' + Object.size(mailboxes) + ' sets of credentials');
        } else {
            vlog(logLevels.WARNING, fName + ' collection ' + collName + ' empty - returning empty list');
        }
    });
    return mailboxes;
}

/**
 * Returns the next startId of a given Mailbox
 * @param {string} access_id the unique identifier of the Mailbox
 * @returns {number} next_start_id
 */
function getNextStartId (accessId) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'for ' + accessId);
    const collName = COL_API_CALLS;
    var next_start_id = -1;
    var qNextId = ClearBlade.Query({collectionName:collName});
    qNextId.equalTo('api_operation', 'get_return_messages');
    qNextId.equalTo('access_id', accessId);
    qNextId.notEqualTo('next_start_id', -1);
    qNextId.descending('call_time');
    qNextId.fetch(function(err, result) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' ' + collName + ' query error: ' + JSON.stringify(result));
        } else if (result.DATA.length > 0) {
            next_start_id = result.DATA[0].next_start_id;
            vlog(logLevels.DEBUG, fName + ' found next_start_id = ' + next_start_id + ' from API call id ' + result.DATA[0].item_id + ' (' + result.DATA[0].call_time + ')');
        } else {
            vlog(logLevels.DEBUG, fName + ' no valid next_start_id found in Collection ' + collName + '. Returning ' + next_start_id);
        }
    });
    return next_start_id;
}

/**
 * Returns the next_start_utc to be passed into get_return_messages
 * @param {string} access_id the unique identifier of the Mailbox
 * @returns {string} IDP timestamp reference for next API call with format 'YYYY-MM-DD hh:mm:ss'
 */
function getNextStartUtc (accessId) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'for ' + accessId);
    const collName = COL_API_CALLS;
    var next_start_utc = '';
    var qNextUtc = ClearBlade.Query({collectionName:collName});
    qNextUtc.equalTo('api_operation', 'get_return_messages');
    qNextUtc.equalTo('access_id', accessId);
    qNextUtc.notEqualTo('next_start_utc', '');
    qNextUtc.descending('call_time');
    qNextUtc.fetch(function(err, result) {
        // vlog(logLevels.DEBUG, fName + ' fetch returned: ' + JSON.stringify(result));
        if (err) {
            vlog(logLevels.ERROR, fName + ' ' + collName + ' query error: ' + JSON.stringify(result));
        } else if(result.DATA.length > 0) {
            next_start_utc = result.DATA[0].next_start_utc;
            vlog(logLevels.DEBUG, fName + ' found next_start_utc=' + next_start_utc + ' from API call id ' + result.DATA[0].item_id + ' (' + result.DATA[0].call_time + ')');
        } else {
            next_start_utc = getIdpTimestamp({midnight: true});
            vlog(logLevels.WARNING, fName + ' no valid next_start_utc found in collection ' + collName + '. Using ' + next_start_utc);
        }
    });
    return next_start_utc;
}
    
/**
 * @callback updateReturnMessagesCallback
 * @param {Boolean} error
 * @param {Object} result
 * @param {string} result.accessId
 * @param {number} result.messageId
 * @param {number} result.stored
 * @param {number} result.bytes
 */
/**
 * Updates the IdpRawMessages Collection with a new return message, and calls back with a result
 * @param {string} access_id
 * @param {Object} message
 * @param {updateReturnMessagesCallback} callback
 */
function updateReturnMessages(accessId, message, callback) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'called with:' + JSON.stringify(message));
    const collName = COL_IDP_MO_MESSAGES;
    var error = false;
    var result = {stored:0, bytes:0};
    var collection = ClearBlade.Collection({collectionName: collName});
    const Buffer = BufferNodeJs().Buffer;
    
    var newRow = {
        'timestamp': timestampRfc3339(message.ReceiveUTC),
        'msg_id': message.ID,
        'mobile_id': message.MobileID,
        'mo_msg': true,
        'msg_sin': message.SIN,
        'msg_min': (typeof message.Payload !== 'undefined') ? message.Payload.MIN:message.RawPayload[0],  // handle null case?
        'msg_payload_raw': (typeof message.RawPayload !== 'undefined') ? Buffer.from(message.RawPayload).toString('base64') : null,
        'msg_payload_json': (typeof message.Payload !== 'undefined') ? JSON.stringify(message.Payload) : '',
        'msg_size_ota': message.OTAMessageSize,
        'access_id': accessId
    };

    var qNewMsg = ClearBlade.Query({collectionName: collName});
    qNewMsg.equalTo('msg_id', newRow.msg_id);
    qNewMsg.equalTo('mobile_id', newRow.mobile_id);
    qNewMsg.equalTo('timestamp', newRow.timestamp);
    qNewMsg.fetch(function(err, qResult){
        if (err){
            error = err;
            vlog(logLevels.ERROR, fName + ' fetch error: ' + JSON.stringify(qResult));
        } else {
            if (qResult.DATA.length === 0) {    // no matching entry in collection
                collection.create(newRow, function(err, cResult) {
                    if (err) {
                        error = err;
                        result = cResult;
                        vlog(logLevels.ERROR, fName + ' collection.create error: ' + JSON.stringify(cResult));
                        throw new Error(fName + ' collection.create error: ' +JSON.stringify(cResult));
                    } else {
                        result = { stored: 1, bytes: message.OTAMessageSize };
                        vlog(logLevels.DEBUG, fName + ' stored message ID ' + message.ID);
                    }
                });
            } else {
                vlog(logLevels.INFO, fName + ' duplicate message retrieved, ' + message.ID + ' already in collection.  Update skipped.');
            }
        }
    });
    callback(error, result);
}

/**
 * @typedef Message
 * @property {number} SIN - Service Identification Number
 * @property {number} MIN - Message Identification Number
 * @property {string} Name - the name of the message
 * @property {boolean} IsForward - indicates if the message is Mobile-Terminated aka Forward
 * @property {Object[]} Fields - a list of field objects
 * @property {}
 */
/**
 * @typedef ForwardMessage
 * @property {string} DestinationID
 * @property {string} UserMessageID
 * @property [{number}] RawPayload
 * @property {Message} Message
 */
/**
 * @callback updateForwardMessagesCallback
 * @param {boolean} error
 * @param {Object} result
 * @param {number} result.stored
 * @param {number} result.bytes
 */
/**
 * Updates the IdpRawMessages Collection with a new forward message, and calls back with a result
 * @param {string} accessId - username credential of the mailbox used to send the message
 * @param {Object} meta - metadata associated with the message
 * @param {string} meta.mt_submit_time - the time the message was submitted to the Inmarsat network
 * @param {number} meta.mt_status_id - the status ID (state) of the message
 * @param {string} meta.mt_status_timestamp - the timestamp of the status ID
 * @param {boolean} meta.mt_is_closed - whether the message has been closed
 * @param {number} meta.msg_size_ota - size of the message in bytes sent over-the-air
 * @param {string} meta.user_msg_id - the (optional) user message ID submitted
 * @param {number} meta.msg_id - a unique message ID assigned by the Inmarsat network
 * @param {string} meta.mobile_id - the destination address of the message
 * @param {number} meta.wakeup_period - the (optional) wakeup period indicated by the Inmarsat network
 * @param {string} meta.scheduled_send - if wakeup_period is nonzero, the scheduled time of delivery
 * @param {ForwardMessage} message - the Mobile-Terminated (aka Forward) message object
 * @param {updateForwardMessagesCallback} callback
*/
function updateForwardMessages(accessId, meta, message, callback) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'meta:' + JSON.stringify(meta) + 'with data:' + JSON.stringify(message));
    const collName = COL_IDP_MT_MESSAGES;
    var error = false;
    var result = {stored: 0, bytes: 0};
    var collection = ClearBlade.Collection({collectionName: collName});
    const Buffer = BufferNodeJs().Buffer;

    var newRow = {
        'timestamp': meta.mt_submit_time,
        'msg_id': meta.msg_id,
        'mobile_id': message.DestinationID,
        'mo_msg': false,
        'msg_sin': (typeof message.Payload !== 'undefined') ? message.Payload.SIN : message.RawPayload[0],
        'msg_min': (typeof message.Payload !== 'undefined') ? message.Payload.MIN : message.RawPayload[1],
        'msg_size_ota': meta.msg_size_ota,
        'user_msg_id': message.UserMessageID,
        'mt_status_id': meta.mt_status_id,
        'mt_status_desc': getForwardStatus(meta.mt_status_id),
        'mt_status_timestamp': timestampRfc3339(meta.mt_status_timestamp),
        'mt_is_closed': meta.mt_is_closed,
        'mt_wakeup_period': meta.mt_wakeup_period.toString(),
        'mt_wakeup_seconds': meta.mt_wakeup_seconds,
        'mt_scheduled_send': timestampRfc3339(meta.mt_scheduled_send),
        'msg_payload_raw': (typeof message.RawPayload !== 'undefined') ? Buffer.from(message.RawPayload).toString('base64') : null,
        'msg_payload_json': (typeof message.Payload !== 'undefined') ? JSON.stringify(message.Payload) : '',
        'access_id': accessId
    };
    
    var qNewMsg = ClearBlade.Query({collectionName: collName});
    qNewMsg.equalTo('msg_id', newRow.msg_id);
    qNewMsg.equalTo('mobile_id', newRow.mobile_id);
    qNewMsg.equalTo('timestamp', newRow.timestamp);
    qNewMsg.fetch(function(err, qResult){
        if (err){
            error = err;
            vlog(logLevels.ERROR, fName + ' ' + JSON.stringify(qResult));
        } else {
            if (qResult.DATA.length === 0) {    // no matching entry in collection
                vlog(logLevels.TRACE, fName + ' creating new row with:' + JSON.stringify(newRow));
                collection.create(newRow, function(err, cResult) {
                    if (err) {
                        error = err;
                        result = cResult;
                        vlog(logLevels.ERROR, fName + ' createItem: ' + JSON.stringify(cResult));
                        throw new Error(fName + ' collection.create error: ' +JSON.stringify(qResult));
                    } else {
                        result = {stored: 1, bytes: newRow.msg_size_ota};
                        vlog(logLevels.INFO, fName + ' stored Forward message ID ' + meta.msg_id);
                    }
                });
            } else {
                vlog(logLevels.WARNING, fName + ' duplicate forward message found in collection - update skipped for msg_id ' + newRow.msg_id);
            }
        }
    });
    callback(error, result);
}

/**
 * Gets a list of pending Mobile-Terminated (Forward) messages for a given mailbox
 * @param {string} accessId - the mailbox ID
 * @returns {string} comma-separated list of pending (non-closed) forward message IDs
 */
function getPendingStatuses(accessId) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'for mailbox: ' + accessId);
    const collName = COL_IDP_MT_STATUSES;
    var pendingStatuses = false;
    var fwIds = '';
    var qPendingMsg = ClearBlade.Query({collectionName:collName});
    qPendingMsg.equalTo('mo_msg', false);
    qPendingMsg.equalTo('mt_status_id', 0);
    qPendingMsg.equalTo('access_id', accessId);
    qPendingMsg.fetch(function(err, qResult) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' qPendingMsg.fetch: ' + JSON.stringify(qResult));
        } else if (qResult.DATA.length > 0) {
            pendingStatuses = true;
            for (var i=0; i < qResult.DATA.length; i++) {
                // log('Entry: ' + JSON.stringify(qResult.DATA[i]));
                if (i > 0) {
                    fwIds += ','; 
                }
                fwIds += String(qResult.DATA[i].msg_id);
            }
            vlog(logLevels.INFO, fName + ' found pending message statuses for mailbox ' + accessId + ': ' + fwIds);
        } else {
            vlog(logLevels.INFO, fName + ' no pending MT/Forward messages found for mailbox ' + accessId);
        }
    });
    return fwIds
}

/**
 * @callback updateForwardStatusCallback
 * @param {boolean} err
 * @param {Object} result
 * @param {boolean} result.updated
 * @param {string} result.status
 */
/**
 * Updates the Raw Message Collection with latest status
 * @param {Object} meta
 * @param {updateForwardStatusCallback} callback
 */
function updateForwardStatus(meta, callback) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with meta:' + JSON.stringify(meta));
    const collName = COL_IDP_MT_MESSAGES;
    var collection = ClearBlade.Collection({collectionName: collName});
    var updated = false;
    var status = '';
    var error = false;
    
    var updateRow = function(item_id) {
        var qMsgRow = ClearBlade.Query({collectionName: collName});
        qMsgRow.equalTo('item_id', item_id);
        qMsgRow.update(meta, function(err, qResult) {
            if (err) {
                error, result = err, JSON.stringify(qResult);
                vlog(logLevels.ERROR, fName + ' updateRow: ' + result);
            } else {
                vlog(logLevels.DEBUG, fName + ' updated status of MT message ' + meta.msg_id + ':' + getForwardStatus(meta.mt_status_id));
                updated = true;
            }
        });
    };
    
    var qNewStatus = ClearBlade.Query({collectionName: collName});
    qNewStatus.equalTo('msg_id', meta.msg_id);
    qNewStatus.equalTo('mo_msg', false);
    qNewStatus.fetch(function(err, qResult){
        if (err){
            error, result = err, JSON.stringify(qResult);
            vlog(logLevels.ERROR, fName + ' qNewStatus.fetch: ' + result);
        } else {
            if (qResult.DATA.length === 0) {    // no matching entry in collection
                vlog(logLevels.WARNING, fName + ' Forward message not found in collection ' + collName);
            } else {
                if (qResult.DATA[0].mt_status_id !== meta.mt_status_id) {
                    vlog(logLevels.INFO, fName + ' status change for ' + meta.msg_id + ' old=' + qResult.DATA[0].mt_status_id + ' new=' + meta.mt_status_id);
                    updateRow(qResult.DATA[0].item_id);
                } else {
                    vlog(logLevels.DEBUG, fName + ' no status change for message ' + meta.msg_id + '(' + meta.mt_status_desc + ')');
                }
                status = meta.mt_status_desc;
            }
        }
    });
    if (!error) {
        var result = {
            'updated': updated,
            'status': status
        };
    }
    callback(error, result);
}

/**
 * The callback for updateIdpRestApiCalls
 * @callback updateIdpRestApiCallsCallback
 * @param {boolean} error - flag for failure
 * @param {string} result - the Collection update result
 */
/**
 * Updates the IdpRestApiCalls Collection for high watermark and troubleshooting purposes
 * @param {string} op - the REST API operation as specified in the Inmarsat Messaging API
 * @param {Object} meta - metadata associated with the operation
 * @param {number} meta.stored - the number of messages stored as a result of the operation
 * @param {number} meta.bytes - the number of bytes represented by the stored messages
 * @param {string} meta.accessId - the Mailbox identifier
 * @param {string} meta.callTime - the time of the API call origination
 * @param {string} meta.resTime - the time of the API call response
 * @param {string} meta.errorDesc The API error description
 * @param {Object} data - the data returned by the API response to the operation
 * @param {string} data.ErrorID
 * @param {boolean} data.More
 * @param {string} data.NextStartUTC Present for get_return_messages API call
 * @param {string} data.NextStartID Present for get_return_messages API call
 * @param {callback} callback - to be passed the result of the operation
 */
function updateIdpRestApiCalls(op, meta, data, callback) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with meta:' + JSON.stringify(meta) + ' data:' + JSON.stringify(data));
    const collName = COL_API_CALLS;
    var collection = ClearBlade.Collection({collectionName: collName});
    var error = false;
    var result = null;
    var newRow = {
        'call_time': meta.callTime,
        'api_operation': op,
        'success': (data.ErrorID === 0),
        'error_id': data.ErrorID,
        'error_desc': meta.errorDesc,
        'more_messages': data.More,
        'messages_count': meta.stored,
        'next_start_utc': data.NextStartUTC,
        'next_start_id': data.NextStartID,
        'access_id': meta.accessId,
    };
    vlog(logLevels.DEBUG, fName + ' updating ' + collName + ' with:' + JSON.stringify(newRow));
    collection.create(newRow, function(err, cData) {
        //error, result = err, JSON.stringify(cData);
        if(err){
            vlog(logLevels.ERROR, fName + ' ' + JSON.stringify(cData));
        } else {
            vlog(logLevels.DEBUG, fName + ' API call collection item added: ' + JSON.stringify(cData));
        }
        callback(err, cData);
    });
}

/**
 * Updates device metadata.  Metadata must include unique mobile_id.  Typical metadata include timestamp of the last message received, wakeup interval.
 * @param {object} meta Mobile/device metadata
 * @param {string} meta.mobile_id The unique Mobile ID with format nnnnnnnnMMMcccc
 */
function updateMobileMeta(meta) {
    const fName = entryLog(COLLECTIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with meta ' + JSON.stringify(meta));
    const mobileCollName = COL_IDP_MOBILES;
    var qUpdate = ClearBlade.Query({collectionName: mobileCollName});
    qUpdate.equalTo('mobile_id', meta.mobile_id);
    qUpdate.fetch(function(err, qProvisioned){
        if (err) {
            vlog(logLevels.ERROR, fName + ' qProvisioned query error:' + JSON.stringify(qProvisioned));
        } else if (qProvisioned.DATA.length === 0) {
            vlog(logLevels.INFO, fName + ' ' + meta.mobile_id + ' not found in ' + mobileCollName + ' - adding');
            var mobileCol = ClearBlade.Collection({collectionName: mobileCollName});
            var mobile = { mobile_id: meta.mobile_id };
            if (meta.access_id) {
                mobile.access_id = meta.access_id;
            }
            mobileCol.create(mobile, function(err, cRes){
                if (err) {
                    vlog(logLevels.ERROR, fName + ' ' + JSON.stringify(cRes));
                } else {
                    vlog(logLevels.DEBUG, fName + ' added Mobile ' + meta.mobile_id + ' to ' + mobileCollName);
                }
            });
        }
    });
    qUpdate.update(meta, function(err, res) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' Collection update failed for ' + mobileCollName + ': ' + JSON.stringify(res));
        } else {
            vlog(logLevels.DEBUG, fName + ' updated Collection ' + mobileCollName + ' metadata for ' + meta.mobile_id);
        }
    });
    
}

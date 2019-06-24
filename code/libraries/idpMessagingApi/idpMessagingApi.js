const IDP_API_LIBRARY_NAME = 'idpMessagingApi';

/** Implements Inmarsat's IDP Messaging API (version 1) including various helper functions */

/**
 * @typedef IdpAuth
 * @property {string} access_id - unique username for the mailbox assigned by Inmarsat
 * @property {string} password
 */

/**
 * Returns a URI with relevant filters
 * @param {string} baseURI - API operation being requested request base
 * @param {IdpAuth} auth - the authentication parameters
 * @param {Object} filters - relevant filters dependent upon the API operation
*/
function getURI(baseURI, auth, filters) {
    var URI = API_URL + baseURI + '?access_id=' + auth.access_id + '&password=' + auth.password;
    for (var f in filters) {
        if (filters.hasOwnProperty(f)) {
            URI += '&' + f + '=' + String(filters[f]);
        }
    }
    URI = URI.replace(/ /g,'%20').trim();
    return URI;
}

/**
 * Obfuscates the password for debug messages including URI
 * @param {string} debugMessage
 */
function obfusctatePassword(debugMessage) {
    if (debugMessage.indexOf('"uri"') !== -1) {
        var obsPass = '***';
        var messageComponents = debugMessage.split('&');
        var replaceMessage = messageComponents[0];
        for (var c=1; c < messageComponents.length; c++) {
            if (messageComponents[c].split('=')[0] === 'password') {
                messageComponents[c] = 'password=' + obsPass;
            }
            replaceMessage += '&' + messageComponents[c];
        }
        return replaceMessage;
    } else {
        return debugMessage;
    }
}

/**
 * @callback httpGetCallback
 * @param {boolean} error
 * @param {Object} result - JSON object with relevant data
 */
/**
 * Performs a GET operation and calls back with result
 * @param {string} URI passed to HTTP GET
 * @param {method} callback function set to receive (err, JSON.parse(data))
*/
function httpGet(URI, callback) {
    var fName = entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    var reqObject = Requests();
    var options = {
        uri: URI,
        strictSSL: false,
        headers: {
            'Accept': 'application/json'
        }
    };
    vlog(logLevels.TRACE, fName + ' sending HTTP GET: ' + obfusctatePassword(JSON.stringify(options)));
    reqObject.get(options, function(err, data) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' unable to HTTP GET: ' + err);
            if (isApiAlive) {
                isApiAlive = false;
                notifyApiError(err);
            }
        } else {
            if (!isApiAlive) {
                isApiAlive = true;
                notifyApiError(err);
            }
            vlog(logLevels.DEBUG, fName + ' HTTP GET valid response received');
            //vlog(logLevels.TRACE, fName + ' HTTP GET response: ' + JSON.stringify(data, null, 2));
        }
        callback(err, JSON.parse(data));
    });
}

/**
 * @callback httpPostCallback
 * @param {boolean} error
 * @param {Object} result - JSON object with relevant data
 */
/**
 * Performs a POST operation and calls back with the result
 * @param {string} URI passed to HTTP POST
 * @param {object} body JSON object
 * @param {method} callback function set to receive (err, JSON.parse(data))
*/
function httpPost(URI, body, callback) {
    var fName = entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    var reqObject = Requests();
    var options = {
        uri: URI,
        strictSSL: false,
        headers: {
            'Content-Type': 'application/json'
        },
        body: body
    };
    vlog(logLevels.TRACE, fName + ' sending HTTP POST: ' + obfusctatePassword(JSON.stringify(options)));
    reqObject.post(options, function(err, data) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' unable to HTTP POST: ' + JSON.stringify(data));
        } else {
            vlog(logLevels.TRACE, fName + ' valid HTTP POST data received');
            // vlog(logLevels.TRACE, fName + ' data from HTTP POST: ' + JSON.stringify(data));
        }
        callback(err, JSON.parse(data));
    });
}

/**
 * @callback infoUtcTimeCallback
 * @param {string} utcTime - formatted as YYYY-MM-DD hh:mm:ss
 */
/**
 * Calls back with the IDP network time (UTC)
 * @param {infoUtcTimeCallback} callback
*/
function info_utc_time(callback) {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    httpGet(API_URL + 'info_utc_time.json/', callback);
}

/**
 * @callback infoErrorsCallback
 * @param {Object[]} errors
 * @param {string} errors[].ID
 * @param {string} errors[].Name
 * @param {string} errors[].Description
 */
/**
 * Calls back with a list of errors
 * @param {infoErrorsCallback} callback - set to receive (err, info_errors)
*/
function info_errors(callback) {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    httpGet(API_URL + 'info_errors.json/', callback);
}

/**
 * @callback infoVersionCallback
 * @param {string} version
 */
/**
 * Calls back with the API version
 * @param {infoVersionCallback} callback
*/
function info_version(callback) {
    httpGet(API_URL + 'info_version.json/', callback);
}

/**
 * Gets the name of the error from the API (TODO: seems inefficient to call this every time - can a cache be created?)
 * @param {number} errorId returned by the messaging API
 * @returns {string} name of the error
*/
function getErrorMessage(errorId) {
    var fName = entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + errorId);
    var errorName = '';
    info_errors(function(err, data) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' ' + JSON.stringify(data));
        } else {
            for (var i = 0; i < data.length; i++) {
                if (data[i].ID == errorId) {
                    errorName = data[i].Name;
                    vlog(logLevels.TRACE, fName + ' IDP API ErrorID ' + errorId + ' Name=' + errorName);
                }
            }
            if (errorName === '') {
                vlog(logLevels.WARNING, fName + ' Error ID not found in info_errors');
            }
        }
    });
    // TODO: This approach is probably bad practice, seems to put a sync call inside async but seems to work
    return errorName;
}

/**
 * Returns the API version
 * @returns {string} version
 */
function getApiVersion() {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    var version = '';
    info_version(function(err, data) {
        if (err) {
            vlog(logLevels.ERROR, 'info_version: ' + JSON.stringify(data));
        } else {
            version = data
        }
    });
    return version;
}

/**
 * Returns the current IDP network time
 * @returns {string} time - formatted as YYYY-MM-DD hh:mm:ss
 */
function getGatewayTime() {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    var gwTime = '';
    var timeCallback = function(err, data) {
        if (err) {
            vlog(logLevels.ERROR, 'info_version: ' + JSON.stringify(data));
        } else {
            gwTime = data
        }
    }
    info_utc_time(timeCallback);
    return gwTime;
}

/**
 * Returns the human-readable status of a Forward message
 * @param {number} value - returned by the get_forward_statuses API operation
 * @returns {string} description of the forward message state
*/
function getForwardStatus(value) {
    entryLog('idpMessagingApi' + '.' + arguments.callee.name, 'with value=' + value);
    // status = ''
    switch (value) {
        case 0:
            return 'SUBMITTED';
        case 1:
            return 'RECEIVED';
        case 2:
            return 'ERROR';
        case 3:
            return 'FAILED';
        case 4:
            return 'TIMEOUT';
        case 5:
            return 'CANCELLED';
        default:
            return 'ERROR: Undefined Forward Message state value (' + String(value) + ')';
    }
}

/**
 * @typedef MessageField
 * @property {string} Name
 * @property {string} Type - enum, boolean, unsignedint, signedint, string, data, array, message, dynamic, property
 * @property {variant} Value - dependent on Type (enum={string}, boolean={boolean}, *int={number}, string={string}, data={Array})
 * @property {Object[]} Elements - present if Type is array or message
 * @property {number} Elements.Index
 * @property {MessageField[]} Elements.Fields
 */

/**
 * @typedef Message
 * @property {boolean} IsForward
 * @property {number} SIN
 * @property {number} MIN
 * @property {string} Name
 * @property {MessageField[]} Fields
 */

/**
 * @typedef ReturnMessage
 * @property {number} ID
 * @property {string} ReceiveUTC
 * @property {string} RegionName
 * @property {number} OTAMessageSize
 * @property {string} MessageUTC
 * @property {string} MobileID
 * @property {number} SIN
 * @property {number[]} RawPayload
 * @property {Message} Payload
 */
/**
 * @callback getReturnMessagesCallback
 * @param {number} ErrorID
 * @param {boolean} More
 * @param {string} NextStartUTC
 * @param {number} NextStartID
 * @param {ReturnMessage[]} Messages
 */
/**
 * @typedef ReturnMessageFilter
 * @property {string} start_utc - UTC timestamp idp format 'YYYY-MM-DD hh:mm:ss' required if from_id is not present
 * @property {number} from_id - unique (Return) message number assigned by the IDP network; required if start_utc is not present
 * @property {string} end_utc - (optional) UTC timestamp
 * @property {string} mobile_id - unique Inmarsat serial number
 * @property {boolean} include_raw_payload - flag to include a byte array response
 * @property {boolean} include_type - flag to include data type, if a Message Definition File is used
 */
/**
 * Executes the get_return_messages API operation and calls back with a result
 * @param {IdpAuth} auth Authentication parameters
 * @param {ReturnMessageFilter} filters
 * @param {getReturnMessagesCallback} callback
*/
function get_return_messages(auth, filters, callback) {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    httpGet(getURI('get_return_messages.json/', auth, filters), callback);
}

/**
 * @typedef ForwardMessage
 * @property {string} DestinationID
 * @property {string} UserMessageID
 * @property {number[]} RawPayload
 * @property {Message} Payload
 */
/**
 * @typedef ForwardSubmission
 * @property {number} ErrorID
 * @property {number} ForwardMessageID
 * @property {string} UserMessageID
 * @property {string} DestinationID
 * @property {number} OTAMessageSize
 * @property {string} StateUTC
 * @property {number} TerminalWakeupPeriod
 * @property {string} ScheduledSendUTC
 */
/**
 * @typedef SubmitForwardMessages_JResult
 * @property {number} ErrorID
 * @property {ForwardSubmission[]} Submissions
 */
/**
 * @callback submitMessagesCallback
 * @param {boolean} error
 * @param {SubmitForwardMessages_JResult} result
 */
/**
 * Executes the submit_messages API operation and calls back with a result
 * @param {IdpAuth} auth Authentication parameters
 * @param {ForwardMessage[]} messages
 * @param {submitMessagesCallback} callback
*/
function submit_messages(auth, messages, callback) {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    var URI = 'submit_messages.json/';
    var body = {
        accessID: auth.access_id,
        password: auth.password,
        messages: messages
    };
    httpPost(API_URL + URI, body, callback);
}

/**
 * @typedef ForwardStatus
 * @property {number} ErrorID
 * @property {number} ForwardMessageID
 * @property {boolean} IsClosed
 * @property {number} ReferenceNumber
 * @property {string} StateUTC
 * @property {number} State
 */
/**
 * @typedef GetForwardStatusesResult
 * @property {number} ErrorID
 * @property {boolean} More
 * @property {string} NextStartUTC
 * @property {ForwardStatus[]} Statuses
 */
/**
 * @typedef ForwardStatusFilter
 * @property {string} fwIDs - a list of comma-separated numbers
 * @property {string} start_utc
 * @property {string} end_utc
 */
/**
 * @callback getForwardStatusesCallback
 * @param {boolean} error
 * @param {GetForwardStatusesResult} result
 */
/**
 * Executes the get_forward_statuses API operation and calls back with a result
 * @param {IdpAuth} auth Authentication parameters
 * @param {ForwardStatusFilter} filters
 * @param {getForwardStatusesCallback} callback
*/
function get_forward_statuses(auth, filters, callback) {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    httpGet(getURI('get_forward_statuses.json/', auth, filters), callback);
}

/**
 * @typedef ForwardMessageFilters
 * @property {string} fwIDs - a list of comma-separated numbers
 */

/**
 * @callback submitCancelationsCallback
 * @param {boolean} error
 * @param {Object} result
 */
/**
 * Executes the submit_cancelations API operation and calls back with a result
 * @param {IdpAuth} auth Authentication parameters
 * @param {ForwardMessageFilters} filters
 * @param {submitCancelationsCallback} callback
 */
function submit_cancelations(auth, filters, callback) {
    //
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    httpGet(getURI('submit_cancelations.json/', auth, filters), callback);
}

/**
 * @typedef ForwardMessageRecord
 * @property {number} ErrorID
 * @property {number} ID
 * @property {string} CreateUTC
 * @property {string} DestinationID
 * @property {number} ReferenceNumber
 * @property {boolean} IsClosed
 * @property {string} StatusUTC
 * @property {number} State
 * @property {number[]} RawPayload
 * @property {Message} Payload
 */
/**
 * @typedef GetForwardMessagesResult
 * @property {number} ErrorID
 * @property {ForwardMessageRecord[]} Messages
 */
/**
 * @callback getForwardMessagesCallback
 * @property {boolean} error
 * @property {GetForwardMessagesResult} result
 */
/**
 * Executes the get_forward_messages API operation and calls back with a result
 * @param {IdpAuth} auth Authentication parameters
 * @param {ForwardMessageFilters} filters
 * @param {getForwardMessagesCallback} callback
*/
function get_forward_messages(auth, filters, callback) {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    httpGet(getURI('get_forward_messages.json/', auth, filters), callback);
}

/**
 * @typedef Mobile
 * @property {string} ID Unique mobile ID
 * @property {string} Description Provisioned description of the terminal
 * @property {string} LastRegistrationUTC The last time the terminal registered on the network
 * @property {string} Region The regional beam the terminal registered on
 */
/**
 * @typedef GetMobilesPagedResult
 * @property {number} ErrorID
 * @property {Mobile[]} Mobiles
 */
/**
 * @callback getMobilesPagedCallback
 * @property {boolean} error
 * @property {GetMobilesPagedResult} result
 */
/**
 * @typedef MobileFilters
 * @property {string} since_mobile Optional starting serial number
 * @property {number} page_size Page size in range [1..1000]
 */
/**
 * Executes the get_forward_messages API operation and calls back with a result
 * @param {IdpAuth} auth Authentication parameters
 * @param {MobileFilters} filters Parameters for the operation
 * @param {getMobilesPagedCallback} callback
*/
function get_mobiles_paged(auth, filters, callback) {
    entryLog(IDP_API_LIBRARY_NAME + '.' + arguments.callee.name);
    httpGet(getURI('get_mobiles_paged.json/', auth, filters), callback);
}

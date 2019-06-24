const GLOBALS_LIBRARY_NAME = 'idpGlobals';

// Set if Inmarsat API is returning valid responses
var isApiAlive = true;

// Custom logging extension with severity levels and multi-line support ---------------------------------------------
/**
 * Sets a logging level for the system, used in custom logs.  Declared as var due to Object restrictions.
 * @typedef {(number|string)} an indexed priority level for logging
 */
var logLevels = {
    TRACE: {value: 0, name: 'TRACE'},
    DEBUG: {value: 1, name: 'DEBUG'},
    INFO: {value: 2, name: 'INFO'},
    WARNING: {value: 3, name: 'WARNING'},
    ERROR: {value: 4, name: 'ERROR'},
    CRITICAL: {value: 5, name: 'CRITICAL'}
};
Object.freeze(logLevels);

// default logging level (DEBUG during dev/test)
const LOG_LEVEL = logLevels.INFO;

// TODO: set up SystemConstants following best practices
// ***** CONSTANTS FOR IDP NETWORK SHARED BY CODE SERVICES ETC. ***** -------------------------------------------------
const API_URL = 'https://api.inmarsat.com/v1/idp/gateway/rest/';
// Mocky API test responses
//const API_URL = 'https://www.mocky.io/v2/5ce80e45350000ba40cf63a8';   // HTTP 500/504
// ORBCOMM Modem+Network Simulator API
const SIMULATOR_ADDRESS = 'localhost:8080';   //May be set up as an externally routable IP address if your firewall is appropriately configured
//const API_URL = SIMULATOR_ADDRESS + '/GLGW/GWServices_v1/RestMessages.svc/';

// Collection size for IDP network API call history
const MAX_API_RECORDS = Math.round(86400 / 30 * 3 * 1.2);   // 86400 sec/day, 30 sec polls, 3 days, 20% buffer

// Collection names referenced by functions
const COL_API_CALLS = 'idp_rest_api_calls';
const COL_IDP_MO_MESSAGES = 'idp_raw_messages';
const COL_IDP_MT_MESSAGES = 'idp_raw_messages';
const COL_IDP_MT_STATUSES = 'idp_raw_messages';
const COL_IDP_MAILBOXES = 'idp_mailboxes';
const COL_IDP_MOBILES = 'idp_mobiles';
//const COL_DEVICES = 'idp_mobiles';

// Notification email settings
// Configuration comes from your account credentials on https://www.mailgun.com/
const MAILGUN_ORIGIN_EMAIL = 'idp.monitor@platform.clearblade.com';
const MAILGUN_DOMAIN = '<yourDomain>.mailgun.org';
const MAILGUN_KEY = '<yourKey>';
const RECIPIENT_EMAIL = 'you@yourCompany.com';

// Helper functions ----------------------------------------------------------------------------------------------------

/**
 * Logs the callerName and comments using DEBUG level.
 * @param {string} callerName - the name of the calling function (including arguments.callee.name)
 * @param {...string} [message] - optional additional string messages to append to the log
 * @returns {string} the caller's name (without addtional messages)
 */
function entryLog(callerName) {
    // callerName = arguments.callee.caller.toString();   // This doesn't work in ClearBlade ES5 framework
    var callTime = new Date();
    if (typeof callerName === 'undefined' || callerName === '') {
        callerName = 'callerNameNotProvided';
    }
    msg = '[' + callerName + ']' + ' called at ' + callTime;
    for (var i=1; i < arguments.length; i++) {
        msg += ' ' + arguments[i];
    }
    vlog(logLevels.DEBUG, msg);
    return '[' + callerName + ']';
}

/**
 * Logs messages (one per line) based on the specified logging level
 * @param {number} logLevel A logging level defined in the logLevels type
 * @param {...string} [message]
 */
function vlog(logLevel) {
    const lines = arguments.length - 1;
    if (logLevel.value >= LOG_LEVEL.value) {
        if (lines > 0) {
            for (var i = 1; i < arguments.length; i++) {
                if (lines > 1) {
                    log('[' + logLevel.name + ' ' + i + ' of ' + lines + '] ' + arguments[i]);
                } else {
                    log('[' + logLevel.name + '] ' + arguments[i]);
                }
                
            }
        } else {
            log('[WARNING] log operation called but no log string provided.');
        }
    }
}

/**
 * Class representing an IDP mailbox
 * @param {string} accessId - the username credential provided by Inmarsat
 * @param {string} password - the password credential
 */
function Mailbox (accessId, password) {
    this.accessId = accessId;
    this.password = password;
}

/**
 * Returns an IDP API formatted timestamp based on an offset
 * @param {{days: {integer}, midnight: {boolean}}} offset going back a number of days and/or to midnight of that day
 * @returns {string} IDP API formatted timestamp YYYY-MM-DD hh:mm:ss
*/
function getIdpTimestamp(offset) {
    entryLog(GLOBALS_LIBRARY_NAME + '.' + arguments.callee.name, 'with offet = ' + JSON.stringify(offset));
    if (typeof offset === 'undefined') { offset = {days: 0, midnight: false}; }
    var d = new Date();
    var offsetDays = (typeof offset.days === 'number') ? offset.days : 0;
    var midnight = (typeof offset.midnight === 'boolean') ? offset.midnight : false;

    function pad(n) { return (n < 10) ? '0'+n : n; }
    
    function leapYear(year) { return ((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0); }
    
    var hhmmss = (midnight) ? '00:00:00' : pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
    var day = d.getUTCDate();
    var month = d.getUTCMonth() + 1;
    var year = d.getUTCFullYear();
    if (day - offsetDays > 0) {
        day = day - offsetDays;
    } else {
        switch(month) {
            case 1, 3, 5, 7, 8, 10, 12:
                day = 31 + (day - offsetDays);
                break;
            case 4, 6, 9, 11:
                day = 30 + (day - offsetDays);
                break;
            case 2:
                day = (leapYear(year)) ? 29 - (day + offsetDays) : 28 - (day + offsetDays);
                break;
        }
        if (month - 1 > 0) {
            month = month - 1;
        } else {
            month = 12;
            year = year - 1;
        }
    }
    var yyyymmdd = year + '-' + pad(month) + '-' + pad(day);
    return (yyyymmdd + ' ' + hhmmss);
}

/**
 * Converts a unix timestamp to a human/Javascript readable datestamp
 * @param {number} unix timestamp seconds since epoch
 * @returns {string} timestamp format YYYY-MM-DD hh:mm:ss.sss
 */
function unixToTimestamp(ts) {
    var date = new Date(ts * 1000);
    return date;
}

/**
 * Converts a Javascript readable datestamp to a unix timestamp
 * 
 * @param {string} timestamp format YYYY-MM-DD hh:mm:ss
 * @returns {number} unix timestamp seconds since epoch
 */
function timestampToUnix(timestamp) {
    if (timestamp == 'undefined' || timestamp == null) {
        timestamp = String(new Date());
    }
    return Math.round(new Date(timestamp).getTime() / 1000);
}

/** 
 * Converts an IDP API formatted timestamp to RFC3339 format
 * 
 * @param {string} timestamp UTC formatted as YYYY-MM-DD hh:mm:ss
 * @returns {string} timestamp formatted as YYYY-MM-DDThh:mm:ssZ
*/
function timestampRfc3339(idpTimestamp) {
    //TODO: make sure this works if an RFC timestamp is passed in (don't add another Z and/or retain +00:00)
    var fName = entryLog(GLOBALS_LIBRARY_NAME + '.' + arguments.callee.name, 'with timestamp ' + idpTimestamp);
    var timestamp;
    if (!((new Date(timestamp)).getTime() > 0)) {
        idpTimestamp = timestampIdp(new Date());
    }
    return idpTimestamp.replace(/ /g,'T').substring(0, 19) + 'Z';
}

/**
 * Converts an RFC3339 formatted datestamp to IDP API format
 * 
 * @param {string} timestamp RFC3339 formatted as YYYY-MM-DDThh:mm:ss[.sss]Z
 * @returns {string} timestamp IDP API formatted as YYYY-MM-DD hh:mm:ss
*/
function timestampIdp(timestamp) {
    var fName = entryLog(GLOBALS_LIBRARY_NAME + '.' + arguments.callee.name, 'with timestamp ' + timestamp);
    var idpTimestamp;
    if (!((new Date(timestamp)).getTime() > 0)) {
        timestamp = new Date();
    }
    return timestamp.toString().replace('T',' ').substring(0, 19);
}

/**
 * Cleans up unreadable characters from the start and end of a string (usually parsed from a file read)
 * 
 * @param {string} s the string to trim
 * @returns {string}
 */
function trim(s) {
    return s.replace(/^\s+|\s+$/g, '');
}

/**
 * Rounds a floating point number to a given number of decimal places
 * 
 * @param {number} num the number to round
 * @param {number} places the precision after the decimal place
 * @returns {number}
 */
function roundTo(num, places) {    
    if (typeof(places) !== 'number') {
        places = 0;
    }
    return +(Math.round(num + 'e+' + places)  + 'e-' + places);
}

/**
 * Returns the size/length of an object (number of properties)
 * 
 * @param {Object} obj to determine size of
 * @returns {number}
 */
Object.size = function(obj) {
    var size = 0;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            size++;
        }
    }
    return size;
};

/**
 * Returns a Javascript datestamp based on day of month and minute of day (from IDP 'Ping' response)
 * 
 * @param {number} dayOfMonth
 * @param {number} minuteOfDay
 * @returns {string}
 */
function timestampFromMinuteDay(dayOfMonth, minuteOfDay) {
    var dateObj = new Date();
    var month = dateObj.getUTCMonth(); //months from 0-11
    var year = dateObj.getUTCFullYear();
    var hour = minuteOfDay / 60;
    var minute = minuteOfDay % 60;
    var tsDate = new Date(year, month, dayOfMonth, hour, minute);
    return tsDate;
}

/**
 * Returns the time of day in modulo of 65535 minutes (for IDP 'Ping' request/response)
 * 
 */
function pingTime(timestamp) {
    var fName = entryLog(GLOBALS_LIBRARY_NAME + '.' + arguments.callee.name, 'with timestamp ' + timestamp);
    var d;
    if (typeof(timestamp) === 'undefined') {
        d = new Date();
    } else {
        d = new Date(timestamp);
    }
    vlog(logLevels.DEBUG, fName + ' returning ' + d);
    return (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) % 65535;
}

/**
 * Returns the modem wakeup time in seconds
 * @param {number|string} value - wakeupPeriod used by core modem messages in JSON format or rawPayload enum value for wakeupPeriod in core modem messages
 * @returns {number} seconds between wakeups
*/
function getModemWakeupSeconds(value) {
    entryLog(GLOBALS_LIBRARY_NAME + '.' + arguments.callee.name, 'with value=' + value);
    switch (value) {
        case 0:
        case 'None':
            return 5;  //5 seconds (Always On)
        case 1:
        case 'Seconds30':
            return 30;
        case 2:
        case 'Seconds60':
            return 60;
        case 3:
        case 'Minutes3':
            return 3 * 60;
        case 4:
        case 'Minutes10':
            return 10 * 60;
        case 5:
        case 'Minutes30':
            return 30 * 60;
        case 6:
        case 'Minutes60':
            return 60 * 60;
        case 7:
        case 'Minutes2':
            return 2 * 60;
        case 8:
        case 'Minutes5':
            return 5 * 60;
        case 9:
        case 'Minutes15':
            return 15 * 60;
        case 10:
        case 'Minutes20':
            return 20 * 60;
        default:
            return -1;  //ERROR: Undefined Modem Wakeup Period
    }
}

/**
 * Returns the modem wakeup period string
 * @param {number} value TerminalWakeupPeriod in seconds returned by submit_messages API operation or rawPayload enum value for wakeupPeriod in core modem messages
 * @returns {string} enumerated type value for JSON-encoded messages
*/
function getModemWakeupPeriod(value) {
    entryLog(GLOBALS_LIBRARY_NAME + '.' + arguments.callee.name, 'with value=' + value);
    switch (value) {
        case 0:
        case 5:
            return 'None';  //'5 seconds (Always On)';
        case 30:
            return 'Seconds30';  //'30 seconds';
        case 60:
            return 'Seconds60';  //'60 seconds';
        case 180:
            return 'Minutes3';  //'3 minutes';
        case 600:
            return 'Minutes10'; //'10 minutes';
        case 1800:
            return 'Minutes30';  //'30 minutes';
        case 3600:
            return 'Minutes60';  //'60 minutes';
        case 120:
            return 'Minutes2';  //'2 minutes';
        case 300:
            return 'Minutes5';  //'5 minutes';
        case 900:
            return 'Minutes15';  //'15 minutes';
        case 1200:
            return 'Minutes20';  //'20 minutes';
        default:
            return 'UNDEFINED';
    }
}

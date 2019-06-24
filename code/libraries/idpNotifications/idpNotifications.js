const NOTIFICATIONS_LIBRARY_NAME = 'idpNotifications';

/**
 * Notifies a user/system of an IDP API error
 * @param {object} err The error object
 */
function notifyApiError(err) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + err);
  var msg = ClearBlade.Messaging();
  if (err.error && err.error === 200) {
    err.note = 'API Recovered'
  }
  msg.publish('idp/api_error', JSON.stringify(err));
  mailgunNotify(err, 'IDP API error (ClearBlade client)');
  // TODO: set and clear API status up/down to avoid frequent alarms
};

/**
 * Notifies a user/system of a new IDP mobile detected (message from previously unknown modem)
 * @param {object} meta Metadata about the IDP Mobile
 */
function notifyIdpNewMobileProvisioned(meta) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + JSON.stringify(meta));
  // TODO: validate minimum content of meta, including mobile_id
  var msg = ClearBlade.Messaging();
  msg.publish('idp/new_mobile', JSON.stringify(meta));
  var emailBody = 'Mobile ID: ' + meta.mobile_id + '\n' + 'Mailbox: ' + meta.access_id + '\n' + 'Last MO Message: ' + meta.last_message;
  mailgunNotify(emailBody, 'IDP New Mobile provisioned in ClearBlade Platform (' + meta.mobile_id + ')');
};

/**
 * Notifies a user/system of an IDP mobile with scrambled message payload
 * @param {string} mobile_id Unique ID of the Mobile
 */
function notifySkywaveLocked(mobile_id) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + mobile_id);
  var msg = ClearBlade.Messaging();
  msg.publish('idp/modem_locked_to_skywave', mobile_id);
  mailgunNotify(mobile_id, 'IDP scrambled payload detected (ClearBlade client)');
}

/**
 * Notifies a user/system of a Mobile-Originated Error message
 * @param {object} message The message object
 */
function notifyIdpModemError(message) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + JSON.stringify(message));
  var msg = ClearBlade.Messaging();
  msg.publish('idp/modem_error', JSON.stringify(message));
};

/**
 * Notifies a user/system of a scheduled Mobile-Terminated message to a modem using low power mode
 * @param {object} meta Metadata about the MT message
 */
function notifyIdpMtScheduledMessage(meta) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + JSON.stringify(meta));
  var jsonContent = {
    mobile_id: meta.mobile_id,
    msg_id: meta.msg_id,
    scheduled: meta.mt_scheduled_send,
  };
  var emailBody = 'Mobile ID: ' + meta.mobile_id + '\n' + 'Message ID: ' + meta.msg_id + '\n' + 'Scheduled: ' + meta.mt_scheduled_send;
  var msg = ClearBlade.Messaging();
  msg.publish('idp/mt_scheduled', JSON.stringify(jsonContent));
  mailgunNotify(emailBody, 'IDP Mobile-Terminated message scheduled to low power modem');
};

/**
 * Notifies a user/system of a failed Mobile-Terminated message (may indicate terminal blockage or power problem)
 * @param {object} message The message
 */
function notifyIdpMtMessageFailure(message) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + message);
  var msg = ClearBlade.Messaging();
  msg.publish('idp_mt_failed', JSON.stringify(message));
  mailgunNotify(JSON.stringify(message, null, 2), 'IDP Mobile-Terminated message failed');
};

/**
 * Notifies a user/system of a new Mobile-Originated message
 * @param {object} message The message
 */
function notifyIdpReturn(message) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + JSON.stringify(message));
  var msg = ClearBlade.Messaging();
  msg.publish('idp_new_mo_message', JSON.stringify(message));
};

/**
 * Notifies a user/system of a Mobile-Terminated message state change
 * @param {object} message The message details
 */
function notifyIdpForwardStateChange(message) {
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + JSON.stringify(message));
  var msg = ClearBlade.Messaging();
  msg.publish('idp_new_mt_message_state', JSON.stringify(message));
};

/**
 * Send an email using ipm mailgun Library
 * @param {string} body Body of the email
 * @param {string} subject Subject of the email
 */
function mailgunNotify(body, subject){
  var fName = entryLog(NOTIFICATIONS_LIBRARY_NAME + '.' + arguments.callee.name, 'with ' + subject);
  vlog(logLevels.WARNING, fName + 
        ' Mailgun functionality requires adding mailgun ipm, apply your own configuration in idpGlobals and remove comments in idpNotifications');
  /*  Remove to enable mailgun
  // TODO: validate Mailgun configuration
  var mailgun = Mailgun(MAILGUN_KEY, MAILGUN_DOMAIN, MAILGUN_ORIGIN_EMAIL);
  mailgun.send(body, subject, RECIPIENT_EMAIL, function(err, data){
      if(err){
          vlog(logLevels.ERROR, fName + ' ' + err);
      }
      vlog(logLevels.DEBUG, fName + ' returned from mailgun: ' + data);
  })
  */
}

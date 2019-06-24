// RECOMMENDED TIMER 30 SECONDS 'pollForwardStatuses'

/**
 * Checks the IDP gateway/network for changes to open Mobile-Terminated (aka Forward) messages
 * @param {string} req.params.access_id
 * @param {string} req.params.password
 * @param {string} req.params.fwIDs
 * @param {string} req.params.start_utc
 * @param {string} req.params.end_utc
 */
function idpGetForwardStatuses(req, resp) {
  var fName = entryLog(arguments.callee.name);
  var callTime = new Date();
  ClearBlade.init({request:req});
    
  var mailboxes = [];
  var activeMailbox = {};
  var successMsgs = [];
  var successMsg = '';
  var statusCount = 0;
  var updatedCount = 0;
  var updatedTotal = 0;
  var newStatus = false;
  var activeMsg = -1;
  
  var getForwardStatusesCallback = function(err, data){
    var cbName = entryLog(fName.replace('[', '').replace(']', '') + '.' + 'getForwardStatusesCallback');
    var resTime = new Date();
    if(err) {
      vlog(logLevels.ERROR, cbName + ' returned: ' + JSON.stringify(data));
      resp.error(data);
    } else {
      vlog(logLevels.DEBUG, cbName + ' returned: ' + JSON.stringify(data));
      if (data.ErrorID > 0) {
        error = 'API error ' + activeMailbox.accessId + ' ('+ data.ErrorID +'): ' + getErrorMessage(data.ErrorID);
        vlog(logLevels.ERROR, cbName + ' ' + error);
        resp.error(error);
      } else if (data.Statuses !== null) {
        for (var i=0; i < data.Statuses.length; i++) {
          activeMsg = data.Statuses[i].ForwardMessageID;
          vlog(logLevels.DEBUG, cbName + ' processing status for ' + activeMsg + ' content:' + JSON.stringify(data.Statuses[i]));
          statusCount += 1;
          newStatus = false;
          if (data.Statuses[i].ErrorID > 0) {
            vlog(logLevels.WARNING, cbName + ' message error for ' + activeMsg + ': ' + getErrorMessage(data.Statuses[i].ErrorID));
          }
          var metaMsg = {
            msg_id: data.Statuses[i].ForwardMessageID,
            mt_is_closed: data.Statuses[i].IsClosed,
            mt_status_timestamp: data.Statuses[i].StateUTC,
            mt_status_id: data.Statuses[i].State,
            mt_status_desc: getForwardStatus(data.Statuses[i].State),
            mt_refno: data.Statuses[i].ReferenceNumber,
            mt_error_id: data.Statuses[i].ErrorID,
            mt_error_desc: getErrorMessage(data.Statuses[i].ErrorID),
          };
          updateForwardStatus(metaMsg, function (err, result) {
            if (err) {
              vlog(logLevels.ERROR, cbName + ' updateForwardStatus: ' + JSON.stringify(result));
            } else {
              if (result.updated) {
                  successMsg = 'Updated status of message: ' + activeMsg + ' (' + result.status + ')';
                  vlog(logLevels.INFO, cbName + ' ' + successMsg);
                  newStatus = true;
                  updatedCount += 1;
                  updatedTotal += 1;
                  if (result.status > 1 && result.status < 5) {
                    notifyIdpMtMessageFailure(data.Statuses[i]);
                  }
              } else {
                  successMsg = 'No change to status of message: ' + activeMsg + ' (' + result.status + ')';
                  vlog(logLevels.DEBUG, cbName + ' ' + successMsg);
              }
              successMsgs.push(successMsg);
            }
          });
          if (newStatus) {
            vlog(logLevels.INFO, cbName + ' notifying state change for message ' + activeMsg);
            // notifyIdpForwardStateChange(metaMsg.msg_id + ':' + metaMsg.mt_status_desc);
          }
        }
        successMsg = 'Retrieved ' + data.Statuses.length + ' statuses from ' + activeMailbox.accessId + '. Updated: ' + updatedCount;
      } else {
        successMsg = 'No statuses to retrieve from ' + activeMailbox.accessId;
      }
      vlog(logLevels.DEBUG, successMsg);
      successMsgs.push(successMsg);
      var metaApi = {
        stored: statusCount,
        accessId: activeMailbox.accessId,
        callTime: callTime,
        errorDesc: getErrorMessage(data.ErrorID),
      };
      updateIdpRestApiCalls('get_forward_statuses', metaApi, data, function(err, result) {
        if (err) {
          vlog(logLevels.ERROR, fName + ' updateApiCallsCallback: ' + JSON.stringify(result));
          resp.error(JSON.stringify(result));
        } else {
          vlog(logLevels.DEBUG, fName + ' successfully updated ApiCalls collection');
        }
      });
      if (data.More) {
        //TODO: UNTESTED
        vlog(logLevels.INFO, 'getForwardStatusesCallback: more statuses pending retrieval');
        getForwardStatuses(activeMailbox, data.NextStartUTC);
      }
    }
  };
  
  var getForwardStatuses = function(mailbox, watermark) {
    var auth = {access_id: mailbox.accessId, password: mailbox.password};
    var filters = {};
    if (typeof watermark !== 'undefined') {
      filters.start_utc = watermark;
    } else {
      vlog(logLevels.DEBUG, fName + ' no watermark provided, searching for all pending statuses for ' + mailbox.accessId);
      filters.fwIDs = getPendingStatuses(mailbox.accessId);
    }
    if (filters.fwIDs !== '') {
      var fwIDs = filters.fwIDs.split(',');
      if (fwIDs.length > 1) {
        vlog(logLevels.DEBUG, fName + ' ' + fwIDs.length + ' Forward statuses to check');
        // Separate out; API failed when requesting multiple statuses
        for (var id=0; id < fwIDs.length; id++) {
          filters.fwIDs = fwIDs[id];
          vlog(logLevels.DEBUG, fName + ' getting Forward status ' + fwIDs[id] + ' from ' + mailbox.accessId);
          get_forward_statuses(auth, filters, getForwardStatusesCallback);
        }
      } else {
        vlog(logLevels.DEBUG, fName + ' getting Forward statuses from ' + mailbox.accessId);
        get_forward_statuses(auth, filters, getForwardStatusesCallback);
      }
    } else {
      successMsg = 'No pending MT/Forward messages found for mailbox ' + activeMailbox.accessId + ' - no API call made';
      vlog(logLevels.INFO, fName + ' ' + successMsg);
      successMsgs.push(successMsg);
    }
  };
  
  if (typeof req.params.access_id === 'undefined' || req.params.access_id === '') {
    vlog(logLevels.DEBUG, fName + 'Parameter access_id not provided - looping through Mailboxes collection');
    mailboxes = getMailboxes();  // from idp_collections
  } else {
    if (typeof req.params.fwIDs !== 'undefined' && req.params.fwIDs !== '') {
      vlog(logLevels.INFO, 'Using accessId: ' + req.params.access_id);
      var mb = Mailbox(req.params.access_id, req.params.password);
      mb.fwIDs = req.params.fwIDs;
      if (typeof req.params.start_utc !== 'undefined') {
        // TODO: set up proper watermark and range, test
        mb.watermark = req.params.start_utc;
      }
      mailboxes.push(mb);
    } else {
      resp.error('No fwIDs filter provided for mailbox ' + req.params.access_id);
    }
  }

  for (var mb_idx=0; mb_idx < mailboxes.length; mb_idx++) {
    activeMailbox = mailboxes[mb_idx];
    updatedCount = 0;
    getForwardStatuses(activeMailbox, activeMailbox.watermark);  // from this code service
  }
  
  resp.success('Retrieved ' + updatedTotal + ' status updates: ' + '\n' + JSON.stringify(successMsgs, null, 2));
}

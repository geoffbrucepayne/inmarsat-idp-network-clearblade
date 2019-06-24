/**
 * Exercises various unit test cases.  TODO: handle error cases, filtered tests
 * @param {number[]} req.params.testCases - optional list of specific test cases
 */
function idpUnitTest(req, resp) {
  var fName = entryLog(arguments.callee.name);
  ClearBlade.init({request:req});
  var successMsgs = [];
  var failureMsgs = [];
  var testCase = 0;

  const MOBILE_ID = '01459438SKYFEE3';
  //const MOBILE_ID = '01105596SKY37E9';

  function executeCode(service, params) {
    var codeEngine = ClearBlade.Code();
    var loggingEnabled = true;
    codeEngine.execute(service, params, loggingEnabled, function(err, data){
      if(err){
        failureMsgs.push(testCase + ': Failed to complete service ' + service + ': ' + JSON.stringify(data, null, 2));
      } else {
        var error = '';
        var dataStruct = JSON.parse(data);
        var logs = dataStruct.logs.split('\n');
        for (l=0; l < logs.length; l++) {
          if (logs[l].indexOf('[ERROR]') !== -1) {
            error += logs[l];
          }
        }
        if (!error) {
          successMsgs.push(testCase + ': ' + service + ' logs: ' + dataStruct.logs);
        } else {
          failureMsgs.push(testCase + ': ' + service + ' logs: ' + error);
        }
      }
    });
  }
  
  // Test cases for idpMessagingApi -------------------------------------------------------------------

  testCase++;
  successMsgs.push(testCase + ': Inmarsat IDP API version: ' + getApiVersion());

  testCase++;
  successMsgs.push(testCase + ': Inmarsat IDP network time (UTC): ' + getGatewayTime());

  testCase++;
  var errorId = 0;
  successMsgs.push(testCase + ': Error ID ' + errorId + ' = ' + getErrorMessage(errorId));

  testCase++;
  var status_id = 0;
  successMsgs.push(testCase + ': Forward Status ' + status_id + ' = ' + getForwardStatus(status_id));

  testCase++;
  var modem_wakeup_interval = 0;
  successMsgs.push(testCase + ': Modem wakeup interval ' + modem_wakeup_interval + ' = ' + getModemWakeupPeriod(modem_wakeup_interval));

  // Test cases for idpCollections --------------------------------------------------------------------

  testCase++;
  mailboxes = getMailboxes();
  for (var i=0; i < mailboxes.length; i++) {
    successMsgs.push(testCase + ': Retrieved credentials for mailbox: ' + mailboxes[i].accessId);
  }

  testCase++;
  successMsgs.push(testCase + ': Next API Start ID: ' + getNextStartId(mailboxes[0].accessId));

  testCase++;
  successMsgs.push(testCase + ': Next API Start UTC: ' + getNextStartUtc(mailboxes[0].accessId));

  // idpSendMessage tests ------------------------------------------------------------------------------
  // TODO: may need to introduce delays between each submission

  const mtMessagesToTest = [
    //mtResetModemPayload(),
    mtPingModemPayload(),
    //mtGetModemLocationPayload(),
    //mtGetModemConfigurationPayload(),
    //mtProtocolErrorRawPayload(),
    //mtModemWakeupIntervalChangePayload('Seconds30'),
    //mtModemWakeupIntervalChangePayload('None'),
    //mtGetLastRxInfoPayload(),
    //mtGetRxMetricsPayload('LastFullMinute'),
    //mtGetTxMetricsPayload('LastFullMinute'),
    //mtRequestBroadcastIdsPayload(),
    //mtModemRxMetricsRawPayload,
  ];
  
  for (var mt=0; mt < mtMessagesToTest.length; mt++) {
    testCase++;
    var sendMsgParams = {
      MobileID: MOBILE_ID,
    }
    if ('Fields' in mtMessagesToTest[mt]) {
      sendMsgParams.Payload = mtMessagesToTest[mt];
    } else {
      sendMsgParams.RawPayload = mtMessagesToTest[mt];
    }
    vlog(logLevels.DEBUG, fName + ' test case ' + testCase + ' sending: ' + JSON.stringify(sendMsgParams));	
    executeCode('idpSendMessage', sendMsgParams);
  }

  // TODO: idpGetReturnMessages test -------------------------------------------------------------------
  //testCase++;
  

  // TODO: Test idpMoParser with RawPayload
  //testCase++;

  // Test cases for idpParserCodeModem ----------------------------------------------------------------

  const moMessagesToTest = [
    //moPingModemPayload,
    //moBroadcastIds,
    //moModemWakeupIntervalChangedRawPayload,
  ];
  
  for (var mo=0; mo < moMessagesToTest.length; mo++) {
    testCase++;
    var rxTime = new Date();
    var msgTime = new Date(rxTime.setSeconds(rxTime.getSeconds() + 2));
    var moMessage = {
      ID: mo,
      ReceiveUTC: timestampIdp(rxTime),
      MessageUTC: timestampIdp(msgTime),
      SIN: 0,
      MobileID: MOBILE_ID,
    }
    if (typeof moMessagesToTest[mo] === 'array') {
      moMessage.RawPayload = moMessagesToTest[mo];
    } else {
      moMessage.Payload = moMessagesToTest[mo];
    }
    vlog(logLevels.DEBUG, fName + ' test case ' + testCase + ' parsing: ' + JSON.stringify(moMessage));	
    var parsingResult = parseCoreModem(moMessage);
    successMsgs.push(testCase + ': Parsed core modem message ' + JSON.stringify(moMessage));
  }
  
  if (failureMsgs.length > 0) {
    resp.error('Failure cases: ' + failureMsgs.length + '\n' + JSON.stringify(failureMsgs, null, 2) + '\n' + 
               'Success cases: ' + successMsgs.length + '\n' + JSON.stringify(successMsgs, null, 2));
  } else {
    resp.success('Success cases: ' + successMsgs.length + '\n' + JSON.stringify(successMsgs, null, 2));
  }
}

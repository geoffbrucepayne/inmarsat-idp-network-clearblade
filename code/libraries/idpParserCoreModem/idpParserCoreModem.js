const IDP_PARSER_CM_LIBRARY_NAME = 'idpParserCoreModem';

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
 * Main Core Modem parsing routine farms out individual message parsing
 * @param {ReturnMessage} returnMessage a message object
 */
function parseCoreModem(returnMessage) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message #' + returnMessage.ID + ' (' + JSON.stringify(returnMessage) + ')');
    
    var msgMeta = {
        mobile_id: returnMessage.MobileID,
        timestamp: timestampRfc3339(returnMessage.MessageUTC),
    };

    var message = returnMessage.Payload;
    // TODO: caution around the possibility that MIN could be 'falsey'
    switch (message.MIN) {
        case 97:
        case 1:
        case 0:
            parseModemRegistration(message, msgMeta);
            break;
        case 2:
            parseModemProtocolError(message, msgMeta);
            break;
        case 70:
            parseModemSleepSchedule(message, msgMeta);
            break;
        case 72:
            parseModemLocation(message, msgMeta);
            break;
        case 98:
            parseModemLastRxInfo(message, msgMeta);
            break;
        case 99:
            parseModemRxMetrics(message, msgMeta);
            break;
        case 100:
            parseModemTxMetrics(message, msgMeta);
            break;
        case 112:
            parseModemPingReply(message, msgMeta);
            break;
        case 113:
            parseNetworkPingRequest(message, msgMeta);
            break;
        case 115:
            parseModemBroadcastIds(message, msgMeta);
            break;
        default:
            vlog(logLevels.WARNING, 'No parsing logic defined for SIN 0 MIN ' + message.MIN);
    }
    // TODO: consider passing back metadata for the code service to manage collection updates
}

/**
 * Parses modem registration, beam registration and configuration query responses
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemRegistration(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var mobileMeta = {
        mobile_id: msgMeta.mobile_id,
    };
    var temp = {};

    var notifyMessage = {
        name: message.Name,
    };
    
    var fields = message.Fields;
    for (var f=0; f< fields.length; f++) {
        vlog(logLevels.TRACE, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'hardwareMajorVersion':
                temp.hwMajorVersion = fields[f].Value;
                break;
            case 'hardwareMinorVersion':
                temp.hwMinorVersion = fields[f].Value;
                break;
            case 'softwareMajorVersion':
                temp.swMajorVersion = fields[f].Value;
                break;
            case 'softwareMinorVersion':
                temp.swMinorVersion = fields[f].Value;
                break;
            case 'product':
                temp.productId = fields[f].Value;
                break;
            case 'wakeupPeriod':
                mobileMeta.wakeup_seconds = getWakeupSeconds(Number(fields[f].Value));
                notifyMessage.wakeupInterval = fields[f].Value;
                break;
            case 'lastResetReason':
                notifyMessage.lastResetReason = fields[f].Value;
                break;
            case 'virtualCarrier':
                notifyMessage.vcId = fields[f].Value;
                break;
            case 'beam':
                notifyMessage.beamId = fields[f].Value;
                break;
            case 'vain':
                notifyMessage.vain = fields[f].Value;
                break;
            case 'operatorTxState':
                notifyMessage.operatorTxState = fields[f].Value;
                break;
            case 'userTxState':
                notifyMessage.userTxState = fields[f].Value;
                break;
            case 'broadcastIDCount':
                notifyMessage.bcIdCount = fields[f].Value;
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }
    
    if (temp.hwMajorVersion) {
        var hwVersion = temp.hwMajorVersion.toString() + '.' + temp.hwMinorVersion.toString();
        var swVersion = temp.swMajorVersion.toString() + '.' + temp.swMinorVersion.toString();
        vlog(logLevels.DEBUG, fName + ' found HW version:' + hwVersion + ' | SW version:' + swVersion);
        mobileMeta.modem_hw_version = hwVersion;
        mobileMeta.modem_sw_version = swVersion;
        mobileMeta.modem_product_id = temp.productId;
    }
    updateMobileMeta(mobileMeta);
    // TODO: send notification
}

/**
 * Parses modem errors
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemProtocolError(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var fields = message.Fields;
    var notifyMessage = {};
    for (var f=0; f< fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'messageReference':
                notifyMessage.msgRef = fields[f].Value;
                break;
            case 'errorCode':
                notifyMessage.errorCode = fields[f].Value;
                switch (notifyMessage.errorCode) {
                    case 1:
                        notifyMessage.errorDesc = 'Unable to allocate message buffer';
                        break;
                    case 2:
                        notifyMessage.errorDesc = 'Unknown message type';
                        break;
                    default:
                        notifyMessage.errorDesc = 'UNHANDLED ERROR';
                }
                break;
            case 'errorInfo':
                notifyMessage.errorInfo = fields[f].Value;
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }
    notifyIdpModemError(notifyMessage);
}

/**
 * Returns the wakeup interval in seconds
 * @param {number | string} wakeupCode
 */
function getWakeupSeconds(wakeupCode) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with code:' + wakeupCode);

    var interval = 5;
    switch (wakeupCode) {
        case 0:
        case 'None':
            interval = 5;
            break;
        case 1:
        case 'Seconds30':
            interval = 30;
            break;
        case 2:
        case 'Seconds60':
            interval = 60;
            break;
        case 3:
        case 'Minutes3':
            interval = 3 * 60;
            break;
        case 4:
        case 'Minutes10':
            interval = 10 * 60;
            break;
        case 5:
        case 'Minutes30':
            interval = 30 * 60;
            break;
        case 6:
        case 'Minutes2':
            interval = 2 * 60;
            break;
        case 7:
        case 'Minutes5':
            interval = 5 * 60;
            break;
        case 8:
        case 'Minutes15':
            interval = 15 * 60;
            break;
        case 9:
        case 'Minutes20':
            interval = 20 * 60;
            break;
        default:
            vlog(logLevels.ERROR, fName + ' unrecognized wakeupPeriod: ' + wakeupCode);
    }
    return interval;
}

/**
 * Parses wakeup interval change notification
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemSleepSchedule(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    const deviceCollName = COL_IDP_MOBILES;
    var mobileMeta = {
        mobile_id: msgMeta.mobile_id,
    };
    
    var fields = message.Fields;
    var notifyMessage = {};
    for (var f=0; f< fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'wakeupPeriod':
                mobileMeta.mt_wakeup_period = fields[f].Value.toString();
                mobileMeta.mt_wakeup_seconds = getModemWakeupSeconds(fields[f].Value);
                notifyMessage.wakeupInterval = fields[f].Value;
                break;
            case 'mobileInitiated':
                notifyMessage.localInitiated = fields[f].Value;
                break;
            case 'messageReference':
                notifyMessage.setWakeupMsgRefNo = fields[f].Value;
                break;
            default:
                vlog(logLevels.WARNING, fName + 'Unknown field: ' + fields[f].Name);
        }
    }
    updateMobileMeta(mobileMeta);
    // TODO: send notification
}

/**
 * Parses location and timestamp data to update the IdpMobiles collection with device metadata
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemLocation(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    // TODO: Determine which collection (or DEVICES) to update with location.
    const updateCollNames = [COL_IDP_MOBILES];
    const timeseriesCollNames = [];
    const fieldsToIgnore = ['fixStatus', 'location_spd', 'location_hdg'];
    // var collection = ClearBlade.Collection({collectionName: collName});
    var mobileMeta = {
        mobile_id: msgMeta.mobile_id,
    };
    var parkingLot = {};
    
    var fields = message.Fields;
    for (var f=0; f < fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'fixStatus':
                mobileMeta.fixStatus = Number(fields[f].Value);
                break;
            case 'latitude':
                mobileMeta.location_lat = roundTo(Number(fields[f].Value) / 60000, 6);
                break;
            case 'longitude':
                mobileMeta.location_lng = roundTo(Number(fields[f].Value) / 60000, 6);
                break;
            case 'altitude':
                mobileMeta.location_alt = Number(fields[f].Value);
                break;
            case 'speed':
                mobileMeta.location_spd = Number(fields[f].Value);
                break;
            case 'heading':
                mobileMeta.location_hdg = Number(fields[f].Value) * 2;
                break;
            case 'dayOfMonth':
                parkingLot.dayUtc = Number(fields[f].Value);
                break;
            case 'minuteOfDay':
                parkingLot.minuteOfDayUtc = Number(fields[f].Value);
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }

    if (Object.size(parkingLot) > 0) {
        mobileMeta.location_timestamp = timestampFromMinuteDay(parkingLot.dayUtc, parkingLot.minuteOfDayUtc);
    }
    
    for (var u=0; u < updateCollNames.length; u++) {
        vlog(logLevels.TRACE, fName + ' updating ' + updateCollNames[u]);
        for (var d=0; d < fieldsToIgnore.length; d++) {
            vlog(logLevels.DEBUG, fName + ' removing ' + fieldsToIgnore[d]);
            delete mobileMeta[fieldsToIgnore[d]];
        }
        if (updateCollNames[u] === COL_IDP_MOBILES) {
            updateMobileMeta(mobileMeta);
        } else {
            var qUpdate = ClearBlade.Query({collectionName: updateCollNames[u]});
            qUpdate.equalTo('mobile_id', mobileMeta.mobile_id);
            qUpdate.update(mobileMeta, function(err, res) {
                if (err) {
                    vlog(logLevels.ERROR, fName + ' Collection update failed for ' + updateCollNames[u] + ': ' + JSON.stringify(res));
                } else {
                    vlog(logLevels.DEBUG, fName + ' updated Collection ' + updateCollNames[u] + ' metadata for ' + mobileMeta.mobile_id);
                }
            });
        }
    }

    for (var t=0; t < timeseriesCollNames.length; t++) {
        vlog(logLevels.DEBUG, fName + ' adding timeseries data to ' + updateCollNames[u]);
        var collection = ClearBlade.Collection({collectionName: timeseriesCollNames[t]});
        collection.create(location, function(err, res){
            if (err) {
                vlog(logLevels.ERROR, fName + ' createItem failed: ' + JSON.stringify(res));
            } else {
                vlog(logLevels.INFO, fName + ' updated timeseries Collection ' + timeseriesCollNames[t] + ' with ' + JSON.stringify(res));
            }
        });
    }
}

/**
 * Parses response to query for last receive information
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemLastRxInfo(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var fields = message.Fields;
    var notifyMessage = {};
    for (var f=0; f< fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'sipValid':
                notifyMessage.sipValid = fields[f].Value;
                break;
            case 'subframe':
                notifyMessage.subframe = fields[f].Value;
                break;
            case 'packets':
                notifyMessage.numSegmentsDetected = fields[f].Value;
                break;
            case 'packetsOK':
                notifyMessage.numSegmentsOk = fields[f].Value;
                break;
            case 'frequencyOffset':
                notifyMessage.frequencyOffset = fields[f].Value;
                break;
            case 'timingOffset':
                notifyMessage.timingOffset = fields[f].Value;
                break;
            case 'packetCNO':
                notifyMessage.segmentCn = fields[f].Value;
                break;
            case 'uwCNO':
                notifyMessage.uwCn = fields[f].Value;
                break;
            case 'uwRSSI':
                notifyMessage.uwRssi = fields[f].Value;
                break;
            case 'uwSymbols':
                notifyMessage.numUwSymbols = fields[f].Value;
                break;
            case 'uwErrors':
                notifyMessage.numUwErrors = fields[f].Value;
                break;
            case 'packetSymbols':
                notifyMessage.numSegmentSymbols = fields[f].Value;
                break;
            case 'packetErrors':
                notifyMessage.numSegmentErrors = fields[f].Value;
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }
    vlog(logLevels.DEBUG, fName + ' modem last Rx info: ' + JSON.stringify(notifyMessage));
    // TODO: send notification
}

/**
 * Returns a string value of the metrics period, since it may not be an integer (e.g. 'partial minute' is non-specific)
 * @param {string | number} periodCode The period over which metrics were calculated by the modem
 */
function getMetricsPeriod(periodCode) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with code ' + periodCode);

    var period = 'UNKNOWN';
    switch (periodCode) {
        case 0:
        case 'SinceReset':
            period = 'SinceReset';
            break;
        case 1:
        case 'LastPartialMinute':
            period = 'LastPartialMinute';
            break;
        case 2:
        case 'LastFullMinute':
            period = 'LastFullMinute';
            break;
        case 3:
        case 'LastPartialHour':
            period = 'LastPartialHour';
            break;
        case 4:
        case 'LastFullHour':
            period = 'LastFullHour';
            break;
        case 5:
        case 'LastPartialDay':
            period = 'LastPartialDay';
            break;
        case 6:
        case 'LastFullDay':
            period = 'LastFullDay';
            break;
        case 15:
        case 14:
        case 13:
        case 12:
        case 11:
        case 10:
        case 9:
        case 8:
        case 7:
        default:
            period = 'Reserved';
    }
    return period;
}

/**
 * Parses response to get receive metrics
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemRxMetrics(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var fields = message.Fields;
    var notifyMessage = {};
    for (var f=0; f< fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'period':
                notifyMessage.metricsPeriod = getMetricsPeriod(Number(fields[f].Value));
                break;
            case 'numSegments':
                notifyMessage.numSegments = fields[f].Value;
                break;
            case 'numSegmentsOk':
                notifyMessage.numSegmentsOk = fields[f].Value;
                break;
            case 'AvgCN0':
                notifyMessage.avgCn = fields[f].Value;
                break;
            case 'SamplesCN0':
                notifyMessage.samplesCn = fields[f].Value;
                break;
            case 'ChannelErrorRate':
                notifyMessage.channelErrorRate = fields[f].Value;
                break;
            case 'uwErrorRate':
                notifyMessage.uwErrorRate = fields[f].Value;
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }
    vlog(logLevels.DEBUG, fName + ' modem Rx metrics: ' + JSON.stringify(notifyMessage));
    // TODO: send notification
}

/**
 * Parses response to get transmit metrics
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemTxMetrics(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var fields = message.Fields;
    var notifyMessage = {};
    var segmentDetails = {};
    for (var f=0; f< fields.length; f++) {
        var fieldValue;
        if (fields[f].Type === 'array') {
            fieldValue = JSON.stringify(fields[f].Elements);
        } else {
            fieldValue = fields[f].Value;
        }
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fieldValue);
        switch (fields[f].Name) {
            case 'period':
                notifyMessage.metricsPeriod = getMetricsPeriod(fields[f].Value);
                break;
            case 'packetTypeMask':
                // TODO: build data structure for segment type arrays
                // bitmask definition dictates size of the 3 array fields following
                // 0: ack
                // 1: 0.5s @ 0.33 rate
                // 2: 0.5s @ 0.5 rate
                // 3: 0.5s @ 0.75 rate
                // 4: reserved
                // 5: 1s @ 0.33 rate
                // 6: 1s @ 0.5 rate
                segmentDetails.packetTypeMask = fields[f].Value;
                break;
            case 'txMetrics':
                segmentDetails.packetTypes = fields[f].Elements;
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }
    notifyMessage.metrics = [];
    var bitmask = [];
    for (var b=0; b < 8; b++) {
        bitmask[b] = (segmentDetails.packetTypeMask >> b) & 1;
    }
    var packetTypesIndex = 0;
    for (var i=0; i < bitmask.length; i++) {
        vlog(logLevels.TRACE, fName + ' processing bitmask[' + i + ']=' + bitmask[i]);
        if (bitmask[i] === 1) {
            var metric = {};
            switch (i) {
                case 0:
                    metric.type = 'ack';
                    break;
                case 1:
                    metric.type = '0.5s subframe 0.33 rate';
                    break;
                case 2:
                    metric.type = '0.5s subframe 0.5 rate';
                    break;
                case 3:
                    metric.type = '0.5s subframe 0.75 rate';
                    break;
                case 5:
                    metric.type = '1s subframe 0.33 rate';
                    break;
                case 6:
                    metric.type = '1s subframe 0.5 rate';
                    break;
                default:
                    metric.type = 'undefined';
            }
            for (var e=0; e < segmentDetails.packetTypes[packetTypesIndex].Fields.length; e++) {
                vlog(logLevels.TRACE, fName + ' processing packetTypes:' + JSON.stringify(segmentDetails.packetTypes[packetTypesIndex].Fields));
                switch (segmentDetails.packetTypes[packetTypesIndex].Fields[e].Name) {
                    case 'PacketsTotal':
                        metric.segmentsTotal = segmentDetails.packetTypes[packetTypesIndex].Fields[e].Value;
                        break;
                    case 'PacketsSuccess':
                        metric.segmentsOk = segmentDetails.packetTypes[packetTypesIndex].Fields[e].Value;
                        break;
                    case 'PacketsFailed':
                        metric.segmentsFailed = segmentDetails.packetTypes[packetTypesIndex].Fields[e].Value;
                        break;
                }
            }
            notifyMessage.metrics.push(metric);
            packetTypesIndex += 1;
        }
    }
    vlog(logLevels.DEBUG, fName + ' modem Tx metrics: ' + JSON.stringify(notifyMessage));
    // TODO: send notification
}

/**
 * Parses a ping response to update the IdpMobiles collection metadata
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemPingReply(message, meta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var latency = {};
    var requestTime, responseTime;
    var receiveTime = pingTime(meta.timestamp);
    var fields = message.Fields;

    for (var f=0; f < fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'requestTime':
                requestTime = Number(fields[f].Value);
                break;
            case 'responseTime':
                responseTime = Number(fields[f].Value);
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }

    if (responseTime < requestTime) {
        responseTime += 65535;
        if (responseTime > 86399) { responseTime -= 86400 }
    }
    latency.mobileTerminated = responseTime - requestTime;

    if (receiveTime < responseTime) {
        receiveTime += 65535;
        if (receiveTime > 86399) { receiveTime -= 86400 }
    }
    latency.mobileOriginated = receiveTime - responseTime;

    latency.roundTrip = latency.mobileTerminated + latency.mobileOriginated;

    vlog(logLevels.DEBUG, fName + ' Latency: ' + JSON.stringify(latency, null, 2));
    // notifyIdpReturn('pingLatency:' + JSON.stringify(latency));
}

/**
 * Parses request from modem for network ping response (note: response is automatically generated by the network)
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseNetworkPingRequest(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var fields = message.Fields;
    var requestTime;
    var notifyMessage = {};
    for (var f=0; f < fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'requestSent':
                requestTime = Number(fields[f].Value);
                notifyMessage.requestTime = requestTime;
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }
}

/**
 * Parses request from modem for network ping response (note: response is automatically generated by the network)
 * @param {Message} message The mobile-origintated message
 * @param {object} msgMeta elements from the original ReturnMessage or mailbox
 */
function parseModemBroadcastIds(message, msgMeta) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(message));

    var fields = message.Fields;
    var broadcastIds = [];
    var mobileMeta = {
        mobile_id: msgMeta.mobile_id,
    };
    var notifyMessage = {};
    for (var f=0; f < fields.length; f++) {
        vlog(logLevels.DEBUG, fName + ' Field Name: ' + fields[f].Name + ' | Field Value: ' + fields[f].Value);
        switch (fields[f].Name) {
            case 'broadcastIDs':
                for (var e=0; e < fields[f].Elements.length; e++) {
                    for (var ef=0; ef < fields[f].Elements[e].Fields.length; ef++) {
                        broadcastIds.push(fields[f].Elements[e].Fields[ef].Value);
                    }
                }
                break;
            default:
                vlog(logLevels.WARNING, fName + ' Unknown field: ' + fields[f].Name);
        }
    }
    vlog(logLevels.DEBUG, fName + ' broadcastIds:' + broadcastIds);
    mobileMeta.broadcast_ids = JSON.stringify(broadcastIds);
    updateMobileMeta(mobileMeta);
}

// Mobile-Terminated (aka Forward) Message Parsers

/**
 * @typedef ForwardMessage
 * @property {string} DestinationID
 * @property {string} UserMessageID
 * @property {number[]} RawPayload
 * @property {Message} Payload
 */

/**
 * Encodes the modem reset message based on the reset type
 * @param {string | number} resetType
 * @return {Object} Message and raw payload number array
 */
function encodeModemReset(resetType) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with args:' + JSON.stringify(arguments));
    
    if (typeof(resetType) === 'undefined') {
        resetType = 'modemPreserve';
    }
    var payload = {
        IsForward: true,
        SIN: 0,
        MIN: 68,
        Name: 'Reset',
        Fields: []
    };
    switch (resetType) {
        case 0:
        case 'modemPreserve':
            resetType = 0;
            break;
        case 1:
        case 'modemFlush':
            resetType = 1;
            break;
        case 2:
        case 'termnal':
            resetType = 2;
            break;
        case 3:
        case 'TerminalModemFlush':
            resetType = 3;
            break;
        default:
            vlog(logLevels.ERROR, fName + ' invalid resetType ' + resetType);
            resetType = 0;
    }
    var field0 = {'Name':'resetType','Value':resetType.toString(),'Type':'enum'};
    payload.Fields.push(field0);
    var rawPayload = [0, 68, resetType];
    return {payload: payload, rawPayload: rawPayload};
}

function encodeModemSetWakeupInterval(interval) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
    
    const wakeupIntevals = [];
    if (interval in wakeupIntevals) {
        // TODO something
    }
}

function encodeModemMute(muteFlag) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));

}

function encodeModemPositionRequest() {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
}

function encodeModemGetConfiguration() {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
    var payload = {
        IsForward: true,
        Name: 'getConfiguration',
        SIN: 0,
        MIN: 97,
        Fields: []
    };
    var rawPayload = [];
    return {payload: payload, rawPayload: rawPayload};
}

function encodeModemGetLastRxInfo() {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
}

function encodeModemGetRxMetrics(metricsPeriod) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
}

function encodeModemGetTxMetrics(metricsPeriod) {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
}

function encodeModemPing() {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
    var message = {
        //Name: 'pingModem',
        IsForward: true,
        SIN: 0,
        MIN: 112,
        Fields: []
    };
    var requestTime = pingTime();
    var field0 = {'Name':'requestTime','Value':requestTime.toString,'Type':'unsignedInt'};
    message.Fields.push(field0);
    // TODO: calculate requestTime for rawPayload
    var rawPayload = [0, 115];
    return {message, rawPayload};
}

function encodeModemGetBroadcastIds() {
    var fName = entryLog(IDP_PARSER_CM_LIBRARY_NAME + '.' + arguments.callee.name, 'with message:' + JSON.stringify(arguments));
    var message = {
        IsForward: true,
        SIN: 0,
        MIN: 115,
        Name: 'requestBroadcastIds',
    };
    var rawPayload = [0, 115];
    return {message, rawPayload};
}

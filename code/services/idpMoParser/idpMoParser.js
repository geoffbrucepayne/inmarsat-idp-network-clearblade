// TRIGGER on IdpRawMessages item created

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

/**
 * Parses new Mobile-Originated messages as they are added to the RawMessages collection.
 * If the mobile ID is not found in the IdpMobiles collection, a notification is sent
 */
function idpMoParser(req, resp) {
    var fName = entryLog(arguments.callee.name);
    ClearBlade.init({request:req});
    var msgCollName = COL_IDP_MO_MESSAGES;
    var mobileCollName = COL_IDP_MOBILES;
    var message = {};

    var qNewMsg = ClearBlade.Query({collectionName:msgCollName});
    qNewMsg.equalTo('mo_msg', true);
    qNewMsg.equalTo('mo_processed', false);
    qNewMsg.descending('timestamp');
    qNewMsg.setPage(1, 1);
    qNewMsg.fetch(function(err, res) {
        if (err) {
            vlog(logLevels.ERROR, fName + ' query.fetch: ' + JSON.stringify(res));
            resp.error('could not retrieve new message from collection');
        } else if (res.DATA.length === 1) {
            vlog(logLevels.DEBUG, fName + ' query returned ' + res.DATA.length + ' results');
            for (var i=0; i < res.DATA.length; i++) {
                vlog(logLevels.TRACE, fName + ' processing ' + JSON.stringify(res.DATA[i]));
                var processed = false;
                message.ID = res.DATA[i].msg_id;
                message.MobileID = res.DATA[i].mobile_id;
                message.MessageUTC = res.DATA[i].timestamp;
                if (res.DATA[i].msg_payload_json) {
                    vlog(logLevels.INFO, fName + ' parsing JSON payload for message ' + message.ID + ' received from ' + message.MobileID +
                                                    ' at ' + res.DATA[i].timestamp);
                    message.Payload = JSON.parse(res.DATA[i].msg_payload_json);
                    switch (message.Payload.SIN) {
                        case 0:
                            vlog(logLevels.DEBUG, fName + ' parsing SIN 0 ' + JSON.stringify(message.Payload));
                            parseCoreModem(message);
                            // TODO: parser should return a boolean rather than assuming success
                            processed = true;
                            break;
                        // INSERT CUSTOM PARSING CALLS HERE; MAY NEED TO ADD LIBRARY
                        // case <MDF_SIN>:
                        //    parseYourMessageDefinition(message);
                        //    processed = true;
                        //    break;
                        case 15:
                            vlog(logLevels.DEBUG, fName + ' parsing SIN 15 ' + JSON.stringify(message.Payload));
                            if ('SKY' in message.MobileID) {
                                vlog(logLevels.DEBUG, fName + ' parsing SkyWave modem ' + JSON.stringify(message.Payload));
                                if (message.Payload.MIN && message.Payload.MIN === 255) {
                                    notifySkywaveLocked(message.MobileID);
                                    processed = true;
                                }
                            } else {
                                vlog(logLevels.WARNING, fName + ' unsupported manufacturer code: ' + message.MobileID.substr(8, 11));
                            }
                        default:
                            vlog(logLevels.WARNING, fName + ' no parsing logic defined for SIN:' + message.Payload.SIN + ' MIN:' + message.Payload.MIN + ' (' + message.Payload.Name + ')');
                    }
                } else {
                    message.rawPayload = res.DATA[i].msg_payload_raw;
                    vlog(logLevels.WARNING, fName + ' parsing logic undefined for ' + res.DATA[i].msg_size_ota + ' byte message with SIN:' + res.DATA[i].msg_sin);
                }
                if (processed) {
                    vlog(logLevels.TRACE, fName + ' updating metadata for MO message ' + message.ID);
                    var msgMeta = {
                        mo_processed: true,
                        //mo_processed_timestamp: new Date(),
                    };
                    var qUpdate = ClearBlade.Query({collectionName: msgCollName});
                    qUpdate.equalTo('msg_id', message.ID);
                    qUpdate.update(msgMeta, function(err, res) {
                        if (err) {
                            vlog(logLevels.ERROR, fName + ' Collection update failed for ' + msgCollName + ': ' + JSON.stringify(res));
                        } else {
                            vlog(logLevels.DEBUG, fName + ' updated Collection ' + msgCollName + ' metadata for message ' + message.ID);
                        }
                    });
                }
            }
        } else {
            //TODO: distinguish error case from Forward Message submission
            vlog(logLevels.WARNING, fName + ' ' + res.DATA.length + ' unprocessed return messages found in collection, should be 1');
        }
    });

    resp.success('Success');
}

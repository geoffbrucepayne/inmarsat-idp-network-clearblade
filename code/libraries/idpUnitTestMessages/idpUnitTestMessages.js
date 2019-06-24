/**
 * @typedef Message
 * @property {boolean} IsForward
 * @property {string} Name
 * @property {number} SIN
 * @property {number} MIN
 * @property {Field[]} Fields
 */
/**
 * @typedef Field
 * @property {string} Name
 * @property {string} Type - enum | boolean | unsignedint | signedint | string | data | array | message
 * @property {variant} Value - {string} | {boolean} | {number} | {number} | {string} | {base64String} | null | null
 * @property {Message} Message
 * @property {Element[]} Elements
 */
/**
 * @typedef Element
 * @property {number} Index
 * @property {Fields[]} Field
 */
/**
 * @typedef ReturnMessageFilter
 * @property {boolean} include_raw_payload
 * @property {boolean} include_type
 * @property {number} from_id - optional but supercedes start_utc
 * @property {string} start_utc - optional in place of from_id
 * @property {string} end_utc - optional if start_utc is used
 */
/**
 * @typedef GetReturnMesssageResult
 * @property {number} ErrorID
 * @property {boolean} More
 * @property {number} NextStartID
 * @property {string} NextStartUTC
 */
/**
 * @typedef ReturnMessage
 * @property {number} ID
 * @property {string} MobileID
 * @property {string} ReceiveUTC
 * @property {string} MessageUTC
 * @property {string} RegionName
 * @property {number} SIN
 * @property {number} OTAMessageSize
 * @property {number[]} RawPayload
 * @property {Message} Payload
 */
/**
 * @typedef ForwardSubmission
 * @property {string} DestinationID
 * @property {number} ErrorID
 * @property {number} ForwardMessageID
 * @property {number} OTAMessageSize
 * @property {string} ScheduledSendUTC
 * @property {string} StateUTC
 * @property {number} TerminalWakeupPeriod
 * @property {number} UserMessageID
 */
/**
 * @typedef SubmitMessageJResult
 * @property {SubmitMessageResult} SubmitForwardMessages_JResult
 */
/**
 * @typedef SubmitMessagesResult
 * @property {number} ErrorID
 * @property {ForwardSubmission[]} Submissions
 */
/**
 * @typedef ForwardMessage
 * @property {string} DestinationID
 * @property {number[]} RawPayload
 * @property {number} UserMessageID
 * @property {Message} Payload
 */
/**
 * @typedef ForwardStatusFilter
 * @property {string} ForwardMessageIDs
 * @property {string} StartUTC
 * @property {string} EndUTC
 */
/**
 * @typedef ForwardStatus
 * @property {number} ErrorID
 * @property {number} ForwardMessageID
 * @property {boolean} IsClosed
 * @property {number} ReferenceNumber
 * @property {number} State
 * @property {string} StateUTC
 */
/**
 * @typedef GetForwardMessageResult
 * @property {number} ErrorID
 * @property {ForwardMessageRecord[]} Messages
 */
/**
 * @typedef ForwardMessageRecord
 * @property {string} CreateUTC
 * @property {string} DestinationID
 * @property {number} ErrorID
 * @property {number} ID
 * @property {boolean} IsClosed
 * @property {number[]} RawPayload
 * @property {number} ReferenceNumber
 * @property {number} State
 * @property {string} StateUTC
 */
/**
 * @typedef GetForwardStatusesResult
 * @property {number} ErrorID
 * @property {boolean} More
 * @property {string} NextStartUTC
 * @property {ForwardStatus[]} Statuses
 */

// var getModemLocationMsgRawPayload = [0, 72];
function mtGetModemLocationPayload() {
    return {
        IsForward: true,
        Name: 'requestPosition',
        SIN: 0,
        MIN: 72,
        Fields: []
    };
}

var moModemLocationMsg = {
    "ID": 123456789,
    "MessageUTC": "2019-01-15 14:03:55",
    "ReceiveUTC": "2019-01-15 14:03:55",
    "SIN": 0,
    "MobileID": '01344380SKY6FA9',
    Payload: {
        // "IsForward": false,
        "Name": "position",
        "SIN": 0,
        "MIN": 72,
        "Fields": [
        {
            "Name": "fixStatus",
            "Value": 1,
            "Type": "unsignedInt",
        },
        {
            "Name": "latitude",
            "Value": 2717105,
            "Type": "signedInt",
        },
        {
            "Name": "longitude",
            "Value": -4550914,
            "Type": "signedInt",
        },
        {
            "Name": "altitude",
            "Value": 89,
            "Type": "signedInt",
        },
        {
            "Name": "speed",
            "Value": 0,
            "Type": "unsignedInt",
        },
        {
            "Name": "heading",
            "Value": 106,
            "Type": "unsignedInt",
        },
        {
            "Name": "dayOfMonth",
            "Value": 25,
            "Type": "unsignedInt",
        },
        {
            "Name": "minuteOfDay",
            "Value": 1054,
            "Type": "unsignedInt",
        }]
    }
};

function mtPingModemPayload() {
    return {
        IsForward: true,
        //Name: "pingModem",
        Name: "mobilePing",
        SIN: 0,
        MIN: 112,
        Fields: [
            {"Name": "requestTime","Value": pingTime(),"Type": "unsignedInt"}
        ]
    };
}

var moPingModemPayload = {
    "Name":"mobilePing",
    "SIN":0,
    "MIN":112,
    "Fields":[
        {"Name":"requestTime","Value":"4339","Type":"unsignedint"},
        {"Name":"responseTime","Value":"4344","Type":"unsignedint"}
    ]
};

// var resetModemPayload = encodeModemReset().payload;
function mtResetModemPayload() {
    return encodeModemReset().payload;
}

var moModemRegistrationPayload = {
    "Name":"modemRegistration",
    "SIN":0,
    "MIN":0,
    "Fields":[
        {"Name":"hardwareMajorVersion","Value":"3","Type":"unsignedint"},
        {"Name":"hardwareMinorVersion","Value":"1","Type":"unsignedint"},
        {"Name":"softwareMajorVersion","Value":"3","Type":"unsignedint"},
        {"Name":"softwareMinorVersion","Value":"3","Type":"unsignedint"},
        {"Name":"product","Value":"6","Type":"unsignedint"},
        {"Name":"wakeupPeriod","Value":"None","Type":"enum"},
        {"Name":"lastResetReason","Value":"PowerOn","Type":"enum"},
        {"Name":"virtualCarrier","Value":"101","Type":"unsignedint"},
        {"Name":"beam","Value":"4","Type":"unsignedint"},
        {"Name":"vain","Value":"0","Type":"unsignedint"},
        {"Name":"operatorTxState","Value":"0","Type":"unsignedint"},
        {"Name":"userTxState","Value":"0","Type":"unsignedint"},
        {"Name":"broadcastIDCount","Value":"0","Type":"unsignedint"}
    ]
};

function mtGetModemConfigurationPayload() {
    return encodeModemGetConfiguration().payload;
}

function mtProtocolErrorRawPayload() {
    return [0, 255]
};

var moProtocolError = {
    "Name":"protocolError",
    "SIN":0,
    "MIN":2,
    "Fields":[
        {"Name":"messageReference","Value":"7","Type":"unsignedint"},
        {"Name":"errorCode","Value":"2","Type":"unsignedint"},
        {"Name":"errorInfo","Value":"255","Type":"unsignedint"}
    ]
};

function mtModemWakeupIntervalChangePayload(val) {
    // TODO: check value
    return {
        "Name":"setSleepSchedule",
        "SIN":0,
        "MIN":70,
        "Fields":[
            {"Name":"wakeupPeriod","Value":val.toString(),"Type":"enum"},
        ]
    };
};

var moModemWakeupIntervalChangedPayload = {
    "Name":"sleepSchedule",
    "SIN":0,
    "MIN":70,
    "Fields":[
        {"Name":"wakeupPeriod","Value":"Seconds30","Type":"enum"},
        {"Name":"mobileInitiated","Value":"False","Type":"boolean"},
        {"Name":"messageReference","Value":"135","Type":"unsignedint"}
    ]
};

var moModemWakeupIntervalChangedRawPayload = [0,70,0];   // 'QUVZQU1DQT0';

function mtGetLastRxInfoPayload() {
    return {
        //"Name":"lastRxMetrics",
        "SIN":0,
        "MIN":98,
        "Fields":[]
    };
};

var moModemLastRxInfoPayload = {
    "Name":"lastRxMetrics",
    "SIN":0,
    "MIN":98,
    "Fields":[
        {"Name":"sipValid","Value":"True","Type":"boolean"},
        {"Name":"subframe","Value":"15506","Type":"unsignedint"},
        {"Name":"packets","Value":"1","Type":"unsignedint"},
        {"Name":"packetsOK","Value":"1","Type":"unsignedint"},
        {"Name":"frequencyOffset","Value":"483","Type":"unsignedint"},
        {"Name":"timingOffset","Value":"2","Type":"unsignedint"},
        {"Name":"packetCNO","Value":"388","Type":"unsignedint"},
        {"Name":"uwCNO","Value":"388","Type":"unsignedint"},
        {"Name":"uwRSSI","Value":"156","Type":"unsignedint"},
        {"Name":"uwSymbols","Value":"124","Type":"unsignedint"},
        {"Name":"uwErrors","Value":"6","Type":"unsignedint"},
        {"Name":"packetSymbols","Value":"2860","Type":"unsignedint"},
        {"Name":"packetErrors","Value":"132","Type":"unsignedint"}
    ]
};

const METRICS_PERIODS = [
        'SinceReset',
        'LastPartialMinute',
        'LastFullMinute',
        'LastPartialHour',
        'LastFullHour',
        'LastPartialDay',
        'LastFullDay',
];

function mtGetRxMetricsPayload(period) {
    if (typeof(period) === 'undefined' || (METRICS_PERIODS.indexOf(period) === -1)) {
        periodCode = 'SinceReset';
    }
    return {
        "Name":"rxMetrics",
        "SIN":0,
        "MIN":99,
        "Fields":[
            {"Name":"period","Value":period,"Type":"enum"},
        ]
    };
};

var mtModemRxMetricsRawPayload = [0, 99, 2];

var moModemRxMetricsPayload = {
  "Name": "rxMetrics",
  "SIN": 0,
  "MIN": 99,
  "Fields": [
    {
      "Name": "period",
      "Value": "LastFullMinute",
      "Type": "enum"
    },
    {
      "Name": "packets",
      "Value": "12",
      "Type": "unsignedint"
    },
    {
      "Name": "packetsOK",
      "Value": "12",
      "Type": "unsignedint"
    },
    {
      "Name": "averageCNO",
      "Value": "409",
      "Type": "unsignedint"
    },
    {
      "Name": "samples",
      "Value": "12",
      "Type": "unsignedint"
    },
    {
      "Name": "channelErrorRate",
      "Value": "2",
      "Type": "unsignedint"
    },
    {
      "Name": "uwErrorRate",
      "Value": "1",
      "Type": "unsignedint"
    }
  ]
};

function mtGetTxMetricsPayload(period) {
    if (typeof(period) === 'undefined' || (METRICS_PERIODS.indexOf(period) === -1)) {
        periodCode = 'SinceReset';
    }
    return {
        "Name":"txMetrics",
        "SIN":0,
        "MIN":100,
        "Fields":[
            {"Name":"period","Value":period,"Type":"enum"},
        ]
    };
};

var moModemTxMetricsPayload = {
    "Name":"txMetrics",
    "SIN":0,
    "MIN":100,
    "Fields":[
        {"Name":"period","Value":"SinceReset","Type":"enum"},
        {"Name":"packetTypeMask","Value":"3","Type":"unsignedint"},
        {
            "Name":"txMetrics",
            "Type":"array",
            "Elements":[
                {
                    "Index":0,
                    "Fields":[
                        {"Name":"PacketsTotal","Value":"5","Type":"unsignedint"},
                        {"Name":"PacketsSuccess","Value":"5","Type":"unsignedint"},
                        {"Name":"PacketsFailed","Value":"0","Type":"unsignedint"}
                    ]
                },{
                    "Index":1,
                    "Fields":[
                        {"Name":"PacketsTotal","Value":"2","Type":"unsignedint"},
                        {"Name":"PacketsSuccess","Value":"2","Type":"unsignedint"},
                        {"Name":"PacketsFailed","Value":"0","Type":"unsignedint"}
                    ]
                }
            ]
        }
    ]
};

var moModemPingReplyTimewrapPayload = {
    "SIN":0,
    "MIN":112,
    "Fields":[
        {"Name":"requestTime","Value":"65535","Type":"unsignedInt"},
        {"Name":"responseTime","Value":"30","Type":"unsignedInt"}
    ]
};

var moModemNetworkPingRequestPayload = {
    "SIN":0,
    "MIN":113,
    "Fields":[]
};

function mtRequestBroadcastIdsPayload() {
    return {
        Name: 'broadcastIDs',
        SIN: 0,
        MIN: 115,
        Fields: []
    };
};

var moBroadcastIds = {
    "Name":"broadcastIDs",
    "SIN":0,
    "MIN":115,
    "Fields":[
        {"Name":"broadcastIDs","Type":"array","Elements":[
            {"Index":0,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":1,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":2,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":3,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":4,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":5,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":6,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":7,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":8,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":9,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":10,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":11,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":12,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":13,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":14,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]},
            {"Index":15,"Fields":[{"Name":"id","Value":"0","Type":"unsignedint"}]}
        ]}
    ]
};

var modemSkywaveLockedPayload = {
    //"Name":"tbc"
    "SIN":15,
    "MIN":255,
    "Fields":[]
};

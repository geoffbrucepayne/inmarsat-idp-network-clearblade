
# ipm package: inmarsat-idp-network-clearblade

## Overview

A set of microservices and data stores for communicating with remote IoT devices using Inmarsat&#39;s [IsatData Pro](https://www.inmarsat.com/service/isatdata-pro/) global satellite service.  You may register with Inmarsat as a [developer](https://developer.inmarsat.com/technology/idp/).

This is an ipm package, which contains one or more reusable assets within the ipm Community. The 'package.json' in this repo is a ipm spec's package.json, [here](https://docs.clearblade.com/v/3/6-ipm/spec), which is a superset of npm's package.json spec, [here](https://docs.npmjs.com/files/package.json).

[Browse ipm Packages](https://ipm.clearblade.com)

## Setup

You need enter a Mailbox access_id and password *(supplied by your Inmarsat IDP service provider)* in the **idp_mailboxes** Collection.  You should also ensure timers are configured for the Code Services **idpGetReturnMessages** and **idpGetForwardStatuses**.

You may want to enable email notifications using the *Mailgun* settings, in addition to the MQTT topics used for notification of relevant events such as errors, or new terminals sending messages.

## Usage

The microservices regularly communicate with the Inmarsat network API to retreive new Mobile-Originated messages and allow submitting Mobile-Terminated messages.  Messages are transacted into a collection **idp_raw_messages**, with standard messages parsed to populate terminal metadata in the collection **idp_mobiles**.  API health monitoring and relevant housekeeping data are stored in the **idp_rest_api_calls** collection.

You can add custom message parsing libraries and call those by editing the **idpMoParser** code service.

## API

Standard ClearBlade APIs/SDK are supported to interface Collection data and Message topics to your application.

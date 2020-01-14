# netstatsCron

[![Build Status](https://travis-ci.org/ThatOneNeji/netstatsCron.svg?branch=master)](https://travis-ci.org/ThatOneNeji/netstatsCron)


<!--- [![Coverage Status](https://coveralls.io/repos/github/ThatOneNeji/netstatsCron/badge.svg?branch=master)](https://coveralls.io/github/ThatOneNeji/netstatsCron?branch=master)
-->

netstatsCron manages the cron for netstats group of applications

## Overview
This node application is one of the five main applications within the "netstats" collection of applications. While running it sends command requests to an AMQP instance which in turn is processed by **netstats<_protocol_>Poller**.

## Hierarchy of netstats applications
* netstatsCron - **This application**
* netstatsSNMPPoller - The poller application that actions the requests from netstatsCron for the SNMP protocol
* netstatsSSHPoller - The poller application that actions the requests from netstatsCron for the SSH protocol
* netstatsSNMPProcessor - The processing application that actions returned data from netstatsSNMPPoller
* netstatsMySQLLoader - Primary MySQL loader

## Getting started
* Create the required user in RabbitMQ:
  ```shell
  rabbitmqctl add_user netstatsCron netstatsCron
  ```
* Update the configuration in settings.json to reflect the correct IP address for your AMQP instance:
```json
    "amqp": {
        "server": "127.0.0.1",
        "user": "netstatsCron",
        "password": "netstatsCron",
        "queuename": "netstats/cron/"
    }
```
* Update nodes.json to indicate which nodes need to be polled and which services are to be used in doing so.

## Planned/In progress 
* Update the summary service so it is easier to add an additional summary services.
* Add "reload nodes.json" configuration service.
* In **netstatsDisplay** add a configuration page for the nodes, services and protocols.
  * Add some sort of function to pull that data from the DB and save it as a JSON file.


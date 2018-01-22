# netstatsNodeCron

[![Build Status](https://travis-ci.org/ThatOneNeji/netstatsNodeCron.svg?branch=master)](https://travis-ci.org/ThatOneNeji/netstatsNodeCron)

netstatsNodeCron manages the cron for netstats group of applications

## Overview
This node application is one of the five main applications within the "netstats" collection of applications. While running it sends command requests to an AMQP instance which in turn is processed by **netstatsNode<_protocol_>Poller**.

## Hierarchy of netstats applications
* netstatsNodeCron - **This application**
* netstatsNodeSNMPPoller - The poller application that actions the requests from netstatsNodeCron for the SNMP protocol
* netstatsNodeSSHPoller - The poller application that actions the requests from netstatsNodeCron for the SSH protocol
* netstatsNodeSNMPProcessor - The processing application that actions returned data from netstatsNodeSNMPPoller
* netstatsNodeMySQLLoader - Primary MySQL loader

## Getting started
* Create the required user in RabbitMQ:
  ```shell
  rabbitmqctl add_user netstatsNodeCron netstatsNodeCron
  ```
* Update the configuration in settings.json to reflect the correct IP address for your AMQP instance:
```json
    "amqp": {
        "server": "127.0.0.1",
        "user": "netstatsNodeCron",
        "password": "netstatsNodeCron",
        "queuename": "netstats/cron/"
    }
```
* Update nodes.json to indicate which nodes need to be polled and which services are to be used in doing so.

## Planned/In progress 
* Update the summary service so it is easier to add an additional summary services.
* Add "reload nodes.json" configuration service.
* In **netstatsDisplay** add a configuration page for the nodes, services and protocols.
  * Add some sort of function to pull that data from the DB and save it as a JSON file.


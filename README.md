# netstatsNodeCron
netstatsNodeCron manages the cron for netstats

## Overview
This node application is one of the 4 main applications within the "netstats" collection of applications. While running it sends command requests to an AMQP instance which in turn is processed by <strong>netstatsNodeSNMPPoller</strong>.

## Hierarchy of netstats applications
* netstatsNodeCron - This application
* netstatsNodeSNMPPoller - The poller application that actions the requests from netstatsNodeCron
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
* Add "type" to the services that are used to poll the nodes. (Thinking SNMP/SSH for future proofing)
* Add field to nodes.json to indicate which service use which intervals; 1min, 5min, 10min, 15min
   * Send that interval value with the request message to the message queue
* Add "reload nodes.json" configuration service.

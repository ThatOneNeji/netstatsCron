# netstatsNodeCronSNMP
netstatsNodeCronSNMP manages the cron for netstats

## Overview
This node application sends cron notifications to an AMQP queue that is then picked up by the worker threads on the other side

## Planned 
* Add better saummary calls to the configuration
* Move the nodes config into seperate file
* Reviewing adding functions to refresh the nodes config file between polling
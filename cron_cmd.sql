/* MySQL 5.7.10 or higher is required */

CREATE TABLE `tbl_base_cron_cmd`
(
   `rdate`         datetime NOT NULL COMMENT 'Row date',
   `stime`         datetime(3) NOT NULL COMMENT 'Start time',
   `rectime`       datetime(3) NOT NULL COMMENT 'Received time',
   `etime`         datetime(3) NOT NULL COMMENT 'End time',
   `area`          varchar(32) NOT NULL,
   `protocol`      varchar(16) NOT NULL,
   `name`          varchar(32) NOT NULL,
   `minterval`     int(3) NOT NULL,
   `parameters`    varchar(32) DEFAULT NULL,
   `mgroup`        varchar(32) DEFAULT NULL,
   `target`        varchar(32) DEFAULT NULL,
   `address`       varchar(32) DEFAULT NULL,
   `status`        varchar(32) DEFAULT NULL,
   `caid`          varchar(64) NOT NULL,
   `processed`     varchar(1) DEFAULT 'n',
   `ldate`         datetime DEFAULT CURRENT_TIMESTAMP COMMENT 'Load date',
   PRIMARY KEY(`rdate`, `caid`),
   KEY `rdate_protocol_idx` (`rdate`, `protocol`),
   KEY `ldate_processed_idx` (`ldate`, `processed`)
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8;

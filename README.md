# signalk-data-logger

A Signal K Node server plugin for logging all Signal K deltas
to flat files. The file rotation interval can be configured
and the old files are compressed to save space.

## Installation

Should be eventually available on the Signal K Appstore.

## Configuration

You need to provide a directory for writing the log files.
Make sure the Node server process has permissions to write to
the defined directory!

Log rotation interval defines how often the destination file
is changed. Old files are automatically compressed with Gzip. SK deltas are _very_ repetitive, so the compressed files are only
3.5% of the original file size. If you prefer not to rotate
the logs, define an interval of 0.

Subcribes can be configured by path and period, which along with a context (e.g. vessels.self) can define a detailed 
subscription. This gives some control over what is logged, and how frequently.
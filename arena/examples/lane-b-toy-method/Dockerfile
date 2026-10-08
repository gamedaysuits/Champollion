# Lane B toy method — the smallest bundle that passes the organizer node's
# static checks and builds under --network=none. The base image already
# carries the interpreter; nothing is added to it, so the build has nothing
# to fetch. Only /method is copied in; the node mounts it read-only at run.
FROM python:3.12-slim
COPY method /method

# osm-import: one-shot job that loads named streets into osm.streets (KAN-56).
# Debian 13 ships osm2pgsql 2.x and osmium-tool; Debian 12's osm2pgsql 1.8 is older than we need.
FROM debian:trixie-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends osm2pgsql osmium-tool postgresql-client curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY streets.lua import.sh /osm/
RUN useradd --create-home --uid 1000 osm && mkdir /data && chown osm /data
USER osm
VOLUME /data
CMD ["/osm/import.sh"]

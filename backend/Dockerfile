FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

# install basics
RUN apt-get update && apt-get install -y \
    wget python3 python3-pip git xvfb

# Install Blender (example downloading blender tar)
RUN wget https://download.blender.org/release/Blender3.6/blender-3.6.0-linux-x64.tar.xz \
 && tar -xf blender-3.6.0-linux-x64.tar.xz -C /opt \
 && ln -s /opt/blender-3.6.0-linux-x64/blender /usr/local/bin/blender

# Install RDKit (for chemistry checks) - use conda in production; simplified here
# Install ChemBlender and blender-mcp
WORKDIR /opt
RUN git clone https://github.com/markahix/ChemBlender.git chemblender
RUN git clone https://github.com/ahujasid/blender-mcp.git blender-mcp

# copy entrypoint scripts that run blender headless on incoming scripts
COPY run_blender_worker.sh /usr/local/bin/run_blender_worker.sh
RUN chmod +x /usr/local/bin/run_blender_worker.sh

CMD ["/usr/local/bin/run_blender_worker.sh"]

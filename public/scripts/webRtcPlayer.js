window.webRtcPlayer = class {
  constructor(parOptions = {}) {
    this.cfg = parOptions.peerConnectionOptions || {};
    this.cfg.sdpSemantics = "unified-plan";

    this.pcClient = null; // RTCPeerConnection
    this.dcClient = null; // RTCDataChannel

    this.sdpConstraints = {
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 1,
    };

    this.aggregatedStats = {};

    // See https://www.w3.org/TR/webrtc/#dom-rtcdatachannelinit for values
    this.dataChannelOptions = { ordered: true };

    //Create Video element and expose that as a parameter
    this.video = document.createElement("video");
    this.video.id = "streamingVideo";
    this.video.playsInline = true;
  }

  // callbacks: defined outside
  onWebRtcOffer() {}
  onWebRtcCandidate() {}
  onAggregatedStats() {}
  onDataChannelMessage() {}
  onDataChannelConnected() {}

  // Private Functions with "_" prefixed

  _setupDataChannel(pc, label, options) {
    const self = this;

    try {
      var datachannel = pc.createDataChannel(label, options);
      console.log(`Created datachannel (${label})`);

      datachannel.onopen = function (e) {
        console.log(`data channel (${label}) connect`);
        self.onDataChannelConnected();
      };

      datachannel.onclose = function (e) {
        console.log(`data channel (${label}) closed`);
      };

      datachannel.onmessage = function (e) {
        console.log(`Got message (${label})`, e.data);
        self.onDataChannelMessage(e.data);
      };

      return datachannel;
    } catch (e) {
      console.warn("No data channel", e);
      return null;
    }
  }

  async _handleCreateOffer(pc) {
    const offer = await pc.createOffer(this.sdpConstraints);

    pc.setLocalDescription(offer);
    // (andriy): increase start bitrate from 300 kbps to 20 mbps and max bitrate from 2.5 mbps to 100 mbps
    // (100 mbps means we don't restrict encoder at all)
    // after we `setLocalDescription` because other browsers are not c happy to see google-specific config
    offer.sdp = offer.sdp.replace(
      /(a=fmtp:\d+ .*level-asymmetry-allowed=.*)\r\n/gm,
      "$1;x-google-start-bitrate=10000;x-google-max-bitrate=20000\r\n"
    );
    this.onWebRtcOffer(offer);
  }

  _setupPeerConnection(pc) {
    const self = this;

    if (pc.SetBitrate)
      console.log("Hurray! there's RTCPeerConnection.SetBitrate function");

    //Setup peerConnection events
    pc.onsignalingstatechange = (state) =>
      console.info("signaling state change:", state);
    pc.oniceconnectionstatechange = (state) =>
      console.info("ice connection state change:", state);

    pc.onicegatheringstatechange = (state) =>
      console.info("ice gathering state change:", state);
    pc.ontrack = (e) => {
      console.log("handleOnTrack", e.streams);
      self.video.srcObject = e.streams[0];
    };
    pc.onicecandidate = (e) => {
      console.log("ICE candidate", e);
      if (e.candidate && e.candidate.candidate) {
        self.onWebRtcCandidate(e.candidate);
      }
    };
  }

  _generateAggregatedStatsFunction(stats) {
    const self = this;

    let newStat = {};

    stats.forEach((stat) => {
      //                    console.log(JSON.stringify(stat, undefined, 4));
      if (
        stat.type == "inbound-rtp" &&
        !stat.isRemote &&
        (stat.mediaType == "video" || stat.id.toLowerCase().includes("video"))
      ) {
        Object.assign(newStat, stat);

        newStat.bytesReceivedStart =
          self.aggregatedStats.bytesReceivedStart || stat.bytesReceived;
        newStat.framesDecodedStart =
          self.aggregatedStats.framesDecodedStart || stat.framesDecoded;
        newStat.timestampStart =
          self.aggregatedStats.timestampStart || stat.timestamp;

        if (self.aggregatedStats.timestamp) {
          if (self.aggregatedStats.bytesReceived) {
            // bitrate = bits received since last time / number of ms since last time
            //This is automatically in kbits (where k=1000) since time is in ms and stat we want is in seconds (so a '* 1000' then a '/ 1000' would negate each other)
            newStat.bitrate =
              (8 *
                (newStat.bytesReceived - self.aggregatedStats.bytesReceived)) /
              (newStat.timestamp - self.aggregatedStats.timestamp);
            newStat.bitrate = Math.floor(newStat.bitrate);
            newStat.lowBitrate = Math.min(
              self.aggregatedStats.lowBitrate || Infinity,
              newStat.bitrate
            );
            newStat.highBitrate = Math.max(
              self.aggregatedStats.highBitrate || -Infinity,
              newStat.bitrate
            );
          }

          if (self.aggregatedStats.bytesReceivedStart) {
            newStat.avgBitrate =
              (8 *
                (newStat.bytesReceived -
                  self.aggregatedStats.bytesReceivedStart)) /
              (newStat.timestamp - self.aggregatedStats.timestampStart);
            newStat.avgBitrate = Math.floor(newStat.avgBitrate);
          }

          if (self.aggregatedStats.framesDecoded) {
            // framerate = frames decoded since last time / number of seconds since last time
            newStat.framerate =
              (newStat.framesDecoded - self.aggregatedStats.framesDecoded) /
              ((newStat.timestamp - self.aggregatedStats.timestamp) / 1000);
            newStat.framerate = Math.floor(newStat.framerate);
            newStat.lowFramerate = Math.min(
              self.aggregatedStats.lowFramerate || Infinity,
              newStat.framerate
            );
            newStat.highFramerate = Math.max(
              self.aggregatedStats.highFramerate || -Infinity,
              newStat.framerate
            );
          }

          if (self.aggregatedStats.framesDecodedStart) {
            newStat.avgframerate =
              (newStat.framesDecoded -
                self.aggregatedStats.framesDecodedStart) /
              ((newStat.timestamp - self.aggregatedStats.timestampStart) /
                1000);
            newStat.avgframerate = Math.floor(newStat.avgframerate);
          }
        }
      }

      //Read video track stats
      if (
        stat.type == "track" &&
        (stat.trackIdentifier == "video_label" || stat.kind == "video")
      ) {
        Object.assign(newStat, stat);

        newStat.framesDroppedPercentage =
          (stat.framesDropped / stat.framesReceived) * 100;
      }

      if (
        stat.type == "candidate-pair" 
        && stat.hasOwnProperty("currentRoundTripTime") 
        // && stat.currentRoundTripTime != 0
      ) {
        newStat.currentRoundTripTime = stat.currentRoundTripTime;
        console.log(1111,newStat.currentRoundTripTime)
      }
    });

    self.aggregatedStats = newStat;

    self.onAggregatedStats(newStat);
  }

  //This is called when revceiving new ice candidates individually instead of part of the offer
  //This is currently not used but would be called externally from this class
  async handleCandidateFromServer(iceCandidate) {
    let candidate = new RTCIceCandidate(iceCandidate);
    await this.pcClient.addIceCandidate(candidate);
    console.log("ICE candidate successfully added", iceCandidate);
  }

  //Called externaly to create an offer for the server
  createOffer() {
    if (this.pcClient) {
      console.log("Closing existing PeerConnection");
      this.pcClient.close();
      this.pcClient = null;
    }
    this.pcClient = new RTCPeerConnection(this.cfg);
    this._setupPeerConnection(this.pcClient);
    this.dcClient = this._setupDataChannel(
      this.pcClient,
      "金恒昱",
      this.dataChannelOptions
    );
    this._handleCreateOffer(this.pcClient);
  }

  //Called externaly when an answer is received from the server
  receiveAnswer(answer) {
    console.log(`Received answer:\n${answer}`);
    var answerDesc = new RTCSessionDescription(answer);
    this.pcClient.setRemoteDescription(answerDesc);
  }

  close() {
    if (this.pcClient) {
      console.log("Closing existing peerClient");
      this.pcClient.close();
      this.pcClient = null;
    }
    clearInterval(this.aggregateStatsIntervalId);
  }

  //Sends data across the datachannel
  send(data) {
    if (this.dcClient && this.dcClient.readyState == "open") {
      this.dcClient.send(data);
    }
  }

  aggregateStats(checkInterval) {
    if (!this.pcClient) return;
    const self = this;

    let printAggregatedStats = () => {
      self.pcClient.getStats(null).then((stats) => {
        this._generateAggregatedStatsFunction(stats);
      });
    };
    this.aggregateStatsIntervalId = setInterval(
      printAggregatedStats,
      checkInterval
    );
  }
};

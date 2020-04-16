﻿
// helps us filter out data channel messages that don't belong to us
const LOZYA_FINGERPRINT = "lozya",
    eventNames = ["moveTo", "emote", "userInitRequest", "userInitResponse", "audioMuteStatusChanged", "videoMuteStatusChanged"];

// Manages communication between Jitsi Meet and Lozya
export class JitsiClient extends EventTarget {

    setJitsiApi(api) {
        this.api = api;
        this.api.addEventListener("endpointTextMessageReceived",
            this.rxGameData.bind(this));

        this.iframe = api.getIFrame();
        this.iframe.addEventListener("message", this.rxJitsiHax.bind(this));
    }

    /// Send a Lozya message through the Jitsi Meet data channel.
    txGameData(id, command, obj) {
        obj = obj || {};
        obj.hax = LOZYA_FINGERPRINT;
        obj.command = command;
        this.api.executeCommand("sendEndpointTextMessage", id, JSON.stringify(obj));
    }

    /// A listener to add to JitsiExternalAPI::endpointTextMessageReceived event
    /// to receive Lozya messages from the Jitsi Meet data channel.
    rxGameData(evt) {
        // JitsiExternalAPI::endpointTextMessageReceived event arguments format: 
        // evt = {
        //    data: {
        //      senderInfo: {
        //        jid: "string", // the jid of the sender
        //        id: "string" // the participant id of the sender
        //      },
        //      eventData: {
        //        name: "string", // the name of the datachannel event: `endpoint-text-message`
        //        text: "string" // the received text from the sender
        //      }
        //   }
        //};
        const data = JSON.parse(evt.data.eventData.text);
        if (data.hax === LOZYA_FINGERPRINT) {
            const evt2 = new JitsiClientEvent(evt.data.senderInfo.id, data);
            this.dispatchEvent(evt2);
        }
    }

    /// Send a Lozya message to the jitsihax.js script
    txJitsiHax(command, obj) {
        if (this.iframe) {
            obj.hax = LOZYA_FINGERPRINT;
            obj.command = command;
            this.iframe.contentWindow.postMessage(JSON.stringify(obj), "https://" + JITSI_HOST);
        }
    }

    rxJitsiHax(evt) {
        const isLocalHost = evt.origin.match(/^https?:\/\/localhost\b/);
        if (evt.origin === JITSI_HOST || isLocalHost) {
            try {
                const data = JSON.parse(evt.data);
                if (data.hax === LOZYA_FINGERPRINT) {
                    const evt2 = new LozyaEvent(data);
                    this.dispatchEvent(evt2);
                }
            }
            catch (exp) {
                console.error(exp);
            }
        }
    }

    toggleAudio() {
        this.api.executeCommand("toggleAudio");
    }

    toggleVideo() {
        this.api.executeCommand("toggleVideo");
    }

    setAvatarURL(url) {
        this.api.executeCommand("avatarUrl", url);
    }

    isAudioMuted() {
        return this.api.isAudioMuted();
    }

    isVideoMuted() {
        return this.api.isVideoMuted();
    }

    /// Add a listener for Lozya events that come through the Jitsi Meet data channel.
    addEventListener(evtName, callback) {
        if (eventNames.indexOf[evtName] === -1) {
            throw new Error(`Unsupported event type: ${evtName}`);
        }

        super.addEventListener(evtName, callback);
    }

    setAudioProperties(minDistance, maxDistance, transitionTime, useBasicAudio, use3dAudio) {
        this.txJitsiHax("setAudioProperties", {
            minDistance,
            maxDistance,
            transitionTime,
            useBasicAudio,
            use3dAudio
        });
    }

    requestUserState(ofUserID) {
        this.txGameData(ofUserID, "userInitRequest");
    }

    sendUserState(toUserID, fromUser) {
        this.txGameData(toUserID, "userInitResponse", fromUser);
    }

    sendEmote(toUserID, emoji) {
        this.txGameData(toUserID, "emote", emoji);
    }

    sendAudioMuteState(toUserID, muted) {
        this.txGameData(toUserID, "audioMuteStatusChanged", { muted });
    }

    sendVideoMuteState(toUserID, muted) {
        this.txGameData(toUserID, "videoMuteStatusChanged", { muted });
    }

    setVolume(evt) {
        this.txJitsiHax("setVolume", evt);
    }

    sendPosition(toUserID, evt) {
        this.txGameData(toUserID, "moveTo", evt);
    }
}

class LozyaEvent extends Event {
    constructor(data) {
        super(data.command);
        this.data = data;
    }
}

class JitsiClientEvent extends LozyaEvent {
    constructor(participantID, data) {
        super(data);
        this.participantID = participantID;
    }
}